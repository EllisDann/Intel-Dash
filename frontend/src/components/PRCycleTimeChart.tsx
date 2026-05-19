import { useEffect, useState } from 'react';
import LineChart from './Charts/LineChart';

interface PRCycleTimeData {
  date: string;
  avg?: number;
  p50?: number;
  p90?: number;
  isPostAdoption: boolean;
}

export default function PRCycleTimeChart({ startDate, endDate }: { startDate: string; endDate: string }) {
  const [data, setData] = useState<PRCycleTimeData[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError('');

        // Fetch series data
        const seriesRes = await fetch(
          `/api/dashboard/pr-cycle-time/series?startDate=${startDate}&endDate=${endDate}`
        );
        if (!seriesRes.ok) throw new Error('Failed to fetch PR cycle time data');
        const seriesData = await seriesRes.json();
        setData(seriesData.data || []);

        // Fetch summary stats
        const summaryRes = await fetch(
          `/api/dashboard/pr-metrics/summary?startDate=${startDate}&endDate=${endDate}`
        );
        if (summaryRes.ok) {
          const summary = await summaryRes.json();
          setStats(summary);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load PR cycle time data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (startDate && endDate) {
      fetchData();
    }
  }, [startDate, endDate]);

  if (loading) return <div className="p-4">Loading PR Cycle Time...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;

  const chartData = {
    labels: data.map((d) => d.date),
    datasets: [
      {
        label: 'Average Cycle Time',
        data: data.map((d) => d.avg),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        tension: 0.4,
      },
      {
        label: 'P50 (Median)',
        data: data.map((d) => d.p50),
        borderColor: '#10b981',
        borderDash: [5, 5],
        borderWidth: 2,
        tension: 0.4,
      },
      {
        label: 'P90',
        data: data.map((d) => d.p90),
        borderColor: '#ef4444',
        borderDash: [5, 5],
        borderWidth: 2,
        tension: 0.4,
      },
    ],
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">PR Cycle Time (Phase 3)</h2>
        <p className="text-gray-600 mb-6">
          Measures the time from PR creation to merge. Shows avg, P50, and P90 percentiles.
        </p>

        {stats && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 rounded p-4">
              <p className="text-sm text-gray-600">Average Cycle Time</p>
              <p className="text-2xl font-bold">{stats.avg_cycle_time?.toFixed(2) || '-'}h</p>
            </div>
            <div className="bg-green-50 rounded p-4">
              <p className="text-sm text-gray-600">Time to Review</p>
              <p className="text-2xl font-bold">{stats.avg_time_to_review?.toFixed(2) || '-'}h</p>
            </div>
            <div className="bg-yellow-50 rounded p-4">
              <p className="text-sm text-gray-600">Review Time</p>
              <p className="text-2xl font-bold">{stats.avg_review_time?.toFixed(2) || '-'}h</p>
            </div>
            <div className="bg-purple-50 rounded p-4">
              <p className="text-sm text-gray-600">Review Rounds</p>
              <p className="text-2xl font-bold">{stats.avg_review_rounds?.toFixed(1) || '-'}</p>
            </div>
          </div>
        )}

        <LineChart data={chartData} options={{ responsive: true, maintainAspectRatio: true }} />
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">Understanding PR Cycle Time</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>Average:</strong> Mean time from PR creation to merge</li>
          <li>• <strong>P50 (Median):</strong> 50% of PRs merge faster than this</li>
          <li>• <strong>P90:</strong> Only 10% of PRs take longer than this</li>
          <li>• <strong>Review Rounds:</strong> Average number of review iterations</li>
        </ul>
      </div>
    </div>
  );
}
