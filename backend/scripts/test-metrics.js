const { Pool } = require('pg');
const path = require('path');
const dotenv = require('dotenv');

const repoRoot = path.resolve(__dirname, '..', '..');
dotenv.config({ path: path.resolve(repoRoot, '.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

(async () => {
  const client = await pool.connect();
  try {
    const adoptionRes = await client.query('SELECT tenant_id, adoption_date FROM ai_adoption_dates ORDER BY created_at DESC LIMIT 1');
    if (adoptionRes.rowCount === 0) {
      console.error('No adoption date found. Run seed-sample-data.js first.');
      process.exit(1);
    }
    const tenantId = adoptionRes.rows[0].tenant_id;
    const date = daysAgo(1);
    console.log('Found adoption date for tenant:', tenantId, adoptionRes.rows[0].adoption_date.toISOString().slice(0,10));

    const snapshotRes = await client.query(
      `SELECT metric_type, COUNT(*) AS count, AVG(value)::numeric(10,2) AS avg_value
       FROM metric_snapshots
       WHERE tenant_id = $1 AND snapshot_date = $2
       GROUP BY metric_type`,
      [tenantId, date]
    );

    if (snapshotRes.rowCount === 0) {
      console.error('No metric snapshots found for', date);
      process.exit(1);
    }

    console.log(`Metric snapshots for ${date}:`);
    snapshotRes.rows.forEach((row) => {
      console.log(`- ${row.metric_type}: count=${row.count}, avg_value=${row.avg_value}`);
    });
    console.log('Metrics verification succeeded.');
  } catch (error) {
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
})();
