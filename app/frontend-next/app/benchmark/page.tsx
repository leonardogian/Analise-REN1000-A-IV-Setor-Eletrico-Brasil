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
import { useEffect, useMemo, useState } from 'react';

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

function shortEntityLabel(label?: string): string {
  if (!label) return '';
  return label.split(' — ')[0].replace(/^Grupo\s+/i, '').trim();
}

function formatHolding(id: string, label?: string): string {
  const conciseLabel = shortEntityLabel(label);
  if (conciseLabel) return conciseLabel;
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

function fmtInt(v: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(v);
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
        minWidth: 240,
      }}
    >
      <p className="font-semibold text-zinc-100">{parts[0]}</p>
      {parts[1] && <p className="text-zinc-500 text-[10px]">{parts[1]}</p>}
      <div className="border-t border-white/10 pt-1.5 space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Tamanho (UC-mês)</span>
          <span className="text-zinc-100 font-medium">{fmtInt(d.x)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Falhas/mês</span>
          <span className="font-semibold" style={{ color: PORTE_COLORS[d.porte] ?? COLORS.blue }}>
            {fmtNum(d.y)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Volume de falhas</span>
          <span className="text-zinc-300">{fmtInt(d.qtd_fora_prazo_total ?? 0)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Falhas/100k UC-mês</span>
          <span className="text-zinc-300">{fmtNum(d.falhas_por_100k_uc_mes ?? 0)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">R$/UC-mês</span>
          <span className="text-zinc-300">{fmtMoney(d.compensacao_rs_por_uc_mes ?? 0)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">R$/falha</span>
          <span className="text-zinc-300">{fmtMoney(d.compensacao_rs_por_falha ?? 0)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Porte</span>
          <span className="font-medium" style={{ color: PORTE_COLORS[d.porte] ?? COLORS.blue }}>
            {PORTE_LABELS[d.porte] ?? d.porte}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Grupo/operadora</span>
          <span className="text-zinc-300">{formatHolding(d.holding, d.holding_label)}</span>
        </div>
        {d.periodo_inicio && d.periodo_fim && (
          <div className="flex justify-between gap-4">
            <span className="text-zinc-500">Cobertura UC</span>
            <span className="text-zinc-300">
              {d.periodo_inicio}–{d.periodo_fim} · {d.meses_uc_validos ?? 0} meses
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function BenchmarkPage() {
  const { data, isLoading, error } = useScatter();
  const [selectedPortes, setSelectedPortes] = useState<Set<string>>(
    new Set(['P', 'M', 'G', 'GG'])
  );
  const [selectedPeriod, setSelectedPeriod] = useState('all');

  const periodOptions = useMemo(() => {
    const declared = data?.periods ?? [];
    if (declared.length) return declared;
    return [{ id: 'all', label: 'Todo período com UC' }];
  }, [data?.periods]);

  useEffect(() => {
    const defaultPeriod = data?.default_period ?? periodOptions[0]?.id ?? 'all';
    if (defaultPeriod && !periodOptions.some((p) => p.id === selectedPeriod)) {
      setSelectedPeriod(defaultPeriod);
    }
  }, [data?.default_period, periodOptions, selectedPeriod]);

  const allData = useMemo(() => data?.data ?? [], [data]);
  const periodData = useMemo(() => {
    const scoped = allData.filter((d) => (d.period_id ?? 'all') === selectedPeriod);
    return scoped.length ? scoped : allData;
  }, [allData, selectedPeriod]);
  const selectedPeriodMeta = periodOptions.find((p) => p.id === selectedPeriod) ?? periodOptions[0];

  const portes = useMemo(
    () => [...new Set(periodData.map((d) => d.porte).filter(Boolean))].sort(),
    [periodData]
  );

  const filtered = useMemo(
    () => periodData.filter((d) => selectedPortes.has(d.porte)),
    [periodData, selectedPortes]
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

  // ── Bar chart: top 15 por R$/falha ─────────────────────────────────────────
  const barData = useMemo(
    () =>
      [...filtered]
        .sort((a, b) => (b.compensacao_rs_por_falha ?? 0) - (a.compensacao_rs_por_falha ?? 0))
        .slice(0, 15)
        .map((d) => ({ ...d, name: d.label.split(' — ')[0].slice(0, 22) })),
    [filtered]
  );

  // ── Group/operator efficiency ranking ─────────────────────────────────────────
  const holdingsRanking = useMemo(() => {
    const byHolding = new Map<string, { totalX: number; totalY: number; count: number; label?: string }>();
    for (const d of filtered) {
      if (!byHolding.has(d.holding))
        byHolding.set(d.holding, { totalX: 0, totalY: 0, count: 0, label: d.holding_label });
      const e = byHolding.get(d.holding)!;
      e.totalX += d.x;
      e.totalY += d.y;
      e.count += 1;
      if (!e.label && d.holding_label) e.label = d.holding_label;
    }
    return [...byHolding.entries()]
      .map(([id, s]) => ({
        id,
        name: formatHolding(id, s.label),
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
            Benchmark por porte · tamanho (UC-mês) × falhas médias mensais · período {selectedPeriodMeta?.periodo_inicio ?? '—'}–{selectedPeriodMeta?.periodo_fim ?? '—'}
          </p>
        </div>
        <div className="flex flex-col gap-2 items-end">
          <div className="flex flex-wrap gap-2 justify-end">
            {periodOptions.map((period) => (
              <button
                key={period.id}
                onClick={() => setSelectedPeriod(period.id)}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                  selectedPeriod === period.id
                    ? 'bg-[#1A8FE3]/10 border-[#1A8FE3]/50 text-[#1A8FE3] font-medium'
                    : 'border-white/10 text-zinc-500 hover:text-zinc-100'
                }`}
                title={period.periodo_inicio && period.periodo_fim ? `${period.periodo_inicio}–${period.periodo_fim}` : undefined}
              >
                {period.label}
              </button>
            ))}
          </div>
          {/* Porte filter chips */}
          <div className="flex flex-wrap gap-2 justify-end">
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
            title="Mediana Falhas/mês"
            value={fmtNum(kpis.medY)}
            sub="Falhas médias mensais no filtro"
            variant="amber"
          />
          <KPICard
            title="Maior Tamanho"
            value={kpis.topVolLabel.slice(0, 20)}
            sub="Maior exposição em UC-mês"
            variant="red"
          />
          <KPICard
            title="Menos Falhas/mês"
            value={kpis.bestLabel.slice(0, 20)}
            sub={`${fmtNum(kpis.bestY)} falhas/mês — menor valor positivo`}
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
                <span className="text-zinc-500 block">Média falhas/mês</span>
                <span
                  className="text-sm font-bold"
                  style={{ color: PORTE_COLORS[s.porte] }}
                >
                  {fmtNum(s.avgY)}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block">UC-mês total</span>
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

      {/* Scatter Plot: Falhas/mês vs tamanho */}
      <ChartCard
        title="Falhas médias mensais × Tamanho da Distribuidora"
        subtitle="Eixo X = UC-mês (exposição); Eixo Y = falhas/mês no período selecionado · tooltip mantém Falhas/100k UC, R$/UC e R$/falha"
      >
        <div className="flex gap-4 mb-3 text-[10px] text-zinc-500">
          <span>
            ↗ Grande + muitas falhas: <span className="text-red-400 font-medium">alto risco operacional</span>
          </span>
          <span>
            ↙ Pequena + poucas falhas: <span className="text-[#00C65A] font-medium">referência</span>
          </span>
          <span>
            ↘ Grande + poucas falhas: <span className="text-[#1A8FE3] font-medium">eficiência de escala</span>
          </span>
        </div>
        <ResponsiveContainer width="100%" height={420}>
          <ScatterChart margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" />
            <XAxis
              type="number"
              dataKey="x"
              name="UC-mês"
              tickFormatter={(v) => fmtInt(v)}
              tick={{ fill: '#71717a', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              label={{
                value: 'UC-mês (tamanho)',
                position: 'insideBottom',
                offset: -4,
                fill: '#52525b',
                fontSize: 10,
              }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Falhas/mês"
              tickFormatter={(v) => fmtNum(v)}
              tick={{ fill: '#71717a', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={62}
              label={{
                value: 'Falhas/mês',
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

      {/* Horizontal bar chart: top 15 por R$/falha */}
      <ChartCard
        title="Top 15 por R$/falha"
        subtitle="Custo médio de compensação por transgressão · tooltip mostra R$/UC e falhas/100k UC"
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
              tickFormatter={(v) => fmtMoney(v)}
              tick={{ fill: '#71717a', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              label={{
                value: 'R$/falha',
                position: 'insideBottom',
                offset: -4,
                fill: '#52525b',
                fontSize: 10,
              }}
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
                  `R$ ${fmtMoney(v)}`,
                  `${PORTE_LABELS[d?.porte ?? ''] ?? d?.porte ?? ''} · ${fmtMoney(d?.compensacao_rs_por_uc_mes ?? 0)}/UC-mês · ${fmtNum(d?.falhas_por_100k_uc_mes ?? 0)} falhas/100k UC`,
                ];
              }}
            />
            <Bar dataKey="compensacao_rs_por_falha" radius={[0, 4, 4, 0]}>
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

      {/* Group/operator efficiency ranking */}
      {holdingsRanking.length >= 2 && (
        <ChartCard
          title="Falhas por grupo/operadora"
          subtitle="Média de falhas/mês no recorte selecionado · menor = melhor performance operacional"
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
                    `${fmtNum(v)} falhas/mês · ${d?.count ?? 0} distribuidoras · UC-mês ${fmtNum(d?.totalX ?? 0)}`,
                    'Falhas médias',
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
            Os primeiros (menor falhas/mês) indicam melhor desempenho operacional no período filtrado.
            O tamanho continua calculado no mesmo recorte comparável usado para UC-mês.
          </p>
        </ChartCard>
      )}
    </div>
  );
}
