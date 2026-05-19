import { useEffect, useState } from 'react';
import LineChart from './Charts/LineChart';

interface ChangeFailureData {
  date: string;
  change_failure_rate: number;
  total_deployments: number;
  failed_deployments: number;
}

export default function ChangeFailureRateChart({ startDate, endDate }: { startDate: string; endDate: string }) {
  const [data, setData] = useState<ChangeFailureData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError('');

        const res = await fetch(
          `/api/dashboard/change-failure-rate/series?startDate=${startDate}&endDate=${endDate}`
        );
        if (!res.ok) throw new Error('Failed to fetch change failure rate data');
        const result = await res.json();
        setData(result || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load change failure rate data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (startDate && endDate) {
      fetchData();
    }
  }, [startDate, endDate]);

  if (loading) return <div className="p-4">Loading Change Failure Rate...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;

  // Calculate summary stats
  const avgFailureRate = data.length > 0 
    ? (data.reduce((sum, d) => sum + (d.change_failure_rate || 0), 0) / data.length).toFixed(2)
    : '0.00';

  const totalDeployments = data.reduce((sum, d) => sum + (d.total_deployments || 0), 0);
  const totalFailed = data.reduce((sum, d) => sum + (d.failed_deployments || 0), 0);

  const chartData = {
    labels: data.map((d) => d.date),
    datasets: [
      {
        label: 'Change Failure Rate (%)',
        data: data.map((d) => d.change_failure_rate),
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderWidth: 2,
        tension: 0.4,
        fill: true,
      },
    ],
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">Change Failure Rate (Phase 4)</h2>
        <p className="text-gray-600 mb-6">
          Percentage of deployments that resulted in failures, incidents, or reverts. Lower is better.
        </p>

        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-red-50 rounded p-4">
            <p className="text-sm text-gray-600">Avg Failure Rate</p>
            <p className="text-2xl font-bold text-red-600">{avgFailureRate}%</p>
          </div>
          <div className="bg-orange-50 rounded p-4">
            <p className="text-sm text-gray-600">Total Deployments</p>
            <p className="text-2xl font-bold">{totalDeployments}</p>
          </div>
          <div className="bg-pink-50 rounded p-4">
            <p className="text-sm text-gray-600">Failed Deployments</p>
            <p className="text-2xl font-bold text-red-600">{totalFailed}</p>
          </div>
          <div className="bg-gray-50 rounded p-4">
            <p className="text-sm text-gray-600">Success Rate</p>
            <p className="text-2xl font-bold text-green-600">
              {((1 - totalFailed / (totalDeployments || 1)) * 100).toFixed(1)}%
            </p>
          </div>
        </div>

        <LineChart data={chartData} options={{ responsive: true, maintainAspectRatio: true }} />
      </div>

      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 className="font-semibold text-red-900 mb-2">DORA Benchmark: Change Failure Rate</h3>
        <div className="text-sm text-red-800 space-y-2">
          <p><strong>Elite performers:</strong> 0-15% failure rate</p>
          <p><strong>High performers:</strong> 16-30% failure rate</p>
          <p><strong>Medium performers:</strong> 31-50% failure rate</p>
          <p><strong>Low performers:</strong> &gt;50% failure rate</p>
        </div>
      </div>
    </div>
  );
}
