import { query, getClient } from '../db';

// Enqueue a metric calculation for a tenant/date. In production this should
// enqueue a background job; here we run the calculation synchronously.
export const enqueueMetricCalculation = async (tenantId: string, date: string) => {
  return computeDailyMetrics(tenantId, date);
};

const isMissingTableError = (error: any, tableName: string) => {
  return error?.code === '42P01' && error?.message?.includes(tableName);
};

const tableExists = async (client: any, tableName: string) => {
  const result = await client.query(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS exists`,
    [tableName]
  );

  return result.rows[0]?.exists ?? false;
};

export const computeDailyMetrics = async (tenantId: string, date: string) => {
  // date is YYYY-MM-DD
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const workItemsExists = await tableExists(client, 'work_items');
    if (!workItemsExists) {
      console.warn(`Skipping daily metrics for tenant ${tenantId}: work_items table does not exist yet.`);
      await client.query('ROLLBACK');
      return { tenantId, date, throughput: 0, avgCycle: null, avgLead: null, topDevelopers: [] };
    }

    const workItemEventsExists = await tableExists(client, 'work_item_events');
    const developerWorkItemsExists = await tableExists(client, 'developer_work_items');

    // Throughput: count of completed work_items for the date
    const throughputRes = await client.query(
      `SELECT COUNT(*)::int AS throughput
       FROM work_items
       WHERE tenant_id = $1 AND completed_at::date = $2::date AND completed_at IS NOT NULL`,
      [tenantId, date]
    );
    const throughput = throughputRes.rows[0]?.throughput ?? 0;

    // Average cycle time: completed_at - start_time. Start_time is first event where to_state != 'open'
    const cycleRes = workItemEventsExists
      ? await client.query(
          `SELECT AVG(EXTRACT(EPOCH FROM (w.completed_at - COALESCE(ev.started_at, w.created_at)))/3600)::numeric AS avg_cycle_hours
           FROM work_items w
           LEFT JOIN LATERAL (
             SELECT e.occurred_at AS started_at
             FROM work_item_events e
             WHERE e.work_item_id = w.id AND e.to_state IS NOT NULL AND e.to_state != 'open'
             ORDER BY e.occurred_at
             LIMIT 1
           ) ev ON true
           WHERE w.tenant_id = $1 AND w.completed_at::date = $2::date AND w.completed_at IS NOT NULL`,
          [tenantId, date]
        )
      : null;
    const avgCycle = cycleRes?.rows[0]?.avg_cycle_hours ? Number(cycleRes.rows[0].avg_cycle_hours) : null;

    // Average lead time: completed_at - created_at
    const leadRes = await client.query(
      `SELECT AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/3600)::numeric AS avg_lead_hours
       FROM work_items
       WHERE tenant_id = $1 AND completed_at::date = $2::date AND completed_at IS NOT NULL`,
      [tenantId, date]
    );
    const avgLead = leadRes.rows[0]?.avg_lead_hours ? Number(leadRes.rows[0].avg_lead_hours) : null;

    // Lead time percentiles (P50, P90)
    const leadPercentilesRes = await client.query(
      `SELECT 
         PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (completed_at - created_at))/3600)::numeric AS p50_hours,
         PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (completed_at - created_at))/3600)::numeric AS p90_hours
       FROM work_items
       WHERE tenant_id = $1 AND completed_at::date = $2::date AND completed_at IS NOT NULL`,
      [tenantId, date]
    );
    const p50Lead = leadPercentilesRes.rows[0]?.p50_hours ? Number(leadPercentilesRes.rows[0].p50_hours) : null;
    const p90Lead = leadPercentilesRes.rows[0]?.p90_hours ? Number(leadPercentilesRes.rows[0].p90_hours) : null;

    // Persist snapshots
    await client.query(
      `INSERT INTO metric_snapshots (tenant_id, snapshot_date, metric_type, period, value, metadata)
       VALUES ($1, $2, 'throughput', 'daily', $3, $4)
       ON CONFLICT DO NOTHING`,
      [tenantId, date, throughput, { source: 'calculated' }]
    );

    if (avgCycle !== null) {
      await client.query(
        `INSERT INTO metric_snapshots (tenant_id, snapshot_date, metric_type, period, value, metadata)
         VALUES ($1, $2, 'cycle_time_avg_hours', 'daily', $3, $4)
         ON CONFLICT DO NOTHING`,
        [tenantId, date, avgCycle, { source: 'calculated' }]
      );
    }

    if (avgLead !== null) {
      await client.query(
        `INSERT INTO metric_snapshots (tenant_id, snapshot_date, metric_type, period, value, metadata)
         VALUES ($1, $2, 'lead_time_avg_hours', 'daily', $3, $4)
         ON CONFLICT DO NOTHING`,
        [tenantId, date, avgLead, { source: 'calculated' }]
      );
    }

    // Store percentile snapshots
    if (p50Lead !== null) {
      await client.query(
        `INSERT INTO metric_snapshots (tenant_id, snapshot_date, metric_type, period, value, metadata)
         VALUES ($1, $2, 'lead_time_p50_hours', 'daily', $3, $4)
         ON CONFLICT DO NOTHING`,
        [tenantId, date, p50Lead, { source: 'calculated' }]
      );
    }

    if (p90Lead !== null) {
      await client.query(
        `INSERT INTO metric_snapshots (tenant_id, snapshot_date, metric_type, period, value, metadata)
         VALUES ($1, $2, 'lead_time_p90_hours', 'daily', $3, $4)
         ON CONFLICT DO NOTHING`,
        [tenantId, date, p90Lead, { source: 'calculated' }]
      );
    }

    // Per-developer throughput (top 10)
    const devRes = developerWorkItemsExists
      ? await client.query(
          `SELECT dwi.developer_id::text AS developer_id, COUNT(*)::int AS count
           FROM developer_work_items dwi
           JOIN work_items w ON w.id = dwi.work_item_id
           WHERE dwi.tenant_id = $1 AND w.completed_at::date = $2::date AND w.completed_at IS NOT NULL
           GROUP BY dwi.developer_id
           ORDER BY count DESC
           LIMIT 10`,
          [tenantId, date]
        )
      : { rows: [] } as { rows: Array<{ developer_id: string; count: number }> };

    for (const row of devRes.rows) {
      await client.query(
        `INSERT INTO metric_snapshots (tenant_id, snapshot_date, metric_type, period, value, metadata)
         VALUES ($1, $2, 'developer_throughput', 'daily', $3, $4)
         ON CONFLICT DO NOTHING`,
        [tenantId, date, row.count, { developer_id: row.developer_id }]
      );
    }

    await client.query('COMMIT');

    return { tenantId, date, throughput, avgCycle, avgLead, topDevelopers: devRes.rows };
  } catch (err) {
    await client.query('ROLLBACK');

    if (isMissingTableError(err, 'work_items')) {
      console.warn(`Skipping daily metrics for tenant ${tenantId}: work_items table does not exist yet.`);
      return { tenantId, date, throughput: 0, avgCycle: null, avgLead: null, topDevelopers: [] };
    }

    console.error('computeDailyMetrics error', err);
    throw err;
  } finally {
    client.release();
  }
};

// Calculate deployment frequency metrics
export const computeDeploymentFrequency = async (tenantId: string, date: string) => {
  // date is YYYY-MM-DD
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Count deployments for the date
    const deployCountRes = await client.query(
      `SELECT COUNT(*)::int AS deploy_count
       FROM deployments
       WHERE tenant_id = $1 AND deployed_at::date = $2::date AND deployed_at IS NOT NULL`,
      [tenantId, date]
    );
    const deploymentCount = deployCountRes.rows[0]?.deploy_count ?? 0;

    // Count deployments per repository
    const repoDeploysRes = await client.query(
      `SELECT source_id AS repo_id, COUNT(*)::int AS count
       FROM deployments
       WHERE tenant_id = $1 AND deployed_at::date = $2::date AND deployed_at IS NOT NULL
       GROUP BY source_id
       ORDER BY count DESC
       LIMIT 20`,
      [tenantId, date]
    );

    // Store deployment frequency snapshot
    await client.query(
      `INSERT INTO metric_snapshots (tenant_id, snapshot_date, metric_type, period, value, metadata)
       VALUES ($1, $2, 'deployment_frequency', 'daily', $3, $4)
       ON CONFLICT DO NOTHING`,
      [tenantId, date, deploymentCount, { source: 'calculated' }]
    );

    // Store per-repo deployment counts
    for (const row of repoDeploysRes.rows) {
      await client.query(
        `INSERT INTO metric_snapshots (tenant_id, snapshot_date, metric_type, period, value, metadata)
         VALUES ($1, $2, 'deployment_frequency_per_repo', 'daily', $3, $4)
         ON CONFLICT DO NOTHING`,
        [tenantId, date, row.count, { repo_id: row.repo_id }]
      );
    }

    await client.query('COMMIT');

    return { tenantId, date, deploymentCount, topRepos: repoDeploysRes.rows };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('computeDeploymentFrequency error', err);
    throw err;
  } finally {
    client.release();
  }
};
