'use client';

import { useRanking } from '@/hooks/useDashboardData';
import { ChartCard, ChartSkeleton, ErrorMessage } from '@/components/ChartCard';
import { fmtPct, fmtMoney, fmtNum, fmtVar } from '@/lib/format';
import { COLORS } from '@/lib/colors';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useState } from 'react';

type Metric = 'taxa_fora_prazo' | 'fora_prazo_por_100k_uc_mes' | 'compensacao_rs' | 'variacao_taxa_pct';

const METRICS: { key: Metric; label: string; fmt: (v: number) => string }[] = [
  { key: 'taxa_fora_prazo', label: 'Taxa fora do prazo', fmt: (v) => fmtPct(v) },
  { key: 'fora_prazo_por_100k_uc_mes', label: 'Fora do prazo / 100k UC', fmt: (v) => fmtNum(v, 1) },
  { key: 'compensacao_rs', label: 'Compensações (R$)', fmt: (v) => fmtMoney(v) },
  { key: 'variacao_taxa_pct', label: 'Variação da taxa (%)', fmt: (v) => fmtVar(v) },
];

export default function RankingPage() {
  const { data, isLoading, error } = useRanking();
  const [metric, setMetric] = useState<Metric>('fora_prazo_por_100k_uc_mes');

  if (isLoading) return <ChartSkeleton />;
  if (error) return <ErrorMessage message={(error as Error).message} />;

  const metricCfg = METRICS.find((m) => m.key === metric)!;
  const sorted = [...(data?.data ?? [])]
    .sort((a, b) => (b[metric] as number) - (a[metric] as number))
    .slice(0, 15);

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-zinc-100">Ranking</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Grupos econômicos · Top 15
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {METRICS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                metric === m.key
                  ? 'bg-[#00C65A]/10 border-[#00C65A]/40 text-[#00C65A]'
                  : 'border-white/10 text-zinc-400 hover:text-zinc-100'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <ChartCard title={metricCfg.label} subtitle="Ordenado do maior para o menor">
        <ResponsiveContainer width="100%" height={420}>
          <BarChart
            data={sorted}
            layout="vertical"
            margin={{ top: 4, right: 32, bottom: 0, left: 0 }}
          >
            <CartesianGrid stroke="rgba(255,255,255,0.05)" horizontal={false} />
            <XAxis
              type="number"
              tickFormatter={metricCfg.fmt}
              tick={{ fill: '#71717a', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="grupo"
              tick={{ fill: '#a1a1aa', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={110}
            />
            <Tooltip
              contentStyle={{
                background: 'rgba(17,17,19,0.97)',
                border: `1px solid ${COLORS.green}55`,
                borderRadius: 8,
              }}
              labelStyle={{ color: '#fafafa', fontWeight: 600 }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(v: any) => [metricCfg.fmt(v as number), metricCfg.label]}
            />
            <Bar dataKey={metric} radius={[0, 4, 4, 0]}>
              {sorted.map((_, i) => (
                <Cell
                  key={i}
                  fill={i === 0 ? COLORS.red : i < 3 ? COLORS.amber : COLORS.blue}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
