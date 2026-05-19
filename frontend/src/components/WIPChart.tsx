import { useEffect, useState } from 'react';
import LineChart from './Charts/LineChart';

interface WIPData {
  date: string;
  total_in_progress: number;
  in_progress_per_developer: number;
  team_size: number;
}

export default function WIPChart({ startDate, endDate }: { startDate: string; endDate: string }) {
  const [data, setData] = useState<WIPData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError('');

        const res = await fetch(
          `/api/dashboard/wip/series?startDate=${startDate}&endDate=${endDate}`
        );
        if (!res.ok) throw new Error('Failed to fetch WIP data');
        const result = await res.json();
        setData(result || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load WIP data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (startDate && endDate) {
      fetchData();
    }
  }, [startDate, endDate]);

  if (loading) return <div className="p-4">Loading WIP...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;

  const currentWIP = data.length > 0 ? data[data.length - 1].total_in_progress : 0;
  const currentPerDev = data.length > 0 ? data[data.length - 1].in_progress_per_developer : 0;
  const avgWIP = data.length > 0 
    ? (data.reduce((sum, d) => sum + d.total_in_progress, 0) / data.length).toFixed(2)
    : '0';

  const chartData = {
    labels: data.map((d) => d.date),
    datasets: [
      {
        label: 'Total WIP',
        data: data.map((d) => d.total_in_progress),
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderWidth: 2,
        tension: 0.4,
        fill: true,
      },
      {
        label: 'WIP per Developer',
        data: data.map((d) => d.in_progress_per_developer),
        borderColor: '#06b6d4',
        borderDash: [5, 5],
        borderWidth: 2,
        tension: 0.4,
      },
    ],
  };

  const isHighWIP = currentPerDev > 3;
  const status = isHighWIP ? 'High - Context Switching Risk' : 'Healthy';
  const statusColor = isHighWIP ? 'text-red-600' : 'text-green-600';

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">Work in Progress (WIP) (Phase 6)</h2>
        <p className="text-gray-600 mb-6">
          Measures how many tasks are active simultaneously. High WIP indicates context switching and slower delivery.
        </p>

        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-amber-50 rounded p-4">
            <p className="text-sm text-gray-600">Current WIP</p>
            <p className={`text-2xl font-bold ${isHighWIP ? 'text-red-600' : 'text-green-600'}`}>{currentWIP}</p>
          </div>
          <div className="bg-cyan-50 rounded p-4">
            <p className="text-sm text-gray-600">WIP per Developer</p>
            <p className={`text-2xl font-bold ${isHighWIP ? 'text-red-600' : 'text-green-600'}`}>{currentPerDev.toFixed(2)}</p>
          </div>
          <div className="bg-gray-50 rounded p-4">
            <p className="text-sm text-gray-600">Average WIP</p>
            <p className="text-2xl font-bold">{avgWIP}</p>
          </div>
          <div className="bg-blue-50 rounded p-4">
            <p className="text-sm text-gray-600">WIP Status</p>
            <p className={`text-lg font-bold ${statusColor}`}>{status}</p>
          </div>
        </div>

        <LineChart data={chartData} options={{ responsive: true, maintainAspectRatio: true }} />
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <h3 className="font-semibold text-amber-900 mb-2">Understanding WIP</h3>
        <ul className="text-sm text-amber-800 space-y-1">
          <li>• <strong>Total WIP:</strong> Number of items currently in "In Progress" status</li>
          <li>• <strong>WIP per Developer:</strong> Average WIP per team member</li>
          <li>• <strong>Key insight:</strong> High WIP causes context switching and slows delivery</li>
          <li>• <strong>Sweet spot:</strong> 1-2 items per developer is optimal</li>
        </ul>
      </div>

      <div className={`${isHighWIP ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'} border rounded-lg p-4`}>
        <h3 className={`font-semibold ${isHighWIP ? 'text-red-900' : 'text-green-900'} mb-2`}>WIP Optimization Recommendations</h3>
        <div className={`text-sm ${isHighWIP ? 'text-red-800' : 'text-green-800'} space-y-2`}>
          {isHighWIP ? (
            <>
              <p><strong>⚠️ High WIP Detected!</strong> Current WIP per dev: {currentPerDev.toFixed(2)}</p>
              <p>Consider implementing WIP limits:</p>
              <p>• Set team WIP limit to 1-2 per developer</p>
              <p>• Prioritize completing tasks before starting new ones</p>
              <p>• Reduce meetings/interruptions to minimize context switching</p>
              <p>• Pair programming on complex tasks</p>
            </>
          ) : (
            <>
              <p><strong>✓ WIP is within healthy range</strong></p>
              <p>• Current WIP per dev: {currentPerDev.toFixed(2)} (target: 1-2)</p>
              <p>• Continue monitoring to maintain flow</p>
              <p>• Team is optimized for delivery</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
