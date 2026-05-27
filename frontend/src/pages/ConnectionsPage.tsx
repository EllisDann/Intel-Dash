import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';
import '../styles/onboarding.css';

const ConnectionsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'apps' | 'projects'>('apps');

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

                <div className="connections-grid">
                  <div className="connection-card">
                    <div className="connection-content">
                      <h3>GitHub</h3>
                      <p>Import repository metrics, pull requests, and deployment data from GitHub.</p>
                    </div>
                    <button type="button" className="button button-secondary">
                      Connect GitHub
                    </button>
                  </div>

                  <div className="connection-card">
                    <div className="connection-content">
                      <h3>Jira</h3>
                      <p>Import issues, sprints, and project management data from Jira.</p>
                    </div>
                    <button type="button" className="button button-secondary">
                      Connect Jira
                    </button>
                  </div>
                </div>
              </section>
            ) : (
              <section className="settings-section">
                <div className="section-header">
                  <h2>Imported Projects</h2>
                  <p>Select which projects to import once your apps are connected</p>
                </div>

                <div style={{ 
                  padding: '2rem', 
                  backgroundColor: '#f4f6fb', 
                  borderRadius: '8px', 
                  border: '1px solid rgba(15, 23, 42, 0.08)',
                  textAlign: 'center'
                }}>
                  <p style={{ color: '#64748b', margin: 0 }}>
                    No imported projects yet. Connect apps to start importing project data.
                  </p>
                </div>
              </section>
            )}
          </section>
        </main>
      </div>
    </div>
  );
};

export default ConnectionsPage;
