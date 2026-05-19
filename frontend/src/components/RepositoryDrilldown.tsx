import React, { useEffect, useState } from 'react';
import api from '../api';
import LineChart from './Charts/LineChart';

const RepositoryDrilldown: React.FC<{ startDate: string; endDate: string }> = ({ startDate, endDate }) => {
  const [repos, setRepos] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [series, setSeries] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await api.get('/api/dashboard/repositories', { params: { startDate, endDate } });
        setRepos(r.data || []);
        if (r.data && r.data.length > 0) setSelected(r.data[0].id);
      } catch (err) {
        console.warn(err);
      }
    };
    load();
  }, [startDate, endDate]);

  useEffect(() => {
    if (!selected) return;
    api.get(`/api/dashboard/repositories/${encodeURIComponent(selected)}/stats`, { params: { startDate, endDate } })
      .then((r) => setSeries(r.data || []))
      .catch((err) => console.warn(err));
  }, [selected, startDate, endDate]);

  return (
    <div className="repo-drilldown" style={{ border: '1px solid #e6edf3', padding: 12, borderRadius: 6 }}>
      <h4>Repositories</h4>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ width: 220 }}>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {repos.map((r) => (
              <li key={r.id} style={{ padding: 6, cursor: 'pointer', background: r.id === selected ? '#eef6fb' : 'transparent' }} onClick={() => setSelected(r.id)}>
                <strong>{r.id}</strong>
                <div style={{ fontSize: 12 }}>{r.throughput} completed</div>
              </li>
            ))}
          </ul>
        </div>

        <div style={{ flex: 1 }}>
          <h5>Throughput trend</h5>
          <LineChart data={series} dataKey="value" />
        </div>
      </div>
    </div>
  );
};

export default RepositoryDrilldown;
