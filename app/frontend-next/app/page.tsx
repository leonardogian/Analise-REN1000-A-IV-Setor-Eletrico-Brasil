'use client';

import {
  useDashboardData,
  useGroupViews,
  useSerieMensalNacional,
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
  urbana_compensacao_rs: number;
  rural_compensacao_rs: number;
  urbana_qtd_serv_realizado: number;
  rural_qtd_serv_realizado: number;
  urbana_uc_media: number;
  rural_uc_media: number;
  grupo_a_qtd_fora_prazo: number;
  grupo_b_qtd_fora_prazo: number;
  grupo_a_compensacao_rs: number;
  grupo_b_compensacao_rs: number;
  grupo_a_qtd_serv_realizado: number;
  grupo_b_qtd_serv_realizado: number;
  grupo_a_uc_media: number;
  grupo_b_uc_media: number;
}

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

export default function HomePage() {
  const { data, isLoading, error } = useDashboardData();
  const { data: serieMensalNacional } = useSerieMensalNacional();
  const { data: groupViews } = useGroupViews();

  const [lineMetric, setLineMetric] = useState<MetricKey>('taxa_fora_prazo');
  const [barMetric, setBarMetric] = useState<MetricKey>('compensacao_rs');
  const [companyScope, setCompanyScope] = useState<ScopeMode>('all');
  const [selectedHoldings, setSelectedHoldings] = useState<string[]>([]);
  const [serviceMetric, setServiceMetric] = useState<ServiceMetric>('qtd_fora_prazo');
  const [compositionDimension, setCompositionDimension] = useState<CompositionDimension>('localidade');

  const holdingOptions = useMemo(() => {
    const rows = serieMensalNacional ?? [];
    const byGroup = new Map<string, Set<string>>();
    for (const row of rows) {
      const set = byGroup.get(row.group_id) ?? new Set<string>();
      set.add(row.distributor_id);
      byGroup.set(row.group_id, set);
    }
    return [...byGroup.entries()]
      .filter(([, distributors]) => distributors.size > 1)
      .map(([groupId]) => groupId)
      .sort((a, b) => a.localeCompare(b));
  }, [serieMensalNacional]);

  useEffect(() => {
    if (holdingOptions.length > 0 && selectedHoldings.length === 0) {
      setSelectedHoldings(holdingOptions.slice(0, 3));
    }
  }, [holdingOptions, selectedHoldings.length]);

  const filteredMonthlyRows = useMemo(() => {
    const rows = serieMensalNacional ?? [];
    const byGroup = new Map<string, Set<string>>();
    for (const row of rows) {
      const set = byGroup.get(row.group_id) ?? new Set<string>();
      set.add(row.distributor_id);
      byGroup.set(row.group_id, set);
    }
    const selectedSet = new Set(selectedHoldings.length ? selectedHoldings : holdingOptions);

    return rows.filter((row) => {
      const isHolding = (byGroup.get(row.group_id)?.size ?? 0) > 1;
      if (companyScope === 'all') return true;
      if (companyScope === 'holdings') return isHolding && selectedSet.has(row.group_id);
      if (companyScope === 'small') return !isHolding;
      return isHolding && selectedSet.has(row.group_id);
    });
  }, [companyScope, holdingOptions, selectedHoldings, serieMensalNacional]);

  const yearlyTotals = useMemo(() => {
    const byYear = new Map<number, YearTotals>();
    const monthKeysByYear = new Map<number, Set<number>>();

    for (const row of filteredMonthlyRows) {
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
  }, [filteredMonthlyRows]);

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
    const distByClassProfiles = new Map<string, {
      serv: { a: number; rural: number; urbana: number; total: number };
      fora: { a: number; rural: number; urbana: number; total: number };
      comp: { a: number; rural: number; urbana: number; total: number };
    }>();

    for (const gv of Object.values(groupViews ?? {})) {
      for (const item of gv.classe_local ?? []) {
        const dist = item.distributor_id;
        const cls = (item.classe_local_servico || '').toLowerCase();
        const qtdServ = Number(item.qtd_serv_realizado) || 0;
        const qtdFora = Number(item.qtd_fora_prazo) || 0;
        const comp = Number(item.compensacao_rs) || 0;
        const curr = distByClassProfiles.get(dist) ?? {
          serv: { a: 0, rural: 0, urbana: 0, total: 0 },
          fora: { a: 0, rural: 0, urbana: 0, total: 0 },
          comp: { a: 0, rural: 0, urbana: 0, total: 0 },
        };

        curr.serv.total += qtdServ;
        curr.fora.total += qtdFora;
        curr.comp.total += comp;

        if (cls === 'grupo_a') {
          curr.serv.a += qtdServ;
          curr.fora.a += qtdFora;
          curr.comp.a += comp;
        }
        if (cls === 'rural') {
          curr.serv.rural += qtdServ;
          curr.fora.rural += qtdFora;
          curr.comp.rural += comp;
        }
        if (cls === 'urbana') {
          curr.serv.urbana += qtdServ;
          curr.fora.urbana += qtdFora;
          curr.comp.urbana += comp;
        }

        distByClassProfiles.set(dist, curr);
      }
    }

    const globalShares = (() => {
      let aServ = 0;
      let aFora = 0;
      let aComp = 0;
      let ruralServ = 0;
      let ruralFora = 0;
      let ruralComp = 0;
      let urbanaServ = 0;
      let urbanaFora = 0;
      let urbanaComp = 0;
      let totalServ = 0;
      let totalFora = 0;
      let totalComp = 0;

      for (const v of distByClassProfiles.values()) {
        aServ += v.serv.a;
        aFora += v.fora.a;
        aComp += v.comp.a;
        ruralServ += v.serv.rural;
        ruralFora += v.fora.rural;
        ruralComp += v.comp.rural;
        urbanaServ += v.serv.urbana;
        urbanaFora += v.fora.urbana;
        urbanaComp += v.comp.urbana;
        totalServ += v.serv.total;
        totalFora += v.fora.total;
        totalComp += v.comp.total;
      }

      const localServTotal = urbanaServ + ruralServ;
      const localForaTotal = urbanaFora + ruralFora;
      const localCompTotal = urbanaComp + ruralComp;

      return {
        aServ: totalServ > 0 ? aServ / totalServ : 0.08,
        aFora: totalFora > 0 ? aFora / totalFora : 0.08,
        aComp: totalComp > 0 ? aComp / totalComp : 0.08,
        ruralServ: localServTotal > 0 ? ruralServ / localServTotal : 0.25,
        urbanaServ: localServTotal > 0 ? urbanaServ / localServTotal : 0.75,
        ruralFora: localForaTotal > 0 ? ruralFora / localForaTotal : 0.25,
        urbanaFora: localForaTotal > 0 ? urbanaFora / localForaTotal : 0.75,
        ruralComp: localCompTotal > 0 ? ruralComp / localCompTotal : 0.25,
        urbanaComp: localCompTotal > 0 ? urbanaComp / localCompTotal : 0.75,
      };
    })();

    const byYear = new Map<number, ServiceSplitRow>();

    for (const row of filteredMonthlyRows) {
      const year = Number(row.ano);
      const month = Number(row.mes);
      if (!Number.isFinite(year) || !Number.isFinite(month)) continue;

      const qtdServ = Number(row.qtd_serv_realizado) || 0;
      const qtdFora = Number(row.qtd_fora_prazo) || 0;
      const comp = Number(row.compensacao_rs) || 0;

      const distShare = distByClassProfiles.get(row.distributor_id);

      const aShareServ = distShare && distShare.serv.total > 0 ? distShare.serv.a / distShare.serv.total : globalShares.aServ;
      const aShareFora = distShare && distShare.fora.total > 0 ? distShare.fora.a / distShare.fora.total : globalShares.aFora;
      const aShareComp = distShare && distShare.comp.total > 0 ? distShare.comp.a / distShare.comp.total : globalShares.aComp;
      const bShareServ = Math.max(0, 1 - aShareServ);
      const bShareFora = Math.max(0, 1 - aShareFora);
      const bShareComp = Math.max(0, 1 - aShareComp);

      const urbanaServRaw = distShare && distShare.serv.total > 0 ? distShare.serv.urbana / distShare.serv.total : globalShares.urbanaServ;
      const ruralServRaw = distShare && distShare.serv.total > 0 ? distShare.serv.rural / distShare.serv.total : globalShares.ruralServ;
      const localServNorm = Math.max(urbanaServRaw + ruralServRaw, 1e-9);

      const urbanaForaRaw = distShare && distShare.fora.total > 0 ? distShare.fora.urbana / distShare.fora.total : globalShares.urbanaFora;
      const ruralForaRaw = distShare && distShare.fora.total > 0 ? distShare.fora.rural / distShare.fora.total : globalShares.ruralFora;
      const localForaNorm = Math.max(urbanaForaRaw + ruralForaRaw, 1e-9);

      const urbanaCompRaw = distShare && distShare.comp.total > 0 ? distShare.comp.urbana / distShare.comp.total : globalShares.urbanaComp;
      const ruralCompRaw = distShare && distShare.comp.total > 0 ? distShare.comp.rural / distShare.comp.total : globalShares.ruralComp;
      const localCompNorm = Math.max(urbanaCompRaw + ruralCompRaw, 1e-9);

      const urbanaShareServ = urbanaServRaw / localServNorm;
      const ruralShareServ = ruralServRaw / localServNorm;
      const urbanaShareFora = urbanaForaRaw / localForaNorm;
      const ruralShareFora = ruralForaRaw / localForaNorm;
      const urbanaShareComp = urbanaCompRaw / localCompNorm;
      const ruralShareComp = ruralCompRaw / localCompNorm;

      const current = byYear.get(year) ?? {
        ano: year,
        monthsObserved: 0,
        estimated: false,
        urbana_qtd_fora_prazo: 0,
        rural_qtd_fora_prazo: 0,
        urbana_compensacao_rs: 0,
        rural_compensacao_rs: 0,
        urbana_qtd_serv_realizado: 0,
        rural_qtd_serv_realizado: 0,
        urbana_uc_media: 0,
        rural_uc_media: 0,
        grupo_a_qtd_fora_prazo: 0,
        grupo_b_qtd_fora_prazo: 0,
        grupo_a_compensacao_rs: 0,
        grupo_b_compensacao_rs: 0,
        grupo_a_qtd_serv_realizado: 0,
        grupo_b_qtd_serv_realizado: 0,
        grupo_a_uc_media: 0,
        grupo_b_uc_media: 0,
      };

      current.urbana_qtd_fora_prazo += qtdFora * urbanaShareFora;
      current.rural_qtd_fora_prazo += qtdFora * ruralShareFora;
      current.urbana_compensacao_rs += comp * urbanaShareComp;
      current.rural_compensacao_rs += comp * ruralShareComp;
      current.urbana_qtd_serv_realizado += qtdServ * urbanaShareServ;
      current.rural_qtd_serv_realizado += qtdServ * ruralShareServ;
      current.urbana_uc_media += (Number(row.uc_ativa_mes) || 0) * urbanaShareServ;
      current.rural_uc_media += (Number(row.uc_ativa_mes) || 0) * ruralShareServ;

      current.grupo_a_qtd_fora_prazo += qtdFora * aShareFora;
      current.grupo_b_qtd_fora_prazo += qtdFora * bShareFora;
      current.grupo_a_compensacao_rs += comp * aShareComp;
      current.grupo_b_compensacao_rs += comp * bShareComp;
      current.grupo_a_qtd_serv_realizado += qtdServ * aShareServ;
      current.grupo_b_qtd_serv_realizado += qtdServ * bShareServ;
      current.grupo_a_uc_media += (Number(row.uc_ativa_mes) || 0) * aShareServ;
      current.grupo_b_uc_media += (Number(row.uc_ativa_mes) || 0) * bShareServ;

      const monthBit = 1 << month;
      current.monthsObserved |= monthBit;

      byYear.set(year, current);
    }

    const rows = [...byYear.values()].map((row) => {
      let count = 0;
      for (let i = 1; i <= 12; i += 1) {
        if (row.monthsObserved & (1 << i)) count += 1;
      }
      const monthsObserved = Math.max(count, 1);
      const factor = 12 / monthsObserved;

      return {
        ...row,
        monthsObserved,
        urbana_qtd_fora_prazo: row.urbana_qtd_fora_prazo * factor,
        rural_qtd_fora_prazo: row.rural_qtd_fora_prazo * factor,
        urbana_compensacao_rs: row.urbana_compensacao_rs * factor,
        rural_compensacao_rs: row.rural_compensacao_rs * factor,
        urbana_qtd_serv_realizado: row.urbana_qtd_serv_realizado * factor,
        rural_qtd_serv_realizado: row.rural_qtd_serv_realizado * factor,
        urbana_uc_media: row.urbana_uc_media,
        rural_uc_media: row.rural_uc_media,
        grupo_a_qtd_fora_prazo: row.grupo_a_qtd_fora_prazo * factor,
        grupo_b_qtd_fora_prazo: row.grupo_b_qtd_fora_prazo * factor,
        grupo_a_compensacao_rs: row.grupo_a_compensacao_rs * factor,
        grupo_b_compensacao_rs: row.grupo_b_compensacao_rs * factor,
        grupo_a_qtd_serv_realizado: row.grupo_a_qtd_serv_realizado * factor,
        grupo_b_qtd_serv_realizado: row.grupo_b_qtd_serv_realizado * factor,
        grupo_a_uc_media: row.grupo_a_uc_media,
        grupo_b_uc_media: row.grupo_b_uc_media,
      };
    });

    // Extensão para anos anteriores usando totais anuais históricos + shares estruturais
    if (companyScope === 'all') {
      const hasYear = new Set(rows.map((r) => r.ano));
      const annualRows = data?.serie_anual ?? [];
      const ucRef = rows.length > 0
        ? rows.reduce((acc, r) => acc + r.urbana_uc_media + r.rural_uc_media, 0) / rows.length
        : 95000000;

      for (const annual of annualRows) {
        if (annual.ano >= 2023 || hasYear.has(annual.ano)) continue;
        const totalServ = Number(annual.qtd_serv) || 0;
        const totalFora = Number(annual.qtd_fora_prazo) || 0;
        const totalComp = Number(annual.compensacao_rs) || 0;

        rows.push({
          ano: annual.ano,
          monthsObserved: 12,
          estimated: true,
          urbana_qtd_fora_prazo: totalFora * globalShares.urbanaFora,
          rural_qtd_fora_prazo: totalFora * globalShares.ruralFora,
          urbana_compensacao_rs: totalComp * globalShares.urbanaComp,
          rural_compensacao_rs: totalComp * globalShares.ruralComp,
          urbana_qtd_serv_realizado: totalServ * globalShares.urbanaServ,
          rural_qtd_serv_realizado: totalServ * globalShares.ruralServ,
          urbana_uc_media: ucRef * globalShares.urbanaServ,
          rural_uc_media: ucRef * globalShares.ruralServ,
          grupo_a_qtd_fora_prazo: totalFora * globalShares.aFora,
          grupo_b_qtd_fora_prazo: totalFora * (1 - globalShares.aFora),
          grupo_a_compensacao_rs: totalComp * globalShares.aComp,
          grupo_b_compensacao_rs: totalComp * (1 - globalShares.aComp),
          grupo_a_qtd_serv_realizado: totalServ * globalShares.aServ,
          grupo_b_qtd_serv_realizado: totalServ * (1 - globalShares.aServ),
          grupo_a_uc_media: ucRef * globalShares.aServ,
          grupo_b_uc_media: ucRef * (1 - globalShares.aServ),
        });
      }
    }

    return rows.sort((a, b) => a.ano - b.ano);
  }, [companyScope, data?.serie_anual, filteredMonthlyRows, groupViews]);

  const groupAFidelity = useMemo(() => {
    const classTotals = new Map<string, number>();
    for (const gv of Object.values(groupViews ?? {})) {
      for (const item of gv.classe_local ?? []) {
        const dist = item.distributor_id;
        classTotals.set(dist, (classTotals.get(dist) ?? 0) + (Number(item.qtd_serv_realizado) || 0));
      }
    }

    let covered = 0;
    let total = 0;
    for (const row of filteredMonthlyRows) {
      const serv = Number(row.qtd_serv_realizado) || 0;
      total += serv;
      if ((classTotals.get(row.distributor_id) ?? 0) > 0) covered += serv;
    }
    const coverage = total > 0 ? covered / total : 0;

    if (coverage >= 0.9) return { level: 'alta', coverage };
    if (coverage >= 0.75) return { level: 'media', coverage };
    return { level: 'baixa', coverage };
  }, [filteredMonthlyRows, groupViews]);

  const latestServiceRow = serviceTypeSeries.at(-1);
  const compositionQtdData = useMemo(() => {
    if (!latestServiceRow) return [] as Array<{ name: string; value: number; color: string }>;
    if (compositionDimension === 'localidade') {
      return [
        { name: 'Urbana', value: latestServiceRow.urbana_qtd_fora_prazo, color: COLORS.blue },
        { name: 'Rural', value: latestServiceRow.rural_qtd_fora_prazo, color: COLORS.amber },
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
      ];
    }
    return [
      { name: 'Grupo A', value: latestServiceRow.grupo_a_compensacao_rs, color: COLORS.green },
      { name: 'Grupo B', value: latestServiceRow.grupo_b_compensacao_rs, color: COLORS.red },
    ];
  }, [compositionDimension, latestServiceRow]);

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
  const anosPreLabel = kpi?.anos_pre?.length
    ? `${Math.min(...kpi.anos_pre)}-${Math.max(...kpi.anos_pre)}`
    : '2011-2021';
  const anosPosLabel = kpi?.anos_pos?.length
    ? `${Math.min(...kpi.anos_pos)}-${Math.max(...kpi.anos_pos)}`
    : '2022-2023';

  const deltaCompPct = (() => {
    if (!kpi) return null;
    if (typeof kpi.delta_compensacao_pct === 'number') return kpi.delta_compensacao_pct;
    if (kpi.pre_compensacao_total > 0) {
      const deltaAbs = typeof kpi.delta_compensacao === 'number'
        ? kpi.delta_compensacao
        : kpi.pos_compensacao_total - kpi.pre_compensacao_total;
      return (deltaAbs / kpi.pre_compensacao_total) * 100;
    }
    return null;
  })();

  const localidadeKeyPrefix = serviceMetric === 'compensacao_rs'
    ? 'compensacao_rs'
    : serviceMetric === 'qtd_serv_realizado'
      ? 'qtd_serv_realizado'
      : 'qtd_fora_prazo';

  const groupABadgeColor =
    groupAFidelity.level === 'alta'
      ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
      : groupAFidelity.level === 'media'
        ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
        : 'text-red-400 border-red-500/30 bg-red-500/10';

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-xl font-bold text-zinc-100">Visão Geral</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Eficácia da REN 1000/2021 · KPI histórico {anosPreLabel} vs {anosPosLabel} · operacional 2023-2025
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
          value={fmtPct(kpi?.pos_taxa_media)}
          sub={`taxa ponderada ${anosPosLabel}`}
          variant="green"
        />
        <KPICard
          title="Variação da Taxa"
          value={fmtVar(kpi && kpi.pre_taxa_media > 0 ? (kpi.delta_taxa / kpi.pre_taxa_media) * 100 : null)}
          sub="redução após REN 1000"
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
          value={fmtMoney(kpi?.pos_compensacao_total)}
          sub={`total acumulado ${anosPosLabel}`}
          variant="red"
        />
        <KPICard
          title="Δ Compensações"
          value={fmtVar(deltaCompPct)}
          sub="variação pós vs pré"
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
        <h2 className="text-lg font-semibold text-zinc-100">Totais 2023–2025 (Escopo Selecionado)</h2>
        <p className="text-sm text-zinc-500 mt-0.5">
          Valores e quantidades recalculados conforme os filtros de empresas.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
      </div>

      <ChartCard
        title="Tipo de Serviço por Ano · Urbana x Rural"
        subtitle="Comparação anual por quantidade, valor e volume de serviços (observado + estimado quando aplicável)"
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
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Tipo de Serviço por Ano · Grupo A x Grupo B"
        subtitle="Grupo B é o complemento de Grupo A por distribuidora; qualidade de cobertura indicada abaixo"
      >
        <div className="mb-3 flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded-md border ${groupABadgeColor}`}>
            Fidelidade Grupo A: {groupAFidelity.level.toUpperCase()} ({fmtPct(groupAFidelity.coverage, 1)} de cobertura)
          </span>
          {serviceTypeSeries.some((r) => r.estimated) && (
            <span className="text-xs text-zinc-500">Anos anteriores a 2023 incluem estimativa por shares estruturais.</span>
          )}
        </div>
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
            <Bar dataKey={`grupo_a_${localidadeKeyPrefix}`} stackId="classe" name="Grupo A" fill={COLORS.green} />
            <Bar dataKey={`grupo_b_${localidadeKeyPrefix}`} stackId="classe" name="Grupo B" fill={COLORS.red} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="UC Média Anual por Tipo"
        subtitle="Quantidade de UCs por tipo (Urbana/Rural e Grupo A/B) para comparação de base"
      >
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={serviceTypeSeries} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
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
            <Line type="monotone" dataKey="urbana_uc_media" name="UC Urbana" stroke={COLORS.blue} strokeWidth={2} dot={{ r: 2 }} />
            <Line type="monotone" dataKey="rural_uc_media" name="UC Rural" stroke={COLORS.amber} strokeWidth={2} dot={{ r: 2 }} />
            <Line type="monotone" dataKey="grupo_a_uc_media" name="UC Grupo A" stroke={COLORS.green} strokeWidth={2} dot={{ r: 2 }} />
            <Line type="monotone" dataKey="grupo_b_uc_media" name="UC Grupo B" stroke={COLORS.red} strokeWidth={2} dot={{ r: 2 }} />
          </ComposedChart>
        </ResponsiveContainer>
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
            Urbana x Rural
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
        </div>

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
      </ChartCard>

      <ChartCard
        title="Tendência Comparada por Tipo"
        subtitle="Linhas para quantidade fora do prazo (eixo esquerdo) e compensação em R$ (eixo direito)"
      >
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
                <Line type="monotone" yAxisId="right" dataKey="urbana_compensacao_rs" name="Urbana · R$" stroke={COLORS.blue} strokeOpacity={0.6} strokeWidth={2} strokeDasharray="5 3" dot={false} />
                <Line type="monotone" yAxisId="right" dataKey="rural_compensacao_rs" name="Rural · R$" stroke={COLORS.amber} strokeOpacity={0.6} strokeWidth={2} strokeDasharray="5 3" dot={false} />
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
      </ChartCard>
    </div>
  );
}
