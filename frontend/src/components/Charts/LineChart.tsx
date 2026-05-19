import React from 'react';
import EmptyMetricsCTA from '../../components/EmptyMetricsCTA';
import {
  ResponsiveContainer,
  LineChart as ReLineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Area,
  Legend,
} from 'recharts';

interface AdditionalLine {
  key: string;
  name?: string;
  stroke?: string;
  strokeDasharray?: string;
}

interface ChartDataset {
  label?: string;
  data?: Array<number | null | undefined>;
  borderColor?: string;
  backgroundColor?: string;
  borderDash?: number[];
}

interface ChartJSData {
  labels: string[];
  datasets: ChartDataset[];
}

interface Props {
  data: Array<any> | ChartJSData;
  dataKey?: string;
  additionalLines?: AdditionalLine[];
  height?: number;
  yLabel?: string;
  options?: Record<string, any>;
}

const normalizeChartJSData = (data: ChartJSData) => {
  const keys = data.datasets.map((dataset, index) => {
    const label = dataset.label || `series_${index}`;
    return label.replace(/[^a-zA-Z0-9_]/g, '_');
  });

  const points = data.labels.map((label, index) => {
    const point: any = { date: label };
    data.datasets.forEach((dataset, datasetIndex) => {
      const key = keys[datasetIndex];
      point[key] = dataset.data?.[index] ?? null;
    });
    return point;
  });

  return {
    normalized: points,
    keys,
  };
};

const LineChart: React.FC<Props> = ({ data = [], dataKey = 'value', additionalLines = [], height = 160, yLabel }) => {
  const hasChartJSData = !Array.isArray(data) && (data as ChartJSData).labels !== undefined;
  const { normalized, keys } = hasChartJSData ? normalizeChartJSData(data as ChartJSData) : { normalized: (data as any[]).map((d) => ({ ...d, date: d.date || d.snapshot_date })), keys: [] };
  const chartData = normalized;
  const primaryKey = hasChartJSData ? keys[0] || dataKey : dataKey;
  // determine if there's any numeric data to plot
  const hasNumeric = chartData && chartData.length > 0 && chartData.some((pt: any) => typeof pt[primaryKey] === 'number');

  if (!hasNumeric) {
    return (
      <div style={{ width: '100%', height }}>
        <EmptyMetricsCTA />
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <ReLineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          {(additionalLines.length > 0 || hasChartJSData) && <Legend />}
          <Area type="monotone" dataKey={primaryKey} stroke="#0ea5e9" fill="rgba(14,165,233,0.08)" />
          <Line type="monotone" dataKey={primaryKey} stroke="#0ea5e9" strokeWidth={2} dot={false} name={primaryKey} />
          {hasChartJSData
            ? keys.slice(1).map((key) => (
                <Line key={key} type="monotone" dataKey={key} stroke="#06b6d4" strokeWidth={2} dot={false} name={key} />
              ))
            : additionalLines.map((line) => (
                <Line
                  key={line.key}
                  type="monotone"
                  dataKey={line.key}
                  stroke={line.stroke || '#06b6d4'}
                  strokeWidth={2}
                  strokeDasharray={line.strokeDasharray}
                  dot={false}
                  name={line.name || line.key}
                />
              ))}
        </ReLineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default LineChart;
