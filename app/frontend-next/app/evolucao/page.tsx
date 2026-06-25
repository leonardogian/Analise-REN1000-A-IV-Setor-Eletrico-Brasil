'use client';

import { useTimeseries, type TimeseriesPoint } from '@/hooks/useDashboardData';
import { ChartCard, ChartSkeleton, ErrorMessage } from '@/components/ChartCard';
import { fmtMoney, fmtNum, fmtPct } from '@/lib/format';
import { useMemo, useState } from 'react';

type EvolutionMetric =
  | 'qtd_fora_prazo'
  | 'compensacao_rs'
  | 'taxa_fora_prazo'
  | 'fora_prazo_por_100k_uc_mes'
  | 'compensacao_rs_por_uc_mes';
type PeriodWindow = 12 | 24 | 36;
type GroupScope = 'holdings' | 'subgroups';

const METRICS: Record<
  EvolutionMetric,
  {
    label: string;
    shortLabel: string;
    subtitle: string;
    legend: string;
    format: (value: number) => string;
    cellFormat: (value: number) => string;
  }
> = {
  qtd_fora_prazo: {
    label: 'Quantidade fora do prazo',
    shortLabel: 'Qtd. fora do prazo',
    subtitle: 'Quantidade mensal de serviços com prazo regulatório transgredido, conforme o ETL trouxe para cada mês.',
    legend: 'Azul mais escuro = maior quantidade de transgressões no mês',
    format: (value) => fmtNum(value, 0),
    cellFormat: (value) => fmtNum(value, 0),
  },
  compensacao_rs: {
    label: 'Compensação paga (R$)',
    shortLabel: 'Valor compensado',
    subtitle: 'Valor mensal de compensações financeiras pagas na fatura dos consumidores.',
    legend: 'Azul mais escuro = maior valor de compensação no mês',
    format: (value) => fmtMoney(value),
    cellFormat: (value) => value >= 1_000_000 ? `${fmtMoney(value / 1_000_000)} mi` : fmtMoney(value),
  },
  taxa_fora_prazo: {
    label: 'Taxa fora do prazo (%)',
    shortLabel: 'Taxa fora do prazo',
    subtitle: 'Percentual mensal de serviços fora do prazo sobre o total de serviços realizados.',
    legend: 'Azul mais escuro = maior taxa mensal de transgressão',
    format: (value) => fmtPct(value),
    cellFormat: (value) => fmtPct(value),
  },
  fora_prazo_por_100k_uc_mes: {
    label: 'Fora do prazo / 100k UC',
    shortLabel: 'Quantidade normalizada',
    subtitle: 'Quantidade mensal de transgressões fora do prazo normalizada por 100 mil UCs ativas.',
    legend: 'Azul mais escuro = mais transgressões fora do prazo / 100k UC',
    format: (value) => fmtNum(value, 1),
    cellFormat: (value) => fmtNum(value, value >= 100 ? 0 : 1),
  },
  compensacao_rs_por_uc_mes: {
    label: 'Compensação R$/UC-mês',
    shortLabel: 'Valor normalizado',
    subtitle: 'Valor mensal pago em compensações, normalizado por UC ativa no mês.',
    legend: 'Azul mais escuro = maior valor de compensação por UC-mês',
    format: (value) => fmtMoney(value),
    cellFormat: (value) => value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  },
};

function monthLabel(date: string) {
  const [year, month] = date.split('-');
  return { month, year: year?.slice(2) ?? '' };
}

function fullMonthLabel(date: string) {
  const [year, month] = date.split('-');
  return `${month}/${year}`;
}

function isHoldingLabel(grupo: string) {
  return grupo.startsWith('Grupo ');
}

function displayGroupLabel(grupo: string) {
  return grupo.split(' — ')[0] || grupo;
}

function getMetricValue(point: TimeseriesPoint | undefined, metric: EvolutionMetric) {
  const value = point?.[metric];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

// Heatmap simples: grupos × meses, sem dependência extra
export default function EvolucaoPage() {
  const { data, isLoading, error } = useTimeseries();
  const [metric, setMetric] = useState<EvolutionMetric>('qtd_fora_prazo');
  const [periodWindow, setPeriodWindow] = useState<PeriodWindow>(24);
  const [groupScope, setGroupScope] = useState<GroupScope>('holdings');

  const metricCfg = METRICS[metric];

  const { grupos, meses, matrix, minVal, maxVal, totalGroups, validMonthCount } = useMemo(() => {
    if (!data?.data?.length) {
      return {
        grupos: [],
        meses: [],
        matrix: [],
        minVal: 0,
        maxVal: 0,
        totalGroups: 0,
        validMonthCount: 0,
      };
    }

    const points = data.data
      .filter((p) => p.tipo !== 'nacional')
      .filter((p) => (groupScope === 'holdings' ? isHoldingLabel(p.grupo) : !isHoldingLabel(p.grupo)));

    const validDates = [
      ...new Set(
        points
          .filter((p) => getMetricValue(p, metric) !== null)
          .map((p) => p.date)
      ),
    ].sort();
    const meses = validDates.slice(-Math.min(periodWindow, validDates.length));
    const monthSet = new Set(meses);
    const pointsInWindow = points.filter(
      (p) => monthSet.has(p.date) && getMetricValue(p, metric) !== null
    );

    const groupScores = new Map<string, { total: number; count: number }>();
    for (const point of pointsInWindow) {
      const value = getMetricValue(point, metric);
      if (value === null) continue;
      const current = groupScores.get(point.grupo) ?? { total: 0, count: 0 };
      current.total += value;
      current.count += 1;
      groupScores.set(point.grupo, current);
    }

    const grupos = [...groupScores.entries()]
      .sort((a, b) => b[1].total / b[1].count - a[1].total / a[1].count)
      .slice(0, 12)
      .map(([grupo]) => grupo);

    // matriz[grupo][mes] = valor
    const matrix: (number | null)[][] = grupos.map((g) =>
      meses.map((m) => {
        const p = points.find((pt) => pt.grupo === g && pt.date === m);
        return getMetricValue(p, metric);
      })
    );

    const values = matrix.flat().filter((v): v is number => v != null && Number.isFinite(v));

    return {
      grupos,
      meses,
      matrix,
      minVal: values.length ? Math.min(...values) : 0,
      maxVal: values.length ? Math.max(...values) : 0,
      totalGroups: groupScores.size,
      validMonthCount: validDates.length,
    };
  }, [data, groupScope, metric, periodWindow]);

  if (isLoading) return <ChartSkeleton />;
  if (error) return <ErrorMessage message={(error as Error).message} />;

  const range = maxVal - minVal;
  const startLabel = meses[0] ? fullMonthLabel(meses[0]) : '—';
  const endLabel = meses.at(-1) ? fullMonthLabel(meses.at(-1)!) : '—';

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-xl font-bold text-zinc-100">Evolução</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Heatmap mensal por {groupScope === 'holdings' ? 'holding' : 'subgrupo'} · {startLabel} a {endLabel}
        </p>
      </div>

      <div className="grid gap-3 rounded-xl border border-white/5 bg-[#18181b] p-4 md:grid-cols-3">
        <label className="space-y-1.5 text-xs text-zinc-500">
          <span className="block uppercase tracking-wide text-zinc-600">Indicador</span>
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as EvolutionMetric)}
            className="w-full px-3 py-2 rounded-lg border border-white/10 bg-[#111114] text-sm text-zinc-100"
          >
            {(Object.entries(METRICS) as [EvolutionMetric, typeof metricCfg][]).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5 text-xs text-zinc-500">
          <span className="block uppercase tracking-wide text-zinc-600">Grupos</span>
          <select
            value={groupScope}
            onChange={(e) => setGroupScope(e.target.value as GroupScope)}
            className="w-full px-3 py-2 rounded-lg border border-white/10 bg-[#111114] text-sm text-zinc-100"
          >
            <option value="holdings">Holdings</option>
            <option value="subgroups">Subgrupos / distribuidoras</option>
          </select>
        </label>

        <label className="space-y-1.5 text-xs text-zinc-500">
          <span className="block uppercase tracking-wide text-zinc-600">Janela</span>
          <select
            value={periodWindow}
            onChange={(e) => setPeriodWindow(Number(e.target.value) as PeriodWindow)}
            className="w-full px-3 py-2 rounded-lg border border-white/10 bg-[#111114] text-sm text-zinc-100"
          >
            <option value={12}>Últimos 12 meses com dado</option>
            <option value={24}>Últimos 24 meses com dado</option>
            <option value={36}>Últimos 36 meses com dado</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl border border-white/5 bg-[#18181b] p-3">
          <p className="text-[11px] uppercase tracking-wide text-zinc-600">Indicador</p>
          <p className="text-sm font-semibold text-zinc-100 mt-1">{metricCfg.label}</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-[#18181b] p-3">
          <p className="text-[11px] uppercase tracking-wide text-zinc-600">Período</p>
          <p className="text-sm font-semibold text-zinc-100 mt-1">{startLabel} – {endLabel}</p>
          <p className="text-[11px] text-zinc-600 mt-1">
            {meses.length} de {validMonthCount} meses disponíveis para este indicador
          </p>
        </div>
        <div className="rounded-xl border border-white/5 bg-[#18181b] p-3">
          <p className="text-[11px] uppercase tracking-wide text-zinc-600">Grupos exibidos</p>
          <p className="text-sm font-semibold text-zinc-100 mt-1">Top {grupos.length} de {totalGroups}</p>
          <p className="text-[11px] text-zinc-600 mt-1">
            {groupScope === 'holdings' ? 'Holdings consolidadas' : 'Subgrupos / distribuidoras'}
          </p>
        </div>
      </div>

      <ChartCard title="Sazonalidade por grupo" subtitle={metricCfg.subtitle}>
        {grupos.length === 0 || meses.length === 0 ? (
          <p className="text-sm text-zinc-500">Sem dados mensais disponíveis para o indicador selecionado.</p>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-xs border-separate border-spacing-[2px]">
            <thead>
              <tr>
                <th className="text-left text-zinc-500 font-normal pr-3 pb-2 min-w-[220px]">
                  Grupo
                </th>
                {meses.map((m) => {
                  const label = monthLabel(m);
                  return (
                  <th
                    key={m}
                    className="text-zinc-500 font-normal pb-2 min-w-[44px] text-center"
                  >
                    <span className="block text-zinc-400">{label.month}</span>
                    <span className="block text-[10px] text-zinc-700">{label.year}</span>
                  </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {grupos.map((grupo, gi) => (
                <tr key={grupo}>
                  <td className="max-w-[220px] truncate text-zinc-400 pr-3 py-1 whitespace-nowrap" title={grupo}>
                    {displayGroupLabel(grupo)}
                  </td>
                  {matrix[gi].map((val, mi) => {
                    const intensity = val != null && range > 0 ? (val - minVal) / range : val != null ? 0.5 : 0;
                    const bg = val != null
                      ? `rgba(26,143,227,${0.16 + intensity * 0.72})`
                      : 'rgba(255,255,255,0.025)';
                    return (
                      <td
                        key={mi}
                        title={val != null ? `${grupo} · ${fullMonthLabel(meses[mi])} · ${metricCfg.label}: ${metricCfg.format(val)}` : `${grupo} · ${fullMonthLabel(meses[mi])}: sem dado`}
                        style={{ background: bg }}
                        className="text-center rounded px-1 py-1 text-[10px] font-medium text-zinc-100/90"
                      >
                        {val != null ? metricCfg.cellFormat(val) : '—'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-600">
          <p>{metricCfg.legend}</p>
          <p>Menor: {metricCfg.format(minVal)} · Maior: {metricCfg.format(maxVal)}</p>
        </div>
      </ChartCard>
    </div>
  );
}
