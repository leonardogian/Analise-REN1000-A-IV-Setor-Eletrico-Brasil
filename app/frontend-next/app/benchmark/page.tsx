'use client';

import { useScatter, type ScatterItem } from '@/hooks/useDashboardData';
import { ChartCard, ChartSkeleton, ErrorMessage } from '@/components/ChartCard';
import { fmtNum, fmtMoney } from '@/lib/format';
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
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend,
} from 'recharts';
import { useMemo, useState } from 'react';

const PORTE_COLORS: Record<string, string> = {
  P: '#00C65A',
  M: '#FF6B1A',
  G: '#1A8FE3',
  GG: '#8b5cf6',
};

const PORTE_LABELS: Record<string, string> = {
  P: 'P — Pequeno',
  M: 'M — Médio',
  G: 'G — Grande',
  GG: 'GG — Muito Grande',
};

export default function BenchmarkPage() {
  const { data, isLoading, error } = useScatter();
  const [selectedPortes, setSelectedPortes] = useState<Set<string>>(
    new Set(['P', 'M', 'G', 'GG'])
  );

  const allData = useMemo(() => data?.data ?? [], [data]);
  const portes = useMemo(
    () => [...new Set(allData.map((d) => d.porte).filter(Boolean))].sort(),
    [allData]
  );

  const filtered = useMemo(
    () => allData.filter((d) => selectedPortes.has(d.porte)),
    [allData, selectedPortes]
  );

  const barData = useMemo(
    () =>
      [...filtered]
        .sort((a, b) => b.x - a.x)
        .slice(0, 15)
        .map((d) => ({
          ...d,
          name: d.label.split(' — ')[0].slice(0, 22),
        })),
    [filtered]
  );

  const radarData = useMemo(() => {
    if (filtered.length < 2) return [];
    const top5 = [...filtered].sort((a, b) => b.x - a.x).slice(0, 5);
    const maxX = Math.max(...filtered.map((d) => d.x), 1);
    const maxY = Math.max(...filtered.map((d) => d.y), 0.001);

    return top5.map((d) => {
      const volNorm = (d.x / maxX) * 100;
      const compNorm = (d.y / maxY) * 100;
      const effNorm = volNorm > 0 ? Math.min(100, (compNorm / volNorm) * 50) : 0;
      return {
        name: d.label.split(' — ')[0].slice(0, 16),
        porte: d.porte,
        Volume: Math.round(volNorm),
        Compensação: Math.round(compNorm),
        Eficiência: Math.round(effNorm),
      };
    });
  }, [filtered]);

  // Summary stats per porte
  const porteSummary = useMemo(() => {
    return portes
      .filter((p) => selectedPortes.has(p))
      .map((p) => {
        const items = filtered.filter((d) => d.porte === p);
        const avgY =
          items.length > 0
            ? items.reduce((s, d) => s + d.y, 0) / items.length
            : 0;
        const totalVol = items.reduce((s, d) => s + d.x, 0);
        const top = [...items].sort((a, b) => b.x - a.x)[0];
        return { porte: p, count: items.length, avgY, totalVol, top };
      });
  }, [portes, selectedPortes, filtered]);

  function togglePorte(p: string) {
    setSelectedPortes((prev) => {
      const next = new Set(prev);
      if (next.has(p)) {
        if (next.size > 1) next.delete(p);
      } else {
        next.add(p);
      }
      return next;
    });
  }

  if (isLoading) return <ChartSkeleton rows={2} />;
  if (error)
    return <ErrorMessage message={(error as Error).message} />;

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-zinc-100">Benchmark</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Comparativo entre distribuidoras por porte
          </p>
        </div>
        {/* Porte filter chips */}
        <div className="flex gap-2">
          {portes.map((p) => (
            <button
              key={p}
              onClick={() => togglePorte(p)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                selectedPortes.has(p)
                  ? `bg-opacity-10 border-opacity-40 font-medium`
                  : 'border-white/10 text-zinc-500 hover:text-zinc-100'
              }`}
              style={
                selectedPortes.has(p)
                  ? {
                      color: PORTE_COLORS[p] ?? COLORS.blue,
                      borderColor: `${PORTE_COLORS[p] ?? COLORS.blue}66`,
                      backgroundColor: `${PORTE_COLORS[p] ?? COLORS.blue}15`,
                    }
                  : undefined
              }
            >
              {PORTE_LABELS[p] ?? p}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards by porte */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {porteSummary.map((s) => (
          <div
            key={s.porte}
            className="rounded-xl border p-4 bg-[#18181b]"
            style={{ borderColor: `${PORTE_COLORS[s.porte]}40` }}
          >
            <p
              className="text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color: PORTE_COLORS[s.porte] }}
            >
              {PORTE_LABELS[s.porte] ?? s.porte}
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-zinc-500 block">Distribuidoras</span>
                <span className="text-lg font-bold text-zinc-100">{s.count}</span>
              </div>
              <div>
                <span className="text-zinc-500 block">Média R$/UC-mês</span>
                <span
                  className="text-sm font-bold"
                  style={{ color: PORTE_COLORS[s.porte] }}
                >
                  {fmtMoney(s.avgY)}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block">Volume Total</span>
                <span className="text-sm font-bold text-zinc-100">
                  {fmtNum(s.totalVol)}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block">Maior Volume</span>
                <span className="text-xs font-medium text-zinc-300 leading-tight block">
                  {s.top?.label.split(' — ')[0].slice(0, 18) ?? '—'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Horizontal bar chart: volume × compensação */}
      <ChartCard
        title="Volume Fora do Prazo × Compensação"
        subtitle="Top 15 distribuidoras · barras = volume, tooltip = R$/UC-mês"
      >
        <ResponsiveContainer width="100%" height={460}>
          <BarChart
            data={barData}
            layout="vertical"
            margin={{ top: 4, right: 32, bottom: 0, left: 0 }}
          >
            <CartesianGrid stroke="rgba(255,255,255,0.05)" horizontal={false} />
            <XAxis
              type="number"
              tickFormatter={(v) => fmtNum(v)}
              tick={{ fill: '#71717a', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: '#a1a1aa', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={130}
            />
            <Tooltip
              contentStyle={{
                background: 'rgba(17,17,19,0.97)',
                border: `1px solid ${COLORS.green}55`,
                borderRadius: 8,
              }}
              labelStyle={{ color: '#fafafa', fontWeight: 600 }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(v: any, _name: any, entry: any) => {
                const d = entry?.payload as ScatterItem | undefined;
                return [
                  `${fmtNum(v as number)} fora do prazo · ${fmtMoney(d?.y)}/UC-mês`,
                  `${PORTE_LABELS[d?.porte ?? ''] ?? d?.porte ?? ''}`,
                ];
              }}
            />
            <Bar dataKey="x" radius={[0, 4, 4, 0]}>
              {barData.map((d, i) => (
                <Cell
                  key={i}
                  fill={`${PORTE_COLORS[d.porte] ?? COLORS.blue}88`}
                  stroke={PORTE_COLORS[d.porte] ?? COLORS.blue}
                  strokeWidth={1.5}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Radar chart: top 5 */}
      {radarData.length >= 2 && (
        <ChartCard
          title="Perfil Comparativo — Top 5"
          subtitle="Volume × Compensação × Eficiência (normalizado 0-100)"
        >
          <ResponsiveContainer width="100%" height={360}>
            <RadarChart data={[
              { dim: 'Volume', ...Object.fromEntries(radarData.map((r) => [r.name, r.Volume])) },
              { dim: 'Compensação', ...Object.fromEntries(radarData.map((r) => [r.name, r.Compensação])) },
              { dim: 'Eficiência', ...Object.fromEntries(radarData.map((r) => [r.name, r.Eficiência])) },
            ]}>
              <PolarGrid stroke="rgba(255,255,255,0.08)" />
              <PolarAngleAxis
                dataKey="dim"
                tick={{ fill: '#a1a1aa', fontSize: 12 }}
              />
              <PolarRadiusAxis tick={false} domain={[0, 100]} axisLine={false} />
              {radarData.map((r, i) => (
                <Radar
                  key={r.name}
                  name={r.name}
                  dataKey={r.name}
                  stroke={Object.values(PORTE_COLORS)[i % 4]}
                  fill={Object.values(PORTE_COLORS)[i % 4]}
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
              ))}
              <Legend
                wrapperStyle={{ fontSize: 11, color: '#71717a', paddingTop: 8 }}
              />
              <Tooltip
                contentStyle={{
                  background: 'rgba(17,17,19,0.97)',
                  border: `1px solid ${COLORS.green}55`,
                  borderRadius: 8,
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  );
}
