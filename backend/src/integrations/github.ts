import axios from 'axios';
import crypto from 'crypto';
import { query } from '../db';
import { BaseIntegration } from './base';
import { encrypt, decrypt } from '../utils/crypto';

const clientId = process.env.GITHUB_CLIENT_ID;
const clientSecret = process.env.GITHUB_CLIENT_SECRET;
const redirectUri = process.env.GITHUB_OAUTH_REDIRECT || 'http://localhost:3000/oauth/github/callback';

if (!clientId || !clientSecret) {
  console.warn('GitHub OAuth is not fully configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.');
}

export class GitHubIntegration extends BaseIntegration {
  getAuthorizationUrl(state: string) {
    if (!clientId || !clientSecret) {
      throw new Error('GitHub OAuth is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.');
    }
    return `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(clientId)}&scope=repo%20read:org&state=${encodeURIComponent(state)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  }

  async createStateToken(returnUrl?: string) {
    const state = crypto.randomBytes(24).toString('hex');
    await query(
      'INSERT INTO oauth_states (tenant_id, integration_type, state, expires_at, return_url) VALUES ($1, $2, $3, NOW() + INTERVAL \'15 minutes\', $4)',
      [this.tenantId, 'github', state, returnUrl || null]
    );
    return state;
  }

  async handleCallback(code: string, state: string) {
    const stateResult = await query(
      'SELECT id, return_url FROM oauth_states WHERE tenant_id = $1 AND integration_type = $2 AND state = $3 AND expires_at > NOW()',
      [this.tenantId, 'github', state]
    );
    if (stateResult.rowCount === 0) {
      throw new Error('Invalid or expired OAuth state token');
    }

    const returnUrl = stateResult.rows[0].return_url;

    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        state,
      }).toString(),
      { headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const accessToken = tokenResponse.data?.access_token;
    if (!accessToken) {
      console.error('GitHub token exchange failed', tokenResponse.data);
      throw new Error(tokenResponse.data?.error_description || tokenResponse.data?.error || 'Unable to obtain GitHub access token');
    }

    let integrationId = this.integrationId;
    if (!integrationId) {
      const integrationResult = await query(
        'INSERT INTO integrations (tenant_id, type, display_name, is_connected, connected_at, created_at, updated_at) VALUES ($1, $2, $3, true, NOW(), NOW(), NOW()) RETURNING id',
        [this.tenantId, 'github', 'GitHub']
      );
      integrationId = integrationResult.rows[0].id;
    }

    await query(
      'INSERT INTO integration_credentials (integration_id, credential_type, encrypted_credential, expires_at, created_at) VALUES ($1, $2, $3, $4, NOW())',
      [integrationId, 'oauth_token', encrypt(accessToken), null]
    );

    await query('UPDATE integrations SET is_connected = true, connected_at = NOW(), disconnected_at = NULL, updated_at = NOW() WHERE id = $1', [integrationId]);

    return { returnUrl };
  }

  async disconnect() {
    if (!this.integrationId) {
      return;
    }
    await query('DELETE FROM integration_credentials WHERE integration_id = $1', [this.integrationId]);
    await query('UPDATE integrations SET is_connected = false, disconnected_at = NOW(), updated_at = NOW() WHERE id = $1', [this.integrationId]);
  }

  async validateConnection() {
    if (!this.integrationId) {
      return false;
    }
    const credentialResult = await query(
      'SELECT encrypted_credential FROM integration_credentials WHERE integration_id = $1 AND (expires_at IS NULL OR expires_at > NOW()) ORDER BY created_at DESC LIMIT 1',
      [this.integrationId]
    );
    return Boolean(credentialResult?.rowCount && credentialResult.rowCount > 0);
  }

  async fetchData() {
    if (!this.integrationId) {
      throw new Error('Integration id is required');
    }
    const credentialResult = await query(
      'SELECT encrypted_credential FROM integration_credentials WHERE integration_id = $1 AND (expires_at IS NULL OR expires_at > NOW()) ORDER BY created_at DESC LIMIT 1',
      [this.integrationId]
    );
    if (credentialResult.rowCount === 0) {
      throw new Error('No GitHub credentials available');
    }

    try {
      const token = decrypt(credentialResult.rows[0].encrypted_credential);
      console.log('GitHub fetchData: token retrieved, length:', token?.length);
      
      const response = await axios.get('https://api.github.com/user', {
        headers: { Authorization: `token ${token}`, Accept: 'application/json' },
      });
      return { account: response.data };
    } catch (err: any) {
      console.error('GitHub fetchData error:', {
        status: err.response?.status,
        message: err.response?.data?.message,
        tokenExists: !!credentialResult.rows[0].encrypted_credential,
      });
      throw err;
    }
  }

  // Fetch deployments for a given repo owner/repo
  async fetchDeployments(owner: string, repo: string) {
    if (!this.integrationId) {
      throw new Error('Integration id is required');
    }
    const credentialResult = await query(
      'SELECT encrypted_credential FROM integration_credentials WHERE integration_id = $1 AND (expires_at IS NULL OR expires_at > NOW()) ORDER BY created_at DESC LIMIT 1',
      [this.integrationId]
    );
    if (credentialResult.rowCount === 0) {
      throw new Error('No GitHub credentials available');
    }

    const token = decrypt(credentialResult.rows[0].encrypted_credential);
    try {
      const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/deployments`, {
        headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
        params: { per_page: 100, sort: 'created', direction: 'desc' },
      });
      return response.data || [];
    } catch (err) {
      console.error(`Failed to fetch deployments for ${owner}/${repo}:`, err);
      return [];
    }
  }

  // Fetch and store user repositories
  async fetchAndStoreRepositories() {
    if (!this.integrationId) {
      throw new Error('Integration id is required');
    }

    const credentialResult = await query(
      'SELECT encrypted_credential FROM integration_credentials WHERE integration_id = $1 AND (expires_at IS NULL OR expires_at > NOW()) ORDER BY created_at DESC LIMIT 1',
      [this.integrationId]
    );
    if (credentialResult.rowCount === 0) {
      throw new Error('No GitHub credentials available');
    }

    const token = decrypt(credentialResult.rows[0].encrypted_credential);

    try {
      // Fetch user's repositories
      const response = await axios.get('https://api.github.com/user/repos', {
        headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
        params: { per_page: 100, sort: 'updated', direction: 'desc', affiliation: 'owner,collaborator' },
      });

      const repos = response.data || [];
      console.log(`GitHub: Found ${repos.length} repositories`);

      // Clear existing repos for this integration to avoid duplicates
      await query(
        'DELETE FROM work_items WHERE tenant_id = $1 AND source_type = $2',
        [this.tenantId, 'github']
      );

      // Insert each repo as a work item
      for (const repo of repos) {
        await query(
          `INSERT INTO work_items (tenant_id, source_type, source_id, title, state, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT DO NOTHING`,
          [
            this.tenantId,
            'github',
            repo.full_name,
            repo.name,
            repo.archived ? 'archived' : 'active',
            new Date(),
          ]
        );
      }

      console.log(`GitHub: Stored ${repos.length} repositories for tenant ${this.tenantId}`);
      return { imported: repos.length, repos };
    } catch (err: any) {
      console.error('GitHub fetchAndStoreRepositories error:', {
        status: err.response?.status,
        message: err.response?.data?.message,
      });
      throw err;
    }
  }

  async fetchRepositories() {
    if (!this.integrationId) {
      throw new Error('Integration id is required');
    }

    const credentialResult = await query(
      'SELECT encrypted_credential FROM integration_credentials WHERE integration_id = $1 AND (expires_at IS NULL OR expires_at > NOW()) ORDER BY created_at DESC LIMIT 1',
      [this.integrationId]
    );
    if (credentialResult.rowCount === 0) {
      throw new Error('No GitHub credentials available');
    }

    const token = decrypt(credentialResult.rows[0].encrypted_credential);

    try {
      const response = await axios.get('https://api.github.com/user/repos', {
        headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
        params: { per_page: 100, sort: 'updated', direction: 'desc', affiliation: 'owner,collaborator' },
      });
      return response.data || [];
    } catch (err: any) {
      console.error('GitHub fetchRepositories error:', {
        status: err.response?.status,
        message: err.response?.data?.message,
      });
      throw err;
    }
  }

  async importRepository(sourceId: string, title: string, archived: boolean = false) {
    if (!this.integrationId) {
      throw new Error('Integration id is required');
    }

    const credentialResult = await query(
      'SELECT encrypted_credential FROM integration_credentials WHERE integration_id = $1 AND (expires_at IS NULL OR expires_at > NOW()) ORDER BY created_at DESC LIMIT 1',
      [this.integrationId]
    );
    if (credentialResult.rowCount === 0) {
      throw new Error('No GitHub credentials available');
    }

    await query(
      `INSERT INTO work_items (tenant_id, source_type, source_id, title, state, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT DO NOTHING`,
      [this.tenantId, 'github', sourceId, title, archived ? 'archived' : 'active']
    );

    return { imported: true, repo: { source_id: sourceId, title } };
  }

  // Fetch deployment statuses for a specific deployment
  async fetchDeploymentStatuses(owner: string, repo: string, deploymentId: number) {
    if (!this.integrationId) {
      throw new Error('Integration id is required');
    }
    const credentialResult = await query(
      'SELECT encrypted_credential FROM integration_credentials WHERE integration_id = $1 AND (expires_at IS NULL OR expires_at > NOW()) ORDER BY created_at DESC LIMIT 1',
      [this.integrationId]
    );
    if (credentialResult.rowCount === 0) {
      throw new Error('No GitHub credentials available');
    }

    const token = decrypt(credentialResult.rows[0].encrypted_credential);
    try {
      const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/deployments/${deploymentId}/statuses`, {
        headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
        params: { per_page: 100 },
      });
      return response.data || [];
    } catch (err) {
      console.error(`Failed to fetch deployment statuses for ${owner}/${repo}/${deploymentId}:`, err);
      return [];
    }
  }
}
