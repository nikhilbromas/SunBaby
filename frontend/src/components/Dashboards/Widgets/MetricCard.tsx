import React, { useEffect, useState } from 'react';
import { apiClient } from '@/services/api';
import type { MetricResponse } from '@/services/types';
import { Card } from '@/components/ui/card';

interface MetricCardProps {
  metric: string;
  title: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ metric, title }) => {
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

  // For card visualization, show sum of all values or first value
  const value = data.data.length === 1
    ? data.data[0].value
    : data.data.reduce((sum, point) => sum + point.value, 0);

  return (
    <Card className="p-4 bg-black border border-neutral-800 text-white">
      <div className="text-xs text-neutral-400">{title}</div>
      <div className="text-2xl font-semibold mt-1">{value.toLocaleString()}</div>
      {data.unit && data.unit !== 'count' && (
        <div className="text-xs text-neutral-500 mt-1">{data.unit}</div>
      )}
    </Card>
  );
};

export default MetricCard;

