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
        client_id: clientId ?? '',
        client_secret: clientSecret ?? '',
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

  private async getGithubToken() {
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

    return decrypt(credentialResult.rows[0].encrypted_credential);
  }

  async syncRepositoryMetrics(repoFullNames: string[]) {
    if (!this.integrationId) {
      throw new Error('Integration id is required');
    }

    const token = await this.getGithubToken();
    const syncedRepos: string[] = [];
    let totalPullRequests = 0;
    let totalDeployments = 0;

    for (const repoFullName of repoFullNames) {
      try {
        const prCount = await this.fetchAndStorePullRequestsForRepo(repoFullName, token);
        const deploymentCount = await this.fetchAndStoreDeploymentsForRepo(repoFullName, token);
        totalPullRequests += prCount;
        totalDeployments += deploymentCount;
        syncedRepos.push(repoFullName);
      } catch (err: any) {
        console.error(`GitHub sync failed for ${repoFullName}:`, err?.response?.data || err?.message || err);
      }
    }

    return { syncedRepos, totalPullRequests, totalDeployments };
  }

  async fetchCommitCountForRepos(repoFullNames: string[], startDate: string, endDate: string) {
    if (!this.integrationId) {
      throw new Error('Integration id is required');
    }

    let totalCommits = 0;
    for (const repoFullName of repoFullNames) {
      totalCommits += await this.countCommitsForRepo(repoFullName, startDate, endDate);
    }

    return totalCommits;
  }

  async fetchCommitCountsForRepos(repoFullNames: string[], startDate: string, endDate: string) {
    if (!this.integrationId) {
      throw new Error('Integration id is required');
    }

    const counts: Record<string, number> = {};
    for (const repoFullName of repoFullNames) {
      counts[repoFullName] = await this.countCommitsForRepo(repoFullName, startDate, endDate);
    }
    return counts;
  }

  private async countCommitsForRepo(repoFullName: string, startDate: string, endDate: string) {
    const token = await this.getGithubToken();
    const [owner, repo] = repoFullName.split('/');
    let totalCommits = 0;
    let page = 1;

    while (true) {
      const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/commits`, {
        headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
        params: {
          per_page: 100,
          page,
          since: `${startDate}T00:00:00Z`,
          until: `${endDate}T23:59:59Z`,
        },
      });

      const commits = response.data || [];
      if (!Array.isArray(commits) || commits.length === 0) {
        break;
      }

      totalCommits += commits.length;
      if (commits.length < 100) {
        break;
      }
      page += 1;
    }

    return totalCommits;
  }

  private async fetchAndStorePullRequestsForRepo(repoFullName: string, token: string) {
    const [owner, repo] = repoFullName.split('/');
    let page = 1;
    let prCount = 0;

    while (true) {
      const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
        headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
        params: { state: 'all', per_page: 100, page },
      });

      const pullRequests = response.data || [];
      if (!Array.isArray(pullRequests) || pullRequests.length === 0) {
        break;
      }

      for (const pr of pullRequests) {
        // fetch full PR details to get commits/additions/deletions if list endpoint is sparse
        let fullPr = pr;
        try {
          const detailResp = await axios.get(`https://api.github.com/repos/${owner}/${repo}/pulls/${pr.number}`, {
            headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
          });
          fullPr = detailResp.data || pr;
        } catch (err) {
          // fall back to list item if detail fetch fails
        }

        const prRow = await query(
          `INSERT INTO pull_requests (
             tenant_id, source_type, source_id, repo_name, pr_number, title, state,
             created_at, updated_at, merged_at, closed_at, external_id, metadata, indexed_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
           ON CONFLICT (tenant_id, source_id, external_id)
           DO UPDATE SET
             title = EXCLUDED.title,
             state = EXCLUDED.state,
             updated_at = EXCLUDED.updated_at,
             merged_at = EXCLUDED.merged_at,
             closed_at = EXCLUDED.closed_at,
             metadata = EXCLUDED.metadata,
             indexed_at = NOW()
           RETURNING id`,
          [
            this.tenantId,
            'github',
            repoFullName,
            repoFullName,
            fullPr.number,
            fullPr.title,
            fullPr.state,
            fullPr.created_at,
            fullPr.updated_at,
            fullPr.merged_at,
            fullPr.closed_at,
            String(fullPr.id),
            {
              author: fullPr.user?.login,
              additions: fullPr.additions,
              deletions: fullPr.deletions,
              changed_files: fullPr.changed_files,
              comments: fullPr.comments,
              review_comments: fullPr.review_comments,
              commits: fullPr.commits,
              draft: fullPr.draft,
            },
          ]
        );

        const pullRequestId = prRow.rows[0]?.id;
        if (pullRequestId) {
          await this.upsertThroughputMetrics(fullPr, repoFullName, String(fullPr.id));
          await this.upsertReviewEfficiencyMetrics(fullPr, repoFullName, String(fullPr.id), pullRequestId, token);
          prCount += 1;
        }
      }

      if (pullRequests.length < 100) {
        break;
      }
      page += 1;
    }

    return prCount;
  }

  private async upsertThroughputMetrics(pr: any, repoFullName: string, externalId: string) {
    await query(
      `DELETE FROM throughput_metrics
       WHERE tenant_id = $1
         AND period_type = 'daily'
         AND metadata->>'source' = 'github_metrics'
         AND metadata->>'pull_request_external_id' = $2`,
      [this.tenantId, externalId]
    );

    await query(
      `INSERT INTO throughput_metrics (
         tenant_id, snapshot_date, period_type, completed_tickets, completed_story_points,
         merged_prs, commits_count, metadata
       ) VALUES ($1, $2, 'daily', $3, $4, $5, $6, $7)`,
      [
        this.tenantId,
        pr.created_at?.slice(0, 10),
        0,
        0,
        pr.merged_at ? 1 : 0,
        pr.commits ?? 0,
        {
          source: 'github_metrics',
          pull_request_external_id: externalId,
          repo: repoFullName,
        },
      ]
    );
  }

  private async upsertReviewEfficiencyMetrics(pr: any, repoFullName: string, externalId: string, pullRequestId: string, token: string) {
    const [owner, repo] = repoFullName.split('/');
    let reviews: any[] = [];
    let page = 1;

    while (true) {
      const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/pulls/${pr.number}/reviews`, {
        headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
        params: { per_page: 100, page },
      });
      const pageReviews = response.data || [];
      reviews = reviews.concat(pageReviews);
      if (pageReviews.length < 100) break;
      page += 1;
    }

    const reviewerNames = new Set<string>();
    let firstReviewSubmittedAt: string | null = null;
    let lastReviewSubmittedAt: string | null = null;
    let approvalAt: string | null = null;

    for (const review of reviews) {
      if (review.user?.login) {
        reviewerNames.add(review.user.login);
      }
      if (review.submitted_at) {
        const submittedAt = review.submitted_at;
        if (!firstReviewSubmittedAt || submittedAt < firstReviewSubmittedAt) {
          firstReviewSubmittedAt = submittedAt;
        }
        if (!lastReviewSubmittedAt || submittedAt > lastReviewSubmittedAt) {
          lastReviewSubmittedAt = submittedAt;
        }
      }
      if (review.state === 'APPROVED' && review.submitted_at) {
        if (!approvalAt || review.submitted_at < approvalAt) {
          approvalAt = review.submitted_at;
        }
      }
    }

    const reviewRounds = reviews.length;
    const commentsCount = pr.review_comments ?? 0;
    const timeToFirstResponseHours = firstReviewSubmittedAt && pr.created_at
      ? (new Date(firstReviewSubmittedAt).getTime() - new Date(pr.created_at).getTime()) / 3600000
      : null;
    const timeToApprovalHours = approvalAt && firstReviewSubmittedAt
      ? (new Date(approvalAt).getTime() - new Date(firstReviewSubmittedAt).getTime()) / 3600000
      : null;

    await query('DELETE FROM review_efficiency_metrics WHERE tenant_id = $1 AND pull_request_id = $2', [this.tenantId, pullRequestId]);
    await query(
      `INSERT INTO review_efficiency_metrics (
         tenant_id, pull_request_id, reviewer_name, first_review_requested_at,
         first_review_submitted_at, last_review_submitted_at, approval_at,
         time_to_first_response_hours, time_to_approval_hours, review_rounds,
         comments_count, is_ai_assisted, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, false, NOW())`,
      [
        this.tenantId,
        pullRequestId,
        Array.from(reviewerNames).join(', '),
        pr.created_at,
        firstReviewSubmittedAt,
        lastReviewSubmittedAt,
        approvalAt,
        timeToFirstResponseHours,
        timeToApprovalHours,
        reviewRounds,
        commentsCount,
      ]
    );
  }

  private async fetchAndStoreDeploymentsForRepo(repoFullName: string, token: string) {
    const [owner, repo] = repoFullName.split('/');
    let page = 1;
    let deploymentCount = 0;

    while (true) {
      const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/deployments`, {
        headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
        params: { per_page: 100, page },
      });

      const deployments = response.data || [];
      if (!Array.isArray(deployments) || deployments.length === 0) {
        break;
      }

      for (const deployment of deployments) {
        await query(
          `INSERT INTO deployments (
             tenant_id, source_type, source_id, environment, ref, status,
             created_at, updated_at, deployed_at, external_id, metadata, indexed_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
           ON CONFLICT (tenant_id, source_id, external_id)
           DO UPDATE SET
             environment = EXCLUDED.environment,
             ref = EXCLUDED.ref,
             status = EXCLUDED.status,
             updated_at = EXCLUDED.updated_at,
             deployed_at = EXCLUDED.deployed_at,
             metadata = EXCLUDED.metadata,
             indexed_at = NOW()`,
          [
            this.tenantId,
            'github',
            repoFullName,
            deployment.environment,
            deployment.ref,
            deployment.state,
            deployment.created_at,
            deployment.updated_at,
            deployment.created_at,
            String(deployment.id),
            {
              task: deployment.task,
              payload: deployment.payload,
              description: deployment.description,
              creator: deployment.creator?.login,
            },
          ]
        );
        deploymentCount += 1;
      }

      if (deployments.length < 100) {
        break;
      }
      page += 1;
    }

    return deploymentCount;
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
