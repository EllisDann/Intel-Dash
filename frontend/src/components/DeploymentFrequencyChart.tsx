import React, { useEffect, useState } from 'react';
import api from '../api';
import LineChart from './Charts/LineChart';

interface DeploymentData {
  date: string;
  deployments: number | null;
}

interface Props {
  startDate: string;
  endDate: string;
}

const DeploymentFrequencyChart: React.FC<Props> = ({ startDate, endDate }) => {
  const [data, setData] = useState<DeploymentData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<{ totalDeployments: number; avgPerDay: number } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const resp = await api.get('/api/dashboard/deployment-frequency/series', {
          params: { startDate, endDate },
        });
        const chartData: DeploymentData[] = resp.data || [];
        setData(chartData);

        // Calculate stats
        if (chartData.length > 0) {
          const totalDeployments = chartData.reduce((sum, d) => sum + (d.deployments || 0), 0);
          const avgPerDay = totalDeployments / chartData.length;
          setStats({ totalDeployments, avgPerDay });
        }
      } catch (err: any) {
        setError(err.response?.data?.error || 'Unable to load deployment frequency data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [startDate, endDate]);

  if (loading) return <p>Loading deployment frequency...</p>;
  if (error) return <p style={{ color: '#f87171' }}>{error}</p>;
  if (!data || data.length === 0) return <p>No deployment data available</p>;

  return (
    <div>
      <h3>Deployment Frequency (per day)</h3>
      {stats && (
        <div style={{ marginBottom: '0.5rem', fontSize: '0.9rem', color: '#94a3b8' }}>
          <p>Total: {stats.totalDeployments} deployments | Avg: {stats.avgPerDay.toFixed(1)} per day</p>
        </div>
      )}
      <LineChart data={data} dataKey="deployments" />
    </div>
  );
};

export default DeploymentFrequencyChart;
