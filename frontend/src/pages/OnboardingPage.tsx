import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import api from '../api';
import '../styles/onboarding.css';

type OnboardingStep = 'account-settings' | 'team-settings' | 'connections';

const OnboardingPage = () => {
  const { tenant, updateProfile, user } = useAuth();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('account-settings');
  const [username, setUsername] = useState('');
  const [teamName, setTeamName] = useState(tenant?.name || '');
  const [profilePicture, setProfilePicture] = useState<File | null>(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (tenant?.name) {
      setTeamName(tenant.name);
    }
  }, [tenant]);

  const handleProfilePictureChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setProfilePicture(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePicturePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveAccount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (!username.trim()) {
      setError('Username is required');
      return;
    }
    if (username.includes(' ')) {
      setError('Username cannot contain spaces');
      return;
    }

    try {
      setSaving(true);
      const payload: any = { name: username.trim() };

      if (profilePicturePreview) {
        payload.profile_image = profilePicturePreview;
      }

      await api.put('/api/user/profile', payload);

      setMessage('Account settings saved successfully!');
      setTimeout(() => {
        setCurrentStep('team-settings');
        setMessage('');
      }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Unable to save account settings.');
    } finally {
      setSaving(false);
    }
  };

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
      setMessage('Team settings saved successfully!');
      setTimeout(() => {
        setCurrentStep('connections');
        setMessage('');
      }, 1500);
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

  const handleSkipConnections = () => {
    navigate('/dashboard');
  };

  const renderStepIndicator = () => {
    const isAccountActive = currentStep === 'account-settings';
    const isTeamActive = currentStep === 'team-settings';
    const isConnectionActive = currentStep === 'connections';

    return (
      <div className="onboarding-steps">
        <div className={`step ${isAccountActive ? 'active' : 'completed'}`}>
          <div className="step-number">1</div>
          <div className="step-label">Account</div>
        </div>
        <div className="step-connector" />
        <div className={`step ${isTeamActive ? 'active' : isConnectionActive ? 'completed' : ''}`}>
          <div className="step-number">2</div>
          <div className="step-label">Team</div>
        </div>
        <div className="step-connector" />
        <div className={`step ${isConnectionActive ? 'active' : ''}`}>
          <div className="step-number">3</div>
          <div className="step-label">Connections</div>
        </div>
      </div>
    );
  };

  const renderAccountSettings = () => (
    <section className="onboarding-section">
      <div className="section-header">
        <h2>Account Settings</h2>
        <p>Set up your profile with your name and optional profile picture.</p>
      </div>

      <form onSubmit={handleSaveAccount} className="onboarding-form">
        <div className="form-group">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Enter your username"
            required
          />
        </div>

        <div className="form-group">
          <label>Profile Picture (Optional)</label>
          <div className="profile-picture-section">
            {profilePicturePreview ? (
              <img src={profilePicturePreview} alt="Profile preview" className="profile-picture-preview" />
            ) : (
              <div className="profile-picture-placeholder">
                <div className="placeholder-icon">📷</div>
              </div>
            )}
            <div className="profile-picture-actions">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleProfilePictureChange}
                style={{ display: 'none' }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="button button-outline"
              >
                {profilePicture ? 'Change' : 'Upload'} Picture
              </button>
              {profilePicture && (
                <button
                  type="button"
                  onClick={() => {
                    setProfilePicture(null);
                    setProfilePicturePreview(null);
                  }}
                  className="button button-outline"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>

        {error && <p className="error-message">{error}</p>}
        {message && <p className="success-message">{message}</p>}

        <button type="submit" className="button button-primary" disabled={saving}>
          {saving ? 'Saving...' : 'Continue'}
        </button>
      </form>
    </section>
  );

  const renderTeamSettings = () => (
    <section className="onboarding-section">
      <div className="section-header">
        <h2>Team Settings</h2>
        <p>Start by naming your team. This helps organize your analytics dashboard.</p>
      </div>

      <form onSubmit={handleSaveTeam} className="onboarding-form">
        <div className="form-group">
          <label htmlFor="teamName">Team Name</label>
          <input
            id="teamName"
            type="text"
            value={teamName}
            onChange={(event) => setTeamName(event.target.value)}
            placeholder="Enter your team name"
            required
          />
        </div>

        {error && <p className="error-message">{error}</p>}
        {message && <p className="success-message">{message}</p>}

        <div className="step-actions">
          <button
            type="button"
            onClick={() => setCurrentStep('account-settings')}
            className="button button-outline"
          >
            Back
          </button>
          <button type="submit" className="button button-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Continue'}
          </button>
        </div>
      </form>
    </section>
  );

  const renderConnections = () => (
    <section className="onboarding-section">
      <div className="section-header">
        <h2>Connect Your Tools</h2>
        <p>Connect your development tools so Intel-Dash can start analyzing your team's performance.</p>
      </div>

      <div className="connections-grid">
        <div className="connection-card">
          <div className="connection-content">
            <h3>GitHub</h3>
            <p>Import repository metrics, pull requests, and deployment data from GitHub.</p>
          </div>
          <button
            onClick={() => handleConnect('github')}
            disabled={connecting}
            className="button button-secondary"
          >
            {connecting ? 'Connecting...' : 'Connect GitHub'}
          </button>
        </div>

        <div className="connection-card">
          <div className="connection-content">
            <h3>Jira</h3>
            <p>Import issues, sprints, and project management data from Jira.</p>
          </div>
          <button
            onClick={() => handleConnect('jira')}
            disabled={connecting}
            className="button button-secondary"
          >
            {connecting ? 'Connecting...' : 'Connect Jira'}
          </button>
        </div>
      </div>

      {error && <p className="error-message">{error}</p>}
      {message && <p className="success-message">{message}</p>}

      <div className="connections-actions">
        <button
          type="button"
          onClick={() => setCurrentStep('team-settings')}
          className="button button-outline"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleSkipConnections}
          className="button button-primary"
        >
          Go to Dashboard
        </button>
      </div>
    </section>
  );

  return (
    <div className="page-shell onboarding-page">
      <div className="onboarding-container">
        <div className="onboarding-header">
          <h1>Welcome to Intel-Dash, {user?.email?.split('@')[0]}</h1>
          <p>Let's set up your workspace in just a few steps</p>
        </div>

        {renderStepIndicator()}

        <div className="onboarding-content">
          {currentStep === 'account-settings' && renderAccountSettings()}
          {currentStep === 'team-settings' && renderTeamSettings()}
          {currentStep === 'connections' && renderConnections()}
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;
