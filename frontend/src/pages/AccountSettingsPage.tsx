import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import Sidebar from '../components/Sidebar';
import '../styles/onboarding.css';

const AccountSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout, updateProfile } = useAuth();
  const email = user?.email ?? '';
  const [username, setUsername] = useState(user?.name || '');
  const [profileImage, setProfileImage] = useState<string | null>(user?.profileImage ?? null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setProfileImage(user?.profileImage ?? null);
    setUsername(user?.name || '');
  }, [user]);

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const imageUrl = reader.result as string;
      setProfileImage(imageUrl);
      setError('');
    };
    reader.readAsDataURL(file);
  };

  const handlePickImage = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveImage = () => {
    setProfileImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
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

    setSaving(true);
    try {
      await updateProfile({ email, profile_image: profileImage, name: username.trim() });
      setMessage('Account settings saved successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Unable to save account settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-shell page-shell--dashboard">
      <div className="dashboard-layout">
        <Sidebar />
        <main className="dashboard-main settings-main">
          <section className="settings-container">
            <div className="settings-header">
              <h1>Account Settings</h1>
              <p>Manage your profile and account details</p>
            </div>

            <form onSubmit={handleSubmit} className="settings-sections">
              <section className="settings-section">
                <div className="section-header">
                  <h2>Profile Picture</h2>
                  <p>Upload a profile picture to personalize your account</p>
                </div>
                <div className="profile-picture-section">
                  {profileImage ? (
                    <img 
                      src={profileImage} 
                      alt="Profile preview" 
                      className="profile-picture-preview"
                      style={{ borderRadius: '50%' }}
                    />
                  ) : (
                    <div className="profile-picture-placeholder" style={{ 
                      width: '100px', 
                      height: '100px', 
                      borderRadius: '50%',
                      background: '#1e40af',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      fontSize: '32px'
                    }}>
                      {(username || email).charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="profile-picture-actions">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleImageChange}
                    />
                    <button type="button" className="button button-secondary" onClick={handlePickImage}>
                      Choose Picture
                    </button>
                    {profileImage && (
                      <button type="button" className="button button-outline" onClick={handleRemoveImage}>
                        Remove Picture
                      </button>
                    )}
                  </div>
                </div>
              </section>

              <section className="settings-section">
                <div className="section-header">
                  <h2>Basic Information</h2>
                  <p>Update your profile information</p>
                </div>

                <div className="form-group">
                  <label htmlFor="username">Username</label>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="email">Email</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    readOnly
                    style={{ backgroundColor: '#e5eaf0', cursor: 'not-allowed' }}
                  />
                </div>

                {message && <p className="success-message">{message}</p>}
                {error && <p className="error-message">{error}</p>}

                <div className="settings-actions">
                  <button type="submit" className="button button-primary" disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </section>

              <section className="settings-section settings-section--danger">
                <div className="section-header">
                  <h2>Leave Intel-Dash</h2>
                  <p>This action cannot be undone</p>
                </div>
                <p style={{ color: '#64748b', marginBottom: '1rem' }}>
                  If you wish to leave Intel-Dash, all your data will be removed from our servers in accordance with GDPR.
                </p>
                <button type="button" className="button button-danger" onClick={logout}>
                  Leave Intel-Dash
                </button>
              </section>
            </form>
          </section>
        </main>
      </div>
    </div>
  );
};

export default AccountSettingsPage;
