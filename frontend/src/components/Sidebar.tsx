import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const dashboards = [
  { id: 'overview', label: 'Overview' },
  { id: 'team', label: 'Team' },
  { id: 'repositories', label: 'Repositories' },
  { id: 'ai-insights', label: 'AI Insights' },
];

const Sidebar: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const toggle = () => setCollapsed((c) => !c);

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`} aria-label="Dashboard navigation">
      <div className="sidebar__top">
        <button className="sidebar__toggle" onClick={toggle} aria-expanded={!collapsed}>
          {collapsed ? '»' : '«'}
        </button>
        {!collapsed && <div className="sidebar__title">Dashboards</div>}
      </div>

      <nav className="sidebar__menu">
        {dashboards.map((d) => (
          <Link key={d.id} to={`#${d.id}`} className={`sidebar__item ${d.id === 'overview' ? 'active' : ''}`}>
            <span className="sidebar__item-label">{d.label}</span>
          </Link>
        ))}
      </nav>

      <div className="sidebar__footer">
        <Link to="/settings" className="sidebar__settings">
          <span className="sidebar__settings-label">Settings</span>
        </Link>
      </div>
    </aside>
  );
};

export default Sidebar;
