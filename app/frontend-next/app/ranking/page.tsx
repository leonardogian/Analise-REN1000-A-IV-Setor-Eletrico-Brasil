'use client';

import { useSerieMensalNacional } from '@/hooks/useDashboardData';
import { ChartCard, ChartSkeleton, ErrorMessage } from '@/components/ChartCard';
import { fmtPct, fmtMoney, fmtNum, fmtVar } from '@/lib/format';
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
} from 'recharts';
import { useEffect, useMemo, useState } from 'react';

type Metric = 'taxa_fora_prazo' | 'fora_prazo_por_100k_uc_mes' | 'compensacao_rs' | 'variacao_taxa_pct';
type ScopeMode = 'all' | 'holdings' | 'small' | 'subsidiaries';

interface RankedEntity {
  grupo: string;
  qtd_serv: number;
  qtd_fora_prazo: number;
  compensacao_rs: number;
  uc_ativa_total: number;
  taxa_fora_prazo: number;
  fora_prazo_por_100k_uc_mes: number;
  compensacao_rs_por_uc_mes: number;
  variacao_taxa_pct: number;
}

const METRICS: { key: Metric; label: string; fmt: (v: number) => string }[] = [
  { key: 'taxa_fora_prazo', label: 'Taxa fora do prazo', fmt: (v) => fmtPct(v) },
  { key: 'fora_prazo_por_100k_uc_mes', label: 'Fora do prazo / 100k UC', fmt: (v) => fmtNum(v, 1) },
  { key: 'compensacao_rs', label: 'Compensações (R$)', fmt: (v) => fmtMoney(v) },
  { key: 'variacao_taxa_pct', label: 'Variação da taxa (%)', fmt: (v) => fmtVar(v) },
];

export default function RankingPage() {
  const { data, isLoading, error } = useSerieMensalNacional();
  const [metric, setMetric] = useState<Metric>('fora_prazo_por_100k_uc_mes');
  const [scope, setScope] = useState<ScopeMode>('all');
  const [selectedHoldings, setSelectedHoldings] = useState<string[]>([]);

  const metricCfg = METRICS.find((m) => m.key === metric)!;

  const holdingOptions = useMemo(() => {
    const rows = data ?? [];
    const groupDist = new Map<string, Set<string>>();
    for (const r of rows) {
      const set = groupDist.get(r.group_id) ?? new Set<string>();
      set.add(r.distributor_id);
      groupDist.set(r.group_id, set);
    }
    return [...groupDist.entries()]
      .filter(([, d]) => d.size > 1)
      .map(([id]) => id)
      .sort((a, b) => a.localeCompare(b));
  }, [data]);

  useEffect(() => {
    if (holdingOptions.length > 0 && selectedHoldings.length === 0) {
      setSelectedHoldings(holdingOptions.slice(0, 2));
    }
  }, [holdingOptions, selectedHoldings.length]);

  const rankedRows = useMemo<RankedEntity[]>(() => {
    const rows = data ?? [];

    const groupDist = new Map<string, Set<string>>();
    for (const r of rows) {
      const set = groupDist.get(r.group_id) ?? new Set<string>();
      set.add(r.distributor_id);
      groupDist.set(r.group_id, set);
    }

    const selectedHoldingSet = new Set(
        selectedHoldings.length ? selectedHoldings : holdingOptions
    );

    const addToAgg = (
      aggMap: Map<string, RankedEntity>,
      key: string,
      qtdServ: number,
      qtdFora: number,
      comp: number,
      uc: number
    ) => {
      const cur = aggMap.get(key) ?? {
        grupo: key,
        qtd_serv: 0,
        qtd_fora_prazo: 0,
        compensacao_rs: 0,
        uc_ativa_total: 0,
        taxa_fora_prazo: 0,
        fora_prazo_por_100k_uc_mes: 0,
        compensacao_rs_por_uc_mes: 0,
        variacao_taxa_pct: 0,
      };
      cur.qtd_serv += qtdServ;
      cur.qtd_fora_prazo += qtdFora;
      cur.compensacao_rs += comp;
      cur.uc_ativa_total += uc;
      aggMap.set(key, cur);
    };

    const agg = new Map<string, RankedEntity>();
    for (const r of rows) {
      const isHolding = (groupDist.get(r.group_id)?.size ?? 0) > 1;
      const isSmall = !isHolding || r.bucket_porte === 'P' || r.bucket_porte === 'M';
      const qtdServ = Number(r.qtd_serv_realizado) || 0;
      const qtdFora = Number(r.qtd_fora_prazo) || 0;
      const comp = Number(r.compensacao_rs) || 0;
      const uc = Number(r.uc_ativa_mes) || 0;

      if (scope === 'holdings' && isHolding) {
        addToAgg(agg, r.group_id.toUpperCase(), qtdServ, qtdFora, comp, uc);
      } else if (scope === 'small' && isSmall) {
        addToAgg(agg, 'EMPRESAS PEQUENAS (AGRUPADAS)', qtdServ, qtdFora, comp, uc);
      } else if (scope === 'all') {
        if (isHolding) addToAgg(agg, r.group_id.toUpperCase(), qtdServ, qtdFora, comp, uc);
        else addToAgg(agg, 'EMPRESAS PEQUENAS (AGRUPADAS)', qtdServ, qtdFora, comp, uc);
      } else if (scope === 'subsidiaries') {
        if (isHolding && selectedHoldingSet.has(r.group_id)) {
          const label = `${r.group_id.toUpperCase()} · ${r.distributor_label.split(' — ')[0]}`;
          addToAgg(agg, label, qtdServ, qtdFora, comp, uc);
        }
      }
    }

    return [...agg.values()]
      .map((e) => {
        const taxa = e.qtd_serv > 0 ? e.qtd_fora_prazo / e.qtd_serv : 0;
        const fora100k = e.uc_ativa_total > 0 ? (e.qtd_fora_prazo / e.uc_ativa_total) * 100000 : 0;
        const compPorUc = e.uc_ativa_total > 0 ? e.compensacao_rs / e.uc_ativa_total : 0;
        return {
          ...e,
          taxa_fora_prazo: taxa,
          fora_prazo_por_100k_uc_mes: fora100k,
          compensacao_rs_por_uc_mes: compPorUc,
          variacao_taxa_pct: 0,
        };
      })
      .sort((a, b) => (b[metric] as number) - (a[metric] as number));
  }, [data, holdingOptions, metric, scope, selectedHoldings]);

  const sorted = rankedRows.slice(0, 20);

  if (isLoading) return <ChartSkeleton />;
  if (error) return <ErrorMessage message={(error as Error).message} />;

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-zinc-100">Ranking</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Escopo configurável: holdings, pequenas e filiais
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as ScopeMode)}
            className="px-3 py-1.5 text-xs rounded-lg border border-white/10 bg-[#111114] text-zinc-200"
          >
            <option value="all">Todas (holdings + pequenas agrupadas)</option>
            <option value="holdings">Apenas holdings</option>
            <option value="small">Apenas pequenas (agrupadas)</option>
            <option value="subsidiaries">Filiais dentro das holdings</option>
          </select>

          {scope === 'subsidiaries' && (
            <div className="flex flex-wrap gap-1">
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
                    className={`px-2 py-1 text-[11px] rounded-md border ${
                      selected
                        ? 'bg-[#00C65A]/10 border-[#00C65A]/40 text-[#00C65A]'
                        : 'border-white/10 text-zinc-400'
                    }`}
                  >
                    {h.toUpperCase()}
                  </button>
                );
              })}
            </div>
          )}

          {METRICS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                metric === m.key
                  ? 'bg-[#00C65A]/10 border-[#00C65A]/40 text-[#00C65A]'
                  : 'border-white/10 text-zinc-400 hover:text-zinc-100'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <ChartCard title={metricCfg.label} subtitle="Ordenado do maior para o menor">
        <ResponsiveContainer width="100%" height={420}>
          <BarChart
            data={sorted}
            layout="vertical"
            margin={{ top: 4, right: 32, bottom: 0, left: 0 }}
          >
            <CartesianGrid stroke="rgba(255,255,255,0.05)" horizontal={false} />
            <XAxis
              type="number"
              tickFormatter={metricCfg.fmt}
              tick={{ fill: '#71717a', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="grupo"
              tick={{ fill: '#a1a1aa', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={220}
            />
            <Tooltip
              contentStyle={{
                background: 'rgba(17,17,19,0.97)',
                border: `1px solid ${COLORS.green}55`,
                borderRadius: 8,
              }}
              labelStyle={{ color: '#fafafa', fontWeight: 600 }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(v: any) => [metricCfg.fmt(v as number), metricCfg.label]}
            />
            <Bar dataKey={metric} radius={[0, 4, 4, 0]}>
              {sorted.map((_, i) => (
                <Cell
                  key={i}
                  fill={i === 0 ? COLORS.red : i < 3 ? COLORS.amber : COLORS.blue}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
