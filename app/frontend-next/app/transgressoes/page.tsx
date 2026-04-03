'use client';

import { useTimeseries } from '@/hooks/useDashboardData';
import { ChartCard, ChartSkeleton, ErrorMessage } from '@/components/ChartCard';
import { fmtNum } from '@/lib/format';
import { COLORS, DISTRIBUTOR_PALETTE } from '@/lib/colors';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useMemo, useState } from 'react';

export default function TransgressoesPage() {
  const { data, isLoading, error } = useTimeseries();
  const [metric, setMetric] = useState<'fora_prazo' | 'compensacao'>('fora_prazo');

  const { grupos, chartData } = useMemo(() => {
    if (!data?.data) return { grupos: [], chartData: [] };

    const points = data.data;
    const grupos = [...new Set(points.map((p) => p.grupo))].slice(0, 8);

    // Pivota: date → { date, [grupo]: valor }
    const byDate = new Map<string, Record<string, number | string>>();
    for (const p of points) {
      if (!grupos.includes(p.grupo)) continue;
      if (!byDate.has(p.date)) byDate.set(p.date, { date: p.date });
      const entry = byDate.get(p.date)!;
      entry[p.grupo] =
        metric === 'fora_prazo'
          ? p.fora_prazo_por_100k_uc_mes
          : p.compensacao_rs_por_uc_mes;
    }

    return {
      grupos,
      chartData: [...byDate.values()].sort((a, b) =>
        String(a.date).localeCompare(String(b.date))
      ),
    };
  }, [data, metric]);

  if (isLoading) return <ChartSkeleton />;
  if (error) return <ErrorMessage message={(error as Error).message} />;

  const metricLabel =
    metric === 'fora_prazo'
      ? 'Fora do Prazo / 100k UC-mês'
      : 'Compensação R$/UC-mês';

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-100">Transgressões</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Série mensal por grupo econômico
          </p>
        </div>
        {/* Seletor de métrica */}
        <div className="flex gap-2">
          {(['fora_prazo', 'compensacao'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                metric === m
                  ? 'bg-[#1A8FE3]/10 border-[#1A8FE3]/40 text-[#1A8FE3]'
                  : 'border-white/10 text-zinc-400 hover:text-zinc-100'
              }`}
            >
              {m === 'fora_prazo' ? 'Fora do Prazo' : 'Compensação'}
            </button>
          ))}
        </div>
      </div>

      <ChartCard title={metricLabel} subtitle="Top 8 grupos por período">
        <ResponsiveContainer width="100%" height={380}>
          <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="date"
              tick={{ fill: '#71717a', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval={5}
            />
            <YAxis
              tickFormatter={(v) => fmtNum(v, 1)}
              tick={{ fill: '#71717a', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={50}
            />
            <Tooltip
              contentStyle={{
                background: 'rgba(17,17,19,0.97)',
                border: `1px solid ${COLORS.green}55`,
                borderRadius: 8,
              }}
              labelStyle={{ color: '#fafafa', fontWeight: 600 }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, color: '#71717a', paddingTop: 16 }}
            />
            {grupos.map((grupo, i) => (
              <Line
                key={grupo}
                type="monotone"
                dataKey={grupo}
                stroke={DISTRIBUTOR_PALETTE[i % DISTRIBUTOR_PALETTE.length]}
                strokeWidth={1.5}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
