const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
dotenv.config({ path: path.resolve(repoRoot, '.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 19).replace('T', ' ');
};

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    // Ensure required tables exist (minimal schemas) to allow seeding when data-model migrations aren't present
    await client.query(`
      CREATE TABLE IF NOT EXISTS developers (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        source_type TEXT,
        source_id TEXT,
        display_name TEXT,
        email TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS work_items (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        source_type TEXT,
        source_id TEXT,
        title TEXT,
        state TEXT,
        created_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS work_item_events (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        work_item_id UUID NOT NULL,
        event_type TEXT,
        from_state TEXT,
        to_state TEXT,
        occurred_at TIMESTAMPTZ
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS developer_work_items (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        developer_id UUID NOT NULL,
        work_item_id UUID NOT NULL,
        role TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_adoption_dates (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        adoption_date DATE NOT NULL,
        label TEXT,
        created_by UUID,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS metric_snapshots (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        snapshot_date DATE NOT NULL,
        metric_type TEXT NOT NULL,
        period TEXT NOT NULL,
        value NUMERIC NOT NULL,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_metric_snapshots_tenant_date ON metric_snapshots (tenant_id, snapshot_date)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_metric_snapshots_type_date ON metric_snapshots (tenant_id, metric_type, snapshot_date)`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS deployments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        source_type TEXT NOT NULL DEFAULT 'github',
        source_id TEXT NOT NULL,
        environment TEXT,
        ref TEXT,
        status TEXT,
        created_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ,
        deployed_at TIMESTAMPTZ,
        external_id TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        indexed_at TIMESTAMPTZ DEFAULT now()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_deployments_tenant_date ON deployments (tenant_id, deployed_at)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_deployments_source ON deployments (tenant_id, source_id)`);


    // Create tenant
    const tenantRes = await client.query(`INSERT INTO tenants (name) VALUES ($1) RETURNING id`, ['Sample Tenant']);
    const tenantId = tenantRes.rows[0].id;

    // Create a user
    const userRes = await client.query(`INSERT INTO users (tenant_id, email, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING id`, [tenantId, 'admin@example.com', 'fakehash', 'admin']);
    const userId = userRes.rows[0].id;

    // Create developers
    const devs = ['alice', 'bob', 'carol'].map((name) => ({ name }));
    for (const d of devs) {
      const r = await client.query(`INSERT INTO developers (tenant_id, source_type, source_id, display_name, is_active) VALUES ($1,$2,$3,$4,$5) RETURNING id`, [tenantId, 'github', d.name, d.name, true]);
      d.id = r.rows[0].id;
    }

    // Create work_items across 60 days with varied completion
    // Ensure work_items table exists per data model. If not, create minimal rows into work_items.
    for (let i = 60; i >= 0; i -= 2) {
      const created = daysAgo(i + 1);
      const completed = daysAgo(i);
      const title = `Sample item ${i}`;
      const source_type = i % 3 === 0 ? 'github_pr' : 'jira_issue';
      const wi = await client.query(
        `INSERT INTO work_items (tenant_id, source_type, title, state, created_at, completed_at) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [tenantId, source_type, title, 'done', created, completed]
      );
      const workItemId = wi.rows[0].id;

      // Add a start event (in_progress) shortly after created
      await client.query(
        `INSERT INTO work_item_events (tenant_id, work_item_id, event_type, from_state, to_state, occurred_at) VALUES ($1,$2,$3,$4,$5,$6)`,
        [tenantId, workItemId, 'state_changed', 'open', 'in_progress', daysAgo(i + 1 - 0.5)]
      );

      // Assign developer randomly
      const dev = devs[i % devs.length];
      await client.query(
        `INSERT INTO developer_work_items (tenant_id, developer_id, work_item_id, role) VALUES ($1,$2,$3,$4)`,
        [tenantId, dev.id, workItemId, 'author']
      );
    }

    // Add adoption date ~30 days ago
    const adoptionDate = new Date();
    adoptionDate.setDate(adoptionDate.getDate() - 30);
    await client.query(`INSERT INTO ai_adoption_dates (tenant_id, adoption_date, label, created_by) VALUES ($1, $2::date, $3, $4)`, [tenantId, adoptionDate.toISOString().slice(0,10), 'AI rollout', userId]);

    // Seed sample deployments across 60 days
    const repos = ['my-app', 'api-service', 'frontend'];
    for (let d = 60; d >= 0; d--) {
      const date = new Date();
      date.setDate(date.getDate() - d);
      const dateStr = date.toISOString().slice(0,10);

      // Generate 1-3 deployments per day per repo
      for (const repo of repos) {
        const deployCount = Math.floor(Math.random() * 3) + 1;
        for (let i = 0; i < deployCount; i++) {
          const hour = Math.floor(Math.random() * 24);
          const minute = Math.floor(Math.random() * 60);
          const deployedAt = new Date(date);
          deployedAt.setHours(hour, minute, 0);

          await client.query(
            `INSERT INTO deployments (tenant_id, source_type, source_id, environment, ref, status, deployed_at, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [tenantId, 'github', repo, 'production', 'main', 'success', deployedAt.toISOString(), { seeded: true }]
          );
        }
      }
    }

    await client.query('COMMIT');

    console.log('Seeded tenants, users, developers, work_items, events, and deployments');

    // Now compute metrics for the last 60 days and insert into metric_snapshots
    for (let d = 60; d >= 0; d--) {
      const date = new Date();
      date.setDate(date.getDate() - d);
      const dateStr = date.toISOString().slice(0,10);

      // Throughput
      const thr = await client.query(`SELECT COUNT(*)::int AS throughput FROM work_items WHERE tenant_id = $1 AND completed_at::date = $2::date AND completed_at IS NOT NULL`, [tenantId, dateStr]);
      const throughput = thr.rows[0].throughput || 0;

      // Avg cycle time
      const cycle = await client.query(`
        SELECT AVG(EXTRACT(EPOCH FROM (w.completed_at - COALESCE(ev.started_at, w.created_at)))/3600)::numeric AS avg_cycle_hours
        FROM work_items w
        LEFT JOIN LATERAL (
          SELECT e.occurred_at AS started_at
          FROM work_item_events e
          WHERE e.work_item_id = w.id AND e.to_state IS NOT NULL AND e.to_state != 'open'
          ORDER BY e.occurred_at
          LIMIT 1
        ) ev ON true
        WHERE w.tenant_id = $1 AND w.completed_at::date = $2::date AND w.completed_at IS NOT NULL
      `, [tenantId, dateStr]);
      const avgCycle = cycle.rows[0].avg_cycle_hours ? Number(cycle.rows[0].avg_cycle_hours) : null;

      // Avg lead time
      const lead = await client.query(`SELECT AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/3600)::numeric AS avg_lead_hours FROM work_items WHERE tenant_id = $1 AND completed_at::date = $2::date AND completed_at IS NOT NULL`, [tenantId, dateStr]);
      const avgLead = lead.rows[0].avg_lead_hours ? Number(lead.rows[0].avg_lead_hours) : null;

      await client.query(`INSERT INTO metric_snapshots (tenant_id, snapshot_date, metric_type, period, value, metadata) VALUES ($1,$2,'throughput','daily',$3,$4) ON CONFLICT DO NOTHING`, [tenantId, dateStr, throughput, { seeded: true }]);
      if (avgCycle !== null) {
        await client.query(`INSERT INTO metric_snapshots (tenant_id, snapshot_date, metric_type, period, value, metadata) VALUES ($1,$2,'cycle_time_avg_hours','daily',$3,$4) ON CONFLICT DO NOTHING`, [tenantId, dateStr, avgCycle, { seeded: true }]);
      }
      if (avgLead !== null) {
        await client.query(`INSERT INTO metric_snapshots (tenant_id, snapshot_date, metric_type, period, value, metadata) VALUES ($1,$2,'lead_time_avg_hours','daily',$3,$4) ON CONFLICT DO NOTHING`, [tenantId, dateStr, avgLead, { seeded: true }]);
      }

      // Lead time percentiles
      const leadPerc = await client.query(`
        SELECT 
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (completed_at - created_at))/3600)::numeric AS p50_hours,
          PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (completed_at - created_at))/3600)::numeric AS p90_hours
        FROM work_items
        WHERE tenant_id = $1 AND completed_at::date = $2::date AND completed_at IS NOT NULL
      `, [tenantId, dateStr]);
      const p50Lead = leadPerc.rows[0].p50_hours ? Number(leadPerc.rows[0].p50_hours) : null;
      const p90Lead = leadPerc.rows[0].p90_hours ? Number(leadPerc.rows[0].p90_hours) : null;

      if (p50Lead !== null) {
        await client.query(`INSERT INTO metric_snapshots (tenant_id, snapshot_date, metric_type, period, value, metadata) VALUES ($1,$2,'lead_time_p50_hours','daily',$3,$4) ON CONFLICT DO NOTHING`, [tenantId, dateStr, p50Lead, { seeded: true }]);
      }
      if (p90Lead !== null) {
        await client.query(`INSERT INTO metric_snapshots (tenant_id, snapshot_date, metric_type, period, value, metadata) VALUES ($1,$2,'lead_time_p90_hours','daily',$3,$4) ON CONFLICT DO NOTHING`, [tenantId, dateStr, p90Lead, { seeded: true }]);
      }

      // Per-dev throughput
      const devRes = await client.query(`SELECT dwi.developer_id::text AS developer_id, COUNT(*)::int AS count FROM developer_work_items dwi JOIN work_items w ON w.id = dwi.work_item_id WHERE dwi.tenant_id = $1 AND w.completed_at::date = $2::date AND w.completed_at IS NOT NULL GROUP BY dwi.developer_id ORDER BY count DESC LIMIT 10`, [tenantId, dateStr]);
      for (const row of devRes.rows) {
        await client.query(`INSERT INTO metric_snapshots (tenant_id, snapshot_date, metric_type, period, value, metadata) VALUES ($1,$2,'developer_throughput','daily',$3,$4) ON CONFLICT DO NOTHING`, [tenantId, dateStr, row.count, { developer_id: row.developer_id, seeded: true }]);
      }

      // Deployment frequency
      const deployRes = await client.query(`SELECT COUNT(*)::int AS deploy_count FROM deployments WHERE tenant_id = $1 AND deployed_at::date = $2::date AND deployed_at IS NOT NULL`, [tenantId, dateStr]);
      const deploymentCount = deployRes.rows[0].deploy_count || 0;
      if (deploymentCount > 0) {
        await client.query(`INSERT INTO metric_snapshots (tenant_id, snapshot_date, metric_type, period, value, metadata) VALUES ($1,$2,'deployment_frequency','daily',$3,$4) ON CONFLICT DO NOTHING`, [tenantId, dateStr, deploymentCount, { seeded: true }]);
      }
    }

    console.log('Inserted metric_snapshots for sample data');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
