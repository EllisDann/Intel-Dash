import { Router } from 'express';
import { authenticate, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { query } from '../db';
import { createIntegrationClient } from '../integrations';

const router = Router();

const ensureIntegrationType = (type: string) => {
  if (!['github', 'jira'].includes(type)) {
    throw new Error('Unsupported integration type');
  }
};

router.get('/api/integrations', authenticate, async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const tenantId = user?.tenant_id;
    const result = await query(
      'SELECT id, type, display_name, is_connected, connected_at, disconnected_at, created_at, updated_at FROM integrations WHERE tenant_id = $1 ORDER BY created_at DESC',
      [tenantId]
    );

    let importedProjectsResult;
    try {
      importedProjectsResult = await query(
        `SELECT
           COALESCE(source_type, 'unknown') AS source_type,
           COALESCE(source_id, 'unknown') AS project_id,
           COALESCE(source_id, source_type) AS project_name,
           COUNT(*)::int AS total_items,
           SUM(CASE WHEN completed_at IS NULL THEN 1 ELSE 0 END)::int AS open_items,
           SUM(CASE WHEN completed_at IS NOT NULL THEN 1 ELSE 0 END)::int AS closed_items
         FROM work_items
         WHERE tenant_id = $1
         GROUP BY source_type, source_id
         ORDER BY total_items DESC
         LIMIT 50`,
        [tenantId]
      );
    } catch (error: any) {
      if (error.code === '42P01' && error.message.includes('work_items')) {
        importedProjectsResult = { rows: [] } as any;
      } else {
        throw error;
      }
    }

    return res.json({ integrations: result.rows, importedProjects: importedProjectsResult.rows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Unable to load integrations' });
  }
});

router.post('/api/integrations/:type/authorize', authenticate, async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const tenantId = user?.tenant_id;
    const { type } = req.params;
    const { returnUrl } = req.query;

    if (!tenantId) {
      return res.status(401).json({ error: 'Invalid user session' });
    }

    ensureIntegrationType(type);
    const integration = createIntegrationClient(type, tenantId);
    const state = await integration.createStateToken(returnUrl as string | undefined);
    const authorizeUrl = integration.getAuthorizationUrl(state);
    return res.json({ authorizeUrl });
  } catch (error: any) {
    console.error(error);
    return res.status(400).json({ error: error.message || 'Unable to generate authorization url' });
  }
});

router.get('/api/integrations/:type/callback', authenticate, async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const tenantId = user?.tenant_id;
    const { type } = req.params;
    const { code, state } = req.query;

    if (!tenantId) {
      return res.status(401).json({ error: 'Invalid user session' });
    }

    ensureIntegrationType(type);

    if (!code || !state) {
      return res.status(400).json({ error: 'Missing code or state parameter' });
    }

    const integration = createIntegrationClient(type, tenantId);
    const result = await integration.handleCallback(String(code), String(state));

    return res.json({ success: true, returnUrl: result?.returnUrl });
  } catch (error: any) {
    console.error(error);
    return res.status(400).json({ error: error.message || 'Unable to complete OAuth callback' });
  }
});

router.delete('/api/integrations/:id', authenticate, async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const tenantId = user?.tenant_id;
    const { id } = req.params;

    if (!tenantId) {
      return res.status(401).json({ error: 'Invalid user session' });
    }

    const integrationResult = await query(
      'SELECT id, tenant_id, type FROM integrations WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (integrationResult.rowCount === 0) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const integration = createIntegrationClient(integrationResult.rows[0].type, tenantId, id);
    await integration.disconnect();

    await query('DELETE FROM integration_credentials WHERE integration_id = $1', [id]);
    await query('UPDATE integrations SET is_connected = false, disconnected_at = NOW(), updated_at = NOW() WHERE id = $1', [id]);

    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Unable to disconnect integration' });
  }
});

router.post('/api/integrations/:id/sync', authenticate, requireAdmin, async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const tenantId = user?.tenant_id;
    const { id } = req.params;

    if (!tenantId) {
      return res.status(401).json({ error: 'Invalid user session' });
    }

    const integrationResult = await query('SELECT id, tenant_id, type FROM integrations WHERE id = $1 AND tenant_id = $2', [id, tenantId]);

    if (integrationResult.rowCount === 0) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const integrationData = integrationResult.rows[0];
    const integration = createIntegrationClient(integrationData.type, tenantId, id);

    // For GitHub, fetch and store repositories
    let result: any;
    if (integrationData.type === 'github') {
      // Refresh GitHub repository metadata without importing repos automatically.
      result = await integration.fetchRepositories();
    } else {
      // For other types, use generic fetch
      result = await integration.fetchData();
    }

    return res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Sync error:', error);
    return res.status(500).json({ error: error.message || 'Unable to sync integration' });
  }
});

router.get('/api/integrations/:id/repos', authenticate, async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const tenantId = user?.tenant_id;
    const { id } = req.params;

    if (!tenantId) {
      return res.status(401).json({ error: 'Invalid user session' });
    }

    const integrationResult = await query('SELECT id, tenant_id, type FROM integrations WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (integrationResult.rowCount === 0) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const integrationData = integrationResult.rows[0];
    if (integrationData.type !== 'github') {
      return res.status(400).json({ error: 'Repository listing is only supported for GitHub integrations' });
    }

    const integration = createIntegrationClient(integrationData.type, tenantId, id);
    const repos = await integration.fetchRepositories();
    return res.json({ repos });
  } catch (error: any) {
    console.error('Fetch repos error:', error);
    return res.status(500).json({ error: error.message || 'Unable to fetch repositories' });
  }
});

router.post('/api/integrations/:id/repos/import', authenticate, requireAdmin, async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const tenantId = user?.tenant_id;
    const { id } = req.params;
    const { source_id, title, archived } = req.body;

    if (!tenantId) {
      return res.status(401).json({ error: 'Invalid user session' });
    }

    if (!source_id || !title) {
      return res.status(400).json({ error: 'Missing required repository data' });
    }

    const integrationResult = await query('SELECT id, tenant_id, type FROM integrations WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (integrationResult.rowCount === 0) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const integrationData = integrationResult.rows[0];
    if (integrationData.type !== 'github') {
      return res.status(400).json({ error: 'Repository import is only supported for GitHub integrations' });
    }

    const integration = createIntegrationClient(integrationData.type, tenantId, id);
    const result = await integration.importRepository(source_id, title, Boolean(archived));
    return res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Import repo error:', error);
    return res.status(500).json({ error: error.message || 'Unable to import repository' });
  }
});

router.delete('/api/integrations/:id/repos', authenticate, requireAdmin, async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const tenantId = user?.tenant_id;
    const { id } = req.params;
    const { source_id } = req.body;

    if (!tenantId) {
      return res.status(401).json({ error: 'Invalid user session' });
    }

    if (!source_id) {
      return res.status(400).json({ error: 'Missing repository source_id' });
    }

    const integrationResult = await query('SELECT id, tenant_id, type FROM integrations WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (integrationResult.rowCount === 0) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const integrationData = integrationResult.rows[0];
    if (integrationData.type !== 'github') {
      return res.status(400).json({ error: 'Repository removal is only supported for GitHub integrations' });
    }

    const tableCheckResult = await query(
      `SELECT EXISTS (
         SELECT 1
         FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name = 'developer_work_items'
       ) AS table_exists`
    );

    if (tableCheckResult.rows[0]?.table_exists) {
      await query(
        `DELETE FROM developer_work_items
         WHERE work_item_id IN (
           SELECT id FROM work_items WHERE tenant_id = $1 AND source_type = $2 AND source_id = $3
         )`,
        [tenantId, 'github', source_id]
      );
    }

    await query(
      'DELETE FROM work_items WHERE tenant_id = $1 AND source_type = $2 AND source_id = $3',
      [tenantId, 'github', source_id]
    );

    return res.json({ success: true, source_id });
  } catch (error: any) {
    console.error('Remove repo error:', error);
    return res.status(500).json({ error: error.message || 'Unable to remove repository' });
  }
});

router.get('/api/integrations/:id/health', authenticate, async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const tenantId = user?.tenant_id;
    const { id } = req.params;

    if (!tenantId) {
      return res.status(401).json({ error: 'Invalid user session' });
    }

    const integrationResult = await query('SELECT id, tenant_id, type FROM integrations WHERE id = $1 AND tenant_id = $2', [id, tenantId]);

    if (integrationResult.rowCount === 0) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const integration = createIntegrationClient(integrationResult.rows[0].type, tenantId, id);
    const healthy = await integration.validateConnection();
    return res.json({ healthy });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Unable to verify integration health' });
  }
});

export default router;
