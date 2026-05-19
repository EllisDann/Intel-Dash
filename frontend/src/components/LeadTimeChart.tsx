import React, { useEffect, useState } from 'react';
import api from '../api';
import LineChart from './Charts/LineChart';

interface LeadTimeData {
  date: string;
  avg: number | null;
  p50: number | null;
  p90: number | null;
  isPostAdoption: boolean;
}

interface Props {
  startDate: string;
  endDate: string;
}

const LeadTimeChart: React.FC<Props> = ({ startDate, endDate }) => {
  const [data, setData] = useState<LeadTimeData[] | null>(null);
  const [adoptionDate, setAdoptionDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const resp = await api.get('/api/dashboard/lead-time/series', {
          params: { startDate, endDate },
        });
        setData(resp.data.data || []);
        setAdoptionDate(resp.data.adoptionDate || null);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Unable to load lead time data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [startDate, endDate]);

  if (loading) return <p>Loading lead time...</p>;
  if (error) return <p style={{ color: '#f87171' }}>{error}</p>;
  if (!data || data.length === 0) return <p>No lead time data available</p>;

  // Transform data for multi-line chart
  const chartData = data.map((d) => ({
    date: d.date,
    avg: d.avg,
    p50: d.p50,
    p90: d.p90,
  }));

  return (
    <div>
      <h3>Lead Time for Changes (hours)</h3>
      {adoptionDate && (
        <small style={{ color: '#94a3b8' }}>
          AI Adoption: {new Date(adoptionDate).toLocaleDateString()}
        </small>
      )}
      <LineChart 
        data={chartData}
        dataKey="avg"
        additionalLines={[
          { key: 'p50', name: 'P50', stroke: '#06b6d4', strokeDasharray: '5 5' },
          { key: 'p90', name: 'P90', stroke: '#f97316', strokeDasharray: '5 5' },
        ]}
      />
      <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#94a3b8' }}>
        <p>Avg = Average Lead Time | P50 = Median | P90 = 90th Percentile</p>
      </div>
    </div>
  );
};

export default LeadTimeChart;
