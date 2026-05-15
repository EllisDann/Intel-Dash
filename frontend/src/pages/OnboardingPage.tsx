import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import api from '../api';

const OnboardingPage = () => {
  const { tenant, updateProfile, user } = useAuth();
  const [teamName, setTeamName] = useState(tenant?.name || '');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (tenant?.name) {
      setTeamName(tenant.name);
    }
  }, [tenant]);

  const handleSaveTeam = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (!teamName.trim()) {
      setError('Team name is required');
      return;
    }

    try {
      setSaving(true);
      await updateProfile({ tenant_name: teamName.trim() });
      setSaved(true);
      setMessage('Team created successfully. You can now connect apps.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Unable to save team name.');
    } finally {
      setSaving(false);
    }
  };

  const handleConnect = async (type: string) => {
    try {
      setError('');
      setMessage('Redirecting to authorization...');
      setConnecting(true);
      const response = await api.post(`/api/integrations/${type}/authorize`);
      window.location.href = response.data.authorizeUrl;
    } catch (err: any) {
      setConnecting(false);
      setError(err.response?.data?.error || 'Unable to start app connection.');
    }
  };

  return (
    <div className="page-shell">
      <div className="dashboard-card">
        <header className="dashboard-header">
          <div>
            <h1>Welcome, {user?.email}</h1>
            <p>Finish onboarding by creating your team and connecting integrations.</p>
          </div>
        </header>

        <section>
          <h2>Step 1: Create your team</h2>
          <form onSubmit={handleSaveTeam} className="onboarding-form">
            <label>
              Team name
              <input
                type="text"
                value={teamName}
                onChange={(event) => setTeamName(event.target.value)}
                placeholder="Enter your team name"
                required
              />
            </label>
            <button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save team'}</button>
          </form>
        </section>

        <section>
          <h2>Step 2: Connect apps</h2>
          <p>Connect GitHub or Jira so IntelBoard can start pulling data for your team.</p>
          <div className="integration-list">
            <div className="integration-row">
              <div>
                <h3>GitHub</h3>
                <p>Connect your GitHub account to import repo and team data.</p>
              </div>
              <button onClick={() => handleConnect('github')} disabled={connecting}>{connecting ? 'Connecting...' : 'Connect GitHub'}</button>
            </div>
            <div className="integration-row">
              <div>
                <h3>Jira</h3>
                <p>Connect Jira to bring issue and sprint metrics into IntelBoard.</p>
              </div>
              <button onClick={() => handleConnect('jira')} disabled={connecting}>{connecting ? 'Connecting...' : 'Connect Jira'}</button>
            </div>
          </div>
        </section>

        {message && <p className="success-message">{message}</p>}
        {error && <p className="error-message">{error}</p>}

        <div style={{ marginTop: '1.5rem' }}>
          <button type="button" onClick={() => navigate('/')}>Go to dashboard</button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;
