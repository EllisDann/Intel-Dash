import React from 'react';

interface Props {
  title: string;
  value: string | number;
  delta?: string;
  subtitle?: string;
  info?: string;
  status?: 'good' | 'warning' | 'critical' | 'neutral';
  className?: string;
  children?: React.ReactNode;
}

const MetricCard: React.FC<Props> = ({ title, value, delta, subtitle, info, status = 'neutral', className = '', children }) => {
  return (
    <div className={`metric-card metric-card--${status} ${className}`.trim()}>
      <div className="metric-card__header">
        <div className="metric-card__title">{title}</div>
        <div className="metric-card__header-actions">
          {delta && <div className="metric-card__delta">{delta}</div>}
          {info && (
            <div className="metric-card__info-wrapper">
              <button type="button" className="metric-card__info-button" aria-label={`More info about ${title}`}>
                i
              </button>
              <div className="metric-card__info-tooltip">{info}</div>
            </div>
          )}
        </div>
      </div>
      <div className="metric-card__value">{value}</div>
      {subtitle && <div className="metric-card__subtitle">{subtitle}</div>}
      {children && <div className="metric-card__extra">{children}</div>}
    </div>
  );
};

export default MetricCard;
