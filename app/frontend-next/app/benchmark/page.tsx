'use client';

import { ChartCard } from '@/components/ChartCard';

export default function BenchmarkPage() {
  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-xl font-bold text-zinc-100">Benchmark</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Comparativo entre distribuidoras por porte
        </p>
      </div>
      <ChartCard title="Em construção" subtitle="dashboard_scatter.json">
        <div className="h-48 flex items-center justify-center text-zinc-600 text-sm">
          Conecte o endpoint <code className="ml-1 text-zinc-400">/dashboard_scatter.json</code>
        </div>
      </ChartCard>
    </div>
  );
}
