import React from 'react';
import { useNavigate } from 'react-router-dom';
import MetricCard from '../components/MetricCard';

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();

  const organization = {
    name: 'testteam',
    teamName: 'Team name',
    plan: 'trial',
    subscriptionStatus: 'Trial',
    trialStatus: 'Inactive',
    trialEnds: 'Not set',
    integrations: { connected: 0, total: 0 },
  };

  return (
    <div className="page-shell">
      <div className="dashboard-card dashboard-card--clean">
        <div className="section-header">
          <div>
            <h2>Organization settings</h2>
            <p className="section-description">Manage organization-level settings and subscription details.</p>
          </div>
        </div>

        <section className="dashboard-section">
          <div className="settings-grid">
            <div className="settings-card">
              <h3>Organization</h3>
              <p className="mono">{organization.name}</p>
              <button type="button" onClick={() => navigate(-1)} className="secondary">Back</button>
            </div>

            <div className="settings-card">
              <h3>Team name</h3>
              <p>{organization.teamName}</p>
            </div>

            <div className="settings-card">
              <h3>Plan</h3>
              <p className="mono">{organization.plan}</p>
              <p className="muted">Subscription status: {organization.subscriptionStatus}</p>
            </div>

            <div className="settings-card">
              <h3>Trial</h3>
              <p>Status: {organization.trialStatus}</p>
              <p>Ends: {organization.trialEnds}</p>
            </div>

            <div className="settings-card">
              <h3>Integrations</h3>
              <p>{organization.integrations.connected}/{organization.integrations.total}</p>
              <p>Connected services</p>
            </div>

            <div className="settings-card">
              <h3>Quick actions</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="small-action">Sync integrations</button>
                <button type="button" className="small-action">Upgrade plan</button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default SettingsPage;
