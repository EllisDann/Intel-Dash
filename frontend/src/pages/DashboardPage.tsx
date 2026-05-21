import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import api from '../api';
import DatePickerInput from '../components/DatePickerInput';
import MetricCard from '../components/MetricCard';
import Sidebar from '../components/Sidebar';

interface DashboardSummary {
  user: {
    id: string;
    email: string;
    role: string;
  };
  tenant: {
    id: string;
    name: string;
    isTrialActive: boolean;
    trialStartDate: string | null;
    trialEndDate: string | null;
    paymentStatus: string;
    trialEndsInDays: number | null;
  };
  summary: {
    totalIntegrations: number;
    connectedIntegrations: number;
    hasConnectedIntegrations: boolean;
  };
  integrations: Array<{
    id: string;
    type: string;
    display_name: string;
    is_connected: boolean;
    connected_at: string | null;
  }>;
}

const getSeriesValue = (series: any[] | undefined, key = 'value') => {
  if (!series || series.length === 0) return null;
  return series[series.length - 1]?.[key] ?? null;
};

const getSeriesDelta = (series: any[] | undefined, key = 'value') => {
  if (!series || series.length < 2) return null;

  const current = series[series.length - 1]?.[key];
  const previous = series[series.length - 2]?.[key];

  if (typeof current !== 'number' || typeof previous !== 'number' || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
};

const formatDelta = (value: number | null, invert = false) => {
  if (value === null || Number.isNaN(value)) return '—';
  const normalized = invert ? -value : value;
  const sign = normalized > 0 ? '+' : '';
  return `${sign}${normalized.toFixed(0)}%`;
};

const DashboardPage: React.FC = () => {
  const { logout: _ } = useAuth(); // kept for future use
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [metrics, setMetrics] = useState<any | null>(null);
  const [repositories, setRepositories] = useState<any[]>([]);

  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const response = await api.get('/api/dashboard/summary');
        setSummary(response.data);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Unable to load dashboard summary');
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, []);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const resp = await api.get('/api/dashboard/metrics', { params: { startDate, endDate } });
        setMetrics(resp.data);
      } catch (err: any) {
        console.warn('Unable to load metrics', err?.response?.data || err.message);
      }
    };

    fetchMetrics();
  }, [startDate, endDate]);

  useEffect(() => {
    const fetchRepositories = async () => {
      try {
        const resp = await api.get('/api/dashboard/repositories', { params: { startDate, endDate } });
        setRepositories(resp.data || []);
      } catch (err: any) {
        console.warn('Unable to load repositories', err?.response?.data || err.message);
      }
    };

    fetchRepositories();
  }, [startDate, endDate]);

  const NO_DATA_TEXT = 'No data available';

  const formatValue = (value: number | string | null | undefined) =>
    value !== null && value !== undefined ? value : NO_DATA_TEXT;

  return (
    <div className="page-shell page-shell--dashboard">
      <div className="dashboard-layout">
        <Sidebar />
        <main className="dashboard-main">
          <div className="dashboard-card dashboard-card--wide dashboard-card--clean">
            <div className="reporting-period-wrapper">
              <div className="reporting-period-button">
                Reporting Period
                <div className="reporting-period-menu">
                  <div className="reporting-period-item">
                    <label>From</label>
                    <DatePickerInput value={startDate} onChange={(value) => setStartDate(value)} />
                  </div>
                  <div className="reporting-period-item">
                    <label>To</label>
                    <DatePickerInput value={endDate} onChange={(value) => setEndDate(value)} />
                  </div>
                </div>
              </div>
            </div>

        {loading ? (
          <p>Loading your dashboard...</p>
        ) : error ? (
          <p className="error-message">{error}</p>
        ) : summary ? (
          <>
            {/* Organization summary moved to Settings page */}

            <section className="dashboard-section">
              <div className="section-subheader">
                <h3>Pull Requests & Commits Metrics</h3>
              </div>

              <div className="dashboard-kpi-grid">
                <MetricCard
                  title="Opened PRs"
                  value={formatValue(metrics?.openedPRs ?? metrics?.open_pr_count ?? metrics?.openPRs)}
                  subtitle="PRs opened in the selected range"
                  status="neutral"
                />
                <MetricCard
                  title="PRs Completed"
                  value={formatValue(metrics?.completedPRs ?? metrics?.completed_pr_count ?? metrics?.closedPRs)}
                  subtitle="PRs completed in the selected range"
                  status="neutral"
                />
                <MetricCard
                  title="Average PR Size"
                  value={formatValue(metrics?.averagePRSize ?? metrics?.avg_pr_size ?? metrics?.avgPRSize)}
                  subtitle="Average size per pull request"
                  status="neutral"
                />
                <MetricCard
                  title="Commits Made"
                  value={formatValue(metrics?.commitsMade ?? metrics?.commitCount ?? metrics?.commits)}
                  subtitle="Commits made in the selected range"
                  status="neutral"
                />
                <MetricCard
                  title="PR Authors"
                  value={formatValue(metrics?.prAuthors ?? metrics?.pr_authors ?? metrics?.authors)}
                  subtitle="Active developers with PR activity"
                  status="neutral"
                />
                <MetricCard
                  title="Total Lines of Code"
                  value={formatValue(metrics?.totalLinesOfCode ?? metrics?.total_loc ?? metrics?.loc)}
                  subtitle="Lines of code changed in the range"
                  status="neutral"
                />
                <div className="repositories-card">
                  <div className="repositories-card__header">
                    <h4>Repositories Data</h4>
                    <p className="repositories-card__subtitle">Top repos by activity in the selected range</p>
                  </div>
                  <div className="repositories-table-wrapper">
                    <table className="repositories-table">
                      <thead>
                        <tr>
                          <th>Repository</th>
                          <th>Commits made</th>
                          <th>Opened PRs</th>
                          <th>LOC</th>
                        </tr>
                      </thead>
                      <tbody>
                        {repositories.length > 0 ? (
                          repositories.slice(0, 5).map((repo) => (
                            <tr key={repo.id}>
                              <td>{repo.id}</td>
                              <td>{repo.throughput ?? NO_DATA_TEXT}</td>
                              <td>{repo.openedPRs ?? repo.open_prs ?? NO_DATA_TEXT}</td>
                              <td>{repo.loc ?? repo.total_loc ?? NO_DATA_TEXT}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4}>No data</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  </div>
</div>
  );
};

export default DashboardPage;
