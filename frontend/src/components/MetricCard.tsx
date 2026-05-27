import React from 'react';

interface Props {
  title: string;
  value: string | number;
  delta?: string;
  subtitle?: string;
  status?: 'good' | 'warning' | 'critical' | 'neutral';
  className?: string;
  children?: React.ReactNode;
}

const MetricCard: React.FC<Props> = ({ title, value, delta, subtitle, status = 'neutral', className = '', children }) => {
  return (
    <div className={`metric-card metric-card--${status} ${className}`.trim()}>
      <div className="metric-card__header">
        <div className="metric-card__title">{title}</div>
        {delta && <div className="metric-card__delta">{delta}</div>}
      </div>
      <div className="metric-card__value">{value}</div>
      {subtitle && <div className="metric-card__subtitle">{subtitle}</div>}
      {children && <div className="metric-card__extra">{children}</div>}
    </div>
  );
};

export default MetricCard;
