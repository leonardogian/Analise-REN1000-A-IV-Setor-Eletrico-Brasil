export default function MapaPage() {
  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Recorte desativado</p>
        <h1 className="mt-2 text-2xl font-bold text-zinc-100">Mapa removido do painel principal</h1>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm leading-6 text-zinc-300">
        <p>
          O recorte geográfico/municipal foi retirado para manter o dashboard leve e alinhado ao foco
          metodológico atual: comparação por distribuidora, grupo econômico, porte, período regulatório
          e códigos de serviço.
        </p>
        <p className="mt-3 text-zinc-400">
          Os dados canônicos continuam disponíveis nos demais módulos do painel, servidos pelo backend
          FastAPI a partir dos JSONs processados.
        </p>
      </div>
    </div>
  );
}
