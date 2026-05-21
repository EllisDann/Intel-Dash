import React from 'react';
import { Link } from 'react-router-dom';
import { useSidebar } from '../contexts/SidebarContext';

const dashboards = [
  { id: 'activity-board', label: 'Activity Board' },
];

const Sidebar: React.FC = () => {
  const { collapsed, toggleCollapsed } = useSidebar();
  const toggle = () => toggleCollapsed();

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`} aria-label="Dashboard navigation">
      <div className="sidebar__brand">
        <Link to="/" className="sidebar__brand-link">
          <img src="/logonobg.png" alt="IntelBoard" className="sidebar__brand-logo" />
          {!collapsed && <span className="sidebar__brand-text">IntelBoard</span>}
        </Link>
      </div>

      <div className="sidebar__top">
        <button className="sidebar__toggle" onClick={toggle} aria-expanded={!collapsed}>
          {collapsed ? '»' : '«'}
        </button>
      </div>

      <div className="sidebar__menu-header">Dashboards</div>
      <nav className="sidebar__menu">
        {dashboards.map((d) => (
          <Link key={d.id} to={`#${d.id}`} className={`sidebar__item ${d.id === 'activity-board' ? 'active' : ''}`}>
            <span className="sidebar__item-label">{d.label}</span>
          </Link>
        ))}
      </nav>

      <div className="sidebar__footer">
        <Link to="/settings" className="sidebar__settings">
          <span className="sidebar__settings-icon" aria-hidden="true">⚙</span>
          <span className="sidebar__settings-label">Settings</span>
        </Link>
      </div>
    </aside>
  );
};

export default Sidebar;
