import React, { useEffect, useState } from 'react';
import { apiClient } from '@/services/api';
import type { MetricResponse } from '@/services/types';
import { Card } from '@/components/ui/card';

interface LineChartProps {
  metric: string;
  title: string;
}

const LineChart: React.FC<LineChartProps> = ({ metric, title }) => {
  const [data, setData] = useState<MetricResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetric = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.getMetric(metric);
        setData(response);
      } catch (e: any) {
        setError(e?.response?.data?.message || e?.message || 'Failed to load metric');
      } finally {
        setLoading(false);
      }
    };

    void fetchMetric();
  }, [metric]);

  if (loading) {
    return (
      <Card className="p-4 bg-black border border-neutral-800 text-white">
        <div className="text-xs text-neutral-400">{title}</div>
        <div className="text-sm text-neutral-500 mt-2">Loading...</div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-4 bg-black border border-red-500 text-white">
        <div className="text-xs text-red-400">{title}</div>
        <div className="text-sm text-red-300 mt-2">{error}</div>
      </Card>
    );
  }

  if (!data || data.data.length === 0) {
    return (
      <Card className="p-4 bg-black border border-neutral-800 text-white">
        <div className="text-xs text-neutral-400">{title}</div>
        <div className="text-sm text-neutral-500 mt-2">No data</div>
      </Card>
    );
  }

  // Simple line chart visualization - list of data points
  const maxValue = Math.max(...data.data.map((d) => d.value), 1);

  return (
    <Card className="p-4 bg-black border border-neutral-800 text-white">
      <div className="text-xs text-neutral-400 mb-3">{title}</div>
      <div className="space-y-2 max-h-64 overflow-auto">
        {data.data.map((point, idx) => {
          const percentage = (point.value / maxValue) * 100;
          return (
            <div key={idx} className="flex items-center gap-2">
              <div className="text-xs text-white flex-1 min-w-0 truncate">{point.label}</div>
              <div className="flex-1 bg-neutral-800 rounded h-4 relative overflow-hidden">
                <div
                  className="bg-white h-full"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <div className="text-xs text-neutral-300 w-20 text-right">
                {point.value.toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

export default LineChart;

