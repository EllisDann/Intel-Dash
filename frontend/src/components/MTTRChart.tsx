import { useEffect, useState } from 'react';
import LineChart from './Charts/LineChart';

interface MTTRData {
  date: string;
  avg_mttr: number;
  p50_mttr: number;
  p90_mttr: number;
  incident_count: number;
}

export default function MTTRChart({ startDate, endDate }: { startDate: string; endDate: string }) {
  const [data, setData] = useState<MTTRData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError('');

        const res = await fetch(
          `/api/dashboard/mttr/series?startDate=${startDate}&endDate=${endDate}`
        );
        if (!res.ok) throw new Error('Failed to fetch MTTR data');
        const result = await res.json();
        setData(result || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load MTTR data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (startDate && endDate) {
      fetchData();
    }
  }, [startDate, endDate]);

  if (loading) return <div className="p-4">Loading MTTR...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;

  const avgMTTR = data.length > 0 
    ? (data.reduce((sum, d) => sum + (d.avg_mttr || 0), 0) / data.length).toFixed(2)
    : '0.00';

  const totalIncidents = data.reduce((sum, d) => sum + (d.incident_count || 0), 0);

  const chartData = {
    labels: data.map((d) => d.date),
    datasets: [
      {
        label: 'Average MTTR (hours)',
        data: data.map((d) => d.avg_mttr),
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        borderWidth: 2,
        tension: 0.4,
      },
      {
        label: 'P50 (Median)',
        data: data.map((d) => d.p50_mttr),
        borderColor: '#10b981',
        borderDash: [5, 5],
        borderWidth: 2,
        tension: 0.4,
      },
      {
        label: 'P90',
        data: data.map((d) => d.p90_mttr),
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
        <h2 className="text-2xl font-bold mb-4">Mean Time to Restore (MTTR) (Phase 4)</h2>
        <p className="text-gray-600 mb-6">
          Average time to resolve incidents from creation to resolution. Lower is better.
        </p>

        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-purple-50 rounded p-4">
            <p className="text-sm text-gray-600">Average MTTR</p>
            <p className="text-2xl font-bold text-purple-600">{avgMTTR}h</p>
          </div>
          <div className="bg-blue-50 rounded p-4">
            <p className="text-sm text-gray-600">Median MTTR</p>
            <p className="text-2xl font-bold">
              {data.length > 0 && data[data.length - 1].p50_mttr 
                ? data[data.length - 1].p50_mttr.toFixed(2) 
                : '-'}h
            </p>
          </div>
          <div className="bg-yellow-50 rounded p-4">
            <p className="text-sm text-gray-600">P90 MTTR</p>
            <p className="text-2xl font-bold">
              {data.length > 0 && data[data.length - 1].p90_mttr 
                ? data[data.length - 1].p90_mttr.toFixed(2) 
                : '-'}h
            </p>
          </div>
          <div className="bg-gray-50 rounded p-4">
            <p className="text-sm text-gray-600">Total Incidents</p>
            <p className="text-2xl font-bold">{totalIncidents}</p>
          </div>
        </div>

        <LineChart data={chartData} options={{ responsive: true, maintainAspectRatio: true }} />
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">Understanding MTTR</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>MTTR:</strong> Time from incident detection to full resolution</li>
          <li>• <strong>P50 (Median):</strong> 50% of incidents resolve faster than this</li>
          <li>• <strong>P90:</strong> Only 10% of incidents take longer than this</li>
          <li>• <strong>Key insight:</strong> Lower MTTR indicates better operational resilience</li>
        </ul>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h3 className="font-semibold text-green-900 mb-2">DORA Benchmark: MTTR</h3>
        <div className="text-sm text-green-800 space-y-2">
          <p><strong>Elite performers:</strong> &lt;1 hour MTTR</p>
          <p><strong>High performers:</strong> 1-24 hours MTTR</p>
          <p><strong>Medium performers:</strong> 1-7 days MTTR</p>
          <p><strong>Low performers:</strong> &gt;7 days MTTR</p>
        </div>
      </div>
    </div>
  );
}
