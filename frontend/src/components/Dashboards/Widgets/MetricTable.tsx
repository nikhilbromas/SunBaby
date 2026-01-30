import React, { useEffect, useState } from 'react';
import { apiClient } from '@/services/api';
import type { MetricResponse } from '@/services/types';
import { Card } from '@/components/ui/card';

interface MetricTableProps {
  metric: string;
  title: string;
}

function prettifyKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

const MetricTable: React.FC<MetricTableProps> = ({ metric, title }) => {
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

  return (
    <Card className="p-4 bg-black border border-neutral-800 text-white">
      <div className="text-xs text-neutral-400 mb-3">{title}</div>
      <div className="overflow-auto max-h-64">
        <table className="w-full text-xs">
          <thead className="text-neutral-400">
            <tr className="border-b border-neutral-800">
              <th className="py-2 pr-2 text-left font-medium">Label</th>
              <th className="py-2 px-2 text-right font-medium">Value</th>
            </tr>
          </thead>
          <tbody className="text-white">
            {data.data.map((point, idx) => (
              <tr key={idx} className="border-b border-neutral-900">
                <td className="py-2 pr-2">{prettifyKey(point.label)}</td>
                <td className="py-2 px-2 text-right">{point.value.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

export default MetricTable;

