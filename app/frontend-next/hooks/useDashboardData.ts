import { useQuery } from '@tanstack/react-query';
import { API_BASE } from '@/lib/colors';

// ── Tipos espelhando dashboard_data.json ──────────────────────────────────────

export interface KpiOverview {
  pre_taxa_media: number;
  pos_taxa_media: number;
  delta_taxa: number;
  pre_compensacao_total: number;
  pos_compensacao_total: number;
  delta_compensacao_pct?: number;
  delta_compensacao?: number;
  pre_servicos_total: number;
  pos_servicos_total: number;
  pre_fora_prazo_total: number;
  pos_fora_prazo_total: number;
  anos_pre: number[];
  anos_pos: number[];
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

interface DashboardSectionResponse<T> {
  meta: Record<string, unknown>;
  section: string;
  data: T;
}

export interface TimeseriesPoint {
  grupo: string;
  tipo: string;
  date: string;
  qtd_serv_realizado?: number | null;
  qtd_fora_prazo?: number | null;
  compensacao_rs?: number | null;
  taxa_fora_prazo?: number | null;
  exposicao_uc_mes?: number | null;
  fora_prazo_por_100k_uc_mes: number | null;
  compensacao_rs_por_uc_mes: number | null;
  periodo_regulatorio: string;
}

export interface TimeseriesPayload {
  data: TimeseriesPoint[];
  source?: string;
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

export interface SerieMensalNacionalItem {
  ano: number;
  mes: number;
  group_id: string;
  distributor_id: string;
  distributor_label: string;
  uc_ativa_mes: number;
  qtd_serv_realizado: number;
  qtd_fora_prazo: number;
  compensacao_rs: number;
  taxa_fora_prazo: number;
  fora_prazo_por_100k_uc_mes: number;
  compensacao_rs_por_uc_mes: number;
  bucket_porte: string;
}

export interface ClasseLocalItem {
  distributor_id: string;
  classe_local_servico: string;
  qtd_serv_realizado: number;
  qtd_fora_prazo: number;
  compensacao_rs: number;
}

export type GroupViewsPayload = Record<string, {
  classe_local?: ClasseLocalItem[];
}>;

// ── Helpers de fetch ──────────────────────────────────────────────────────────

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`Erro ao carregar ${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

async function fetchJsonFirstAvailable<T>(paths: string[]): Promise<T> {
  let lastError: Error | null = null;
  for (const path of paths) {
    try {
      return await fetchJson<T>(path);
    } catch (err) {
      lastError = err as Error;
    }
  }
  throw lastError ?? new Error('Falha ao carregar recurso.');
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useDashboardData() {
  return useQuery<DashboardPayload>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const [kpiSection, serieSection] = await Promise.all([
        fetchJson<DashboardSectionResponse<KpiOverview>>('/api/dashboard/kpi_overview'),
        fetchJson<DashboardSectionResponse<SerieAnual[]>>('/api/dashboard/serie_anual'),
      ]);
      return {
        kpi_overview: kpiSection.data,
        serie_anual: serieSection.data,
      };
    },
  });
}

export function useTimeseries() {
  return useQuery<TimeseriesPayload>({
    queryKey: ['timeseries', 'detailed-v1-raw-latest'],
    queryFn: () =>
      fetchJsonFirstAvailable<TimeseriesPayload>([
        '/api/v1/timeseries-tendencia',
        '/api/v2/timeseries-tendencia',
        '/dashboard_timeseries.json',
      ]),
  });
}

export function useRanking() {
  return useQuery<{ data: RankingItem[] }>({
    queryKey: ['ranking'],
    queryFn: () =>
      fetchJsonFirstAvailable<{ data: RankingItem[] }>([
        '/api/v1/groups-ranking',
        '/dashboard_groups_ranking.json',
      ]),
  });
}

export function useSerieMensalNacional() {
  return useQuery<SerieMensalNacionalItem[]>({
    queryKey: ['serie-mensal-nacional'],
    queryFn: async () => {
      const res = await fetchJson<DashboardSectionResponse<SerieMensalNacionalItem[]>>(
        '/api/dashboard/serie_mensal_nacional'
      );
      return res.data;
    },
  });
}

export function useGroupViews() {
  return useQuery<GroupViewsPayload>({
    queryKey: ['group-views'],
    queryFn: async () => {
      const res = await fetchJson<DashboardSectionResponse<GroupViewsPayload>>(
        '/api/dashboard/group_views'
      );
      return res.data;
    },
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
      fetchJsonFirstAvailable<{ data: ScatterItem[] }>([
        '/api/v1/scatter-eficiencia',
        '/dashboard_scatter.json',
      ]),
  });
}

// ── Transgressões por grupo/distribuidora ────────────────────────────────────

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
    queryKey: ['transgressoes'],
    queryFn: () =>
      fetchJsonFirstAvailable<TransgressoesPayload>([
        '/api/v1/transgressoes',
        '/dashboard_transgressoes.json',
      ]),
  });
}
