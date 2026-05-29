import React, { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar';
import api from '../api';
import '../styles/onboarding.css';

interface Integration {
  id: string;
  type: string;
  display_name: string;
  is_connected: boolean;
  connected_at: string | null;
}

interface ImportedProject {
  project_id: string;
  project_name: string;
  source_type: string;
  total_items: number;
  open_items: number;
  closed_items: number;
}

interface AvailableRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  archived: boolean;
  private: boolean;
  html_url: string;
}

const availableIntegrations = [
  { type: 'github', label: 'GitHub', description: 'Import repository metrics, pull requests, and deployment data from GitHub.' },
  { type: 'jira', label: 'Jira', description: 'Import issues, sprints, and project management data from Jira.' },
];

const ConnectionsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'apps' | 'projects'>('apps');
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [importedProjects, setImportedProjects] = useState<ImportedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState<string | null>(null);
  const [syncedIntegrations, setSyncedIntegrations] = useState<Set<string>>(new Set());
  const [availableRepos, setAvailableRepos] = useState<AvailableRepo[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [reposError, setReposError] = useState('');
  const [importingRepo, setImportingRepo] = useState<string | null>(null);
  const [removingRepo, setRemovingRepo] = useState<string | null>(null);

  const fetchIntegrations = async () => {
    setError('');
    try {
      const response = await api.get('/api/integrations');
      setIntegrations(response.data.integrations || []);
      setImportedProjects(response.data.importedProjects || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Unable to load connected apps.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const fetchAvailableRepos = async (integrationId: string) => {
    setReposError('');
    setReposLoading(true);
    try {
      const response = await api.get(`/api/integrations/${integrationId}/repos`);
      setAvailableRepos(response.data.repos || []);
    } catch (err: any) {
      setReposError(err.response?.data?.error || 'Unable to load GitHub repositories.');
      setAvailableRepos([]);
    } finally {
      setReposLoading(false);
    }
  };

  const githubIntegration = integrations.find(i => i.type === 'github' && i.is_connected);

  useEffect(() => {
    if (githubIntegration) {
      fetchAvailableRepos(githubIntegration.id);
    } else {
      setAvailableRepos([]);
    }
  }, [githubIntegration]);

  const handleImportRepo = async (repo: AvailableRepo) => {
    if (!githubIntegration) {
      return;
    }

    setError('');
    setImportingRepo(repo.full_name);

    try {
      await api.post(`/api/integrations/${githubIntegration.id}/repos/import`, {
        source_id: repo.full_name,
        title: repo.name,
        archived: repo.archived,
      });
      await fetchIntegrations();
      await fetchAvailableRepos(githubIntegration.id);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Unable to import repository.');
    } finally {
      setImportingRepo(null);
    }
  };

  // Auto-sync newly connected integrations
  useEffect(() => {
    const autoSync = async () => {
      const connectedIntegrations = integrations.filter(i => i.is_connected);
      for (const integration of connectedIntegrations) {
        if (!syncedIntegrations.has(integration.id)) {
          try {
            await api.post(`/api/integrations/${integration.id}/sync`);
            setSyncedIntegrations(prev => new Set(prev).add(integration.id));
            await fetchIntegrations();
            setActiveTab('projects');
          } catch (err: any) {
            console.error('Auto-sync failed:', err);
          }
        }
      }
    };

    if (integrations.length > 0) {
      autoSync();
    }
  }, [integrations]);

  const connectedByType = integrations.reduce<Record<string, Integration>>((acc, integration) => {
    if (!acc[integration.type]) {
      acc[integration.type] = integration;
    }
    return acc;
  }, {});

  const importedRepoIds = useMemo(() => new Set(importedProjects.map((project) => project.project_id)), [importedProjects]);

  const handleConnect = async (type: string) => {
    setError('');
    setConnecting(type);
    try {
      const response = await api.post(`/api/integrations/${type}/authorize?returnUrl=/connections`);
      window.location.href = response.data.authorizeUrl;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Unable to start authorization.');
      setConnecting(null);
    }
  };

  const handleDisconnect = async (id: string) => {
    setError('');
    try {
      await api.delete(`/api/integrations/${id}`);
      setSyncedIntegrations(prev => {
        const updated = new Set(prev);
        updated.delete(id);
        return updated;
      });
      fetchIntegrations();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Unable to disconnect integration.');
    }
  };

  const handleRemoveRepo = async (project: ImportedProject) => {
    if (!githubIntegration) {
      return;
    }

    setError('');
    setRemovingRepo(project.project_id);

    try {
      await api.delete(`/api/integrations/${githubIntegration.id}/repos`, {
        data: { source_id: project.project_id },
      });
      await fetchIntegrations();
      await fetchAvailableRepos(githubIntegration.id);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Unable to remove repository.');
    } finally {
      setRemovingRepo(null);
    }
  };

  return (
    <div className="page-shell page-shell--dashboard">
      <div className="dashboard-layout">
        <Sidebar />
        <main className="dashboard-main settings-main">
          <section className="settings-container">
            <div className="settings-header">
              <h1>Connections</h1>
              <p>Connect your tools and manage data imports</p>
            </div>

            <div className="connections-tab-container">
              <button
                type="button"
                className={`connections-tab-button ${activeTab === 'apps' ? 'active' : ''}`}
                onClick={() => setActiveTab('apps')}
              >
                Connected Apps
              </button>
              <button
                type="button"
                className={`connections-tab-button ${activeTab === 'projects' ? 'active' : ''}`}
                onClick={() => setActiveTab('projects')}
              >
                Imported Projects
              </button>
            </div>

            {activeTab === 'apps' ? (
              <section className="settings-section">
                <div className="section-header">
                  <h2>Connect Third-Party Apps</h2>
                  <p>Link GitHub and Jira to import data into Intel-Dash</p>
                </div>

                {loading ? (
                  <p>Loading connected apps...</p>
                ) : (
                  <div className="connections-grid">
                    {availableIntegrations.map((item) => {
                      const integration = connectedByType[item.type];
                      const isConnected = integration?.is_connected;
                      return (
                        <div key={item.type} className="connection-card">
                          <div className="connection-content">
                            <h3>{item.label}</h3>
                            <p>{item.description}</p>
                            <p className="connection-status">
                              {isConnected ? `Connected ${integration?.connected_at ? `since ${new Date(integration.connected_at).toLocaleDateString()}` : ''}` : 'Not connected'}
                            </p>
                          </div>
                          <div>
                            {isConnected ? (
                              <button type="button" className="button button-secondary" onClick={() => handleDisconnect(integration.id)}>
                                Disconnect
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="button button-primary"
                                onClick={() => handleConnect(item.type)}
                                disabled={connecting !== null}
                              >
                                {connecting === item.type ? 'Connecting…' : `Connect ${item.label}`}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            ) : (
              <section className="settings-section">
                <div className="section-header">
                  <h2>Imported Projects</h2>
                  <p>Review the projects and repositories imported from connected apps.</p>
                </div>

                {loading ? (
                  <p>Loading imported projects...</p>
                ) : importedProjects.length > 0 ? (
                  <div className="project-table-wrapper">
                    <table className="project-table">
                      <thead>
                        <tr>
                          <th>Source</th>
                          <th>Project</th>
                          <th>Total items</th>
                          <th>Open</th>
                          <th>Closed</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importedProjects.map((project) => {
                          const isGitHubRepo = project.source_type === 'github';
                          const isRemoving = removingRepo === project.project_id;
                          return (
                            <tr key={`${project.source_type}-${project.project_id}`}>
                              <td>{project.source_type}</td>
                              <td>{project.project_name}</td>
                              <td>{project.total_items}</td>
                              <td>{project.open_items}</td>
                              <td>{project.closed_items}</td>
                              <td>
                                {isGitHubRepo ? (
                                  <button
                                    type="button"
                                    className="button button-secondary"
                                    disabled={isRemoving}
                                    onClick={() => handleRemoveRepo(project)}
                                  >
                                    {isRemoving ? 'Disconnecting…' : 'Disconnect'}
                                  </button>
                                ) : (
                                  <span style={{ color: '#64748b' }}>—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div
                    style={{
                      padding: '2rem',
                      backgroundColor: '#f4f6fb',
                      borderRadius: '8px',
                      border: '1px solid rgba(15, 23, 42, 0.08)',
                      textAlign: 'center',
                    }}
                  >
                    <p style={{ color: '#64748b', margin: 0 }}>
                      No imported projects yet. Connect apps to start importing project data.
                    </p>
                  </div>
                )}

                {githubIntegration && (
                  <section className="settings-section" style={{ marginTop: '2rem' }}>
                    <div className="section-header">
                      <h3>Available GitHub Repositories</h3>
                      <p>Select repositories to import into Intel-Dash.</p>
                    </div>
                    {reposLoading ? (
                      <p>Loading repositories...</p>
                    ) : reposError ? (
                      <p className="error-message">{reposError}</p>
                    ) : availableRepos.length > 0 ? (
                      <div className="project-table-wrapper">
                        <table className="project-table">
                          <thead>
                            <tr>
                              <th>Repository</th>
                              <th>Description</th>
                              <th>Visibility</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {availableRepos.map((repo) => {
                              const alreadyImported = importedRepoIds.has(repo.full_name);
                              return (
                                <tr key={repo.full_name} className="repo-row">
                                  <td>
                                    <div className="repo-name">
                                      <a href={repo.html_url} target="_blank" rel="noreferrer">
                                        {repo.full_name}
                                      </a>
                                      <span className={`repo-badge ${repo.private ? 'private' : 'public'}`}>
                                        {repo.private ? 'Private' : 'Public'}
                                      </span>
                                    </div>
                                  </td>
                                  <td>
                                    <div className="repo-description">{repo.description || 'No description available'}</div>
                                  </td>
                                  <td>{repo.archived ? 'Archived' : 'Active'}</td>
                                  <td>
                                    <button
                                      type="button"
                                      className="button button-primary"
                                      disabled={alreadyImported || importingRepo === repo.full_name}
                                      onClick={() => handleImportRepo(repo)}
                                    >
                                      {alreadyImported ? 'Imported' : importingRepo === repo.full_name ? 'Importing…' : 'Import'}
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div
                        style={{
                          padding: '1.5rem',
                          backgroundColor: '#f8fafc',
                          borderRadius: '8px',
                          border: '1px solid rgba(15, 23, 42, 0.08)',
                          textAlign: 'center',
                        }}
                      >
                        <p style={{ color: '#64748b', margin: 0 }}>
                          No GitHub repositories were found. Make sure your GitHub integration is connected with repo access.
                        </p>
                      </div>
                    )}
                  </section>
                )}
              </section>
            )}

            {error && <p className="error-message">{error}</p>}
          </section>
        </main>
      </div>
    </div>
  );
};

export default ConnectionsPage;
