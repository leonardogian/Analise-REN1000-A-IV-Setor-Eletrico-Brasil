'use client';

import { useEffect, useMemo, useState } from 'react';
import { GeoJSON, MapContainer, TileLayer } from 'react-leaflet';
import type { Layer } from 'leaflet';
import type { MunicipioMapaItem } from '@/hooks/useDashboardData';
import { fmtMoney, fmtNum, fmtPct } from '@/lib/format';

export type MunicipalMetric = 'compensacao_rs' | 'qtd_fora_prazo' | 'taxa_fora_prazo';

interface MunicipalMapViewProps {
  ufCode: string;
  ufName: string;
  municipios: MunicipioMapaItem[];
  metric: MunicipalMetric;
}

interface GeoJsonFeature {
  type: 'Feature';
  properties?: {
    id?: string;
    name?: string;
    description?: string;
  };
  geometry: unknown;
}

interface GeoJsonPayload {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}

const UF_CENTER: Record<string, [number, number]> = {
  '11': [-10.9, -62.8],
  '12': [-9.0, -70.8],
  '13': [-3.8, -64.7],
  '14': [2.1, -61.3],
  '15': [-3.8, -52.5],
  '16': [1.4, -51.8],
  '17': [-10.2, -48.3],
  '21': [-5.0, -45.2],
  '22': [-7.4, -42.9],
  '23': [-5.2, -39.5],
  '24': [-5.8, -36.6],
  '25': [-7.1, -36.8],
  '26': [-8.4, -37.8],
  '27': [-9.6, -36.6],
  '28': [-10.6, -37.4],
  '29': [-12.6, -41.7],
  '31': [-18.5, -44.2],
  '32': [-19.6, -40.7],
  '33': [-22.1, -42.7],
  '35': [-22.3, -48.6],
  '41': [-24.7, -51.6],
  '42': [-27.3, -50.2],
  '43': [-30.1, -53.2],
  '50': [-20.5, -54.6],
  '51': [-12.7, -55.8],
  '52': [-16.1, -49.6],
  '53': [-15.8, -47.9],
};

const METRIC_LABEL: Record<MunicipalMetric, string> = {
  compensacao_rs: 'Compensação',
  qtd_fora_prazo: 'Fora do prazo',
  taxa_fora_prazo: 'Taxa fora do prazo',
};

function colorScale(value: number, max: number): string {
  if (!Number.isFinite(value) || value <= 0 || max <= 0) return '#27272a';
  const t = Math.min(1, Math.log1p(value) / Math.log1p(max));
  if (t > 0.8) return '#14532d';
  if (t > 0.6) return '#15803d';
  if (t > 0.4) return '#22c55e';
  if (t > 0.2) return '#84cc16';
  return '#bef264';
}

function metricValue(item: MunicipioMapaItem | undefined, metric: MunicipalMetric): number {
  if (!item) return 0;
  const value = item[metric];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function formatMetric(item: MunicipioMapaItem | undefined, metric: MunicipalMetric): string {
  if (!item) return 'sem dados';
  if (metric === 'compensacao_rs') return fmtMoney(item.compensacao_rs);
  if (metric === 'taxa_fora_prazo') return fmtPct(item.taxa_fora_prazo);
  return fmtNum(item.qtd_fora_prazo);
}

export default function MunicipalMapView({
  ufCode,
  ufName,
  municipios,
  metric,
}: MunicipalMapViewProps) {
  const [geojson, setGeojson] = useState<GeoJsonPayload | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [loadingGeo, setLoadingGeo] = useState(false);

  const metricsByCode = useMemo(() => {
    const lookup = new Map<string, MunicipioMapaItem>();
    for (const item of municipios) {
      lookup.set(item.codmunicipioibge, item);
    }
    return lookup;
  }, [municipios]);

  const maxValue = useMemo(
    () => Math.max(...municipios.map((item) => metricValue(item, metric)), 0),
    [municipios, metric]
  );

  useEffect(() => {
    let cancelled = false;
    async function loadGeoJson() {
      setLoadingGeo(true);
      setGeoError(null);
      setGeojson(null);
      try {
        const response = await fetch(
          `https://raw.githubusercontent.com/tbrugz/geodata-br/master/geojson/geojs-${ufCode}-mun.json`
        );
        if (!response.ok) {
          throw new Error(`GeoJSON ${ufCode} retornou HTTP ${response.status}`);
        }
        const payload = (await response.json()) as GeoJsonPayload;
        if (!cancelled) setGeojson(payload);
      } catch (err) {
        if (!cancelled) setGeoError((err as Error).message);
      } finally {
        if (!cancelled) setLoadingGeo(false);
      }
    }
    loadGeoJson();
    return () => {
      cancelled = true;
    };
  }, [ufCode]);

  const center = UF_CENTER[ufCode] ?? [-14.2, -51.9];

  return (
    <div className="relative h-[560px] overflow-hidden rounded-2xl border border-white/10 bg-zinc-950">
      {loadingGeo && (
        <div className="absolute inset-0 z-[500] flex items-center justify-center bg-zinc-950/80 text-sm text-zinc-300">
          Carregando malha municipal de {ufName}…
        </div>
      )}
      {geoError && (
        <div className="absolute left-4 right-4 top-4 z-[500] rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          Não foi possível carregar a malha municipal externa: {geoError}
        </div>
      )}
      <MapContainer
        key={ufCode}
        center={center}
        zoom={ufCode === '53' ? 9 : 6}
        scrollWheelZoom={false}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {geojson && (
          <GeoJSON
            key={`${ufCode}-${metric}`}
            data={geojson as never}
            style={(feature) => {
              const code = String(feature?.properties?.id ?? '');
              const item = metricsByCode.get(code);
              const value = metricValue(item, metric);
              return {
                color: '#18181b',
                weight: 0.5,
                fillColor: colorScale(value, maxValue),
                fillOpacity: item ? 0.72 : 0.08,
              };
            }}
            onEachFeature={(feature, layer: Layer) => {
              const code = String(feature?.properties?.id ?? '');
              const item = metricsByCode.get(code);
              const name = item?.nome_municipio ?? feature?.properties?.name ?? feature?.properties?.description ?? code;
              layer.bindPopup(
                `<strong>${name}</strong><br/>${METRIC_LABEL[metric]}: ${formatMetric(item, metric)}<br/>Serviços: ${fmtNum(item?.qtd_serv_realizado)}`
              );
            }}
          />
        )}
      </MapContainer>
    </div>
  );
}
