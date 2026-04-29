# 📊 Dashboard — Guia para IA

## Como Subir o Dashboard Oficial

```bash
# Recomendado: backend local + frontend Next.js
make site
# Backend: http://localhost:8051
# Frontend: http://localhost:3051

# Regenerar JSONs locais antes de subir
make site-refresh

# Separado, se precisar depurar cada lado
make backend
make frontend-next

# Usando backend de produção Railway no frontend local, igual à Vercel
make site-railway
```

`make site` só sobe backend + Next.js com os JSONs atuais.
`make site-refresh` roda `dashboard-full` e depois sobe backend + Next.js.
Para reprodução científica desde o download/transformação, use `make site-full`
(execução longa: baixa dados, transforma, valida e depois serve).

## Arquitetura dos Arquivos

```
app/frontend-next/
├── app/                  ← App Router: home, benchmark, evolucao, mapa, ranking, transgressoes
├── components/           ← KPICard, ChartCard, Sidebar, MapView
├── hooks/                ← TanStack Query hooks para API/dashboard
├── lib/                  ← formatadores, cores, store
├── next.config.mjs       ← rewrites /api/* e /dashboard_*.json → backend
└── vercel.json           ← headers/CSP da Vercel

app/backend/main.py       ← FastAPI: /api/dashboard, /api/v1/*, /dashboard_*.json

data/processed/dashboard/
├── dashboard_data.json
└── dashboard_*.json
```

## Fluxo de Dados

O browser chama rotas relativas (`/api/*` e `/dashboard_*.json`). O Next.js faz
rewrite para `API_REWRITE_URL`, que localmente é `http://localhost:8051` no
target `make frontend-next` e, em produção, é o Railway.

Os JSONs canônicos são gerados em `data/processed/dashboard/` por:

```bash
make dashboard-full
```

## Modificar o Dashboard

1. Para mudança visual ou de interação, edite `app/frontend-next/app/**`,
   `components/**`, `hooks/**` ou `lib/**`.
2. Para novo dado no dashboard, edite `src/analysis/build_dashboard_data.py`
   ou o gerador específico de micro-payload.
3. Regenere os JSONs com `make dashboard-full`.
4. Valide com `make test-fast`; para checagem mais ampla, use `make test-smoke`.

## Troubleshooting

| Problema | Causa | Solução |
|----------|-------|---------|
| Frontend carrega skeleton | backend/JSON indisponível ou CSP quebrada | `make backend`, conferir `/health` e manter CSP em `app/frontend-next/vercel.json` |
| `/api/*` retorna erro local | backend local não está rodando | `make backend` ou `make stack-next` |
| JSON ausente/desatualizado | dashboard não foi regenerado | `make dashboard-full` ou `make pipeline` |
| Preflight do backend falha | artefatos/schema incompletos | `make preflight-backend` e revisar saída |
| Porta 8051 ocupada | outro serviço local | `ss -tlnp | grep :8051` |
| Porta 3051 ocupada | outro frontend local | `NEXT_PORT=3052 make frontend-next` |
