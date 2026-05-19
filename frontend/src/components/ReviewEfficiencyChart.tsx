import { useEffect, useState } from 'react';
import LineChart from './Charts/LineChart';

interface ReviewEfficiencyData {
  date: string;
  avg_time_to_response_hours: number;
  avg_time_to_approval_hours: number;
  avg_review_rounds: number;
  pr_count: number;
}

export default function ReviewEfficiencyChart({ startDate, endDate }: { startDate: string; endDate: string }) {
  const [data, setData] = useState<ReviewEfficiencyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError('');

        const res = await fetch(
          `/api/dashboard/review-efficiency/series?startDate=${startDate}&endDate=${endDate}`
        );
        if (!res.ok) throw new Error('Failed to fetch review efficiency data');
        const result = await res.json();
        setData(result || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load review efficiency data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (startDate && endDate) {
      fetchData();
    }
  }, [startDate, endDate]);

  if (loading) return <div className="p-4">Loading Review Efficiency...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;

  const avgTimeToApproval = data.length > 0 
    ? (data.reduce((sum, d) => sum + (d.avg_time_to_approval_hours || 0), 0) / data.length).toFixed(2)
    : '0.00';

  const avgReviewRounds = data.length > 0
    ? (data.reduce((sum, d) => sum + (d.avg_review_rounds || 0), 0) / data.length).toFixed(2)
    : '0.00';

  const chartData = {
    labels: data.map((d) => d.date),
    datasets: [
      {
        label: 'Avg Time to Approval (hours)',
        data: data.map((d) => d.avg_time_to_approval_hours),
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderWidth: 2,
        tension: 0.4,
      },
      {
        label: 'Avg Time to First Response (hours)',
        data: data.map((d) => d.avg_time_to_response_hours),
        borderColor: '#06b6d4',
        borderDash: [5, 5],
        borderWidth: 2,
        tension: 0.4,
      },
    ],
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">Review Efficiency (Phase 5)</h2>
        <p className="text-gray-600 mb-6">
          Measures how quickly PRs move through the review process. Lower times indicate better efficiency.
        </p>

        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-amber-50 rounded p-4">
            <p className="text-sm text-gray-600">Avg Time to Approval</p>
            <p className="text-2xl font-bold text-amber-600">{avgTimeToApproval}h</p>
          </div>
          <div className="bg-cyan-50 rounded p-4">
            <p className="text-sm text-gray-600">Avg First Response Time</p>
            <p className="text-2xl font-bold">
              {data.length > 0 && data[data.length - 1].avg_time_to_response_hours 
                ? data[data.length - 1].avg_time_to_response_hours.toFixed(2) 
                : '-'}h
            </p>
          </div>
          <div className="bg-purple-50 rounded p-4">
            <p className="text-sm text-gray-600">Avg Review Rounds</p>
            <p className="text-2xl font-bold text-purple-600">{avgReviewRounds}</p>
          </div>
          <div className="bg-gray-50 rounded p-4">
            <p className="text-sm text-gray-600">Total PRs Reviewed</p>
            <p className="text-2xl font-bold">{data.reduce((sum, d) => sum + (d.pr_count || 0), 0)}</p>
          </div>
        </div>

        <LineChart data={chartData} options={{ responsive: true, maintainAspectRatio: true }} />
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <h3 className="font-semibold text-amber-900 mb-2">Review Efficiency Insights</h3>
        <ul className="text-sm text-amber-800 space-y-1">
          <li>• <strong>Time to Approval:</strong> Total time from PR creation to final approval</li>
          <li>• <strong>First Response Time:</strong> Time until first review is submitted</li>
          <li>• <strong>Review Rounds:</strong> Number of review iterations before approval</li>
          <li>• <strong>AI Impact:</strong> AI tools often reduce approval time and review rounds</li>
        </ul>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">Benchmarks (Industry Average)</h3>
        <div className="text-sm text-blue-800 space-y-2">
          <p><strong>Fast teams:</strong> &lt;4 hours to approval</p>
          <p><strong>Average teams:</strong> 4-24 hours to approval</p>
          <p><strong>Slower teams:</strong> &gt;24 hours to approval</p>
          <p><strong>Target review rounds:</strong> 1-2 (fewer iterations = faster merges)</p>
        </div>
      </div>
    </div>
  );
}
