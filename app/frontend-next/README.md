# Frontend Next.js 14 — Dashboard ANEEL REN 1000

Frontend principal do TCC. Consome a API FastAPI no Railway via rewrites do Next.js.

**URL de produção:** [tcc-frontend-react.vercel.app](https://tcc-frontend-react.vercel.app)

---

## Como rodar

```bash
# Da raiz do projeto (recomendado — sobe backend junto):
make site              # backend :8051 + Next.js :3051 com JSON atual
make site-refresh      # regenera JSONs + backend :8051 + Next.js :3051
make site-railway      # Next.js local usando Railway, igual à Vercel

# Só o Next.js (precisa de backend separado):
make backend &         # backend em segundo plano
make frontend-next     # Next.js em http://localhost:3051

# Direto com npm (dentro desta pasta):
npm run dev            # http://localhost:3000 (sem rewrite pra Railway)
```

---

## Estrutura

```
app/frontend-next/
├── app/                  ← App Router (Next.js 14)
│   ├── layout.tsx        ← Layout raiz (Sidebar + providers)
│   ├── page.tsx          ← Rota / → Dashboard home (KPIs + tendências)
│   ├── benchmark/        ← Rota /benchmark → Scatter volume × compensação
│   ├── evolucao/         ← Rota /evolucao  → Heatmap mensal por holding
│   ├── mapa/             ← Rota /mapa      → Mapa municipal agregado experimental
│   ├── ranking/          ← Rota /ranking   → Ranking horizontal de grupos
│   └── transgressoes/    ← Rota /transgressoes → Série temporal bi-eixo
│
├── components/
│   ├── Sidebar.tsx       ← Navegação lateral (links para as rotas principais)
│   ├── KPICard.tsx       ← Card de KPI com variação pré/pós REN 1000
│   ├── ChartCard.tsx     ← Wrapper de gráfico com skeleton e error state

│
├── hooks/
│   └── useDashboardData.ts ← Hooks TanStack Query: useKpiOverview, useScatter,
│                             useTimeSeries, useHeatmap, useRanking, useGroups
│
├── lib/
│   ├── colors.ts         ← Paleta de cores, API_BASE relativo
│   ├── format.ts         ← Formatadores pt-BR (moeda, %, número)
│   └── store.ts          ← Zustand: estado global de filtros (período, grupo)
│
├── next.config.mjs       ← Rewrites: /api/* e /dashboard_*.json → Railway
├── vercel.json           ← Security headers (CSP, X-Frame-Options…)
└── tailwind.config.ts    ← Tema Tailwind (dark mode, cores das holdings)
```

---

## Como os dados chegam ao frontend

O `next.config.mjs` configura rewrites transparentes — o browser faz `fetch('/api/dashboard')` e o Next.js redireciona para o Railway sem expor a URL do backend:

```
Browser → /api/dashboard
  ↓ rewrite (next.config.mjs)
Railway → https://tcc-ren1000x414-production.up.railway.app/api/dashboard
```

O mesmo vale para os arquivos `dashboard_*.json`; a fonte canônica é `data/processed/dashboard/`, servida pelo backend em `/dashboard_*.json`.

Localmente, a variável `API_REWRITE_URL=http://localhost:8051` (definida pelo `make frontend-next`) aponta os rewrites pro backend local em vez do Railway.

Na home, os dois cards pré-REN do topo usam o agregado histórico de `kpi_overview`. Já os cards pós-REN e as variações do topo são uma visão Brasil fixa recalculada no cliente a partir de `serie_mensal_nacional`, usando a janela operacional 2023–2025; os filtros de empresas afetam apenas os gráficos e cards inferiores.

Os JSONs atuais esperam a mensalidade INDGER corrigida: `serie_mensal_nacional` e `dashboard_timeseries.json` devem conter no mínimo a linha de base `2023-01` a `2025-12`; meses posteriores podem aparecer quando o ZIP mensal da ANEEL trouxer safras contíguas. Se a home ou `/evolucao` voltar a mostrar apenas janeiro por ano, regenere os artefatos e rode `make check-artifacts-full`.

Na rota `/benchmark`, `dashboard_scatter.json` usa apenas meses em que `uc_ativa_mes > 0` para calcular `R$/UC-mês`. O payload também traz `holding_label`, `periodo_inicio`, `periodo_fim` e `meses_uc_validos` para evitar exibir slugs internos de grupos independentes (ex.: `joao`) e deixar explícita a cobertura comparável do denominador UC.

O recorte municipal pesado continua fora do pipeline principal. Nesta branch experimental, `/mapa` foi reativado com `dashboard_municipios.json`, gerado sob demanda por `make mapa-municipios`: o payload agrega INDGER 2023+ por município/UF, usa malha GeoJSON externa por UF no cliente e evita recriar a tabela municipal detalhada de ~22 milhões de linhas no fluxo principal.

---

## Como adicionar uma nova página

1. Crie `app/<nome>/page.tsx`
2. Importe o hook adequado de `hooks/useDashboardData.ts`
3. Adicione o link no `components/Sidebar.tsx`
4. Se precisar de novos dados: adicione um hook `useNomeDaPagina()` em `useDashboardData.ts`

Exemplo mínimo:

```tsx
'use client';
import { useKpiOverview } from '@/hooks/useDashboardData';
import { ChartCard, ChartSkeleton } from '@/components/ChartCard';

export default function NovaPagina() {
  const { data, isLoading, error } = useKpiOverview();
  if (isLoading) return <ChartSkeleton />;
  if (error || !data) return null;
  return <ChartCard title="Minha Análise">{/* Recharts aqui */}</ChartCard>;
}
```

---

## Deploy (Vercel)

Este diretório é o frontend oficial e deve estar vinculado ao projeto Vercel **`tcc-frontend-react`** (ID `prj_hanCWL0GVRwXVKHw5ecCuWmJPSyn`).

Configuração esperada no Vercel:

- Git Repository: `leonardogian/Analise-REN1000-A-IV-Setor-Eletrico-Brasil`
- Production Branch: `main`
- Root Directory: `app/frontend-next`
- Build Command: `npm run build`
- Install Command: `npm install`
- Output Directory: Next.js default
- Env production: `API_REWRITE_URL=https://tcc-ren1000x414-production.up.railway.app`

Deploy automático: qualquer push na branch `main` que modifique `app/frontend-next/**` dispara rebuild no Vercel com este diretório como Root Directory. A env antiga `NEXT_PUBLIC_API_URL` não é usada pelo código atual e deve ser removida ou mantida apenas como nota histórica.

O `vercel.json` nesta pasta adiciona security headers (CSP) ao deploy. A CSP permite `script-src 'unsafe-inline'` porque o App Router do Next.js injeta scripts inline de boot/hydration; remover isso deixa a produção presa em skeleton/loading. Os rewrites de API estão no `next.config.mjs` — não duplique no `vercel.json`.

Sempre que os endpoints ou JSONs do dashboard mudarem, redeploye também o backend Railway a partir do `main` atual. A produção deve expor `/api/v1/groups-ranking` e `/api/v1/transgressoes`, e `/dashboard_data.json` deve trazer o `meta.generated_at` dos JSONs versionados mais recentes.

Mudanças em `data/processed/dashboard/dashboard_*.json` alteram o dado exibido mesmo sem mudança visual no React; após regeneração, o Railway precisa publicar os JSONs novos para que a Vercel não consuma payload antigo.

---

## Dependências principais

| Pacote | Versão | Para quê |
|--------|--------|----------|
| `next` | 14.2.35 | Framework React (App Router, SSR) |
| `@tanstack/react-query` | 5.x | Cache e sincronização de dados assíncronos |
| `zustand` | 5.x | Estado global de filtros |
| `recharts` | 3.x | Gráficos (line, bar, scatter, heatmap) |
| `tailwindcss` | 3.4 | Design system utilitário (dark mode) |
