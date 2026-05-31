import { query } from '../src/db';
import { GitHubIntegration } from '../src/integrations/github';

(async () => {
  try {
    const tenantRes = await query("SELECT DISTINCT tenant_id FROM work_items WHERE source_type = 'github' LIMIT 1");
    if (tenantRes.rowCount === 0) {
      console.log('No tenant with github work_items found');
      process.exit(0);
    }
    const tenantId = tenantRes.rows[0].tenant_id;
    console.log('Using tenant:', tenantId);

    const integRes = await query("SELECT id FROM integrations WHERE tenant_id = $1 AND type = 'github' AND is_connected = true ORDER BY created_at DESC LIMIT 1", [tenantId]);
    if (integRes.rowCount === 0) {
      console.log('No connected GitHub integration found for tenant', tenantId);
      process.exit(1);
    }
    const integrationId = integRes.rows[0].id;
    console.log('Found integration id:', integrationId);

    const reposRes = await query('SELECT source_id FROM work_items WHERE tenant_id = $1 AND source_type = $2', [tenantId, 'github']);
    const repoNames = reposRes.rows.map((r: any) => r.source_id);
    console.log('Repos to sync:', repoNames);

    const client = new GitHubIntegration(tenantId, integrationId);
    const result = await client.syncRepositoryMetrics(repoNames);
    console.log('Sync result:', result);
    process.exit(0);
  } catch (err) {
    console.error('Sync error:', err);
    process.exit(1);
  }
})();
