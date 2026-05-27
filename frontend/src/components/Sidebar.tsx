import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useSidebar } from '../contexts/SidebarContext';

const dashboards = [
  { id: 'activity-board', label: 'Activity Board' },
];

const Sidebar: React.FC = () => {
  const { collapsed, toggleCollapsed } = useSidebar();
  const { user, tenant, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const footerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsOpen && footerRef.current && !footerRef.current.contains(event.target as Node)) {
        setSettingsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [settingsOpen]);

  useEffect(() => {
    if (collapsed) {
      setSettingsOpen(false);
    }
  }, [collapsed]);

  const handleNavigate = (path: string) => () => {
    navigate(path);
    setSettingsOpen(false);
  };

  const userName = user?.name || user?.email?.split('@')[0] || 'User';

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`} aria-label="Dashboard navigation">
      <div className="sidebar__brand">
        <Link to="/dashboard" className="sidebar__brand-link">
          <img src="/logonobg.png" alt="Intel-Dash" className="sidebar__brand-logo" />
          {!collapsed && <span className="sidebar__brand-text">Intel-Dash</span>}
        </Link>
      </div>

      <div className="sidebar__top">
        <button className="sidebar__toggle" onClick={toggleCollapsed} aria-expanded={!collapsed}>
          {collapsed ? '»' : '«'}
        </button>
      </div>

      <div className="sidebar__menu-header">Dashboards</div>
      <nav className="sidebar__menu">
        {dashboards.map((d) => (
          <Link key={d.id} to="/dashboard" className={`sidebar__item ${location.pathname === '/dashboard' ? 'active' : ''}`}>
            <span className="sidebar__item-label">{d.label}</span>
          </Link>
        ))}
      </nav>

      <div className="sidebar__footer" ref={footerRef}>
        <button
          type="button"
          className={`sidebar__settings ${settingsOpen ? 'sidebar__settings--open' : ''}`}
          onClick={() => setSettingsOpen((current) => !current)}
          aria-expanded={settingsOpen}
        >
          <span className="sidebar__settings-icon" aria-hidden="true">⚙</span>
          {!collapsed && (
            <div>
              <span className="sidebar__settings-label">Settings</span>
            </div>
          )}
          {!collapsed && <span className="sidebar__settings-arrow" aria-hidden="true">›</span>}
        </button>

        {settingsOpen && (
          <div className="sidebar__settings-menu" role="menu">
            <div className="sidebar__settings-profile">
              <div className="sidebar__settings-avatar">
                {user?.profileImage ? (
                  <img src={user.profileImage} alt="Profile" className="sidebar__settings-avatar-image" />
                ) : (
                  userName.charAt(0).toUpperCase()
                )}
              </div>
              <div className="sidebar__settings-profile-info">
                <div className="sidebar__settings-profile-name">{userName}</div>
                <div className="sidebar__settings-profile-subtitle">
                  {user?.email ?? 'No email'} · {tenant?.name ?? 'Team name'}
                </div>
              </div>
            </div>

            <div className="sidebar__settings-menu-actions">
              <button type="button" onClick={handleNavigate('/settings')} className="sidebar__settings-menu-item">
                Account
              </button>
              <button type="button" onClick={handleNavigate('/connections')} className="sidebar__settings-menu-item">
                Connections
              </button>
              <button type="button" onClick={handleNavigate('/billing')} className="sidebar__settings-menu-item">
                Billing & Subscription
              </button>
              <button type="button" onClick={handleNavigate('/team-management')} className="sidebar__settings-menu-item">
                Team Management
              </button>
            </div>

            <button
              type="button"
              className="sidebar__settings-menu-signout"
              onClick={() => {
                logout();
                navigate('/login');
              }}
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
