import { getClient } from '../db';

/**
 * KPI Calculation Jobs
 * 
 * Tier 1 KPIs (Phase 3-4):
 * - PR Cycle Time (Phase 3)
 * - Change Failure Rate (Phase 4)
 * - MTTR (Phase 4)
 * 
 * Tier 2 KPIs (Phase 5):
 * - AI-Assisted Development Rate
 * - AI Velocity Gain
 * - Review Efficiency
 * 
 * Tier 3 KPIs (Phase 6):
 * - Throughput (enhanced)
 * - Sprint Predictability
 * - WIP
 * - Flow Efficiency
 * 
 * Tier 4 KPIs (Phase 7):
 * - Bug Escape Rate
 * - Rework Rate
 * - Code Churn
 */

// ============================================================================
// PHASE 3: PR Cycle Time and Sub-Metrics
// ============================================================================

export const computePRCycleTimeMetrics = async (tenantId: string, date: string) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Calculate PR cycle time metrics for PRs merged on the given date
    const prMetricsRes = await client.query(
      `SELECT 
         pr.id AS pr_id,
         pr.pr_number,
         pr.repo_name,
         pr.created_at,
         pr.merged_at,
         EXTRACT(EPOCH FROM (pr.merged_at - pr.created_at))/3600 AS cycle_time_hours,
         -- Time to first review
         MIN(pr_reviews.submitted_at) AS first_review_at,
         EXTRACT(EPOCH FROM (MIN(pr_reviews.submitted_at) - pr.created_at))/3600 AS time_to_first_review_hours,
         -- Time in review (first review to last approval)
         MAX(CASE WHEN pr_reviews.state = 'APPROVED' THEN pr_reviews.submitted_at END) AS last_approval_at,
         -- Count review rounds
         COUNT(DISTINCT pr_reviews.submitted_at) AS review_rounds,
         COUNT(pr_reviews.id) AS total_reviews
       FROM pull_requests pr
       LEFT JOIN pr_reviews ON pr_reviews.pull_request_id = pr.id
       WHERE pr.tenant_id = $1 
         AND pr.merged_at::date = $2::date 
         AND pr.merged_at IS NOT NULL
       GROUP BY pr.id, pr.pr_number, pr.repo_name, pr.created_at, pr.merged_at`,
      [tenantId, date]
    );

    // Insert or update pr_metrics
    for (const row of prMetricsRes.rows) {
      const reviewTimeHours = row.last_approval_at 
        ? (new Date(row.last_approval_at).getTime() - new Date(row.first_review_at).getTime()) / 3600000
        : null;
      
      const mergeWaitHours = row.last_approval_at
        ? (new Date(row.merged_at).getTime() - new Date(row.last_approval_at).getTime()) / 3600000
        : null;

      await client.query(
        `INSERT INTO pr_metrics (tenant_id, pull_request_id, pr_cycle_time_hours, time_to_first_review_hours, review_time_hours, merge_wait_time_hours, review_rounds, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         ON CONFLICT (tenant_id, pull_request_id) DO UPDATE SET
           pr_cycle_time_hours = $3,
           time_to_first_review_hours = $4,
           review_time_hours = $5,
           merge_wait_time_hours = $6,
           review_rounds = $7`,
        [tenantId, row.pr_id, row.cycle_time_hours, row.time_to_first_review_hours, reviewTimeHours, mergeWaitHours, row.review_rounds]
      );
    }

    // Calculate daily aggregates
    const dailyAggRes = await client.query(
      `SELECT 
         AVG(pr_cycle_time_hours) AS avg_cycle_time,
         PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY pr_cycle_time_hours) AS p50_cycle_time,
         PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY pr_cycle_time_hours) AS p90_cycle_time,
         AVG(time_to_first_review_hours) AS avg_time_to_review,
         AVG(review_time_hours) AS avg_review_time,
         AVG(merge_wait_time_hours) AS avg_merge_wait,
         AVG(review_rounds) AS avg_review_rounds,
         COUNT(*)::int AS pr_count
       FROM pr_metrics
       WHERE tenant_id = $1 AND created_at::date = $2::date`,
      [tenantId, date]
    );

    const agg = dailyAggRes.rows[0];

    // Store snapshots
    if (agg.avg_cycle_time) {
      await client.query(
        `INSERT INTO metric_snapshots (tenant_id, snapshot_date, metric_type, period, value, metadata)
         VALUES ($1, $2, 'pr_cycle_time_avg_hours', 'daily', $3, $4)
         ON CONFLICT DO NOTHING`,
        [tenantId, date, agg.avg_cycle_time, { source: 'calculated' }]
      );
    }

    if (agg.p50_cycle_time) {
      await client.query(
        `INSERT INTO metric_snapshots (tenant_id, snapshot_date, metric_type, period, value, metadata)
         VALUES ($1, $2, 'pr_cycle_time_p50_hours', 'daily', $3, $4)
         ON CONFLICT DO NOTHING`,
        [tenantId, date, agg.p50_cycle_time, { source: 'calculated' }]
      );
    }

    if (agg.p90_cycle_time) {
      await client.query(
        `INSERT INTO metric_snapshots (tenant_id, snapshot_date, metric_type, period, value, metadata)
         VALUES ($1, $2, 'pr_cycle_time_p90_hours', 'daily', $3, $4)
         ON CONFLICT DO NOTHING`,
        [tenantId, date, agg.p90_cycle_time, { source: 'calculated' }]
      );
    }

    await client.query('COMMIT');
    return { tenantId, date, prCount: agg.pr_count, avgCycleTime: agg.avg_cycle_time };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('computePRCycleTimeMetrics error', err);
    throw err;
  } finally {
    client.release();
  }
};

// ============================================================================
// PHASE 4: Change Failure Rate & MTTR
// ============================================================================

export const computeChangeFailureRate = async (tenantId: string, date: string) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Count total deployments for the date
    const totalDeploysRes = await client.query(
      `SELECT COUNT(*)::int AS total_count
       FROM deployments
       WHERE tenant_id = $1 AND deployed_at::date = $2::date AND deployed_at IS NOT NULL`,
      [tenantId, date]
    );
    const totalDeployments = totalDeploysRes.rows[0]?.total_count ?? 0;

    // Count failed deployments:
    // 1. Deployments with failed status
    // 2. Deployments with incidents within 24-72 hours
    // 3. Reverted deployments
    const failedDeploysRes = await client.query(
      `SELECT COUNT(DISTINCT d.id)::int AS failed_count
       FROM deployments d
       LEFT JOIN deployment_statuses ds ON d.id = ds.deployment_id AND ds.status = 'failure'
       LEFT JOIN incident_deployments id ON d.id = id.deployment_id
       WHERE d.tenant_id = $1 
         AND d.deployed_at::date = $2::date 
         AND d.deployed_at IS NOT NULL
         AND (ds.id IS NOT NULL OR id.id IS NOT NULL)`,
      [tenantId, date]
    );
    const failedDeployments = failedDeploysRes.rows[0]?.failed_count ?? 0;

    // Calculate failure rate
    const changeFailureRate = totalDeployments > 0 
      ? (failedDeployments / totalDeployments) * 100 
      : 0;

    // Store snapshot
    await client.query(
      `INSERT INTO deployment_failure_metrics (tenant_id, snapshot_date, total_deployments, failed_deployments, change_failure_rate, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (tenant_id, snapshot_date) DO UPDATE SET
         total_deployments = $3,
         failed_deployments = $4,
         change_failure_rate = $5`,
      [tenantId, date, totalDeployments, failedDeployments, changeFailureRate]
    );

    await client.query('COMMIT');
    return { tenantId, date, totalDeployments, failedDeployments, changeFailureRate };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('computeChangeFailureRate error', err);
    throw err;
  } finally {
    client.release();
  }
};

export const computeMTTR = async (tenantId: string, date: string) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Calculate MTTR for incidents created on the given date
    const mttrRes = await client.query(
      `SELECT 
         i.id,
         i.severity,
         EXTRACT(EPOCH FROM (i.resolved_at - i.created_at))/3600 AS mttr_hours
       FROM incidents i
       WHERE i.tenant_id = $1 
         AND i.created_at::date = $2::date
         AND i.resolved_at IS NOT NULL`,
      [tenantId, date]
    );

    // Insert MTTR records
    for (const row of mttrRes.rows) {
      await client.query(
        `INSERT INTO mttr_metrics (tenant_id, incident_id, mttr_hours, severity, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [tenantId, row.id, row.mttr_hours, row.severity]
      );
    }

    // Calculate daily aggregates
    const avgRes = await client.query(
      `SELECT 
         AVG(mttr_hours) AS avg_mttr,
         PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY mttr_hours) AS p50_mttr,
         PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY mttr_hours) AS p90_mttr,
         COUNT(*)::int AS incident_count
       FROM mttr_metrics
       WHERE tenant_id = $1 AND created_at::date = $2::date`,
      [tenantId, date]
    );

    const agg = avgRes.rows[0];

    if (agg.avg_mttr) {
      await client.query(
        `INSERT INTO metric_snapshots (tenant_id, snapshot_date, metric_type, period, value, metadata)
         VALUES ($1, $2, 'mttr_avg_hours', 'daily', $3, $4)
         ON CONFLICT DO NOTHING`,
        [tenantId, date, agg.avg_mttr, { source: 'calculated' }]
      );
    }

    await client.query('COMMIT');
    return { tenantId, date, avgMTTR: agg.avg_mttr, incidentCount: agg.incident_count };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('computeMTTR error', err);
    throw err;
  } finally {
    client.release();
  }
};

// ============================================================================
// PHASE 5: AI Effectiveness Metrics
// ============================================================================

export const computeAIAssistedDevRate = async (tenantId: string, date: string) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Count PRs merged on the date
    const totalPRsRes = await client.query(
      `SELECT COUNT(*)::int AS total_prs
       FROM pull_requests
       WHERE tenant_id = $1 AND merged_at::date = $2::date AND merged_at IS NOT NULL`,
      [tenantId, date]
    );
    const totalPRs = totalPRsRes.rows[0]?.total_prs ?? 0;

    // Count AI-assisted PRs (those with AI signals)
    const aiPRsRes = await client.query(
      `SELECT COUNT(DISTINCT ai_signals.pull_request_id)::int AS ai_prs
       FROM ai_signals
       JOIN pull_requests pr ON pr.id = ai_signals.pull_request_id
       WHERE ai_signals.tenant_id = $1 
         AND pr.merged_at::date = $2::date 
         AND pr.merged_at IS NOT NULL`,
      [tenantId, date]
    );
    const aiPRs = aiPRsRes.rows[0]?.ai_prs ?? 0;

    // Calculate rate
    const aiRate = totalPRs > 0 ? (aiPRs / totalPRs) * 100 : 0;

    // Calculate avg cycle time for AI vs non-AI PRs
    const cycleTimesRes = await client.query(
      `SELECT 
         CASE WHEN ai_prs.pr_id IS NOT NULL THEN 'ai' ELSE 'non_ai' END AS pr_type,
         AVG(pm.pr_cycle_time_hours) AS avg_cycle_time,
         COUNT(*)::int AS count
       FROM pr_metrics pm
       JOIN pull_requests pr ON pm.pull_request_id = pr.id
       LEFT JOIN (
         SELECT DISTINCT pull_request_id AS pr_id FROM ai_signals WHERE tenant_id = $1
       ) ai_prs ON pr.id = ai_prs.pr_id
       WHERE pm.tenant_id = $1 AND pm.created_at::date = $2::date
       GROUP BY pr_type`,
      [tenantId, date]
    );

    let aiCycleTime = null;
    let nonAICycleTime = null;
    for (const row of cycleTimesRes.rows) {
      if (row.pr_type === 'ai') aiCycleTime = row.avg_cycle_time;
      if (row.pr_type === 'non_ai') nonAICycleTime = row.avg_cycle_time;
    }

    // Store snapshot
    await client.query(
      `INSERT INTO ai_effectiveness_metrics (tenant_id, snapshot_date, ai_assisted_pr_count, total_pr_count, ai_assisted_rate, ai_assisted_pr_avg_cycle_time_hours, non_ai_pr_avg_cycle_time_hours, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [tenantId, date, aiPRs, totalPRs, aiRate, aiCycleTime, nonAICycleTime]
    );

    await client.query('COMMIT');
    return { tenantId, date, totalPRs, aiPRs, aiRate, aiCycleTime, nonAICycleTime };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('computeAIAssistedDevRate error', err);
    throw err;
  } finally {
    client.release();
  }
};

export const computeReviewEfficiency = async (tenantId: string, date: string) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Get all PRs merged on the date and their review metrics
    const reviewMetricsRes = await client.query(
      `SELECT 
         pr.id,
         pr.pr_number,
         MIN(pr_reviews.submitted_at) AS first_review_at,
         MAX(CASE WHEN pr_reviews.state = 'APPROVED' THEN pr_reviews.submitted_at END) AS approval_at,
         EXTRACT(EPOCH FROM (MIN(pr_reviews.submitted_at) - pr.created_at))/3600 AS time_to_first_review,
         COUNT(DISTINCT pr_reviews.reviewer) AS review_rounds,
         CASE WHEN ai_signals.id IS NOT NULL THEN true ELSE false END AS is_ai_assisted
       FROM pull_requests pr
       LEFT JOIN pr_reviews ON pr_reviews.pull_request_id = pr.id
       LEFT JOIN ai_signals ON ai_signals.pull_request_id = pr.id AND ai_signals.source_type = 'pr_description'
       WHERE pr.tenant_id = $1 
         AND pr.merged_at::date = $2::date 
         AND pr.merged_at IS NOT NULL
       GROUP BY pr.id, pr.pr_number, pr.created_at, ai_signals.id`,
      [tenantId, date]
    );

    // Insert review efficiency records
    for (const row of reviewMetricsRes.rows) {
      const approvalTime = row.approval_at 
        ? (new Date(row.approval_at).getTime() - new Date(row.first_review_at).getTime()) / 3600000
        : null;

      await client.query(
        `INSERT INTO review_efficiency_metrics (tenant_id, pull_request_id, first_review_requested_at, first_review_submitted_at, approval_at, time_to_first_response_hours, time_to_approval_hours, review_rounds, is_ai_assisted, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
        [tenantId, row.id, row.first_review_at, row.first_review_at, row.approval_at, row.time_to_first_review, approvalTime, row.review_rounds, row.is_ai_assisted]
      );
    }

    // Calculate daily aggregates
    const avgRes = await client.query(
      `SELECT 
         AVG(time_to_first_response_hours) AS avg_time_to_response,
         AVG(time_to_approval_hours) AS avg_time_to_approval,
         AVG(review_rounds) AS avg_review_rounds
       FROM review_efficiency_metrics
       WHERE tenant_id = $1 AND created_at::date = $2::date`,
      [tenantId, date]
    );

    const agg = avgRes.rows[0];

    await client.query('COMMIT');
    return { tenantId, date, avgTimeToResponse: agg.avg_time_to_response, avgTimeToApproval: agg.avg_time_to_approval };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('computeReviewEfficiency error', err);
    throw err;
  } finally {
    client.release();
  }
};

// ============================================================================
// PHASE 5: AI Velocity Gain
// ============================================================================

export const computeAIVelocityGain = async (tenantId: string, periodDays: number = 30) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Get AI adoption date
    const adoptionRes = await client.query(
      `SELECT adoption_date FROM ai_adoption_dates WHERE tenant_id = $1 ORDER BY adoption_date DESC LIMIT 1`,
      [tenantId]
    );

    if (adoptionRes.rows.length === 0) {
      console.warn('No AI adoption date found for tenant', tenantId);
      return null;
    }

    const adoptionDate = adoptionRes.rows[0].adoption_date;
    const preStartDate = new Date(adoptionDate);
    preStartDate.setDate(preStartDate.getDate() - periodDays);

    const postEndDate = new Date(adoptionDate);
    postEndDate.setDate(postEndDate.getDate() + periodDays);

    // Calculate pre-adoption metrics
    const preMetricsRes = await client.query(
      `SELECT 
         AVG(value) AS avg_lead_time
       FROM metric_snapshots
       WHERE tenant_id = $1 
         AND metric_type = 'lead_time_avg_hours'
         AND snapshot_date >= $2::date
         AND snapshot_date < $3::date`,
      [tenantId, preStartDate.toISOString().split('T')[0], adoptionDate]
    );

    const preLeadTime = preMetricsRes.rows[0]?.avg_lead_time || 0;

    // Calculate post-adoption metrics
    const postMetricsRes = await client.query(
      `SELECT 
         AVG(value) AS avg_lead_time
       FROM metric_snapshots
       WHERE tenant_id = $1 
         AND metric_type = 'lead_time_avg_hours'
         AND snapshot_date >= $3::date
         AND snapshot_date < $4::date`,
      [tenantId, adoptionDate, adoptionDate, postEndDate.toISOString().split('T')[0]]
    );

    const postLeadTime = postMetricsRes.rows[0]?.avg_lead_time || 0;

    // Calculate improvement
    const improvement = preLeadTime > 0 
      ? ((postLeadTime - preLeadTime) / preLeadTime) * 100
      : 0;

    // Store comparison
    await client.query(
      `INSERT INTO ai_velocity_comparisons (tenant_id, snapshot_date, period_days, pre_adoption_date, post_adoption_date, lead_time_improvement_percent, overall_velocity_gain_percent, created_at)
       VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, NOW())`,
      [tenantId, periodDays, preStartDate.toISOString().split('T')[0], adoptionDate, improvement, improvement]
    );

    await client.query('COMMIT');
    return { tenantId, periodDays, preLeadTime, postLeadTime, improvementPercent: improvement };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('computeAIVelocityGain error', err);
    throw err;
  } finally {
    client.release();
  }
};

// ============================================================================
// PHASE 6: Delivery & Flow Metrics
// ============================================================================

export const computeThroughputMetrics = async (tenantId: string, date: string) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Count completed tickets
    const ticketsRes = await client.query(
      `SELECT COUNT(*)::int AS completed_tickets, COUNT(DISTINCT assignee)::int AS team_size
       FROM work_items
       WHERE tenant_id = $1 AND completed_at::date = $2::date AND completed_at IS NOT NULL`,
      [tenantId, date]
    );

    const completedTickets = ticketsRes.rows[0]?.completed_tickets ?? 0;
    const teamSize = ticketsRes.rows[0]?.team_size ?? 1;

    // Count merged PRs
    const prsRes = await client.query(
      `SELECT COUNT(*)::int AS merged_prs
       FROM pull_requests
       WHERE tenant_id = $1 AND merged_at::date = $2::date AND merged_at IS NOT NULL`,
      [tenantId, date]
    );

    const mergedPRs = prsRes.rows[0]?.merged_prs ?? 0;

    // Store throughput metric
    await client.query(
      `INSERT INTO throughput_metrics (tenant_id, snapshot_date, period_type, completed_tickets, merged_prs, team_size, throughput_per_developer, created_at)
       VALUES ($1, $2, 'daily', $3, $4, $5, $6, NOW())`,
      [tenantId, date, completedTickets, mergedPRs, teamSize, teamSize > 0 ? completedTickets / teamSize : 0]
    );

    await client.query('COMMIT');
    return { tenantId, date, completedTickets, mergedPRs, teamSize };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('computeThroughputMetrics error', err);
    throw err;
  } finally {
    client.release();
  }
};

export const computeWIPMetrics = async (tenantId: string, date: string) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Count items currently in progress as of the given date
    const wipRes = await client.query(
      `SELECT COUNT(*)::int AS total_in_progress, COUNT(DISTINCT assignee)::int AS team_size
       FROM work_items
       WHERE tenant_id = $1 
         AND created_at::date <= $2::date
         AND (completed_at IS NULL OR completed_at::date >= $2::date)
         AND status = 'in_progress'`,
      [tenantId, date]
    );

    const totalWIP = wipRes.rows[0]?.total_in_progress ?? 0;
    const teamSize = wipRes.rows[0]?.team_size ?? 1;

    // Store WIP metric
    await client.query(
      `INSERT INTO wip_metrics (tenant_id, snapshot_date, total_in_progress, in_progress_per_developer, team_size, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [tenantId, date, totalWIP, teamSize > 0 ? totalWIP / teamSize : 0, teamSize]
    );

    await client.query('COMMIT');
    return { tenantId, date, totalWIP, inProgressPerDev: teamSize > 0 ? totalWIP / teamSize : 0 };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('computeWIPMetrics error', err);
    throw err;
  } finally {
    client.release();
  }
};

// ============================================================================
// PHASE 7: Quality Metrics
// ============================================================================

export const computeCodeChurnMetrics = async (tenantId: string, date: string) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Get PRs merged on the date
    const prsRes = await client.query(
      `SELECT id, merged_at FROM pull_requests
       WHERE tenant_id = $1 AND merged_at::date = $2::date AND merged_at IS NOT NULL`,
      [tenantId, date]
    );

    for (const pr of prsRes.rows) {
      // Look for follow-up commits/PRs within 24 hours
      const followUpRes = await client.query(
        `SELECT COUNT(*)::int AS follow_up_count
         FROM pull_requests follow_up
         WHERE follow_up.tenant_id = $1 
           AND follow_up.created_at > $2::timestamp
           AND follow_up.created_at < $2::timestamp + interval '24 hours'
           AND follow_up.repo_name = (SELECT repo_name FROM pull_requests WHERE id = $3)`,
        [tenantId, pr.merged_at, pr.id]
      );

      const followUpCount = followUpRes.rows[0]?.follow_up_count ?? 0;

      // Check if AI-assisted
      const aiRes = await client.query(
        `SELECT COUNT(*) > 0 AS is_ai_assisted FROM ai_signals WHERE pull_request_id = $1`,
        [pr.id]
      );

      const isAIAssisted = aiRes.rows[0]?.is_ai_assisted ?? false;

      // Store code churn metric
      await client.query(
        `INSERT INTO code_churn_metrics (tenant_id, pull_request_id, follow_up_commits_within_24h, is_ai_assisted, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [tenantId, pr.id, followUpCount, isAIAssisted]
      );
    }

    // Calculate daily aggregate
    const aggRes = await client.query(
      `SELECT 
         AVG(follow_up_commits_within_24h) AS avg_follow_ups,
         COUNT(CASE WHEN follow_up_commits_within_24h > 0 THEN 1 END)::int AS high_churn_count,
         COUNT(*)::int AS total_prs
       FROM code_churn_metrics
       WHERE tenant_id = $1 AND created_at::date = $2::date`,
      [tenantId, date]
    );

    const agg = aggRes.rows[0];

    // Store daily aggregate
    await client.query(
      `INSERT INTO code_churn_daily_metrics (tenant_id, snapshot_date, high_churn_prs_count, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [tenantId, date, agg.high_churn_count]
    );

    await client.query('COMMIT');
    return { tenantId, date, prCount: prsRes.rows.length, highChurnCount: agg.high_churn_count };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('computeCodeChurnMetrics error', err);
    throw err;
  } finally {
    client.release();
  }
};

// ============================================================================
// Batch KPI Computation
// ============================================================================

export const computeAllKPIsForDate = async (tenantId: string, date: string) => {
  try {
    const results = {
      prCycleTime: await computePRCycleTimeMetrics(tenantId, date),
      changeFailureRate: await computeChangeFailureRate(tenantId, date),
      mttr: await computeMTTR(tenantId, date),
      aiAssistedRate: await computeAIAssistedDevRate(tenantId, date),
      reviewEfficiency: await computeReviewEfficiency(tenantId, date),
      throughput: await computeThroughputMetrics(tenantId, date),
      wip: await computeWIPMetrics(tenantId, date),
      codeChurn: await computeCodeChurnMetrics(tenantId, date),
    };

    console.log(`Computed all KPIs for tenant ${tenantId} on ${date}`, results);
    return results;
  } catch (err) {
    console.error('computeAllKPIsForDate error', err);
    throw err;
  }
};
