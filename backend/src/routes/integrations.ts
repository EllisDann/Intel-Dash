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
    const result = await query(
      'SELECT id, type, display_name, is_connected, connected_at, disconnected_at, created_at, updated_at FROM integrations WHERE tenant_id = $1 ORDER BY created_at DESC',
      [user?.tenant_id]
    );
    return res.json({ integrations: result.rows });
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

    if (!tenantId) {
      return res.status(401).json({ error: 'Invalid user session' });
    }

    ensureIntegrationType(type);
    const integration = createIntegrationClient(type, tenantId);
    const state = await integration.createStateToken();
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
    await integration.handleCallback(String(code), String(state));

    return res.json({ success: true });
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

    const integration = createIntegrationClient(integrationResult.rows[0].type, tenantId, id);
    const result = await integration.fetchData();

    return res.json({ success: true, result });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Unable to sync integration' });
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
