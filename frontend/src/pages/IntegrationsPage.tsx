import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

interface Integration {
  id: string;
  type: string;
  display_name: string;
  is_connected: boolean;
  connected_at: string | null;
}

const availableIntegrations = [
  { type: 'github', label: 'GitHub' },
  { type: 'jira', label: 'Jira' },
];

const IntegrationsPage = () => {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchIntegrations = async () => {
    setError('');
    try {
      const response = await api.get('/api/integrations');
      setIntegrations(response.data.integrations);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Unable to load integrations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const handleConnect = async (type: string) => {
    try {
      const response = await api.post(`/api/integrations/${type}/authorize`);
      window.location.href = response.data.authorizeUrl;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Unable to start authorization');
    }
  };

  const handleDisconnect = async (id: string) => {
    setError('');
    try {
      await api.delete(`/api/integrations/${id}`);
      fetchIntegrations();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Unable to disconnect integration');
    }
  };

  const connectedByType = integrations.reduce<Record<string, Integration>>((acc, integration) => {
    acc[integration.type] = integration;
    return acc;
  }, {});

  return (
    <div className="page-shell">
      <div className="dashboard-card">
        <header className="dashboard-header">
          <div>
            <h1>Integration settings</h1>
            <p>Connect third-party services and manage integration access for your organization.</p>
          </div>
          <Link to="/">Back to dashboard</Link>
        </header>

        {loading ? (
          <p>Loading integrations...</p>
        ) : (
          <div className="integration-list">
            {availableIntegrations.map((item) => {
              const integration = connectedByType[item.type];
              return (
                <div key={item.type} className="integration-row">
                  <div>
                    <h2>{item.label}</h2>
                    <p>{integration?.is_connected ? 'Connected' : 'Not connected'}</p>
                  </div>
                  <div>
                    {integration?.is_connected ? (
                      <button onClick={() => handleDisconnect(integration.id)}>Disconnect</button>
                    ) : (
                      <button onClick={() => handleConnect(item.type)}>Connect</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {error && <p className="error-message">{error}</p>}
      </div>
    </div>
  );
};

export default IntegrationsPage;
