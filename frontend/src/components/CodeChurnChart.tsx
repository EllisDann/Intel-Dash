import { useEffect, useState } from 'react';
import LineChart from './Charts/LineChart';

interface CodeChurnData {
  date: string;
  avg_churn_percent: number;
  high_churn_prs_count: number;
  median_churn_percent: number;
}

export default function CodeChurnChart({ startDate, endDate }: { startDate: string; endDate: string }) {
  const [data, setData] = useState<CodeChurnData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError('');

        const res = await fetch(
          `/api/dashboard/code-churn/series?startDate=${startDate}&endDate=${endDate}`
        );
        if (!res.ok) throw new Error('Failed to fetch code churn data');
        const result = await res.json();
        setData(result || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load code churn data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (startDate && endDate) {
      fetchData();
    }
  }, [startDate, endDate]);

  if (loading) return <div className="p-4">Loading Code Churn...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;

  const avgChurn = data.length > 0 
    ? (data.reduce((sum, d) => sum + (d.avg_churn_percent || 0), 0) / data.length).toFixed(2)
    : '0.00';

  const totalHighChurnPRs = data.reduce((sum, d) => sum + (d.high_churn_prs_count || 0), 0);

  const chartData = {
    labels: data.map((d) => d.date),
    datasets: [
      {
        label: 'Average Code Churn (%)',
        data: data.map((d) => d.avg_churn_percent),
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderWidth: 2,
        tension: 0.4,
        fill: true,
      },
      {
        label: 'Median Code Churn (%)',
        data: data.map((d) => d.median_churn_percent),
        borderColor: '#f97316',
        borderDash: [5, 5],
        borderWidth: 2,
        tension: 0.4,
      },
    ],
  };

  const hasHighChurnTrend = data.length > 3
    ? data.slice(-3).some(d => d.avg_churn_percent > 30)
    : false;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">Code Churn (Phase 7)</h2>
        <p className="text-gray-600 mb-6">
          Measures lines of code modified shortly after merge. High churn indicates rushed work, instability, or unclear requirements.
        </p>

        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-red-50 rounded p-4">
            <p className="text-sm text-gray-600">Average Churn</p>
            <p className={`text-2xl font-bold ${hasHighChurnTrend ? 'text-red-600' : 'text-orange-600'}`}>{avgChurn}%</p>
          </div>
          <div className="bg-orange-50 rounded p-4">
            <p className="text-sm text-gray-600">High Churn PRs</p>
            <p className="text-2xl font-bold text-orange-600">{totalHighChurnPRs}</p>
          </div>
          <div className="bg-gray-50 rounded p-4">
            <p className="text-sm text-gray-600">Median Churn</p>
            <p className="text-2xl font-bold">
              {data.length > 0 && data[data.length - 1].median_churn_percent 
                ? data[data.length - 1].median_churn_percent.toFixed(2) 
                : '-'}%
            </p>
          </div>
          <div className="bg-blue-50 rounded p-4">
            <p className="text-sm text-gray-600">Trend</p>
            <p className={`text-lg font-bold ${hasHighChurnTrend ? 'text-red-600' : 'text-green-600'}`}>
              {hasHighChurnTrend ? '↑ Increasing' : '↓ Stable'}
            </p>
          </div>
        </div>

        <LineChart data={chartData} options={{ responsive: true, maintainAspectRatio: true }} />
      </div>

      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 className="font-semibold text-red-900 mb-2">Understanding Code Churn</h3>
        <ul className="text-sm text-red-800 space-y-1">
          <li>• <strong>Code Churn:</strong> % of code changed in follow-up commits within 24-48 hours</li>
          <li>• <strong>High churn signals:</strong> Rushed work, incomplete testing, AI instability</li>
          <li>• <strong>Healthy churn:</strong> &lt;10% (normal bug fixes and improvements)</li>
          <li>• <strong>Warning signs:</strong> &gt;30% churn indicates process or quality issues</li>
        </ul>
      </div>

      {hasHighChurnTrend && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-semibold text-yellow-900 mb-2">⚠️ High Code Churn Detected</h3>
          <div className="text-sm text-yellow-800 space-y-2">
            <p><strong>Recent trend shows elevated code churn. Possible causes:</strong></p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Insufficient testing before merge</li>
              <li>Unclear requirements or specifications</li>
              <li>AI-generated code quality issues (if AI adoption is recent)</li>
              <li>Time pressure leading to rushed code</li>
              <li>Integration issues discovered post-merge</li>
            </ul>
            <p className="mt-3"><strong>Recommendations:</strong></p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Strengthen code review process</li>
              <li>Improve test coverage before merging</li>
              <li>Review PR requirements for clarity</li>
              <li>If AI-assisted, verify quality of AI suggestions</li>
            </ul>
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">Code Churn Benchmarks</h3>
        <div className="text-sm text-blue-800 space-y-2">
          <p><strong>Excellent (&lt;5%):</strong> Mature team, high quality standards</p>
          <p><strong>Good (5-10%):</strong> Normal development with minor follow-ups</p>
          <p><strong>Fair (10-30%):</strong> Some rework, consider review improvements</p>
          <p><strong>Poor (&gt;30%):</strong> Significant issues, investigate root causes</p>
        </div>
      </div>
    </div>
  );
}
