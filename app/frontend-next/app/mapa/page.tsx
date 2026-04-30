'use client';

import { useTransgressoes } from '@/hooks/useDashboardData';
import { ChartCard, ChartSkeleton, ErrorMessage } from '@/components/ChartCard';
import { fmtNum, fmtMoney } from '@/lib/format';
import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';

// Leaflet must be imported client-side only (no SSR)
const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });

// Coordenadas das distribuidoras (capitais aproximadas)
const GEO_MAP: Record<string, [number, number]> = {
  'Amazonas Energia': [-3.119, -60.0217],
  'Celesc-Dis': [-27.5954, -48.548],
  'Cemig-D': [-19.9167, -43.9345],
  'Copel-Dis': [-25.4284, -49.2733],
  'CEA Equatorial': [0.0349, -51.0694],
  'CEEE Equatorial': [-30.0346, -51.2177],
  'Equatorial AL': [-9.6662, -35.7351],
  'Equatorial MA': [-2.5307, -44.3068],
  'Equatorial PA': [-1.455, -48.5024],
  'Equatorial PI': [-5.0892, -42.8016],
  'Energisa AC': [-9.9754, -67.8249],
  'Energisa MT': [-15.601, -56.0974],
  'Energisa MS': [-20.4428, -54.6464],
  'Energisa Minas Rio': [-21.5312, -42.637],
  'Energisa PB': [-7.1153, -34.861],
  'Energisa RO': [-8.7612, -63.9039],
  'Energisa SE': [-10.9472, -37.0731],
  'Energisa Sul-Sudeste': [-22.1256, -51.3889],
  'Energisa TO': [-10.2128, -48.3601],
  'Enel RJ': [-22.9068, -43.1729],
  'Enel CE': [-3.7184, -38.5434],
  'Enel SP': [-23.5505, -46.6333],
  'Enel GO': [-16.6869, -49.2648],
  'Neoenergia Coelba': [-12.9716, -38.5016],
  'Neoenergia Pernambuco': [-8.0476, -34.877],
  'Neoenergia Cosern': [-5.7945, -35.211],
  'Neoenergia Elektro': [-22.8808, -47.0515],
  'Neoenergia Brasília': [-15.7975, -47.8919],
  'CPFL Santa Cruz': [-22.8943, -49.6385],
  'CPFL Paulista': [-22.9056, -47.0608],
  'CPFL Piratininga': [-23.4988, -47.4587],
  'EDP ES': [-20.3155, -40.3128],
  'EDP SP': [-23.49, -46.2238],
  'Light': [-22.9068, -43.1729],
  'RGE': [-29.1678, -51.1794],
  'Roraima Energia': [2.8235, -60.6758],
};

const HOLDING_COLORS: Record<string, string> = {
  neoenergia: '#00C65A',
  cpfl: '#1A8FE3',
  equatorial: '#FF6B1A',
  enel: '#A8D96B',
  energisa: '#8b5cf6',
  cemig: '#ec4899',
  copel: '#06b6d4',
  edp: '#f59e0b',
  celesc: '#10b981',
};

type Metric = 'valor' | 'qtd';

export interface DistAggregated {
  id: string;
  label: string;
  holdingId: string;
  holdingLabel: string;
  valor: number;
  qtd: number;
  coords: [number, number];
  color: string;
}

export default function MapaPage() {
  const { data, isLoading, error } = useTransgressoes();
  const [metric, setMetric] = useState<Metric>('valor');
  const [selectedHoldings, setSelectedHoldings] = useState<Set<string>>(
    new Set()
  );

  // Aggregate series into per-distributor totals
  const { distData, holdings } = useMemo(() => {
    if (!data) return { distData: [], holdings: [] };

    const holdingsSet = new Set<string>();
    const agg: Record<string, DistAggregated> = {};

    for (const item of data.series) {
      holdingsSet.add(item.holding);
      if (selectedHoldings.size > 0 && !selectedHoldings.has(item.holding))
        continue;
      const coords = GEO_MAP[item.distribuidora];
      if (!coords) continue;

      if (!agg[item.distribuidora]) {
        const group = data.groups.find((g) => g.id === item.holding);
        agg[item.distribuidora] = {
          id: item.distribuidora,
          label: item.distribuidora_label,
          holdingId: item.holding,
          holdingLabel: group?.label ?? item.holding,
          valor: 0,
          qtd: 0,
          coords,
          color: HOLDING_COLORS[item.holding] ?? '#71717a',
        };
      }
      agg[item.distribuidora].valor += item.valor_pago;
      agg[item.distribuidora].qtd += item.qtd_transgressoes;
    }

    const labelFor = (id: string) =>
      data.groups.find((g) => g.id === id)?.label ?? id;
    const holdingsArr = [...holdingsSet].sort((a, b) => {
      return labelFor(a).localeCompare(labelFor(b), 'pt-BR');
    });

    return { distData: Object.values(agg), holdings: holdingsArr };
  }, [data, selectedHoldings]);

  function toggleHolding(h: string) {
    setSelectedHoldings((prev) => {
      const next = new Set(prev);
      if (next.has(h)) next.delete(h);
      else next.add(h);
      return next;
    });
  }

  if (isLoading) return <ChartSkeleton rows={2} />;
  if (error)
    return <ErrorMessage message={(error as Error).message} />;

  // Summary stats
  const totalValor = distData.reduce((s, d) => s + d.valor, 0);
  const totalQtd = distData.reduce((s, d) => s + d.qtd, 0);

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-zinc-100">Mapa</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Distribuição geográfica das transgressões
          </p>
        </div>
        <div className="flex gap-2">
          {(['valor', 'qtd'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                metric === m
                  ? 'bg-[#1A8FE3]/10 border-[#1A8FE3]/40 text-[#1A8FE3]'
                  : 'border-white/10 text-zinc-400 hover:text-zinc-100'
              }`}
            >
              {m === 'valor' ? 'Compensações (R$)' : 'Volume Transgressões'}
            </button>
          ))}
        </div>
      </div>

      {/* Holding filter chips */}
      <div className="flex flex-wrap gap-1.5">
        {holdings.slice(0, 12).map((h) => {
          const active = selectedHoldings.size === 0 || selectedHoldings.has(h);
          const color = HOLDING_COLORS[h] ?? '#71717a';
          return (
            <button
              key={h}
              onClick={() => toggleHolding(h)}
              className={`px-2.5 py-1 text-xs rounded-md border transition-all ${
                active ? 'font-medium' : 'border-white/10 text-zinc-500'
              }`}
              style={
                active
                  ? {
                      color,
                      borderColor: `${color}66`,
                      backgroundColor: `${color}15`,
                    }
                  : undefined
              }
            >
              {data?.groups.find((g) => g.id === h)?.label ?? h}
            </button>
          );
        })}
      </div>

      {/* Map */}
      <ChartCard title="" className="!p-0 overflow-hidden">
        <div className="h-[520px] relative">
          <MapView distData={distData} metric={metric} />
          {/* Stats overlay */}
          <div className="absolute bottom-3 left-3 bg-[#111113]/90 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/10 text-xs space-y-0.5 z-[1000]">
            <p className="text-zinc-400">
              {distData.length} distribuidoras mapeadas
            </p>
            <p className="text-zinc-300">
              Total: <strong className="text-[#00C65A]">{fmtMoney(totalValor)}</strong>
              {' · '}
              <strong className="text-[#1A8FE3]">{fmtNum(totalQtd)}</strong> transgressões
            </p>
          </div>
        </div>
      </ChartCard>
    </div>
  );
}
