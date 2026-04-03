'use client';

import { useTimeseries } from '@/hooks/useDashboardData';
import { ChartCard, ChartSkeleton, ErrorMessage } from '@/components/ChartCard';
import { fmtNum } from '@/lib/format';
import { useMemo } from 'react';

// Heatmap simples: grupos × meses, sem dependência extra
export default function EvolucaoPage() {
  const { data, isLoading, error } = useTimeseries();

  const { grupos, meses, matrix } = useMemo(() => {
    if (!data?.data) return { grupos: [], meses: [], matrix: [] };

    const points = data.data.filter((p) => p.tipo !== 'nacional');
    const grupos = [...new Set(points.map((p) => p.grupo))].slice(0, 12);
    const meses = [...new Set(points.map((p) => p.date))].sort().slice(-24);

    // matriz[grupo][mes] = valor
    const matrix: (number | null)[][] = grupos.map((g) =>
      meses.map((m) => {
        const p = points.find((pt) => pt.grupo === g && pt.date === m);
        return p?.fora_prazo_por_100k_uc_mes ?? null;
      })
    );

    return { grupos, meses, matrix };
  }, [data]);

  if (isLoading) return <ChartSkeleton />;
  if (error) return <ErrorMessage message={(error as Error).message} />;

  // Valor máximo para normalizar cor
  const maxVal = Math.max(
    ...matrix.flat().filter((v): v is number => v != null)
  );

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-xl font-bold text-zinc-100">Evolução</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Heatmap mensal — fora do prazo / 100k UC · últimos 24 meses
        </p>
      </div>

      <ChartCard title="Sazonalidade por grupo" subtitle="Intensidade = taxa de transgressão">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="text-left text-zinc-500 font-normal pr-3 pb-2 min-w-[110px]">
                  Grupo
                </th>
                {meses.map((m) => (
                  <th
                    key={m}
                    className="text-zinc-600 font-normal pb-2 min-w-[28px] text-center"
                  >
                    {m.slice(5)} {/* MM */}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grupos.map((grupo, gi) => (
                <tr key={grupo}>
                  <td className="text-zinc-400 pr-3 py-0.5 whitespace-nowrap">
                    {grupo}
                  </td>
                  {matrix[gi].map((val, mi) => {
                    const intensity = val != null ? val / maxVal : 0;
                    const bg = val != null
                      ? `rgba(26,143,227,${0.08 + intensity * 0.7})`
                      : 'transparent';
                    return (
                      <td
                        key={mi}
                        title={val != null ? fmtNum(val, 1) : '—'}
                        style={{ background: bg }}
                        className="text-center py-0.5 rounded"
                      >
                        &nbsp;
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-zinc-600 mt-3">
          Azul mais escuro = maior taxa de transgressão
        </p>
      </ChartCard>
    </div>
  );
}
