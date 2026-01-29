import React from 'react';
import type { MetricDashboardWidget } from '@/services/types';
import MetricCard from './Widgets/MetricCard';
import LineChart from './Widgets/LineChart';
import BarChart from './Widgets/BarChart';
import MetricTable from './Widgets/MetricTable';

interface WidgetRendererProps {
  widget: MetricDashboardWidget;
}

const WidgetRenderer: React.FC<WidgetRendererProps> = ({ widget }) => {
  const { visualization, metric, title } = widget;

  switch (visualization) {
    case 'card':
      return <MetricCard metric={metric} title={title} />;
    case 'line':
      return <LineChart metric={metric} title={title} />;
    case 'bar':
      return <BarChart metric={metric} title={title} />;
    case 'table':
      return <MetricTable metric={metric} title={title} />;
    default:
      return (
        <div className="p-4 bg-black border border-neutral-800 text-white">
          <div className="text-xs text-neutral-400">{title}</div>
          <div className="text-sm text-red-400 mt-2">Unknown visualization type: {visualization}</div>
        </div>
      );
  }
};

export default WidgetRenderer;

