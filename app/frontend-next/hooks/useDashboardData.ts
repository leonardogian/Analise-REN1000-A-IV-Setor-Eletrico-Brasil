import { useQuery } from '@tanstack/react-query';
import { API_BASE } from '@/lib/colors';

// ── Tipos espelhando dashboard_data.json ──────────────────────────────────────

export interface KpiOverview {
  pre_taxa_media: number;
  pos_taxa_media: number;
  delta_taxa: number;
  pre_compensacao_total: number;
  pos_compensacao_total: number;
  delta_compensacao_pct: number;
  total_serv_pre: number;
  total_serv_pos: number;
}

export interface SerieAnual {
  ano: number;
  periodo_regulatorio: string;
  qtd_serv: number;
  qtd_fora_prazo: number;
  compensacao_rs: number;
  taxa_fora_prazo: number;
}

export interface DashboardPayload {
  kpi_overview: KpiOverview;
  serie_anual: SerieAnual[];
}

export interface TimeseriesPoint {
  grupo: string;
  tipo: string;
  date: string;
  fora_prazo_por_100k_uc_mes: number;
  compensacao_rs_por_uc_mes: number;
  periodo_regulatorio: string;
}

export interface RankingItem {
  grupo: string;
  qtd_fora_prazo: number;
  compensacao_rs: number;
  taxa_fora_prazo: number;
  fora_prazo_por_100k_uc_mes: number;
  compensacao_rs_por_uc_mes: number;
  variacao_taxa_pct: number;
}

// ── Helpers de fetch ──────────────────────────────────────────────────────────

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`Erro ao carregar ${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useDashboardData() {
  return useQuery<DashboardPayload>({
    queryKey: ['dashboard'],
    queryFn: () => fetchJson<DashboardPayload>('/api/dashboard'),
  });
}

export function useTimeseries() {
  return useQuery<{ data: TimeseriesPoint[] }>({
    queryKey: ['timeseries'],
    queryFn: () =>
      fetchJson<{ data: TimeseriesPoint[] }>('/dashboard_timeseries.json'),
  });
}

export function useRanking() {
  return useQuery<{ data: RankingItem[] }>({
    queryKey: ['ranking'],
    queryFn: () =>
      fetchJson<{ data: RankingItem[] }>('/dashboard_groups_ranking.json'),
  });
}

// ── Scatter (Benchmark) ──────────────────────────────────────────────────────

export interface ScatterItem {
  x: number; // volume fora do prazo
  y: number; // compensação R$/UC-mês
  label: string;
  regra: string;
  porte: string;
  holding: string;
}

export function useScatter() {
  return useQuery<{ data: ScatterItem[] }>({
    queryKey: ['scatter'],
    queryFn: () =>
      fetchJson<{ data: ScatterItem[] }>('/dashboard_scatter.json'),
  });
}

// ── Transgressões Geográficas (Mapa) ─────────────────────────────────────────

export interface MapGroup {
  id: string;
  label: string;
  enabled: boolean;
  distribuidoras: { id: string; label: string }[];
}

export interface MapSeriesItem {
  mes: string;
  ano: number;
  mes_num: number;
  holding: string;
  distribuidora: string;
  distribuidora_label: string;
  valor_pago: number;
  qtd_transgressoes: number;
  is_rural: boolean;
}

export interface TransgressoesPayload {
  series: MapSeriesItem[];
  groups: MapGroup[];
  insights: unknown;
}

export function useTransgressoes() {
  return useQuery<TransgressoesPayload>({
    queryKey: ['transgressoes-map'],
    queryFn: () =>
      fetchJson<TransgressoesPayload>('/dashboard_transgressoes.json'),
  });
}
