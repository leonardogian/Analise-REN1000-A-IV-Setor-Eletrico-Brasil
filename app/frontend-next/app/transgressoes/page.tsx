'use client';

import { useTransgressoes } from '@/hooks/useDashboardData';
import { ChartCard, ChartSkeleton, ErrorMessage } from '@/components/ChartCard';
import { KPICard } from '@/components/KPICard';
import { fmtNum, fmtMoney, safeSum } from '@/lib/format';
import { COLORS, DISTRIBUTOR_PALETTE } from '@/lib/colors';
import {
  ComposedChart,
  Bar,
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';
import { useMemo, useState } from 'react';

interface Insights {
  inflection_point?: { mes: string; salto_transgressoes: number };
  top_rural_groups?: Array<{ holding: string; rural_share: number }>;
}

export default function TransgressoesPage() {
  const { data, isLoading, error } = useTransgressoes();
  const [holdingFilter, setHoldingFilter] = useState<string>('all');
  const [holdingMetric, setHoldingMetric] = useState<'valor_pago' | 'qtd_transgressoes'>(
    'valor_pago'
  );

  // ── KPIs ──────────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    if (!data?.series) return null;
    const s = data.series;
    const totalComp = safeSum(s.map((x) => x.valor_pago));
    const totalTransg = safeSum(s.map((x) => x.qtd_transgressoes));
    const ruralComp = safeSum(s.filter((x) => x.is_rural).map((x) => x.valor_pago));
    const ruralPct = totalComp > 0 ? (ruralComp / totalComp) * 100 : 0;

    const byHolding = new Map<string, number>();
    for (const item of s) {
      byHolding.set(item.holding, (byHolding.get(item.holding) ?? 0) + item.valor_pago);
    }
    const topHoldingId = [...byHolding.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
    const topHoldingLabel =
      data.groups.find((g) => g.id === topHoldingId)?.label ?? topHoldingId;

    return { totalComp, totalTransg, ruralPct, topHoldingLabel };
  }, [data]);

  // ── Monthly aggregate chart ───────────────────────────────────────────────────
  const { monthlyData, holdingOptions } = useMemo(() => {
    if (!data?.series) return { monthlyData: [], holdingOptions: [] };

    const source =
      holdingFilter === 'all'
        ? data.series
        : data.series.filter((s) => s.holding === holdingFilter);

    const mesOrder = new Map<string, number>();
    const byMes = new Map<string, { mes: string; valor_pago: number; qtd_transgressoes: number }>();

    for (const item of source) {
      if (!mesOrder.has(item.mes)) mesOrder.set(item.mes, item.ano * 12 + item.mes_num);
      if (!byMes.has(item.mes))
        byMes.set(item.mes, { mes: item.mes, valor_pago: 0, qtd_transgressoes: 0 });
      const entry = byMes.get(item.mes)!;
      entry.valor_pago += item.valor_pago;
      entry.qtd_transgressoes += item.qtd_transgressoes;
    }

    const options = [
      { id: 'all', label: 'Todos os grupos' },
      ...data.groups
        .filter((g) => g.enabled)
        .slice(0, 14)
        .map((g) => ({ id: g.id, label: g.label })),
    ];

    return {
      monthlyData: [...byMes.entries()]
        .sort((a, b) => (mesOrder.get(a[0]) ?? 0) - (mesOrder.get(b[0]) ?? 0))
        .map(([, v]) => v),
      holdingOptions: options,
    };
  }, [data, holdingFilter]);

  // ── Holdings comparison chart ─────────────────────────────────────────────────
  const { top8Holdings, holdingsChartData } = useMemo(() => {
    if (!data?.series) return { top8Holdings: [], holdingsChartData: [] };

    const byHoldingTotal = new Map<string, number>();
    for (const item of data.series) {
      byHoldingTotal.set(
        item.holding,
        (byHoldingTotal.get(item.holding) ?? 0) + item.valor_pago
      );
    }
    const top8Ids = [...byHoldingTotal.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id]) => id);

    const holdingLabels = new Map(
      data.groups.map((g) => [g.id, g.label.replace(/^Grupo /, '')])
    );

    const mesOrder = new Map<string, number>();
    const byMes = new Map<string, Record<string, number>>();

    for (const item of data.series) {
      if (!top8Ids.includes(item.holding)) continue;
      if (!mesOrder.has(item.mes)) mesOrder.set(item.mes, item.ano * 12 + item.mes_num);
      if (!byMes.has(item.mes)) byMes.set(item.mes, {});
      const entry = byMes.get(item.mes)!;
      const val =
        holdingMetric === 'valor_pago' ? item.valor_pago : item.qtd_transgressoes;
      entry[item.holding] = (entry[item.holding] ?? 0) + val;
    }

    return {
      top8Holdings: top8Ids.map((id) => ({ id, label: holdingLabels.get(id) ?? id })),
      holdingsChartData: [...byMes.entries()]
        .sort((a, b) => (mesOrder.get(a[0]) ?? 0) - (mesOrder.get(b[0]) ?? 0))
        .map(([mes, vals]) => ({ mes, ...vals })),
    };
  }, [data, holdingMetric]);

  // ── Rural/Urban breakdown ─────────────────────────────────────────────────────
  const ruralBreakdown = useMemo(() => {
    if (!data?.series) return null;
    const rural = data.series.filter((s) => s.is_rural);
    const urban = data.series.filter((s) => !s.is_rural);
    const totalComp = safeSum(data.series.map((s) => s.valor_pago));
    const ruralComp = safeSum(rural.map((s) => s.valor_pago));
    const urbanComp = safeSum(urban.map((s) => s.valor_pago));
    return {
      ruralComp,
      ruralCount: safeSum(rural.map((s) => s.qtd_transgressoes)),
      urbanComp,
      urbanCount: safeSum(urban.map((s) => s.qtd_transgressoes)),
      ruralShare: totalComp > 0 ? (ruralComp / totalComp) * 100 : 0,
      urbanShare: totalComp > 0 ? (urbanComp / totalComp) * 100 : 0,
    };
  }, [data]);

  // ── Insights ──────────────────────────────────────────────────────────────────
  const insights = data?.insights as Insights | undefined;
  const groupLabel = (holdingId: string) =>
    data?.groups.find((g) => g.id === holdingId)?.label ?? holdingId;

  if (isLoading) return <ChartSkeleton rows={4} />;
  if (error) return <ErrorMessage message={(error as Error).message} />;
  if (!data) return null;

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-xl font-bold text-zinc-100">Transgressões</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Compensações e transgressões por distribuidora · REN 1000 (2023 – hoje)
        </p>
      </div>

      {/* KPI Cards */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPICard
            title="Total Compensações"
            value={fmtMoney(kpis.totalComp)}
            sub="Período REN 1000"
            variant="amber"
          />
          <KPICard
            title="Total Transgressões"
            value={fmtNum(kpis.totalTransg)}
            sub="Serviços fora do prazo"
            variant="red"
          />
          <KPICard
            title="Compensação Rural"
            value={`${kpis.ruralPct.toFixed(1)}%`}
            sub="Do total compensado"
            variant="purple"
          />
          <KPICard
            title="Grupo Líder"
            value={kpis.topHoldingLabel.replace(/^Grupo /, '')}
            sub="Maior compensação acumulada"
            variant="blue"
          />
        </div>
      )}

      {/* Monthly Aggregate Chart */}
      <ChartCard
        title="Volume Mensal de Transgressões e Compensações"
        subtitle="Barras = transgressões (eixo esq.) · Linha = R$ compensado (eixo dir.)"
      >
        <div className="flex justify-end mb-3">
          <select
            value={holdingFilter}
            onChange={(e) => setHoldingFilter(e.target.value)}
            className="text-xs bg-[#09090b] border border-white/10 text-zinc-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#00C65A]/40"
          >
            {holdingOptions.map((h) => (
              <option key={h.id} value={h.id}>
                {h.label}
              </option>
            ))}
          </select>
        </div>
        <ResponsiveContainer width="100%" height={360}>
          <ComposedChart data={monthlyData} margin={{ top: 4, right: 56, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="mes"
              tick={{ fill: '#71717a', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval={2}
            />
            <YAxis
              yAxisId="left"
              tickFormatter={(v) => fmtNum(v)}
              tick={{ fill: '#71717a', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tickFormatter={(v) => fmtMoney(v)}
              tick={{ fill: '#71717a', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={64}
            />
            <ReferenceLine
              yAxisId="left"
              x="Jan/23"
              stroke="rgba(255,255,255,0.18)"
              strokeDasharray="4 4"
              label={{
                value: 'REN 1000',
                fill: '#a1a1aa',
                fontSize: 9,
                position: 'insideTopLeft',
              }}
            />
            <Tooltip
              contentStyle={{
                background: 'rgba(17,17,19,0.97)',
                border: `1px solid ${COLORS.green}55`,
                borderRadius: 8,
              }}
              labelStyle={{ color: '#fafafa', fontWeight: 600 }}
              formatter={(v, name) => [
                name === 'Transgressões'
                  ? `${fmtNum(Number(v ?? 0))} ocorrências`
                  : fmtMoney(Number(v ?? 0)),
                name,
              ]}
            />
            <Bar
              yAxisId="left"
              dataKey="qtd_transgressoes"
              name="Transgressões"
              fill={`${COLORS.amber}44`}
              stroke={`${COLORS.amber}99`}
              strokeWidth={1}
              radius={[2, 2, 0, 0]}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="valor_pago"
              name="Compensação R$"
              stroke={COLORS.green}
              strokeWidth={2}
              dot={false}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: '#71717a', paddingTop: 12 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Holdings Comparison */}
      <ChartCard
        title="Comparativo por Grupo Econômico"
        subtitle="Top 8 grupos · evolução mensal"
      >
        <div className="flex justify-end mb-3 gap-2">
          {(['valor_pago', 'qtd_transgressoes'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setHoldingMetric(m)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                holdingMetric === m
                  ? 'bg-[#1A8FE3]/10 border-[#1A8FE3]/40 text-[#1A8FE3]'
                  : 'border-white/10 text-zinc-400 hover:text-zinc-100'
              }`}
            >
              {m === 'valor_pago' ? 'Compensação R$' : 'Transgressões'}
            </button>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={360}>
          <LineChart
            data={holdingsChartData}
            margin={{ top: 4, right: 16, bottom: 0, left: 0 }}
          >
            <CartesianGrid stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="mes"
              tick={{ fill: '#71717a', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval={2}
            />
            <YAxis
              tickFormatter={(v) =>
                holdingMetric === 'valor_pago' ? fmtMoney(v) : fmtNum(v)
              }
              tick={{ fill: '#71717a', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={58}
            />
            <Tooltip
              contentStyle={{
                background: 'rgba(17,17,19,0.97)',
                border: `1px solid ${COLORS.green}55`,
                borderRadius: 8,
              }}
              labelStyle={{ color: '#fafafa', fontWeight: 600 }}
              formatter={(v, name) => [
                holdingMetric === 'valor_pago'
                  ? fmtMoney(Number(v ?? 0))
                  : fmtNum(Number(v ?? 0)),
                name,
              ]}
            />
            <Legend wrapperStyle={{ fontSize: 10, color: '#71717a', paddingTop: 12 }} />
            {top8Holdings.map((h, i) => (
              <Line
                key={h.id}
                type="monotone"
                dataKey={h.id}
                name={h.label}
                stroke={DISTRIBUTOR_PALETTE[i % DISTRIBUTOR_PALETTE.length]}
                strokeWidth={1.5}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Rural vs Urbano */}
      {ruralBreakdown && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2 py-0.5 text-xs font-semibold bg-red-500/20 text-red-400 rounded-full">
                RURAL
              </span>
              <span className="text-xs text-zinc-500">
                {ruralBreakdown.ruralShare.toFixed(1)}% do total
              </span>
            </div>
            <p className="text-2xl font-bold text-red-400">
              {fmtMoney(ruralBreakdown.ruralComp)}
            </p>
            <p className="text-xs text-zinc-500 mt-1">em compensações pagas</p>
            <p className="text-sm text-zinc-300 mt-3 font-medium">
              {fmtNum(ruralBreakdown.ruralCount)} transgressões registradas
            </p>
          </div>
          <div className="rounded-xl border border-[#1A8FE3]/30 bg-[#1A8FE3]/5 p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2 py-0.5 text-xs font-semibold bg-[#1A8FE3]/20 text-[#1A8FE3] rounded-full">
                URBANO
              </span>
              <span className="text-xs text-zinc-500">
                {ruralBreakdown.urbanShare.toFixed(1)}% do total
              </span>
            </div>
            <p className="text-2xl font-bold text-[#1A8FE3]">
              {fmtMoney(ruralBreakdown.urbanComp)}
            </p>
            <p className="text-xs text-zinc-500 mt-1">em compensações pagas</p>
            <p className="text-sm text-zinc-300 mt-3 font-medium">
              {fmtNum(ruralBreakdown.urbanCount)} transgressões registradas
            </p>
          </div>
        </div>
      )}

      {/* Insights */}
      {(insights?.inflection_point || (insights?.top_rural_groups?.length ?? 0) > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {insights?.inflection_point && (
            <ChartCard
              title="Pico de Crescimento"
              subtitle="Mês com maior salto de transgressões registrado"
            >
              <div className="flex items-center gap-4 py-2">
                <span className="px-3 py-1.5 text-sm font-bold bg-[#FF6B1A]/20 text-[#FF6B1A] rounded-lg border border-[#FF6B1A]/30 whitespace-nowrap">
                  {insights.inflection_point.mes}
                </span>
                <div>
                  <p className="text-2xl font-bold text-zinc-100">
                    +{fmtNum(insights.inflection_point.salto_transgressoes)}
                  </p>
                  <p className="text-xs text-zinc-500">transgressões no período</p>
                </div>
              </div>
            </ChartCard>
          )}
          {(insights?.top_rural_groups?.length ?? 0) > 0 && (
            <ChartCard
              title="Maior Impacto Rural"
              subtitle="Grupos com maior share de compensação rural"
            >
              <div className="space-y-2 py-1">
                {insights!.top_rural_groups!.slice(0, 5).map((g, i) => (
                  <div key={g.holding} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center rounded-full bg-white/5 text-zinc-400 font-medium text-[10px]">
                        {i + 1}
                      </span>
                      <span className="text-zinc-300 truncate">
                        {groupLabel(g.holding)}
                      </span>
                    </div>
                    <span className="font-semibold text-purple-400 ml-3 flex-shrink-0">
                      {(g.rural_share * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </ChartCard>
          )}
        </div>
      )}
    </div>
  );
}
