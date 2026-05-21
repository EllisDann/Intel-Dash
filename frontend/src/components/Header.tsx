import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useSidebar } from '../contexts/SidebarContext';

const Header = () => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const { collapsed } = useSidebar();
  const isDashboard = isAuthenticated && (location.pathname === '/dashboard' || location.pathname === '/integrations' || location.pathname === '/onboarding');
  const showAuthButtons = !isAuthenticated || location.pathname === '/';
  const dashboardTitleMap: Record<string, string> = {
    '/dashboard': 'Activity Board',
    '/integrations': 'Integrations',
    '/onboarding': 'Onboarding',
  };
  const dashboardTitle = dashboardTitleMap[location.pathname] || '';

  return (
    <header className={`app-header ${!isDashboard ? 'app-header--landing' : ''}`}>
      <div className="header-container">
        {isDashboard && dashboardTitle ? (
          <div
            className="header-page-title"
            style={{ left: collapsed ? '70px' : '235px' }}
          >
            {dashboardTitle}
          </div>
        ) : (
          <Link to="/" className="header-logo">
            <img src="/logonobg.png" alt="IntelBoard" />
            <span>IntelBoard</span>
          </Link>
        )}

        {!isDashboard && (
          <nav className="header-nav">
            <a href="#product">Product</a>
            <a href="#solutions">Solutions</a>
            <a href="#resources">Resources</a>
            <a href="#pricing">Pricing</a>
          </nav>
        )}

        <div className="header-actions">
          {showAuthButtons && (
            <>
              <Link to="/login" className="header-link">Log in</Link>
              <Link to="/register" className="header-button header-button-primary">
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
