'use client';

import { ChartCard } from '@/components/ChartCard';

export default function MapaPage() {
  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-xl font-bold text-zinc-100">Mapa</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Distribuição geográfica das transgressões
        </p>
      </div>
      <ChartCard title="Mapa Coroplético" subtitle="Requer Leaflet ou react-leaflet">
        <div className="h-96 flex items-center justify-center flex-col gap-3 text-zinc-600">
          <span className="text-4xl">🗺️</span>
          <p className="text-sm">
            Instale <code className="text-zinc-400">react-leaflet</code> para
            renderizar o mapa interativo
          </p>
          <code className="text-xs text-zinc-500">
            npm install react-leaflet leaflet @types/leaflet
          </code>
        </div>
      </ChartCard>
    </div>
  );
}
