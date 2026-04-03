'use client';

import { useDashboardData } from '@/hooks/useDashboardData';
import { KPICard } from '@/components/KPICard';
import { ChartCard, ChartSkeleton, ErrorMessage } from '@/components/ChartCard';
import { fmtPct, fmtMoney, fmtVar } from '@/lib/format';
import { COLORS } from '@/lib/colors';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

export default function HomePage() {
  const { data, isLoading, error } = useDashboardData();

  if (isLoading)
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
        <ChartSkeleton />
      </div>
    );

  if (error)
    return (
      <ErrorMessage message={`Erro ao carregar dados: ${(error as Error).message}`} />
    );

  const kpi = data?.kpi_overview;
  const serie = data?.serie_anual ?? [];

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-xl font-bold text-zinc-100">Visão Geral</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Eficácia da REN 1000/2021 · Distribuidoras brasileiras · 2011–2023
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KPICard
          title="Taxa Média Pré-REN"
          value={fmtPct(kpi?.pre_taxa_media)}
          sub="transgressões / serviços"
          variant="amber"
        />
        <KPICard
          title="Taxa Média Pós-REN"
          value={fmtPct(kpi?.pos_taxa_media)}
          sub="transgressões / serviços"
          variant="green"
        />
        <KPICard
          title="Variação da Taxa"
          value={fmtVar(kpi ? (kpi.delta_taxa / kpi.pre_taxa_media) * 100 : null)}
          sub="redução após REN 1000"
          variant="blue"
        />
        <KPICard
          title="Compensações Pré-REN"
          value={fmtMoney(kpi?.pre_compensacao_total)}
          sub="total acumulado"
          variant="purple"
        />
        <KPICard
          title="Compensações Pós-REN"
          value={fmtMoney(kpi?.pos_compensacao_total)}
          sub="total acumulado"
          variant="red"
        />
        <KPICard
          title="Δ Compensações"
          value={fmtPct(kpi?.delta_compensacao_pct)}
          sub="variação pós vs pré"
          variant="amber"
        />
      </div>

      {/* Série Anual — Taxa */}
      <ChartCard
        title="Taxa de Transgressão Anual"
        subtitle="Serviços fora do prazo / total de serviços"
      >
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={serie} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="ano" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={(v) => fmtPct(v)} tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} width={55} />
            <Tooltip
              contentStyle={{ background: 'rgba(17,17,19,0.97)', border: `1px solid ${COLORS.green}55`, borderRadius: 8 }}
              labelStyle={{ color: '#fafafa', fontWeight: 600 }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(v: any) => [fmtPct(v as number), 'Taxa fora do prazo']}
            />
            <ReferenceLine x={2022} stroke={COLORS.amber} strokeDasharray="4 4" label={{ value: 'REN 1000', fill: COLORS.amber, fontSize: 11, position: 'insideTopRight' }} />
            <Line type="monotone" dataKey="taxa_fora_prazo" stroke={COLORS.blue} strokeWidth={2} dot={{ fill: COLORS.blue, r: 3 }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Compensações */}
      <ChartCard
        title="Compensações Totais por Ano (R$)"
        subtitle="Valores pagos por transgressões"
      >
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={serie} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="ano" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={(v) => fmtMoney(v)} tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} width={70} />
            <Tooltip
              contentStyle={{ background: 'rgba(17,17,19,0.97)', border: `1px solid ${COLORS.green}55`, borderRadius: 8 }}
              labelStyle={{ color: '#fafafa', fontWeight: 600 }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(v: any) => [fmtMoney(v as number), 'Compensações']}
            />
            <ReferenceLine x={2022} stroke={COLORS.amber} strokeDasharray="4 4" />
            <Line type="monotone" dataKey="compensacao_rs" stroke={COLORS.green} strokeWidth={2} dot={{ fill: COLORS.green, r: 3 }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
