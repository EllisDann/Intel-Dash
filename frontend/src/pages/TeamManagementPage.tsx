import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import Sidebar from '../components/Sidebar';
import '../styles/onboarding.css';

const TeamManagementPage: React.FC = () => {
  const { user, tenant, updateProfile } = useAuth();
  const [teamName, setTeamName] = useState(tenant?.name ?? 'Team Name');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const userName = user?.name || user?.email?.split('@')[0] || 'User';
  const email = user?.email ?? 'user@example.com';

  useEffect(() => {
    setTeamName(tenant?.name ?? 'Team Name');
  }, [tenant]);

  const handleSaveTeamName = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (!teamName.trim()) {
      setError('Team name is required');
      return;
    }

    try {
      setSaving(true);
      await updateProfile({ tenant_name: teamName.trim() });
      setMessage('Team settings saved successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Unable to save team name.');
    } finally {
      setSaving(false);
    }
  };

  const members = [
    {
      id: 'current-user',
      avatar: user?.profileImage || null,
      name: userName,
      email,
      role: 'Admin',
    },
  ];

  return (
    <div className="page-shell page-shell--dashboard">
      <div className="dashboard-layout">
        <Sidebar />
        <main className="dashboard-main settings-main">
          <section className="settings-container">
            <div className="settings-sections">
              <section className="settings-section team-section">
                <form onSubmit={handleSaveTeamName}>
                  <div className="section-header">
                    <h2>Team Identity</h2>
                    <p>Update your team name and review active membership.</p>
                  </div>

                  <div className="settings-row settings-row--split">
                    <div className="form-group" style={{ flex: 1 }}>
                      <label htmlFor="teamName">Team Name</label>
                      <input
                        id="teamName"
                        type="text"
                        value={teamName}
                        onChange={(e) => setTeamName(e.target.value)}
                        placeholder="Teamname"
                      />
                    </div>
                    <div className="team-summary-card">
                      <span className="team-summary-label">Members</span>
                      <strong>{members.length}</strong>
                    </div>
                  </div>

                  {message && <p className="success-message">{message}</p>}
                  {error && <p className="error-message">{error}</p>}

                  <div className="settings-actions" style={{ marginTop: '1.5rem' }}>
                    <button type="submit" className="button button-primary" disabled={saving}>
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </section>

              <section className="settings-section team-section">
                <div className="section-header">
                  <h2>Team Members</h2>
                  <p>Manage who has access to this team and their roles.</p>
                </div>

                <div className="team-members-table">
                  <div className="team-member-row team-member-row--header">
                    <div>Name &amp; Email</div>
                    <div>Role</div>
                  </div>
                  {members.map((member) => (
                    <div key={member.id} className="team-member-row">
                      <div className="team-member-info">
                        <div className="team-member-avatar">
                          {member.avatar ? (
                            <img src={member.avatar} alt={member.name} />
                          ) : (
                            <span>{member.name.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <div>
                          <div className="team-member-name">{member.name}</div>
                          <div className="team-member-email">{member.email}</div>
                        </div>
                      </div>
                      <div className="team-member-role">{member.role}</div>
                    </div>
                  ))}
                </div>

                <div className="settings-actions" style={{ paddingTop: '1.5rem' }}>
                  <button type="button" className="button button-primary">
                    Add Team Member
                  </button>
                </div>
              </section>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default TeamManagementPage;
