import { useEffect, useState } from 'react';
import LineChart from './Charts/LineChart';

interface AIAssistedData {
  date: string;
  ai_assisted_rate: number;
  ai_assisted_pr_count: number;
  total_pr_count: number;
  ai_assisted_pr_avg_cycle_time_hours: number;
  non_ai_pr_avg_cycle_time_hours: number;
}

export default function AIAssistedRateChart({ startDate, endDate }: { startDate: string; endDate: string }) {
  const [data, setData] = useState<AIAssistedData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError('');

        const res = await fetch(
          `/api/dashboard/ai-assisted-rate/series?startDate=${startDate}&endDate=${endDate}`
        );
        if (!res.ok) throw new Error('Failed to fetch AI-assisted rate data');
        const result = await res.json();
        setData(result || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load AI-assisted rate data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (startDate && endDate) {
      fetchData();
    }
  }, [startDate, endDate]);

  if (loading) return <div className="p-4">Loading AI-Assisted Rate...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;

  const avgAIRate = data.length > 0 
    ? (data.reduce((sum, d) => sum + (d.ai_assisted_rate || 0), 0) / data.length).toFixed(2)
    : '0.00';

  const totalPRs = data.reduce((sum, d) => sum + (d.total_pr_count || 0), 0);
  const aiPRs = data.reduce((sum, d) => sum + (d.ai_assisted_pr_count || 0), 0);

  const latestData = data.length > 0 ? data[data.length - 1] : null;
  const cycleTimeImprovement = latestData && latestData.non_ai_pr_avg_cycle_time_hours
    ? ((latestData.non_ai_pr_avg_cycle_time_hours - latestData.ai_assisted_pr_avg_cycle_time_hours) / latestData.non_ai_pr_avg_cycle_time_hours * 100).toFixed(1)
    : '0.0';

  const chartData = {
    labels: data.map((d) => d.date),
    datasets: [
      {
        label: 'AI-Assisted PR Rate (%)',
        data: data.map((d) => d.ai_assisted_rate),
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6, 182, 212, 0.1)',
        borderWidth: 2,
        tension: 0.4,
        fill: true,
      },
    ],
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">AI-Assisted Development Rate (Phase 5)</h2>
        <p className="text-gray-600 mb-6">
          Percentage of PRs with AI assistance signals (Copilot, AI-generated code, etc.)
        </p>

        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-cyan-50 rounded p-4">
            <p className="text-sm text-gray-600">Avg AI-Assisted Rate</p>
            <p className="text-2xl font-bold text-cyan-600">{avgAIRate}%</p>
          </div>
          <div className="bg-blue-50 rounded p-4">
            <p className="text-sm text-gray-600">Total PRs</p>
            <p className="text-2xl font-bold">{totalPRs}</p>
          </div>
          <div className="bg-teal-50 rounded p-4">
            <p className="text-sm text-gray-600">AI-Assisted PRs</p>
            <p className="text-2xl font-bold text-teal-600">{aiPRs}</p>
          </div>
          <div className="bg-green-50 rounded p-4">
            <p className="text-sm text-gray-600">Cycle Time Gain</p>
            <p className="text-2xl font-bold text-green-600">+{cycleTimeImprovement}%</p>
          </div>
        </div>

        <LineChart data={chartData} options={{ responsive: true, maintainAspectRatio: true }} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4">
          <h3 className="font-semibold text-cyan-900 mb-2">AI-Assisted PR Performance</h3>
          <div className="text-sm text-cyan-800 space-y-2">
            {latestData && (
              <>
                <p><strong>AI PRs Avg Cycle Time:</strong> {latestData.ai_assisted_pr_avg_cycle_time_hours?.toFixed(2) || '-'}h</p>
                <p><strong>Non-AI PRs Avg Cycle Time:</strong> {latestData.non_ai_pr_avg_cycle_time_hours?.toFixed(2) || '-'}h</p>
                <p><strong>Difference:</strong> {cycleTimeImprovement}% faster</p>
              </>
            )}
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">AI Adoption Signals</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>✓ Copilot telemetry</li>
            <li>✓ AI-tagged commits</li>
            <li>✓ AI labels in PR descriptions</li>
            <li>✓ IDE telemetry signals</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
