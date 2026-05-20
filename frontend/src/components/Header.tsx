import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const Header = () => {
  const { isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const isDashboard = isAuthenticated && (location.pathname === '/dashboard' || location.pathname === '/integrations' || location.pathname === '/onboarding');

  return (
    <header className="app-header">
      <div className="header-container">
        {!isDashboard && (
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
          {!isAuthenticated && (
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
