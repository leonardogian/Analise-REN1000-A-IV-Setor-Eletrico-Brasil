'use client';

import { useScatter, type ScatterItem } from '@/hooks/useDashboardData';
import { ChartCard, ChartSkeleton, ErrorMessage } from '@/components/ChartCard';
import { KPICard } from '@/components/KPICard';
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
  ScatterChart,
  Scatter,
  ReferenceLine,
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

function formatHolding(id: string): string {
  const map: Record<string, string> = {
    neoenergia: 'Neoenergia',
    cpfl: 'CPFL',
    equatorial: 'Equatorial',
    enel: 'Enel',
    energisa: 'Energisa',
    cemig_d: 'CEMIG D',
    edp: 'EDP',
    celesc_dis: 'Celesc',
    light: 'Light',
    copel_dis: 'Copel',
    rge: 'RGE',
    amazonas: 'Amazonas',
    eletrobras: 'Eletrobras',
  };
  return map[id] ?? id.charAt(0).toUpperCase() + id.slice(1).replace(/_/g, ' ');
}

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function ScatterTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ScatterItem }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const parts = d.label.split(' — ');
  return (
    <div
      className="rounded-lg p-3 text-xs space-y-1.5"
      style={{
        background: 'rgba(17,17,19,0.97)',
        border: `1px solid ${PORTE_COLORS[d.porte] ?? COLORS.blue}55`,
        borderRadius: 8,
        minWidth: 200,
      }}
    >
      <p className="font-semibold text-zinc-100">{parts[0]}</p>
      {parts[1] && <p className="text-zinc-500 text-[10px]">{parts[1]}</p>}
      <div className="border-t border-white/10 pt-1.5 space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Volume fora do prazo</span>
          <span className="text-zinc-100 font-medium">{fmtNum(d.x)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Compensação</span>
          <span className="font-semibold" style={{ color: PORTE_COLORS[d.porte] ?? COLORS.blue }}>
            {fmtMoney(d.y)}/UC-mês
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Porte</span>
          <span className="font-medium" style={{ color: PORTE_COLORS[d.porte] ?? COLORS.blue }}>
            {PORTE_LABELS[d.porte] ?? d.porte}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Holding</span>
          <span className="text-zinc-300">{formatHolding(d.holding)}</span>
        </div>
      </div>
    </div>
  );
}

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

  // ── KPIs ──────────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    if (!filtered.length) return null;
    const medY = median(filtered.map((d) => d.y));
    const topVol = [...filtered].sort((a, b) => b.x - a.x)[0];
    const best = [...filtered].filter((d) => d.y > 0).sort((a, b) => a.y - b.y)[0];
    return {
      total: filtered.length,
      medY,
      topVolLabel: topVol?.label.split(' — ')[0] ?? '—',
      bestLabel: best?.label.split(' — ')[0] ?? '—',
      bestY: best?.y ?? 0,
    };
  }, [filtered]);

  // ── Scatter by porte ──────────────────────────────────────────────────────────
  const { byPorte, medianX, medianY } = useMemo(() => {
    const byPorte: Record<string, ScatterItem[]> = {};
    for (const d of filtered) {
      if (!byPorte[d.porte]) byPorte[d.porte] = [];
      byPorte[d.porte].push(d);
    }
    return {
      byPorte,
      medianX: median(filtered.map((d) => d.x)),
      medianY: median(filtered.map((d) => d.y)),
    };
  }, [filtered]);

  // ── Bar chart: top 15 by volume ───────────────────────────────────────────────
  const barData = useMemo(
    () =>
      [...filtered]
        .sort((a, b) => b.x - a.x)
        .slice(0, 15)
        .map((d) => ({ ...d, name: d.label.split(' — ')[0].slice(0, 22) })),
    [filtered]
  );

  // ── Holdings efficiency ranking ───────────────────────────────────────────────
  const holdingsRanking = useMemo(() => {
    const byHolding = new Map<string, { totalX: number; totalY: number; count: number }>();
    for (const d of filtered) {
      if (!byHolding.has(d.holding))
        byHolding.set(d.holding, { totalX: 0, totalY: 0, count: 0 });
      const e = byHolding.get(d.holding)!;
      e.totalX += d.x;
      e.totalY += d.y;
      e.count += 1;
    }
    return [...byHolding.entries()]
      .map(([id, s]) => ({
        id,
        name: formatHolding(id),
        avgY: s.count > 0 ? s.totalY / s.count : 0,
        totalX: s.totalX,
        count: s.count,
      }))
      .sort((a, b) => a.avgY - b.avgY)
      .slice(0, 12);
  }, [filtered]);

  // ── Summary stats per porte ───────────────────────────────────────────────────
  const porteSummary = useMemo(
    () =>
      portes
        .filter((p) => selectedPortes.has(p))
        .map((p) => {
          const items = filtered.filter((d) => d.porte === p);
          const avgY = items.length > 0 ? items.reduce((s, d) => s + d.y, 0) / items.length : 0;
          const totalVol = items.reduce((s, d) => s + d.x, 0);
          const top = [...items].sort((a, b) => b.x - a.x)[0];
          return { porte: p, count: items.length, avgY, totalVol, top };
        }),
    [portes, selectedPortes, filtered]
  );

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

  if (isLoading) return <ChartSkeleton rows={3} />;
  if (error) return <ErrorMessage message={(error as Error).message} />;

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-zinc-100">Benchmark</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Comparativo entre distribuidoras por porte · volume × compensação R$/UC-mês
          </p>
        </div>
        {/* Porte filter chips */}
        <div className="flex gap-2">
          {portes.map((p) => (
            <button
              key={p}
              onClick={() => togglePorte(p)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                selectedPortes.has(p) ? 'font-medium' : 'border-white/10 text-zinc-500 hover:text-zinc-100'
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

      {/* KPI Cards */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPICard
            title="Distribuidoras"
            value={fmtNum(kpis.total)}
            sub="No filtro atual"
            variant="blue"
          />
          <KPICard
            title="Mediana R$/UC-mês"
            value={fmtMoney(kpis.medY)}
            sub="Compensação por unidade"
            variant="amber"
          />
          <KPICard
            title="Maior Volume"
            value={kpis.topVolLabel.slice(0, 20)}
            sub="Total de serviços fora do prazo"
            variant="red"
          />
          <KPICard
            title="Menor Compensação"
            value={kpis.bestLabel.slice(0, 20)}
            sub={`${fmtMoney(kpis.bestY)}/UC-mês — melhor performer`}
            variant="green"
          />
        </div>
      )}

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
                <span className="text-sm font-bold text-zinc-100">{fmtNum(s.totalVol)}</span>
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

      {/* Scatter Plot — principal */}
      <ChartCard
        title="Volume × Compensação por Distribuidora"
        subtitle="Cada ponto = 1 distribuidora · linhas tracejadas = mediana do conjunto"
      >
        <div className="flex gap-4 mb-3 text-[10px] text-zinc-500">
          <span>
            ↗ Alto volume + alto custo:{' '}
            <span className="text-red-400 font-medium">alto risco</span>
          </span>
          <span>
            ↙ Baixo volume + baixo custo:{' '}
            <span className="text-[#00C65A] font-medium">referência</span>
          </span>
          <span>
            ↘ Alto volume + baixo custo:{' '}
            <span className="text-[#1A8FE3] font-medium">eficiência de escala</span>
          </span>
        </div>
        <ResponsiveContainer width="100%" height={420}>
          <ScatterChart margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" />
            <XAxis
              type="number"
              dataKey="x"
              name="Volume"
              tickFormatter={(v) => fmtNum(v)}
              tick={{ fill: '#71717a', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              label={{
                value: 'Volume fora do prazo',
                position: 'insideBottom',
                offset: -4,
                fill: '#52525b',
                fontSize: 10,
              }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="R$/UC-mês"
              tickFormatter={(v) => fmtMoney(v)}
              tick={{ fill: '#71717a', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={62}
              label={{
                value: 'R$/UC-mês',
                angle: -90,
                position: 'insideLeft',
                offset: 8,
                fill: '#52525b',
                fontSize: 10,
              }}
            />
            {medianX > 0 && (
              <ReferenceLine
                x={medianX}
                stroke="rgba(255,255,255,0.12)"
                strokeDasharray="4 4"
              />
            )}
            {medianY > 0 && (
              <ReferenceLine
                y={medianY}
                stroke="rgba(255,255,255,0.12)"
                strokeDasharray="4 4"
              />
            )}
            {(['P', 'M', 'G', 'GG'] as const).map(
              (p) =>
                selectedPortes.has(p) &&
                byPorte[p]?.length > 0 && (
                  <Scatter
                    key={p}
                    name={PORTE_LABELS[p]}
                    data={byPorte[p]}
                    fill={PORTE_COLORS[p]}
                    fillOpacity={0.75}
                    strokeWidth={0}
                  />
                )
            )}
            <Tooltip
              cursor={false}
              content={
                <ScatterTooltip />
              }
            />
            <Legend wrapperStyle={{ fontSize: 11, color: '#71717a', paddingTop: 8 }} />
          </ScatterChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Horizontal bar chart: volume × compensação */}
      <ChartCard
        title="Top 15 por Volume Fora do Prazo"
        subtitle="Barras = volume · tooltip mostra R$/UC-mês"
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
              formatter={(vRaw, _name, entry) => {
                const d = (entry?.payload as ScatterItem | undefined);
                const v = Number(vRaw ?? 0);
                return [
                  `${fmtNum(v)} fora do prazo · ${fmtMoney(d?.y)}/UC-mês`,
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

      {/* Holdings Efficiency Ranking */}
      {holdingsRanking.length >= 2 && (
        <ChartCard
          title="Eficiência por Grupo Econômico"
          subtitle="Média de compensação R$/UC-mês por holding · menor = melhor performance"
        >
          <ResponsiveContainer width="100%" height={360}>
            <BarChart
              data={holdingsRanking}
              layout="vertical"
              margin={{ top: 4, right: 80, bottom: 0, left: 0 }}
            >
              <CartesianGrid stroke="rgba(255,255,255,0.05)" horizontal={false} />
              <XAxis
                type="number"
                tickFormatter={(v) => fmtMoney(v)}
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
                width={90}
              />
              <Tooltip
                contentStyle={{
                  background: 'rgba(17,17,19,0.97)',
                  border: `1px solid ${COLORS.green}55`,
                  borderRadius: 8,
                }}
                labelStyle={{ color: '#fafafa', fontWeight: 600 }}
                formatter={(vRaw, _name, entry) => {
                  const d = (entry?.payload as (typeof holdingsRanking)[0] | undefined);
                  const v = Number(vRaw ?? 0);
                  return [
                    `${fmtMoney(v)}/UC-mês · ${d?.count ?? 0} distribuidoras · vol ${fmtNum(d?.totalX ?? 0)}`,
                    'Compensação média',
                  ];
                }}
              />
              <Bar dataKey="avgY" radius={[0, 4, 4, 0]}>
                {holdingsRanking.map((d, i) => (
                  <Cell
                    key={i}
                    fill={`${COLORS.blue}${i < 3 ? '99' : '55'}`}
                    stroke={i < 3 ? COLORS.green : `${COLORS.blue}88`}
                    strokeWidth={i < 3 ? 1.5 : 1}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-zinc-600 mt-2">
            Os primeiros (menor R$/UC-mês) indicam melhor eficiência regulatória.
            Volume total calculado sobre distribuidoras no filtro atual.
          </p>
        </ChartCard>
      )}
    </div>
  );
}
