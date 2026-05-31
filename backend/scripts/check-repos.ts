import { query } from '../src/db';

(async () => {
  try {
    console.log('Querying work_items (github)...');
    const workItems = await query("SELECT id, tenant_id, source_type, source_id, title, created_at FROM work_items WHERE source_type = 'github' ORDER BY created_at DESC LIMIT 50");
    console.log('work_items rows:', workItems.rowCount);
    console.table(workItems.rows);

    console.log('\nCounting pull_requests (github)...');
    const prCount = await query("SELECT COUNT(*)::int AS cnt FROM pull_requests WHERE source_type = 'github'");
    console.log('pull_requests count:', prCount.rows[0].cnt);

    process.exit(0);
  } catch (err) {
    console.error('Error querying DB:', err);
    process.exit(1);
  }
})();
