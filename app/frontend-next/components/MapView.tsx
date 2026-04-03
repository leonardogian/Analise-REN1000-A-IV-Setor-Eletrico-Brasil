'use client';

import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import { fmtNum, fmtMoney } from '@/lib/format';
import type { DistAggregated } from '@/app/mapa/page';
// leaflet CSS imported via globals.css

interface MapViewProps {
  distData: DistAggregated[];
  metric: 'valor' | 'qtd';
}

export default function MapView({ distData, metric }: MapViewProps) {
  const maxVal = Math.max(
    ...distData.map((d) => (metric === 'valor' ? d.valor : d.qtd)),
    1
  );

  return (
    <MapContainer
      center={[-14.235, -51.925]}
      zoom={4}
      className="h-full w-full"
      style={{ background: '#09090b' }}
      zoomControl={true}
      attributionControl={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxZoom={10}
        minZoom={3}
      />
      {distData.map((d) => {
        const val = metric === 'valor' ? d.valor : d.qtd;
        const intensity = val / maxVal;
        // Heatmap color: green (low) → yellow → red (high)
        const hue = (1 - intensity) * 120;
        const heatColor = `hsl(${Math.round(hue)}, 90%, 55%)`;
        // Radius 5–30px proportional to sqrt(intensity)
        const radius = 5 + Math.sqrt(intensity) * 25;

        return (
          <CircleMarker
            key={d.id}
            center={d.coords}
            radius={radius}
            pathOptions={{
              fillColor: heatColor,
              color: d.color,
              weight: 2,
              opacity: 0.9,
              fillOpacity: 0.55,
            }}
          >
            <Tooltip
              direction="top"
              offset={[0, -radius]}
              className="!bg-[#111113]/95 !border-white/10 !text-zinc-100 !rounded-lg !px-3 !py-2 !text-xs"
            >
              <p className="font-semibold text-sm" style={{ color: d.color }}>
                {d.label.split(' — ')[0]}
              </p>
              <p className="text-zinc-400 text-[10px]">{d.holdingLabel}</p>
              <div className="mt-1 space-y-0.5">
                <p>
                  Compensações:{' '}
                  <strong className="text-[#00C65A]">{fmtMoney(d.valor)}</strong>
                </p>
                <p>
                  Transgressões:{' '}
                  <strong className="text-[#1A8FE3]">{fmtNum(d.qtd)}</strong>
                </p>
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
