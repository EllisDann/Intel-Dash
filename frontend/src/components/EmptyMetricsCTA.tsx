import React from 'react';
import { Link } from 'react-router-dom';

export default function EmptyMetricsCTA() {
  return (
    <div className="empty-metrics-cta" style={{ padding: 16 }}>
      <h4 style={{ margin: 0 }}>No metrics yet</h4>
      <p style={{ color: '#4b5563' }}>Connect your GitHub or Jira integration to begin collecting metrics. Metrics will appear once data is synced.</p>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <Link to="/integrations" className="btn btn-primary">Connect Integrations</Link>
        <a href="/docs/13-kpi-framework-complete.md" className="btn btn-secondary">Learn about KPIs</a>
      </div>
    </div>
  );
}
