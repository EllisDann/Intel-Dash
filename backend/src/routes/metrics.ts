import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { query } from '../db';
import { enqueueMetricCalculation } from '../jobs/metricJobs';

const router = Router();

// GET /api/dashboard/throughput/series?startDate=&endDate=&granularity=
router.get('/api/dashboard/throughput/series', authenticate, async (req, res) => {
  try {
    const user = (req as any).user;
    const { startDate, endDate } = req.query as any;

    const rows = await query(
      `SELECT snapshot_date::text as date, value
       FROM metric_snapshots
       WHERE tenant_id = $1 AND metric_type = 'throughput' AND snapshot_date BETWEEN $2::date AND $3::date
       ORDER BY snapshot_date`,
      [user.tenant_id, startDate, endDate]
    );

    return res.json(rows.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to load throughput series' });
  }
});

// GET /api/dashboard/cycle-time/series
router.get('/api/dashboard/cycle-time/series', authenticate, async (req, res) => {
  try {
    const user = (req as any).user;
    const { startDate, endDate } = req.query as any;

    const rows = await query(
      `SELECT snapshot_date::text as date, value as avg_hours
       FROM metric_snapshots
       WHERE tenant_id = $1 AND metric_type = 'cycle_time_avg_hours' AND snapshot_date BETWEEN $2::date AND $3::date
       ORDER BY snapshot_date`,
      [user.tenant_id, startDate, endDate]
    );

    return res.json(rows.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to load cycle time series' });
  }
});

// GET /api/dashboard/deployment-frequency/series - Deployment frequency over time
router.get('/api/dashboard/deployment-frequency/series', authenticate, async (req, res) => {
  try {
    const user = (req as any).user;
    const { startDate, endDate } = req.query as any;

    const rows = await query(
      `SELECT snapshot_date::text as date, value as deployments
       FROM metric_snapshots
       WHERE tenant_id = $1 AND metric_type = 'deployment_frequency' AND snapshot_date BETWEEN $2::date AND $3::date
       ORDER BY snapshot_date`,
      [user.tenant_id, startDate, endDate]
    );

    return res.json(rows.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to load deployment frequency series' });
  }
});

// GET /api/dashboard/lead-time/series - Lead time with percentiles and AI comparison
router.get('/api/dashboard/lead-time/series', authenticate, async (req, res) => {
  try {
    const user = (req as any).user;
    const { startDate, endDate } = req.query as any;

    // Fetch adoption date for comparison
    const adoptionRes = await query(
      `SELECT adoption_date::date AS adoption_date FROM ai_adoption_dates WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [user.tenant_id]
    );
    const adoptionDate = adoptionRes.rows[0]?.adoption_date || null;

    // Fetch lead time metrics (avg, p50, p90)
    const metricsRes = await query(
      `SELECT 
         snapshot_date::text as date,
         MAX(CASE WHEN metric_type = 'lead_time_avg_hours' THEN value::numeric END) as avg_hours,
         MAX(CASE WHEN metric_type = 'lead_time_p50_hours' THEN value::numeric END) as p50_hours,
         MAX(CASE WHEN metric_type = 'lead_time_p90_hours' THEN value::numeric END) as p90_hours
       FROM metric_snapshots
       WHERE tenant_id = $1 
         AND metric_type IN ('lead_time_avg_hours', 'lead_time_p50_hours', 'lead_time_p90_hours')
         AND snapshot_date BETWEEN $2::date AND $3::date
       GROUP BY snapshot_date
       ORDER BY snapshot_date`,
      [user.tenant_id, startDate, endDate]
    );

    const data = metricsRes.rows.map((row: any) => ({
      date: row.date,
      avg: row.avg_hours ? Number(row.avg_hours) : null,
      p50: row.p50_hours ? Number(row.p50_hours) : null,
      p90: row.p90_hours ? Number(row.p90_hours) : null,
      isPostAdoption: adoptionDate && new Date(row.date) >= new Date(adoptionDate),
    }));

    return res.json({ data, adoptionDate });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to load lead time series' });
  }
});

// POST /api/metrics/calculate - trigger calculation for tenant/date (admin/dev use)
router.post('/api/metrics/calculate', authenticate, async (req, res) => {
  try {
    const user = (req as any).user;
    const { date } = req.body;
    if (!date) return res.status(400).json({ error: 'Missing date (YYYY-MM-DD)' });

    const result = await enqueueMetricCalculation(user.tenant_id, date);
    return res.json({ ok: true, result });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to enqueue metrics calculation' });
  }
});
// ============================================================================
// PHASE 3: PR Cycle Time Metrics
// ============================================================================

router.get('/api/dashboard/pr-cycle-time/series', authenticate, async (req, res) => {
  try {
    const user = (req as any).user;
    const { startDate, endDate } = req.query as any;

    const rows = await query(
      `SELECT 
         snapshot_date::text as date,
         MAX(CASE WHEN metric_type = 'pr_cycle_time_avg_hours' THEN value::numeric END) as avg_hours,
         MAX(CASE WHEN metric_type = 'pr_cycle_time_p50_hours' THEN value::numeric END) as p50_hours,
         MAX(CASE WHEN metric_type = 'pr_cycle_time_p90_hours' THEN value::numeric END) as p90_hours
       FROM metric_snapshots
       WHERE tenant_id = $1 
         AND metric_type IN ('pr_cycle_time_avg_hours', 'pr_cycle_time_p50_hours', 'pr_cycle_time_p90_hours')
         AND snapshot_date BETWEEN $2::date AND $3::date
       GROUP BY snapshot_date
       ORDER BY snapshot_date`,
      [user.tenant_id, startDate, endDate]
    );

    const adoptionRes = await query(
      `SELECT adoption_date::date AS adoption_date FROM ai_adoption_dates WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [user.tenant_id]
    );
    const adoptionDate = adoptionRes.rows[0]?.adoption_date || null;

    const data = rows.rows.map((row: any) => ({
      date: row.date,
      avg: row.avg_hours ? Number(row.avg_hours) : null,
      p50: row.p50_hours ? Number(row.p50_hours) : null,
      p90: row.p90_hours ? Number(row.p90_hours) : null,
      isPostAdoption: adoptionDate && new Date(row.date) >= new Date(adoptionDate),
    }));

    return res.json({ data, adoptionDate });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to load PR cycle time series' });
  }
});

router.get('/api/dashboard/pr-metrics/summary', authenticate, async (req, res) => {
  try {
    const user = (req as any).user;
    const { startDate, endDate } = req.query as any;

    const rows = await query(
      `SELECT 
         AVG(pr_cycle_time_hours) AS avg_cycle_time,
         AVG(time_to_first_review_hours) AS avg_time_to_review,
         AVG(review_time_hours) AS avg_review_time,
         AVG(merge_wait_time_hours) AS avg_merge_wait,
         AVG(review_rounds) AS avg_review_rounds,
         COUNT(*)::int AS pr_count
       FROM pr_metrics
       WHERE tenant_id = $1 AND created_at::date BETWEEN $2::date AND $3::date`,
      [user.tenant_id, startDate, endDate]
    );

    return res.json(rows.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to load PR metrics summary' });
  }
});

// ============================================================================
// PHASE 4: Change Failure Rate & MTTR
// ============================================================================

router.get('/api/dashboard/change-failure-rate/series', authenticate, async (req, res) => {
  try {
    const user = (req as any).user;
    const { startDate, endDate } = req.query as any;

    const rows = await query(
      `SELECT 
         snapshot_date::text as date,
         change_failure_rate,
         total_deployments,
         failed_deployments
       FROM deployment_failure_metrics
       WHERE tenant_id = $1 AND snapshot_date BETWEEN $2::date AND $3::date
       ORDER BY snapshot_date`,
      [user.tenant_id, startDate, endDate]
    );

    return res.json(rows.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to load change failure rate series' });
  }
});

router.get('/api/dashboard/mttr/series', authenticate, async (req, res) => {
  try {
    const user = (req as any).user;
    const { startDate, endDate } = req.query as any;

    const rows = await query(
      `SELECT 
         DATE_TRUNC('day', created_at)::text as date,
         AVG(mttr_hours) AS avg_mttr,
         PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY mttr_hours) AS p50_mttr,
         PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY mttr_hours) AS p90_mttr,
         COUNT(*)::int AS incident_count
       FROM mttr_metrics
       WHERE tenant_id = $1 AND created_at::date BETWEEN $2::date AND $3::date
       GROUP BY DATE_TRUNC('day', created_at)
       ORDER BY date`,
      [user.tenant_id, startDate, endDate]
    );

    return res.json(rows.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to load MTTR series' });
  }
});

// ============================================================================
// PHASE 5: AI Effectiveness Metrics
// ============================================================================

router.get('/api/dashboard/ai-assisted-rate/series', authenticate, async (req, res) => {
  try {
    const user = (req as any).user;
    const { startDate, endDate } = req.query as any;

    const rows = await query(
      `SELECT 
         snapshot_date::text as date,
         ai_assisted_rate,
         ai_assisted_pr_count,
         total_pr_count,
         ai_assisted_pr_avg_cycle_time_hours,
         non_ai_pr_avg_cycle_time_hours
       FROM ai_effectiveness_metrics
       WHERE tenant_id = $1 AND snapshot_date BETWEEN $2::date AND $3::date
       ORDER BY snapshot_date`,
      [user.tenant_id, startDate, endDate]
    );

    return res.json(rows.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to load AI-assisted rate series' });
  }
});

router.get('/api/dashboard/review-efficiency/series', authenticate, async (req, res) => {
  try {
    const user = (req as any).user;
    const { startDate, endDate } = req.query as any;

    const rows = await query(
      `SELECT 
         DATE_TRUNC('day', first_review_requested_at)::text as date,
         AVG(time_to_first_response_hours) AS avg_time_to_response,
         AVG(time_to_approval_hours) AS avg_time_to_approval,
         AVG(review_rounds) AS avg_review_rounds,
         COUNT(*)::int AS pr_count
       FROM review_efficiency_metrics
       WHERE tenant_id = $1 AND first_review_requested_at::date BETWEEN $2::date AND $3::date
       GROUP BY DATE_TRUNC('day', first_review_requested_at)
       ORDER BY date`,
      [user.tenant_id, startDate, endDate]
    );

    return res.json(rows.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to load review efficiency series' });
  }
});

router.get('/api/dashboard/ai-velocity-gain/:periodDays', authenticate, async (req, res) => {
  try {
    const user = (req as any).user;
    const { periodDays } = req.params as any;

    const rows = await query(
      `SELECT 
         snapshot_date::text as date,
         period_days,
         lead_time_improvement_percent,
         deployment_frequency_improvement_percent,
         pr_cycle_time_improvement_percent,
         overall_velocity_gain_percent
       FROM ai_velocity_comparisons
       WHERE tenant_id = $1 AND period_days = $2
       ORDER BY snapshot_date DESC
       LIMIT 1`,
      [user.tenant_id, parseInt(periodDays)]
    );

    return res.json(rows.rows[0] || null);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to load AI velocity gain' });
  }
});

// ============================================================================
// PHASE 6: Delivery & Flow Metrics
// ============================================================================

router.get('/api/dashboard/throughput-enhanced/series', authenticate, async (req, res) => {
  try {
    const user = (req as any).user;
    const { startDate, endDate } = req.query as any;

    const rows = await query(
      `SELECT 
         snapshot_date::text as date,
         completed_tickets,
         merged_prs,
         throughput_per_developer
       FROM throughput_metrics
       WHERE tenant_id = $1 AND period_type = 'daily' AND snapshot_date BETWEEN $2::date AND $3::date
       ORDER BY snapshot_date`,
      [user.tenant_id, startDate, endDate]
    );

    return res.json(rows.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to load throughput series' });
  }
});

router.get('/api/dashboard/wip/series', authenticate, async (req, res) => {
  try {
    const user = (req as any).user;
    const { startDate, endDate } = req.query as any;

    const rows = await query(
      `SELECT 
         snapshot_date::text as date,
         total_in_progress,
         in_progress_per_developer,
         team_size
       FROM wip_metrics
       WHERE tenant_id = $1 AND snapshot_date BETWEEN $2::date AND $3::date
       ORDER BY snapshot_date`,
      [user.tenant_id, startDate, endDate]
    );

    return res.json(rows.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to load WIP series' });
  }
});

router.get('/api/dashboard/sprint-predictability/series', authenticate, async (req, res) => {
  try {
    const user = (req as any).user;

    const rows = await query(
      `SELECT 
         sprint_name,
         sprint_start_date::text as start_date,
         sprint_end_date::text as end_date,
         committed_story_points,
         completed_story_points,
         predictability_percent,
         tickets_committed,
         tickets_completed
       FROM sprint_predictability_metrics
       WHERE tenant_id = $1
       ORDER BY sprint_start_date DESC
       LIMIT 20`,
      [user.tenant_id]
    );

    return res.json(rows.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to load sprint predictability' });
  }
});

// ============================================================================
// PHASE 7: Quality Metrics
// ============================================================================

router.get('/api/dashboard/bug-escape-rate/series', authenticate, async (req, res) => {
  try {
    const user = (req as any).user;
    const { startDate, endDate } = req.query as any;

    const rows = await query(
      `SELECT 
         snapshot_date::text as date,
         escape_rate,
         total_bugs,
         production_bugs,
         critical_escapes
       FROM bug_escape_metrics
       WHERE tenant_id = $1 AND snapshot_date BETWEEN $2::date AND $3::date
       ORDER BY snapshot_date`,
      [user.tenant_id, startDate, endDate]
    );

    return res.json(rows.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to load bug escape rate series' });
  }
});

router.get('/api/dashboard/rework-rate/series', authenticate, async (req, res) => {
  try {
    const user = (req as any).user;
    const { startDate, endDate } = req.query as any;

    const rows = await query(
      `SELECT 
         snapshot_date::text as date,
         rework_rate,
         total_completed_issues,
         reopened_issues,
         total_reverted_prs
       FROM rework_metrics
       WHERE tenant_id = $1 AND snapshot_date BETWEEN $2::date AND $3::date
       ORDER BY snapshot_date`,
      [user.tenant_id, startDate, endDate]
    );

    return res.json(rows.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to load rework rate series' });
  }
});

router.get('/api/dashboard/code-churn/series', authenticate, async (req, res) => {
  try {
    const user = (req as any).user;
    const { startDate, endDate } = req.query as any;

    const rows = await query(
      `SELECT 
         snapshot_date::text as date,
         avg_churn_percent,
         high_churn_prs_count,
         median_churn_percent
       FROM code_churn_daily_metrics
       WHERE tenant_id = $1 AND snapshot_date BETWEEN $2::date AND $3::date
       ORDER BY snapshot_date`,
      [user.tenant_id, startDate, endDate]
    );

    return res.json(rows.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to load code churn series' });
  }
});
export default router;

// Adoption date endpoints
router.get('/api/organizations/ai-adoption-date', authenticate, async (req, res) => {
  try {
    const user = (req as any).user;
    const rows = await query(
      `SELECT id, adoption_date::text AS adoption_date, label, created_by::text AS created_by
       FROM ai_adoption_dates WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [user.tenant_id]
    );
    return res.json(rows.rows[0] || null);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to load adoption date' });
  }
});

router.post('/api/organizations/ai-adoption-date', authenticate, async (req, res) => {
  try {
    const user = (req as any).user;
    const { adoption_date, label } = req.body;
    if (!adoption_date) return res.status(400).json({ error: 'Missing adoption_date' });

    const result = await query(
      `INSERT INTO ai_adoption_dates (tenant_id, adoption_date, label, created_by)
       VALUES ($1, $2::date, $3, $4) RETURNING id, adoption_date::text AS adoption_date, label`,
      [user.tenant_id, adoption_date, label || null, user.sub]
    );

    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to save adoption date' });
  }
});

// Adoption comparison endpoint
router.get('/api/dashboard/adoption/comparison', authenticate, async (req, res) => {
  try {
    const user = (req as any).user;
    const adoptionRow = await query(
      `SELECT adoption_date::date AS adoption_date FROM ai_adoption_dates WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [user.tenant_id]
    );
    if (adoptionRow.rowCount === 0) return res.json({ adoption: null });
    const adoptionDate = adoptionRow.rows[0].adoption_date;

    // Pre/post windows (30 days)
    const preStart = `${adoptionDate}`; // adoptionDate - 30 handled in SQL

    // Calculate averages from metric_snapshots for 30 days before and after
    const compRes = await query(
      `WITH params AS (
         SELECT $1::date AS adoption_date
       ),
       pre AS (
         SELECT AVG(value)::numeric AS avg_throughput
         FROM metric_snapshots m, params p
         WHERE m.tenant_id = $2 AND m.metric_type = 'throughput'
           AND m.snapshot_date BETWEEN (p.adoption_date - INTERVAL '30 days')::date AND (p.adoption_date - INTERVAL '1 day')::date
       ),
       post AS (
         SELECT AVG(value)::numeric AS avg_throughput
         FROM metric_snapshots m, params p
         WHERE m.tenant_id = $2 AND m.metric_type = 'throughput'
           AND m.snapshot_date BETWEEN p.adoption_date AND (p.adoption_date + INTERVAL '29 days')::date
       ),
       pre_cycle AS (
         SELECT AVG(value)::numeric AS avg_cycle
         FROM metric_snapshots m, params p
         WHERE m.tenant_id = $2 AND m.metric_type = 'cycle_time_avg_hours'
           AND m.snapshot_date BETWEEN (p.adoption_date - INTERVAL '30 days')::date AND (p.adoption_date - INTERVAL '1 day')::date
       ),
       post_cycle AS (
         SELECT AVG(value)::numeric AS avg_cycle
         FROM metric_snapshots m, params p
         WHERE m.tenant_id = $2 AND m.metric_type = 'cycle_time_avg_hours'
           AND m.snapshot_date BETWEEN p.adoption_date AND (p.adoption_date + INTERVAL '29 days')::date
       )
       SELECT (SELECT * FROM pre) AS pre_throughput, (SELECT * FROM post) AS post_throughput,
              (SELECT * FROM pre_cycle) AS pre_cycle, (SELECT * FROM post_cycle) AS post_cycle
       `,
      [adoptionDate, user.tenant_id]
    );

    const row = compRes.rows[0];
    const pre = { throughput: row?.pre_throughput?.avg_throughput ?? null, cycle_time: row?.pre_cycle?.avg_cycle ?? null };
    const post = { throughput: row?.post_throughput?.avg_throughput ?? null, cycle_time: row?.post_cycle?.avg_cycle ?? null };

    const improvement = {
      throughput_pct: pre.throughput ? (post.throughput - pre.throughput) / pre.throughput * 100 : null,
      cycle_time_pct: pre.cycle_time ? (post.cycle_time - pre.cycle_time) / pre.cycle_time * 100 : null,
    };

    return res.json({ adoptionDate, pre, post, improvement });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to compute adoption comparison' });
  }
});

// Developers list with aggregate throughput between dates
router.get('/api/dashboard/developers', authenticate, async (req, res) => {
  try {
    const user = (req as any).user;
    const { startDate, endDate } = req.query as any;
    const rows = await query(
      `SELECT dwi.developer_id::text AS id, COALESCE(dev.display_name, dwi.developer_id::text) AS name, COUNT(*)::int AS throughput
       FROM developer_work_items dwi
       JOIN work_items w ON w.id = dwi.work_item_id
       LEFT JOIN developers dev ON dev.id = dwi.developer_id
       WHERE dwi.tenant_id = $1
         AND w.completed_at::date BETWEEN $2::date AND $3::date
       GROUP BY dwi.developer_id, dev.display_name
       ORDER BY throughput DESC
       LIMIT 50`,
      [user.tenant_id, startDate, endDate]
    );

    return res.json(rows.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to load developers' });
  }
});

// Developer throughput time series
router.get('/api/dashboard/developers/:id/throughput', authenticate, async (req, res) => {
  try {
    const user = (req as any).user;
    const developerId = req.params.id;
    const { startDate, endDate } = req.query as any;
    const rows = await query(
      `SELECT w.completed_at::date AS date, COUNT(*)::int AS value
       FROM developer_work_items dwi
       JOIN work_items w ON w.id = dwi.work_item_id
       WHERE dwi.tenant_id = $1 AND dwi.developer_id::text = $2 AND w.completed_at::date BETWEEN $3::date AND $4::date
       GROUP BY w.completed_at::date
       ORDER BY w.completed_at::date`,
      [user.tenant_id, developerId, startDate, endDate]
    );

    return res.json(rows.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to load developer throughput series' });
  }
});

// Repositories (source_id) list and throughput
router.get('/api/dashboard/repositories', authenticate, async (req, res) => {
  try {
    const user = (req as any).user;
    const { startDate, endDate } = req.query as any;
    const rows = await query(
      `SELECT source_type, source_id AS id, COUNT(*)::int AS throughput
       FROM work_items
       WHERE tenant_id = $1 AND completed_at::date BETWEEN $2::date AND $3::date
       GROUP BY source_type, source_id
       ORDER BY throughput DESC
       LIMIT 50`,
      [user.tenant_id, startDate, endDate]
    );

    return res.json(rows.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to load repositories' });
  }
});

router.get('/api/dashboard/repositories/:id/stats', authenticate, async (req, res) => {
  try {
    const user = (req as any).user;
    const repoId = req.params.id;
    const { startDate, endDate } = req.query as any;
    const rows = await query(
      `SELECT completed_at::date AS date, COUNT(*)::int AS value
       FROM work_items
       WHERE tenant_id = $1 AND source_id = $2 AND completed_at::date BETWEEN $3::date AND $4::date
       GROUP BY completed_at::date
       ORDER BY completed_at::date`,
      [user.tenant_id, repoId, startDate, endDate]
    );

    return res.json(rows.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to load repository stats' });
  }
});

