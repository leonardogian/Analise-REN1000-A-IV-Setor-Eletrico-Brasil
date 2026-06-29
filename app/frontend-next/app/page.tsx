'use client';

import {
  useDashboardData,
  useHomeServiceTypes,
  useSerieMensalNacional,
  type SerieMensalNacionalItem,
} from '@/hooks/useDashboardData';
import { KPICard } from '@/components/KPICard';
import { ChartCard, ChartSkeleton, ErrorMessage } from '@/components/ChartCard';
import { fmtNum, fmtPct, fmtMoney, fmtVar } from '@/lib/format';
import { COLORS } from '@/lib/colors';
import {
  Bar,
  BarChart,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useEffect, useMemo, useState } from 'react';

type MetricKey =
  | 'taxa_fora_prazo'
  | 'qtd_fora_prazo'
  | 'compensacao_rs'
  | 'compensacao_rs_100k_uc'
  | 'qtd_fora_prazo_100k_uc';

type ScopeMode = 'all' | 'holdings' | 'small' | 'subsidiaries';
type ServiceMetric = 'qtd_fora_prazo' | 'compensacao_rs' | 'qtd_serv_realizado';
type CompositionDimension = 'localidade' | 'classe';

interface YearMetricRow {
  ano: number;
  taxa_fora_prazo: number | null;
  qtd_fora_prazo: number | null;
  compensacao_rs: number | null;
  compensacao_rs_100k_uc: number | null;
  qtd_fora_prazo_100k_uc: number | null;
  annualized: boolean;
  monthsObserved: number;
}

interface YearTotals {
  qtd_fora_prazo: number;
  compensacao_rs: number;
  qtd_serv_realizado: number;
  uc_exposicao_mes: number;
  monthsObserved: number;
}

interface ServiceSplitRow {
  ano: number;
  monthsObserved: number;
  estimated: boolean;
  urbana_qtd_fora_prazo: number;
  rural_qtd_fora_prazo: number;
  nao_classificado_qtd_fora_prazo: number;
  urbana_compensacao_rs: number;
  rural_compensacao_rs: number;
  nao_classificado_compensacao_rs: number;
  urbana_qtd_serv_realizado: number;
  rural_qtd_serv_realizado: number;
  nao_classificado_qtd_serv_realizado: number;
  urbana_uc_media: number;
  rural_uc_media: number;
  nao_classificado_uc_media: number;
  grupo_a_qtd_fora_prazo: number;
  grupo_b_qtd_fora_prazo: number;
  grupo_a_compensacao_rs: number;
  grupo_b_compensacao_rs: number;
  grupo_a_qtd_serv_realizado: number;
  grupo_b_qtd_serv_realizado: number;
  grupo_a_uc_media: number;
  grupo_b_uc_media: number;
}

const POST_REN_START = 2023;
const POST_REN_END = 2025;
const POST_REN_LABEL = `${POST_REN_START}-${POST_REN_END}`;

const METRIC_OPTIONS: Array<{ key: MetricKey; label: string }> = [
  { key: 'taxa_fora_prazo', label: 'Taxa fora do prazo' },
  { key: 'qtd_fora_prazo', label: 'Quantidade de serviços fora do prazo' },
  { key: 'compensacao_rs', label: 'R$ (transgressões totais)' },
  { key: 'compensacao_rs_100k_uc', label: 'R$ / 100k UC' },
  { key: 'qtd_fora_prazo_100k_uc', label: 'Quantidade / 100k UC' },
];

const SCOPE_OPTIONS: Array<{ key: ScopeMode; label: string }> = [
  { key: 'all', label: 'Todas (holdings + pequenas)' },
  { key: 'holdings', label: 'Apenas holdings' },
  { key: 'small', label: 'Apenas pequenas' },
  { key: 'subsidiaries', label: 'Filiais de holdings selecionadas' },
];

const SERVICE_METRIC_OPTIONS: Array<{ key: ServiceMetric; label: string }> = [
  { key: 'qtd_fora_prazo', label: 'Quantidade fora do prazo' },
  { key: 'compensacao_rs', label: 'Compensação (R$)' },
  { key: 'qtd_serv_realizado', label: 'Quantidade de serviços' },
];

function metricFormatter(metric: MetricKey, value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  if (metric === 'taxa_fora_prazo') return fmtPct(value);
  if (metric === 'qtd_fora_prazo' || metric === 'qtd_fora_prazo_100k_uc') return fmtNum(value);
  return fmtMoney(value);
}

function serviceMetricFormatter(metric: ServiceMetric, value: number): string {
  if (metric === 'compensacao_rs') return fmtMoney(value);
  return fmtNum(value);
}

function buildAnnualTotals(rows: readonly SerieMensalNacionalItem[]): Map<number, YearTotals> {
  const byYear = new Map<number, YearTotals>();
  const monthKeysByYear = new Map<number, Set<number>>();

  for (const row of rows) {
    const year = Number(row.ano);
    const month = Number(row.mes);
    if (!Number.isFinite(year) || !Number.isFinite(month)) continue;

    const curr = byYear.get(year) ?? {
      qtd_fora_prazo: 0,
      compensacao_rs: 0,
      qtd_serv_realizado: 0,
      uc_exposicao_mes: 0,
      monthsObserved: 12,
    };

    curr.qtd_fora_prazo += Number(row.qtd_fora_prazo) || 0;
    curr.compensacao_rs += Number(row.compensacao_rs) || 0;
    curr.qtd_serv_realizado += Number(row.qtd_serv_realizado) || 0;
    curr.uc_exposicao_mes += Number(row.uc_ativa_mes) || 0;

    byYear.set(year, curr);

    const monthSet = monthKeysByYear.get(year) ?? new Set<number>();
    monthSet.add(month);
    monthKeysByYear.set(year, monthSet);
  }

  for (const [year, total] of byYear.entries()) {
    const monthsObserved = Math.max(monthKeysByYear.get(year)?.size ?? 0, 1);
    const annualFactor = 12 / monthsObserved;
    total.qtd_fora_prazo *= annualFactor;
    total.compensacao_rs *= annualFactor;
    total.qtd_serv_realizado *= annualFactor;
    total.monthsObserved = monthsObserved;
    byYear.set(year, total);
  }

  return byYear;
}

function summarizeYearTotals(
  totals: Map<number, YearTotals>,
  startYear: number,
  endYear: number
): YearTotals | null {
  let yearsObserved = 0;
  const summary: YearTotals = {
    qtd_fora_prazo: 0,
    compensacao_rs: 0,
    qtd_serv_realizado: 0,
    uc_exposicao_mes: 0,
    monthsObserved: 0,
  };

  for (let year = startYear; year <= endYear; year += 1) {
    const total = totals.get(year);
    if (!total) continue;
    summary.qtd_fora_prazo += total.qtd_fora_prazo;
    summary.compensacao_rs += total.compensacao_rs;
    summary.qtd_serv_realizado += total.qtd_serv_realizado;
    summary.uc_exposicao_mes += total.uc_exposicao_mes;
    summary.monthsObserved += total.monthsObserved;
    yearsObserved += 1;
  }

  return yearsObserved > 0 ? summary : null;
}

export default function HomePage() {
  const { data, isLoading, error } = useDashboardData();
  const { data: serieMensalNacional } = useSerieMensalNacional();
  const {
    data: homeServiceTypes,
    isLoading: serviceTypesLoading,
    error: serviceTypesError,
  } = useHomeServiceTypes();

  const [lineMetric, setLineMetric] = useState<MetricKey>('taxa_fora_prazo');
  const [barMetric, setBarMetric] = useState<MetricKey>('compensacao_rs');
  const [companyScope, setCompanyScope] = useState<ScopeMode>('all');
  const [selectedHoldings, setSelectedHoldings] = useState<string[]>([]);
  const [serviceMetric, setServiceMetric] = useState<ServiceMetric>('qtd_fora_prazo');
  const [compositionDimension, setCompositionDimension] = useState<CompositionDimension>('localidade');

  const distributorsByGroup = useMemo(() => {
    const rows = serieMensalNacional ?? [];
    const byGroup = new Map<string, Set<string>>();
    for (const row of rows) {
      const set = byGroup.get(row.group_id) ?? new Set<string>();
      set.add(row.distributor_id);
      byGroup.set(row.group_id, set);
    }
    return byGroup;
  }, [serieMensalNacional]);

  const holdingOptions = useMemo(() => {
    return [...distributorsByGroup.entries()]
      .filter(([, distributors]) => distributors.size > 1)
      .map(([groupId]) => groupId)
      .sort((a, b) => a.localeCompare(b));
  }, [distributorsByGroup]);

  useEffect(() => {
    if (holdingOptions.length > 0 && selectedHoldings.length === 0) {
      setSelectedHoldings(holdingOptions.slice(0, 3));
    }
  }, [holdingOptions, selectedHoldings.length]);

  const filteredMonthlyRows = useMemo(() => {
    const rows = serieMensalNacional ?? [];
    const selectedSet = new Set(selectedHoldings.length ? selectedHoldings : holdingOptions);

    return rows.filter((row) => {
      const isHolding = (distributorsByGroup.get(row.group_id)?.size ?? 0) > 1;
      if (companyScope === 'all') return true;
      if (companyScope === 'holdings') return isHolding && selectedSet.has(row.group_id);
      if (companyScope === 'small') return !isHolding;
      return isHolding && selectedSet.has(row.group_id);
    });
  }, [companyScope, distributorsByGroup, holdingOptions, selectedHoldings, serieMensalNacional]);

  const yearlyTotals = useMemo(() => buildAnnualTotals(filteredMonthlyRows), [filteredMonthlyRows]);

  const filteredServiceRows = useMemo(() => {
    const rows = homeServiceTypes?.data ?? [];
    const selectedSet = new Set(selectedHoldings.length ? selectedHoldings : holdingOptions);

    return rows.filter((row) => {
      const isHolding = (distributorsByGroup.get(row.group_id)?.size ?? 0) > 1;
      if (companyScope === 'all') return true;
      if (companyScope === 'holdings') return isHolding && selectedSet.has(row.group_id);
      if (companyScope === 'small') return !isHolding;
      return isHolding && selectedSet.has(row.group_id);
    });
  }, [companyScope, distributorsByGroup, holdingOptions, homeServiceTypes?.data, selectedHoldings]);

  const nationalYearlyTotals = useMemo(
    () => buildAnnualTotals(serieMensalNacional ?? []),
    [serieMensalNacional]
  );

  const postRenNationalTotals = useMemo(
    () => summarizeYearTotals(nationalYearlyTotals, POST_REN_START, POST_REN_END),
    [nationalYearlyTotals]
  );

  const comboSeries = useMemo<YearMetricRow[]>(() => {
    const rows: YearMetricRow[] = [];

    const ucProxyCandidates = [...yearlyTotals.values()]
      .map((v) => (v.uc_exposicao_mes > 0 ? v.uc_exposicao_mes / Math.max(v.monthsObserved, 1) : 0))
      .filter((v) => Number.isFinite(v) && v > 0)
      .sort((a, b) => a - b);

    const ucProxy =
      ucProxyCandidates.length > 0
        ? ucProxyCandidates[Math.floor(ucProxyCandidates.length / 2)]
        : 95000000;

    const shouldShowHistorical = companyScope === 'all';

    if (shouldShowHistorical) {
      for (const item of data?.serie_anual ?? []) {
        const isDetailedYear = item.ano >= 2023 && yearlyTotals.has(item.ano);
        if (isDetailedYear) continue;
        rows.push({
          ano: item.ano,
          taxa_fora_prazo: item.taxa_fora_prazo,
          qtd_fora_prazo: item.qtd_fora_prazo,
          compensacao_rs: item.compensacao_rs,
          compensacao_rs_100k_uc: ucProxy > 0 ? (item.compensacao_rs / ucProxy) * 100000 : null,
          qtd_fora_prazo_100k_uc: ucProxy > 0 ? (item.qtd_fora_prazo / ucProxy) * 100000 : null,
          annualized: false,
          monthsObserved: 12,
        });
      }
    }

    for (const [year, total] of yearlyTotals.entries()) {
      const taxa = total.qtd_serv_realizado > 0
        ? total.qtd_fora_prazo / total.qtd_serv_realizado
        : null;
      const qtd100k = total.uc_exposicao_mes > 0
        ? (total.qtd_fora_prazo / total.uc_exposicao_mes) * 100000
        : null;
      const comp100k = total.uc_exposicao_mes > 0
        ? (total.compensacao_rs / total.uc_exposicao_mes) * 100000
        : null;

      rows.push({
        ano: year,
        taxa_fora_prazo: taxa,
        qtd_fora_prazo: total.qtd_fora_prazo,
        compensacao_rs: total.compensacao_rs,
        compensacao_rs_100k_uc: comp100k,
        qtd_fora_prazo_100k_uc: qtd100k,
        annualized: total.monthsObserved < 12,
        monthsObserved: total.monthsObserved,
      });
    }

    return rows.sort((a, b) => a.ano - b.ano);
  }, [companyScope, data?.serie_anual, yearlyTotals]);

  const serviceTypeSeries = useMemo<ServiceSplitRow[]>(() => {
    type ServiceAccumulator = ServiceSplitRow & {
      total_qtd_fora_prazo: number;
      total_compensacao_rs: number;
      total_qtd_serv_realizado: number;
      total_uc_ativa_mes: number;
    };

    const createYear = (year: number): ServiceAccumulator => ({
      ano: year,
      monthsObserved: 0,
      estimated: false,
      urbana_qtd_fora_prazo: 0,
      rural_qtd_fora_prazo: 0,
      nao_classificado_qtd_fora_prazo: 0,
      urbana_compensacao_rs: 0,
      rural_compensacao_rs: 0,
      nao_classificado_compensacao_rs: 0,
      urbana_qtd_serv_realizado: 0,
      rural_qtd_serv_realizado: 0,
      nao_classificado_qtd_serv_realizado: 0,
      urbana_uc_media: 0,
      rural_uc_media: 0,
      nao_classificado_uc_media: 0,
      grupo_a_qtd_fora_prazo: 0,
      grupo_b_qtd_fora_prazo: 0,
      grupo_a_compensacao_rs: 0,
      grupo_b_compensacao_rs: 0,
      grupo_a_qtd_serv_realizado: 0,
      grupo_b_qtd_serv_realizado: 0,
      grupo_a_uc_media: 0,
      grupo_b_uc_media: 0,
      total_qtd_fora_prazo: 0,
      total_compensacao_rs: 0,
      total_qtd_serv_realizado: 0,
      total_uc_ativa_mes: 0,
    });

    const byYear = new Map<number, ServiceAccumulator>();

    for (const row of filteredServiceRows) {
      const year = Number(row.ano);
      if (!Number.isFinite(year)) continue;

      const qtdServ = Number(row.qtd_serv_realizado) || 0;
      const qtdFora = Number(row.qtd_fora_prazo) || 0;
      const comp = Number(row.compensacao_rs) || 0;
      const cls = (row.classe_local_servico || 'nao_classificado').toLowerCase();
      const current = byYear.get(year) ?? createYear(year);

      current.total_qtd_fora_prazo += qtdFora;
      current.total_compensacao_rs += comp;
      current.total_qtd_serv_realizado += qtdServ;
      current.total_uc_ativa_mes += Number(row.uc_ativa_mes) || 0;
      current.monthsObserved = Math.max(current.monthsObserved, Number(row.meses_observados) || 0);

      if (cls === 'urbana') {
        current.urbana_qtd_fora_prazo += qtdFora;
        current.urbana_compensacao_rs += comp;
        current.urbana_qtd_serv_realizado += qtdServ;
      } else if (cls === 'rural') {
        current.rural_qtd_fora_prazo += qtdFora;
        current.rural_compensacao_rs += comp;
        current.rural_qtd_serv_realizado += qtdServ;
      } else if (cls === 'grupo_a') {
        current.grupo_a_qtd_fora_prazo += qtdFora;
        current.grupo_a_compensacao_rs += comp;
        current.grupo_a_qtd_serv_realizado += qtdServ;
      } else {
        current.nao_classificado_qtd_fora_prazo += qtdFora;
        current.nao_classificado_compensacao_rs += comp;
        current.nao_classificado_qtd_serv_realizado += qtdServ;
      }

      byYear.set(year, current);
    }

    const rows = [...byYear.values()].map((row) => {
      const monthsObserved = Math.max(yearlyTotals.get(row.ano)?.monthsObserved ?? row.monthsObserved, 1);
      const factor = 12 / monthsObserved;
      const ucExposure = yearlyTotals.get(row.ano)?.uc_exposicao_mes ?? row.total_uc_ativa_mes;
      const localServiceTotal =
        row.urbana_qtd_serv_realizado +
        row.rural_qtd_serv_realizado +
        row.nao_classificado_qtd_serv_realizado;
      const groupBServ = row.urbana_qtd_serv_realizado + row.rural_qtd_serv_realizado;
      const groupBFora = row.urbana_qtd_fora_prazo + row.rural_qtd_fora_prazo;
      const groupBComp = row.urbana_compensacao_rs + row.rural_compensacao_rs;
      const allocateUc = (part: number, total: number) => (ucExposure > 0 && total > 0 ? (ucExposure * part) / total : 0);

      return {
        ...row,
        monthsObserved,
        urbana_qtd_fora_prazo: row.urbana_qtd_fora_prazo * factor,
        rural_qtd_fora_prazo: row.rural_qtd_fora_prazo * factor,
        nao_classificado_qtd_fora_prazo: row.nao_classificado_qtd_fora_prazo * factor,
        urbana_compensacao_rs: row.urbana_compensacao_rs * factor,
        rural_compensacao_rs: row.rural_compensacao_rs * factor,
        nao_classificado_compensacao_rs: row.nao_classificado_compensacao_rs * factor,
        urbana_qtd_serv_realizado: row.urbana_qtd_serv_realizado * factor,
        rural_qtd_serv_realizado: row.rural_qtd_serv_realizado * factor,
        nao_classificado_qtd_serv_realizado: row.nao_classificado_qtd_serv_realizado * factor,
        urbana_uc_media: allocateUc(row.urbana_qtd_serv_realizado, localServiceTotal),
        rural_uc_media: allocateUc(row.rural_qtd_serv_realizado, localServiceTotal),
        nao_classificado_uc_media: allocateUc(row.nao_classificado_qtd_serv_realizado, localServiceTotal),
        grupo_a_qtd_fora_prazo: row.grupo_a_qtd_fora_prazo * factor,
        grupo_b_qtd_fora_prazo: groupBFora * factor,
        grupo_a_compensacao_rs: row.grupo_a_compensacao_rs * factor,
        grupo_b_compensacao_rs: groupBComp * factor,
        grupo_a_qtd_serv_realizado: row.grupo_a_qtd_serv_realizado * factor,
        grupo_b_qtd_serv_realizado: groupBServ * factor,
        grupo_a_uc_media: allocateUc(row.grupo_a_qtd_serv_realizado, row.total_qtd_serv_realizado),
        grupo_b_uc_media: allocateUc(groupBServ, row.total_qtd_serv_realizado),
      };
    });

    return rows.sort((a, b) => a.ano - b.ano);
  }, [filteredServiceRows, yearlyTotals]);

  // UC data only available for years where uc_ativa_mes > 0 (ANEEL stopped publishing UC for 2025+)
  const ucAvailableSeries = useMemo(
    () => serviceTypeSeries.filter(
      (row) => (row.urbana_uc_media || 0) + (row.rural_uc_media || 0) + (row.grupo_a_uc_media || 0) + (row.grupo_b_uc_media || 0) > 0
    ),
    [serviceTypeSeries],
  );

  const latestServiceRow = serviceTypeSeries.at(-1);
  const compositionQtdData = useMemo(() => {
    if (!latestServiceRow) return [] as Array<{ name: string; value: number; color: string }>;
    if (compositionDimension === 'localidade') {
      return [
        { name: 'Urbana', value: latestServiceRow.urbana_qtd_fora_prazo, color: COLORS.blue },
        { name: 'Rural', value: latestServiceRow.rural_qtd_fora_prazo, color: COLORS.amber },
        { name: 'Grupo A', value: latestServiceRow.grupo_a_qtd_fora_prazo, color: COLORS.green },
      ];
    }
    return [
      { name: 'Grupo A', value: latestServiceRow.grupo_a_qtd_fora_prazo, color: COLORS.green },
      { name: 'Grupo B', value: latestServiceRow.grupo_b_qtd_fora_prazo, color: COLORS.red },
    ];
  }, [compositionDimension, latestServiceRow]);

  const compositionCompData = useMemo(() => {
    if (!latestServiceRow) return [] as Array<{ name: string; value: number; color: string }>;
    if (compositionDimension === 'localidade') {
      return [
        { name: 'Urbana', value: latestServiceRow.urbana_compensacao_rs, color: COLORS.blue },
        { name: 'Rural', value: latestServiceRow.rural_compensacao_rs, color: COLORS.amber },
        { name: 'Grupo A', value: latestServiceRow.grupo_a_compensacao_rs, color: COLORS.green },
      ];
    }
    return [
      { name: 'Grupo A', value: latestServiceRow.grupo_a_compensacao_rs, color: COLORS.green },
      { name: 'Grupo B', value: latestServiceRow.grupo_b_compensacao_rs, color: COLORS.red },
    ];
  }, [compositionDimension, latestServiceRow]);

  const serviceTypeUnavailable = serviceTypesLoading || !!serviceTypesError || serviceTypeSeries.length === 0;
  const renderServiceTypeFallback = () => {
    if (serviceTypesLoading) return <ChartSkeleton />;
    if (serviceTypesError) {
      return <ErrorMessage message={`Erro ao carregar tipos de serviço: ${(serviceTypesError as Error).message}`} />;
    }
    return (
      <div className="h-[300px] flex items-center justify-center rounded-lg border border-white/5 bg-white/[0.02]">
        <p className="text-sm text-zinc-500">
          Sem dados de classe/localidade para o filtro selecionado.
        </p>
      </div>
    );
  };

  if (isLoading) {
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
  }

  if (error) return <ErrorMessage message={`Erro ao carregar dados: ${(error as Error).message}`} />;

  const kpi = data?.kpi_overview;
  const total2023 = yearlyTotals.get(2023);
  const total2024 = yearlyTotals.get(2024);
  const total2025 = yearlyTotals.get(2025);
  const total2026 = yearlyTotals.get(2026);
  const anosPreLabel = kpi?.anos_pre?.length
    ? `${Math.min(...kpi.anos_pre)}-${Math.max(...kpi.anos_pre)}`
    : '2011-2021';
  const anosPosLabel = POST_REN_LABEL;
  const postRenTaxaMedia = postRenNationalTotals && postRenNationalTotals.qtd_serv_realizado > 0
    ? postRenNationalTotals.qtd_fora_prazo / postRenNationalTotals.qtd_serv_realizado
    : null;
  const deltaTaxaPct = kpi && kpi.pre_taxa_media > 0 && postRenTaxaMedia != null
    ? ((postRenTaxaMedia - kpi.pre_taxa_media) / kpi.pre_taxa_media) * 100
    : null;

  const deltaCompPct = (() => {
    if (!kpi || !postRenNationalTotals) return null;
    if (kpi.pre_compensacao_total > 0) {
      return ((postRenNationalTotals.compensacao_rs - kpi.pre_compensacao_total) / kpi.pre_compensacao_total) * 100;
    }
    return null;
  })();

  const localidadeKeyPrefix = serviceMetric === 'compensacao_rs'
    ? 'compensacao_rs'
    : serviceMetric === 'qtd_serv_realizado'
      ? 'qtd_serv_realizado'
      : 'qtd_fora_prazo';

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-xl font-bold text-zinc-100">Visão Geral</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Eficácia da REN 1000/2021 · KPI histórico {anosPreLabel} vs operacional {anosPosLabel}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KPICard
          title="Taxa Média Pré-REN"
          value={fmtPct(kpi?.pre_taxa_media)}
          sub={`taxa ponderada ${anosPreLabel}`}
          variant="amber"
        />
        <KPICard
          title="Taxa Média Pós-REN"
          value={fmtPct(postRenTaxaMedia)}
          sub={`taxa ponderada operacional ${anosPosLabel}`}
          variant="green"
        />
        <KPICard
          title="Variação da Taxa"
          value={fmtVar(deltaTaxaPct)}
          sub={`variação ${anosPosLabel} vs pré`}
          variant="blue"
        />
        <KPICard
          title="Compensações Pré-REN"
          value={fmtMoney(kpi?.pre_compensacao_total)}
          sub={`total acumulado ${anosPreLabel}`}
          variant="purple"
        />
        <KPICard
          title="Compensações Pós-REN"
          value={fmtMoney(postRenNationalTotals?.compensacao_rs ?? null)}
          sub={`total anualizado ${anosPosLabel}`}
          variant="red"
        />
        <KPICard
          title="Δ Compensações"
          value={fmtVar(deltaCompPct)}
          sub={`${anosPosLabel} vs total pré`}
          variant="amber"
        />
      </div>

      <ChartCard
        title="Filtros de Empresas"
        subtitle="Os filtros abaixo impactam os gráficos desta página e os cartões 2023–2025"
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {SCOPE_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setCompanyScope(opt.key)}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                  companyScope === opt.key
                    ? 'bg-[#00C65A]/10 border-[#00C65A]/40 text-[#00C65A]'
                    : 'border-white/10 text-zinc-400 hover:text-zinc-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {(companyScope === 'holdings' || companyScope === 'subsidiaries') && (
            <div className="flex flex-wrap gap-2">
              {holdingOptions.map((h) => {
                const selected = selectedHoldings.includes(h);
                return (
                  <button
                    key={h}
                    onClick={() => {
                      setSelectedHoldings((prev) => {
                        if (prev.includes(h)) return prev.filter((v) => v !== h);
                        return [...prev, h];
                      });
                    }}
                    className={`px-2.5 py-1 text-[11px] rounded-md border ${
                      selected
                        ? 'bg-[#1A8FE3]/10 border-[#1A8FE3]/40 text-[#1A8FE3]'
                        : 'border-white/10 text-zinc-400'
                    }`}
                  >
                    {h.toUpperCase()}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </ChartCard>

      <ChartCard
        title="Série Anual Combinada"
        subtitle="Linha + colunas com eixos Y independentes; taxa ponderada por serviços no Brasil"
      >
        <div className="flex flex-col md:flex-row gap-3 md:items-end mb-4">
          <label className="text-xs text-zinc-400 uppercase tracking-wide">
            Eixo primário (linha)
            <select
              value={lineMetric}
              onChange={(e) => setLineMetric(e.target.value as MetricKey)}
              className="mt-1 w-full md:w-80 bg-[#111114] border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200"
            >
              {METRIC_OPTIONS.map((m) => (
                <option key={`line-${m.key}`} value={m.key}>{m.label}</option>
              ))}
            </select>
          </label>

          <label className="text-xs text-zinc-400 uppercase tracking-wide">
            Eixo secundário (colunas)
            <select
              value={barMetric}
              onChange={(e) => setBarMetric(e.target.value as MetricKey)}
              className="mt-1 w-full md:w-80 bg-[#111114] border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200"
            >
              {METRIC_OPTIONS.map((m) => (
                <option key={`bar-${m.key}`} value={m.key}>{m.label}</option>
              ))}
            </select>
          </label>
        </div>

        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart data={comboSeries} margin={{ top: 4, right: 18, bottom: 0, left: 4 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="ano" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis
              yAxisId="left"
              tickFormatter={(v) => metricFormatter(lineMetric, Number(v))}
              tick={{ fill: '#71717a', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={78}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tickFormatter={(v) => metricFormatter(barMetric, Number(v))}
              tick={{ fill: '#71717a', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={78}
            />
            <Tooltip
              contentStyle={{
                background: 'rgba(17,17,19,0.97)',
                border: `1px solid ${COLORS.green}55`,
                borderRadius: 8,
              }}
              labelStyle={{ color: '#fafafa', fontWeight: 600 }}
              formatter={(value, name) => {
                const metric = name as MetricKey;
                const label = METRIC_OPTIONS.find((opt) => opt.key === metric)?.label ?? name;
                return [metricFormatter(metric, Number(value ?? 0)), label];
              }}
              labelFormatter={(label, payload) => {
                const row = payload?.[0]?.payload as YearMetricRow | undefined;
                if (row?.annualized) return `${label} (anualizado; ${row.monthsObserved} meses)`;
                return String(label);
              }}
            />

            <ReferenceLine
              x={2022}
              stroke={COLORS.amber}
              strokeDasharray="4 4"
              label={{ value: 'REN 1000', fill: COLORS.amber, fontSize: 11, position: 'insideTopRight' }}
            />

            <Bar
              yAxisId="right"
              dataKey={barMetric}
              name={barMetric}
              fill={COLORS.green}
              fillOpacity={0.45}
              radius={[6, 6, 0, 0]}
            />

            <Line
              yAxisId="left"
              type="monotone"
              dataKey={lineMetric}
              name={lineMetric}
              stroke={COLORS.blue}
              strokeWidth={2}
              dot={{ fill: COLORS.blue, r: 3 }}
              activeDot={{ r: 5 }}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>

        <p className="text-xs text-zinc-500 mt-3">
          Para escopos filtrados por empresa, a série detalhada começa em 2023. A taxa fora do prazo é sempre ponderada por volume: soma fora do prazo / soma de serviços.
        </p>
      </ChartCard>

      <div>
        <h2 className="text-lg font-semibold text-zinc-100">Totais por Ano (Escopo Selecionado)</h2>
        <p className="text-sm text-zinc-500 mt-0.5">
          Valores e quantidades recalculados conforme os filtros; anos parciais aparecem anualizados.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPICard
          title="Compensação 2023"
          value={fmtMoney(total2023?.compensacao_rs ?? null)}
          sub="escopo selecionado"
          variant="blue"
        />
        <KPICard
          title="Compensação 2024"
          value={fmtMoney(total2024?.compensacao_rs ?? null)}
          sub="escopo selecionado"
          variant="purple"
        />
        <KPICard
          title="Compensação 2025"
          value={fmtMoney(total2025?.compensacao_rs ?? null)}
          sub="escopo selecionado"
          variant="green"
        />
        <KPICard
          title="Fora do Prazo 2025"
          value={fmtNum(total2025?.qtd_fora_prazo ?? null)}
          sub="quantidade anual"
          variant="amber"
        />
        <KPICard
          title="Compensação 2026"
          value={fmtMoney(total2026?.compensacao_rs ?? null)}
          sub={total2026 ? (total2026.monthsObserved < 12 ? `anualizado (${total2026.monthsObserved} meses)` : 'escopo selecionado') : 'sem dados'}
          variant="red"
        />
        <KPICard
          title="Fora do Prazo 2026"
          value={fmtNum(total2026?.qtd_fora_prazo ?? null)}
          sub={total2026 ? (total2026.monthsObserved < 12 ? `anualizado (${total2026.monthsObserved} meses)` : 'escopo selecionado') : 'sem dados'}
          variant="amber"
        />
      </div>

      <ChartCard
        title="Tipo de Serviço por Ano · Classe/localidade ANEEL"
        subtitle="Comparação anual por categorias classificadas; registros 'Não classificado' ficam fora da visualização"
      >
        <div className="flex flex-wrap gap-2 mb-3">
          {SERVICE_METRIC_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setServiceMetric(opt.key)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                serviceMetric === opt.key
                  ? 'bg-[#00C65A]/10 border-[#00C65A]/40 text-[#00C65A]'
                  : 'border-white/10 text-zinc-400 hover:text-zinc-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {serviceTypeUnavailable ? renderServiceTypeFallback() : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={serviceTypeSeries} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="ano" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                tickFormatter={(v) => serviceMetricFormatter(serviceMetric, Number(v))}
                tick={{ fill: '#71717a', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={78}
              />
              <Tooltip
                contentStyle={{ background: 'rgba(17,17,19,0.97)', border: `1px solid ${COLORS.green}55`, borderRadius: 8 }}
                labelStyle={{ color: '#fafafa', fontWeight: 600 }}
                formatter={(v, name) => [serviceMetricFormatter(serviceMetric, Number(v ?? 0)), name]}
              />
              <Legend />
              <Bar dataKey={`urbana_${localidadeKeyPrefix}`} stackId="local" name="Urbana" fill={COLORS.blue} />
              <Bar dataKey={`rural_${localidadeKeyPrefix}`} stackId="local" name="Rural" fill={COLORS.amber} />
              <Bar dataKey={`grupo_a_${localidadeKeyPrefix}`} stackId="local" name="Grupo A" fill={COLORS.green} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard
        title="Tipo de Serviço por Ano · Grupo A x Grupo B"
        subtitle="Grupo A = alta tensão; Grupo B = baixa tensão classificada (Urbana + Rural). 'Não classificado' não entra no gráfico."
      >
        {serviceTypeUnavailable ? renderServiceTypeFallback() : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={serviceTypeSeries} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="ano" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                tickFormatter={(v) => serviceMetricFormatter(serviceMetric, Number(v))}
                tick={{ fill: '#71717a', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={78}
              />
              <Tooltip
                contentStyle={{ background: 'rgba(17,17,19,0.97)', border: `1px solid ${COLORS.green}55`, borderRadius: 8 }}
                labelStyle={{ color: '#fafafa', fontWeight: 600 }}
                formatter={(v, name) => {
                  const label = name === 'Grupo A' ? 'Grupo A (alta tensão)' : name === 'Grupo B' ? 'Grupo B (baixa tensão)' : name;
                  return [serviceMetricFormatter(serviceMetric, Number(v ?? 0)), label];
                }}
              />
              <Legend formatter={(v) => (v === 'Grupo A' ? 'Grupo A (alta tensão)' : v === 'Grupo B' ? 'Grupo B (baixa tensão)' : v)} />
              <Bar dataKey={`grupo_a_${localidadeKeyPrefix}`} stackId="classe" name="Grupo A" fill={COLORS.green} />
              <Bar dataKey={`grupo_b_${localidadeKeyPrefix}`} stackId="classe" name="Grupo B" fill={COLORS.red} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard
        title="UC Média Anual por Tipo"
        subtitle="Quantidade de UCs por tipo — apenas anos com dados publicados pela ANEEL e categorias classificadas"
      >
        {serviceTypeUnavailable ? renderServiceTypeFallback() : ucAvailableSeries.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center rounded-lg border border-white/5 bg-white/[0.02]">
            <p className="text-sm text-zinc-500">
              Sem dados de UC disponíveis para o filtro selecionado.
            </p>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={ucAvailableSeries} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="ano" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  tickFormatter={(v) => fmtNum(Number(v))}
                  tick={{ fill: '#71717a', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={78}
                />
                <Tooltip
                  contentStyle={{ background: 'rgba(17,17,19,0.97)', border: `1px solid ${COLORS.green}55`, borderRadius: 8 }}
                  labelStyle={{ color: '#fafafa', fontWeight: 600 }}
                  formatter={(v, name) => [fmtNum(Number(v ?? 0)), name]}
                />
                <Legend />
                <Line type="monotone" dataKey="urbana_uc_media" name="UC Urbana (baixa tensão)" stroke={COLORS.blue} strokeWidth={2} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="rural_uc_media" name="UC Rural (baixa tensão)" stroke={COLORS.amber} strokeWidth={2} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="grupo_a_uc_media" name="UC Grupo A (alta tensão)" stroke={COLORS.green} strokeWidth={2} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="grupo_b_uc_media" name="UC Grupo B (baixa tensão)" stroke={COLORS.red} strokeWidth={2} dot={{ r: 2 }} />
              </ComposedChart>
            </ResponsiveContainer>
            <p className="text-xs text-zinc-500 mt-3">
              A ANEEL não publicou dados de UCs ativas para 2025-2026. Este gráfico mostra apenas {ucAvailableSeries.length > 0 ? `${ucAvailableSeries[0].ano}-${ucAvailableSeries.at(-1)?.ano}` : 'anos com dados'}.
              Grupo A = tarifa de alta tensão; Grupo B = baixa tensão classificada (Urbana + Rural). Registros sem classe/localidade ficam fora deste gráfico.
            </p>
          </>
        )}
      </ChartCard>

      <ChartCard
        title="Composição Percentual no Ano Mais Recente"
        subtitle="Comparação lado a lado entre quantidade fora do prazo e compensação (R$)"
      >
        <div className="flex flex-wrap gap-2 mb-3">
          <button
            onClick={() => setCompositionDimension('localidade')}
            className={`px-3 py-1.5 text-xs rounded-lg border ${
              compositionDimension === 'localidade'
                ? 'bg-[#1A8FE3]/10 border-[#1A8FE3]/40 text-[#1A8FE3]'
                : 'border-white/10 text-zinc-400'
            }`}
          >
            Classe/localidade
          </button>
          <button
            onClick={() => setCompositionDimension('classe')}
            className={`px-3 py-1.5 text-xs rounded-lg border ${
              compositionDimension === 'classe'
                ? 'bg-[#00C65A]/10 border-[#00C65A]/40 text-[#00C65A]'
                : 'border-white/10 text-zinc-400'
            }`}
          >
            Grupo A x Grupo B
          </button>
          <span className="text-[11px] text-zinc-500 self-center ml-1">
            Grupo A = alta tensão; Grupo B = baixa tensão; não classificados ocultos
          </span>
        </div>

        {serviceTypeUnavailable ? renderServiceTypeFallback() : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-white/10 p-3">
              <p className="text-xs text-zinc-400 mb-2">Quantidade fora do prazo</p>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={compositionQtdData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={78}
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(1)}%`}
                  >
                    {compositionQtdData.map((entry) => (
                      <Cell key={`qtd-${entry.name}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => fmtNum(Number(v ?? 0))} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-xl border border-white/10 p-3">
              <p className="text-xs text-zinc-400 mb-2">Compensação (R$)</p>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={compositionCompData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={78}
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(1)}%`}
                  >
                    {compositionCompData.map((entry) => (
                      <Cell key={`comp-${entry.name}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => fmtMoney(Number(v ?? 0))} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </ChartCard>

      <ChartCard
        title="Tendência Comparada por Tipo"
        subtitle="Linhas para quantidade fora do prazo (eixo esquerdo) e compensação em R$ (eixo direito)"
      >
        {serviceTypeUnavailable ? renderServiceTypeFallback() : (
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={serviceTypeSeries} margin={{ top: 4, right: 18, bottom: 0, left: 4 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="ano" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                yAxisId="left"
                tickFormatter={(v) => fmtNum(Number(v))}
                tick={{ fill: '#71717a', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={78}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tickFormatter={(v) => fmtMoney(Number(v))}
                tick={{ fill: '#71717a', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={88}
              />
              <Tooltip
                contentStyle={{ background: 'rgba(17,17,19,0.97)', border: `1px solid ${COLORS.green}55`, borderRadius: 8 }}
                labelStyle={{ color: '#fafafa', fontWeight: 600 }}
                formatter={(value, name) => {
                  const numericValue = Number(value ?? 0);
                  if (String(name).includes('R$')) return [fmtMoney(numericValue), name];
                  return [fmtNum(numericValue), name];
                }}
              />
              <Legend />

              {compositionDimension === 'localidade' ? (
                <>
                  <Line type="monotone" yAxisId="left" dataKey="urbana_qtd_fora_prazo" name="Urbana · Fora do prazo" stroke={COLORS.blue} strokeWidth={2} dot={{ r: 2 }} />
                  <Line type="monotone" yAxisId="left" dataKey="rural_qtd_fora_prazo" name="Rural · Fora do prazo" stroke={COLORS.amber} strokeWidth={2} dot={{ r: 2 }} />
                  <Line type="monotone" yAxisId="left" dataKey="grupo_a_qtd_fora_prazo" name="Grupo A · Fora do prazo" stroke={COLORS.green} strokeWidth={2} dot={{ r: 2 }} />
                  <Line type="monotone" yAxisId="right" dataKey="urbana_compensacao_rs" name="Urbana · R$" stroke={COLORS.blue} strokeOpacity={0.6} strokeWidth={2} strokeDasharray="5 3" dot={false} />
                  <Line type="monotone" yAxisId="right" dataKey="rural_compensacao_rs" name="Rural · R$" stroke={COLORS.amber} strokeOpacity={0.6} strokeWidth={2} strokeDasharray="5 3" dot={false} />
                  <Line type="monotone" yAxisId="right" dataKey="grupo_a_compensacao_rs" name="Grupo A · R$" stroke={COLORS.green} strokeOpacity={0.6} strokeWidth={2} strokeDasharray="5 3" dot={false} />
                </>
              ) : (
                <>
                  <Line type="monotone" yAxisId="left" dataKey="grupo_a_qtd_fora_prazo" name="Grupo A · Fora do prazo" stroke={COLORS.green} strokeWidth={2} dot={{ r: 2 }} />
                  <Line type="monotone" yAxisId="left" dataKey="grupo_b_qtd_fora_prazo" name="Grupo B · Fora do prazo" stroke={COLORS.red} strokeWidth={2} dot={{ r: 2 }} />
                  <Line type="monotone" yAxisId="right" dataKey="grupo_a_compensacao_rs" name="Grupo A · R$" stroke={COLORS.green} strokeOpacity={0.6} strokeWidth={2} strokeDasharray="5 3" dot={false} />
                  <Line type="monotone" yAxisId="right" dataKey="grupo_b_compensacao_rs" name="Grupo B · R$" stroke={COLORS.red} strokeOpacity={0.6} strokeWidth={2} strokeDasharray="5 3" dot={false} />
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}
