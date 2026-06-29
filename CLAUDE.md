# CLAUDE.md — TCC REN 1000/2021 ANEEL

## Overview

TCC analisando a eficácia da Resolução Normativa ANEEL nº 1.000/2021 sobre qualidade de serviços comerciais das distribuidoras de energia do Brasil. Foco: transgressões de prazo, compensações financeiras (R$), normalização por UC.

**Fase atual (2026-06-29):** ETL e backend operacionais. Frontend oficial é Next.js em `app/frontend-next/` (`tcc-frontend-react` na Vercel). Backend Railway serve JSONs canônicos como caminho crítico; PostgreSQL/Redis são degradáveis. Trilha PostgreSQL opcional em endpoints v2.

## Essential Commands

```bash
make install              # pip install -r requirements.txt
make doctor               # validate .venv + critical imports
make pipeline             # ETL → análise → relatório → dashboard (completo)
make dashboard-full       # analysis + report + grupos + JSONs (sem ETL)
make backend              # FastAPI em http://localhost:8051
make frontend-next        # Next.js em http://localhost:3051 (backend local)
make stack-next           # Backend local + Next.js juntos
make site-refresh         # Regenera JSONs + backend + Next.js
make test-fast            # imports + schema + artefatos core
make test-smoke           # grupos + dashboard + validação completa
make qa-data              # auditoria numérica dos artefatos
make load-postgres        # Carrega CSVs no PostgreSQL opcional
```

## Architecture

```
ANEEL API + IBGE (tiers)
    ↓ src/etl/
data/raw/*.csv → src/etl/transform_aneel.py → data/processed/*.csv
    ↓ src/analysis/
data/processed/analysis/*.csv  (versioned)
    ↓ src/analysis/build_dashboard_data.py
data/processed/dashboard/dashboard_*.json  (canônico)
    ↓ app/backend/main.py
FastAPI :8051 (local) / Railway (prod)
    ↓ next.config.mjs rewrites
Next.js :3051 (local) / Vercel (prod)
```

### Deploy híbrido (Vercel + Railway)

- **Vercel:** Next.js `app/frontend-next/`, rewrites para Railway. CSP com `unsafe-inline`.
- **Railway:** FastAPI `app/backend/main.py`, URL: `https://tcc-ren1000x414-production.up.railway.app`.
- **Health:** `/health` expõe `dashboard_artifacts_ready`, `database_connected`, `redis_connected`.
- **Local:** `API_REWRITE_URL=http://localhost:8051 npm run dev` (ou `make frontend-next`).

### Endpoints

| Endpoint | Fonte | Descrição |
|----------|-------|-----------|
| `/health` | Runtime | Status de artefatos + DB + Redis |
| `/api/dashboard` | JSON | Payload completo |
| `/api/dashboard/{section}` | JSON | Fatia por seção |
| `/api/v1/timeseries-tendencia` | JSON | Série temporal mensal por grupo |
| `/api/v1/groups-ranking` | JSON | Ranking de grupos |
| `/api/v1/scatter-eficiencia` | JSON | Scatter UC × falhas |
| `/api/v1/heatmap-transgressoes` | JSON | Heatmap mensal |
| `/api/v1/radar-slas` | JSON | Radar SLAs |
| `/api/v1/transgressoes` | JSON | Transgressões detalhadas |
| `/api/v2/home-service-types` | PG/CSV | Gráficos inferiores da Home por classe |
| `/api/v2/timeseries-tendencia` | PG/JSON | Trilha PostgreSQL opcional |
| `/api/v2/db-status` | PG | Tabelas carregadas |
| `/dashboard_*.json` | Files | JSONs canônicos públicos |

### Key Files

- `app/backend/main.py` — FastAPI (13 endpoints)
- `app/backend/core/postgres_dashboard.py` — consultas PostgreSQL opcionais
- `app/frontend-next/app/page.tsx` — Home (KPIs + gráficos)
- `app/frontend-next/hooks/useDashboardData.ts` — hooks TanStack Query
- `data/processed/dashboard/dashboard_*.json` — JSONs canônicos
- `data/processed/analysis/fato_transgressao_mensal_porte.csv` — fonte de `home-service-types`

## Critical Constraints

1. **Porta 8051** para backend local. Porta 3051 para frontend Next.
2. **`python3`**, não `python` — Makefile já trata.
3. **Não commitar** `data/raw/` nem `data/processed/*.csv` base.
4. **JSONs regenerados** por `make dashboard-full` — nunca edite manualmente.
5. **Grupo A = tarifa alta tensão** (grandes consumidores), **Grupo B = tarifa baixa tensão** — documente sempre em legendas.
6. **UC ausente 2025-2026:** ANEEL não publicou `uc_ativa_mes`; métricas normalizadas por UC ficam null. Gráficos que dependem de UC mostram só anos com dados.
7. **CSP Vercel:** `app/frontend-next/vercel.json` deve manter `script-src 'unsafe-inline'` para hydration.
8. **Nenhum `.py` fora de `app/backend/`** na raiz ou subdiretórios globais — conflita com build Vercel.

## Context Files for AI Agents

Após mudanças estruturais, sincronize:

- `README.md`, `AGENTS.md`, `CLAUDE.md` (raiz)
- `app/frontend-next/README.md` (dashboard)
- `.ai/CONTEXT.md`, `.ai/CONVENTIONS.md`

## Testing

```bash
make test-fast            # imports + schema + artefatos core
make test-smoke           # grupos + dashboard + validação
make validate-contracts   # schema contracts raw + processed
make qa-data              # auditoria numérica
```
