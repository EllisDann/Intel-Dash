import React, { useEffect, useState } from 'react';
import api from '../api';
import LineChart from './Charts/LineChart';

const DeveloperDrilldown: React.FC<{ startDate: string; endDate: string }> = ({ startDate, endDate }) => {
  const [devs, setDevs] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [series, setSeries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await api.get('/api/dashboard/developers', { params: { startDate, endDate } });
        setDevs(r.data || []);
        if (r.data && r.data.length > 0) setSelected(r.data[0].id);
      } catch (err) {
        console.warn(err);
      }
    };
    load();
  }, [startDate, endDate]);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    api.get(`/api/dashboard/developers/${selected}/throughput`, { params: { startDate, endDate } })
      .then((r) => setSeries(r.data || []))
      .catch((err) => console.warn(err))
      .finally(() => setLoading(false));
  }, [selected, startDate, endDate]);

  return (
    <div className="developer-drilldown" style={{ border: '1px solid #e6edf3', padding: 12, borderRadius: 6 }}>
      <h4>Developers</h4>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ width: 220 }}>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {devs.map((d) => (
              <li key={d.id} style={{ padding: 6, cursor: 'pointer', background: d.id === selected ? '#eef6fb' : 'transparent' }} onClick={() => setSelected(d.id)}>
                <strong>{d.name}</strong>
                <div style={{ fontSize: 12 }}>{d.throughput} completed</div>
              </li>
            ))}
          </ul>
        </div>

        <div style={{ flex: 1 }}>
          <h5>Throughput trend</h5>
          {loading ? <p>Loading...</p> : <LineChart data={series} dataKey="value" />}
        </div>
      </div>
    </div>
  );
};

export default DeveloperDrilldown;
