'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import { ChartCard, ChartSkeleton, ErrorMessage } from '@/components/ChartCard';
import type { MunicipalMetric } from '@/components/MunicipalMapView';
import { useMunicipiosMapa } from '@/hooks/useDashboardData';
import { fmtMoney, fmtNum, fmtPct } from '@/lib/format';

const MunicipalMapView = dynamic(() => import('@/components/MunicipalMapView'), {
  ssr: false,
});

const METRIC_OPTIONS: { id: MunicipalMetric; label: string }[] = [
  { id: 'compensacao_rs', label: 'Compensação R$' },
  { id: 'qtd_fora_prazo', label: 'Qtd. fora do prazo' },
  { id: 'taxa_fora_prazo', label: 'Taxa fora do prazo' },
];

export default function MapaPage() {
  const { data, isLoading, error } = useMunicipiosMapa();
  const [metric, setMetric] = useState<MunicipalMetric>('compensacao_rs');

  const defaultUf = data?.ufs[0]?.uf_code ?? '35';
  const [selectedUf, setSelectedUf] = useState<string>('');
  const ufCode = selectedUf || defaultUf;

  const municipiosUf = useMemo(
    () => data?.municipios.filter((item) => item.uf_code === ufCode) ?? [],
    [data, ufCode]
  );

  const selectedUfSummary = data?.ufs.find((uf) => uf.uf_code === ufCode);
  const topMunicipios = useMemo(() => {
    const sorted = [...municipiosUf].sort((a, b) => {
      const av = a[metric] ?? 0;
      const bv = b[metric] ?? 0;
      return Number(bv) - Number(av);
    });
    return sorted.slice(0, 8);
  }, [municipiosUf, metric]);

  if (isLoading) {
    return <ChartSkeleton rows={3} />;
  }

  if (error || !data) {
    return <ErrorMessage message={(error as Error)?.message ?? 'Falha ao carregar mapa municipal.'} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Recorte geográfico experimental</p>
          <h1 className="mt-2 text-2xl font-bold text-zinc-100">Mapa municipal de transgressões</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
            Visão opcional gerada a partir do INDGER 2023+ em granularidade municipal agregada.
            A malha do mapa é carregada por UF para evitar recolocar o gargalo municipal no pipeline principal.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="text-xs text-zinc-400">
            UF
            <select
              value={ufCode}
              onChange={(event) => setSelectedUf(event.target.value)}
              className="mt-1 block w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            >
              {data.ufs
                .slice()
                .sort((a, b) => a.uf.localeCompare(b.uf))
                .map((uf) => (
                  <option key={uf.uf_code} value={uf.uf_code}>
                    {uf.uf} — {uf.uf_nome}
                  </option>
                ))}
            </select>
          </label>
          <label className="text-xs text-zinc-400">
            Métrica
            <select
              value={metric}
              onChange={(event) => setMetric(event.target.value as MunicipalMetric)}
              className="mt-1 block w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            >
              {METRIC_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <ChartCard title="Municípios no payload" subtitle={`${data.meta.period_start} → ${data.meta.period_end}`}>
          <p className="text-2xl font-semibold text-zinc-100">{fmtNum(data.meta.municipality_count)}</p>
          <p className="mt-1 text-xs text-zinc-500">{fmtNum(data.meta.municipality_month_rows)} pares município-mês</p>
        </ChartCard>
        <ChartCard title={`Municípios em ${selectedUfSummary?.uf ?? ufCode}`} subtitle={selectedUfSummary?.uf_nome}>
          <p className="text-2xl font-semibold text-zinc-100">{fmtNum(selectedUfSummary?.municipio_count)}</p>
          <p className="mt-1 text-xs text-zinc-500">com registros INDGER</p>
        </ChartCard>
        <ChartCard title="Compensação" subtitle="UF selecionada">
          <p className="text-2xl font-semibold text-emerald-400">{fmtMoney(selectedUfSummary?.compensacao_rs)}</p>
          <p className="mt-1 text-xs text-zinc-500">soma 2023+</p>
        </ChartCard>
        <ChartCard title="Taxa fora do prazo" subtitle="UF selecionada">
          <p className="text-2xl font-semibold text-zinc-100">{fmtPct(selectedUfSummary?.taxa_fora_prazo)}</p>
          <p className="mt-1 text-xs text-zinc-500">fora do prazo / serviços</p>
        </ChartCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <MunicipalMapView
          ufCode={ufCode}
          ufName={selectedUfSummary?.uf_nome ?? ufCode}
          municipios={municipiosUf}
          metric={metric}
        />

        <ChartCard title="Municípios em destaque" subtitle="Top 8 pela métrica selecionada">
          <div className="space-y-3">
            {topMunicipios.map((item, index) => (
              <div key={item.codmunicipioibge} className="rounded-xl bg-white/[0.03] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-zinc-500">#{index + 1} · {item.codmunicipioibge}</p>
                    <p className="text-sm font-medium text-zinc-100">{item.nome_municipio}</p>
                  </div>
                  <p className="text-right text-sm font-semibold text-emerald-300">
                    {metric === 'compensacao_rs'
                      ? fmtMoney(item.compensacao_rs)
                      : metric === 'taxa_fora_prazo'
                        ? fmtPct(item.taxa_fora_prazo)
                        : fmtNum(item.qtd_fora_prazo)}
                  </p>
                </div>
                <p className="mt-2 text-xs text-zinc-500">
                  {fmtNum(item.qtd_serv_realizado)} serviços · {fmtNum(item.qtd_fora_prazo)} fora do prazo
                </p>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs leading-5 text-amber-100/80">
        <strong className="text-amber-200">Nota metodológica:</strong> este mapa é uma camada experimental
        separada. Ele agrega o INDGER por município para visualização e não substitui as tabelas principais
        por grupo econômico, porte e distribuidora usadas na análise do TCC.
      </div>
    </div>
  );
}
