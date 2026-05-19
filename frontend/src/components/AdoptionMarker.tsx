import React, { useEffect, useState } from 'react';
import api from '../api';

const AdoptionMarker: React.FC = () => {
  const [adoption, setAdoption] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [dateInput, setDateInput] = useState('');
  const [label, setLabel] = useState('');
  const [comparison, setComparison] = useState<any | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await api.get('/api/organizations/ai-adoption-date');
        setAdoption(r.data);
        if (r.data) setDateInput(r.data.adoption_date.slice(0, 10));
      } catch (err) {
        console.warn(err);
      } finally {
        setLoading(false);
      }
    };

    load();
    // also load comparison
    const loadComp = async () => {
      try {
        const c = await api.get('/api/dashboard/adoption/comparison');
        setComparison(c.data);
      } catch (err) {
        // ignore
      }
    };
    loadComp();
  }, []);

  const save = async () => {
    try {
      const r = await api.post('/api/organizations/ai-adoption-date', { adoption_date: dateInput, label });
      setAdoption(r.data);
      setEditing(false);
      const c = await api.get('/api/dashboard/adoption/comparison');
      setComparison(c.data);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Unable to save');
    }
  };

  if (loading) return <p>Loading adoption info...</p>;

  return (
    <div className="adoption-marker" style={{ border: '1px solid #e6edf3', padding: '0.75rem', borderRadius: 6 }}>
      <h4>AI / Tooling Adoption</h4>
      {adoption ? (
        <div>
          <div>Adoption date: <strong>{adoption.adoption_date.slice(0,10)}</strong></div>
          {adoption.label && <div>Label: {adoption.label}</div>}
          <div style={{ marginTop: 8 }}>
            <button onClick={() => setEditing(true)}>Edit</button>
          </div>
        </div>
      ) : (
        <div>
          <p>No adoption date set.</p>
          <button onClick={() => setEditing(true)}>Set adoption date</button>
        </div>
      )}

      {editing && (
        <div style={{ marginTop: 8 }}>
          <input type="date" value={dateInput} onChange={(e) => setDateInput(e.target.value)} />
          <input placeholder="Label (optional)" value={label} onChange={(e) => setLabel(e.target.value)} />
          <div style={{ marginTop: 6 }}>
            <button onClick={save}>Save</button>
            <button onClick={() => setEditing(false)} style={{ marginLeft: 8 }}>Cancel</button>
          </div>
        </div>
      )}

      {comparison && comparison.adoptionDate && (
        <div style={{ marginTop: 10 }}>
          <h5>30-day pre/post comparison</h5>
          <div>Throughput: {comparison.pre.throughput ? Number(comparison.pre.throughput).toFixed(1) : 'N/A'} → {comparison.post.throughput ? Number(comparison.post.throughput).toFixed(1) : 'N/A'} ({comparison.improvement.throughput_pct !== null ? `${Number(comparison.improvement.throughput_pct).toFixed(1)}%` : 'N/A'})</div>
          <div>Cycle time (hrs): {comparison.pre.cycle_time ? Number(comparison.pre.cycle_time).toFixed(1) : 'N/A'} → {comparison.post.cycle_time ? Number(comparison.post.cycle_time).toFixed(1) : 'N/A'} ({comparison.improvement.cycle_time_pct !== null ? `${Number(comparison.improvement.cycle_time_pct).toFixed(1)}%` : 'N/A'})</div>
        </div>
      )}
    </div>
  );
};

export default AdoptionMarker;
