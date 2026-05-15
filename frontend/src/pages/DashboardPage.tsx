import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const DashboardPage = () => {
  const { user, tenant, logout } = useAuth();

  return (
    <div className="page-shell">
      <div className="dashboard-card">
        <header className="dashboard-header">
          <div>
            <h1>Welcome, {user?.email}</h1>
            <p>Organization: {tenant?.name}</p>
            <p>Role: {user?.role}</p>
          </div>
          <button onClick={logout}>Sign out</button>
        </header>

        <section>
          <h2>Quick status</h2>
          <p>Your account is ready to connect integrations and track productivity.</p>
          <ul>
            <li>Dashboard backend: authenticated</li>
            <li>Tenant trial status: {tenant?.isTrialActive ? 'Active' : 'Inactive'}</li>
            <li>Payment status: {tenant?.paymentStatus}</li>
          </ul>
          <div style={{ marginTop: '1rem' }}>
            <Link to="/integrations">Manage integrations</Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default DashboardPage;
