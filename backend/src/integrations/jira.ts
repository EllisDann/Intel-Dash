import axios from 'axios';
import crypto from 'crypto';
import { query } from '../db';
import { BaseIntegration } from './base';
import { encrypt, decrypt } from '../utils/crypto';

const clientId = process.env.JIRA_CLIENT_ID;
const clientSecret = process.env.JIRA_CLIENT_SECRET;
const redirectUri = process.env.JIRA_OAUTH_REDIRECT || 'http://localhost:3000/oauth/jira/callback';

if (!clientId || !clientSecret) {
  console.warn('Jira OAuth is not fully configured. Set JIRA_CLIENT_ID and JIRA_CLIENT_SECRET.');
}

export class JiraIntegration extends BaseIntegration {
  getAuthorizationUrl(state: string) {
    return `https://auth.atlassian.com/authorize?audience=api://default&client_id=${encodeURIComponent(
      clientId || ''
    )}&scope=read%3Ajira-user%20read%3Ajira-work%20offline_access&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&state=${encodeURIComponent(state)}&response_type=code&prompt=consent`;
  }

  async createStateToken() {
    const state = crypto.randomBytes(24).toString('hex');
    await query(
      'INSERT INTO oauth_states (tenant_id, integration_type, state, expires_at) VALUES ($1, $2, $3, NOW() + INTERVAL \'15 minutes\')',
      [this.tenantId, 'jira', state]
    );
    return state;
  }

  async handleCallback(code: string, state: string) {
    const stateResult = await query(
      'SELECT id FROM oauth_states WHERE tenant_id = $1 AND integration_type = $2 AND state = $3 AND expires_at > NOW()',
      [this.tenantId, 'jira', state]
    );
    if (stateResult.rowCount === 0) {
      throw new Error('Invalid or expired OAuth state token');
    }

    const tokenResponse = await axios.post(
      'https://auth.atlassian.com/oauth/token',
      {
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const accessToken = tokenResponse.data.access_token;
    if (!accessToken) {
      throw new Error('Unable to obtain Jira access token');
    }

    let integrationId = this.integrationId;
    if (!integrationId) {
      const integrationResult = await query(
        'INSERT INTO integrations (tenant_id, type, display_name, is_connected, connected_at, created_at, updated_at) VALUES ($1, $2, $3, true, NOW(), NOW(), NOW()) RETURNING id',
        [this.tenantId, 'jira', 'Jira']
      );
      integrationId = integrationResult.rows[0].id;
    }

    await query(
      'INSERT INTO integration_credentials (integration_id, credential_type, encrypted_credential, expires_at, created_at) VALUES ($1, $2, $3, NULL, NOW())',
      [integrationId, 'oauth_token', encrypt(accessToken), null]
    );

    await query('UPDATE integrations SET is_connected = true, connected_at = NOW(), disconnected_at = NULL, updated_at = NOW() WHERE id = $1', [integrationId]);
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
    const credentialResult = await query('SELECT encrypted_credential FROM integration_credentials WHERE integration_id = $1 LIMIT 1', [this.integrationId]);
    return Boolean(credentialResult?.rowCount && credentialResult.rowCount > 0);
  }

  async fetchData() {
    if (!this.integrationId) {
      throw new Error('Integration id is required');
    }
    const credentialResult = await query('SELECT encrypted_credential FROM integration_credentials WHERE integration_id = $1 LIMIT 1', [this.integrationId]);
    if (credentialResult.rowCount === 0) {
      throw new Error('No Jira credentials available');
    }

    const token = decrypt(credentialResult.rows[0].encrypted_credential);
    const response = await axios.get('https://api.atlassian.com/oauth/token/accessible-resources', {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    return { resources: response.data };
  }
}
