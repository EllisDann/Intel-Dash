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

  

  const NO_DATA_TEXT = 'No data available';

  const cycleCurrent = getSeriesValue(metrics?.cycleTimeSeries, 'avg_hours');
  const cycleTrend = getSeriesDelta(metrics?.cycleTimeSeries, 'avg_hours');
  const deploymentCurrent = getSeriesValue(metrics?.deploymentFrequencySeries, 'deployments');
  const deploymentTrend = getSeriesDelta(metrics?.deploymentFrequencySeries, 'deployments');

  return (
    <div className="page-shell">
      <div className="dashboard-layout">
        <Sidebar />
        <main className="dashboard-main">
          <div className="dashboard-card dashboard-card--wide dashboard-card--clean">
        <div className="filter-bar">
          <div className="filter-left">
            <div className="filter-item">
              <label>From</label>
              <DatePickerInput value={startDate} onChange={(value) => setStartDate(value)} />
            </div>
            <div className="filter-item">
              <label>To</label>
              <DatePickerInput value={endDate} onChange={(value) => setEndDate(value)} />
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
              <div className="section-header">
                <div>
                  <h2>Executive KPI overview</h2>
                  <p className="section-description">Top metrics for the team, updated for your selected range.</p>
                </div>
              </div>

              <div className="dashboard-kpi-grid">
                <MetricCard
                  title="Lead Time for Changes"
                  value={cycleCurrent ? `${cycleCurrent.toFixed(1)} hrs` : NO_DATA_TEXT}
                  delta={cycleTrend !== null ? formatDelta(cycleTrend, true) : '—'}
                  subtitle="Average cycle time in selected range"
                  status={cycleTrend !== null && cycleTrend < 0 ? 'good' : cycleTrend !== null && cycleTrend > 0 ? 'critical' : 'neutral'}
                />
                <MetricCard
                  title="Deployment Frequency"
                  value={deploymentCurrent !== null ? `${deploymentCurrent} / day` : NO_DATA_TEXT}
                  delta={deploymentTrend !== null ? formatDelta(deploymentTrend) : '—'}
                  subtitle="Recent deployment cadence"
                  status={deploymentTrend !== null && deploymentTrend >= 0 ? 'good' : 'warning'}
                />
                <MetricCard
                  title="Change Failure Rate"
                  value={metrics?.failureRate !== undefined ? `${metrics.failureRate.toFixed(1)}%` : NO_DATA_TEXT}
                  subtitle="Deployments causing incidents"
                  status={typeof metrics?.failureRate === 'number' ? (metrics.failureRate <= 10 ? 'good' : metrics.failureRate <= 20 ? 'warning' : 'critical') : 'neutral'}
                />
                <MetricCard
                  title="Mean Time to Restore (MTTR)"
                  value={metrics?.mttr !== undefined ? `${metrics.mttr.toFixed(1)} hrs` : NO_DATA_TEXT}
                  subtitle="Average incident recovery time"
                  status={typeof metrics?.mttr === 'number' ? (metrics.mttr <= 2 ? 'good' : metrics.mttr <= 4 ? 'warning' : 'critical') : 'neutral'}
                />
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
