# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TCC (undergraduate thesis) analyzing the efficacy of ANEEL Normative Resolution no. 1.000/2021 on commercial service quality of Brazilian energy distributors. Focus: service deadline transgressions, financial compensations (R$), and normalization by UC (consumer units). Special focus on 5 Neoenergia distributors.

**Current phase:** ETL e backend FastAPI+Postgres+Redis estão operacionais; o frontend oficial é o Next.js em `app/frontend-next/` (`tcc-frontend-react` na Vercel). O Vanilla em `app/frontend/` fica preservado como legado. A rodada de reprodutibilidade reforçou extração segura, contratos de schema, deduplicação INDGER e dashboard com agregações ponderadas. `make pipeline` agora termina com validações.

## Essential Commands

```bash
# Environment setup
make venv-recreate     # recreate .venv from scratch
make install           # pip install -r requirements.txt
make doctor            # validate .venv + critical imports

# Full pipeline (ETL -> analysis -> report -> dashboard)
make pipeline

# Individual pipeline steps (equivalentes ao make pipeline)
python3 -m src.etl.extract_aneel               # raw CSVs from ANEEL
python3 -m src.etl.extract_ibge                # raw data from IBGE (tiers)
python3 -m src.etl.transform_aneel             # clean -> Parquet/CSV
python3 -m src.analysis.build_analysis_tables  # analytical tables
python3 -m src.analysis.build_report           # markdown report
python3 -m src.analysis.build_dashboard_data   # dashboard JSON
python3 -m src.analysis.grupos_diagnostico     # grupos/*.csv
python3 -m src.analysis.dashboard_transgressoes  # dashboard_transgressoes.json

# Generating dashboard data
make grupos-diagnostico     # data/processed/analysis/grupos/
make neoenergia-diagnostico # data/processed/analysis/neoenergia/
make dashboard-full         # analysis + grupos + neoenergia + all JSONs
make clean-analysis         # remove data/processed/analysis/ outputs

# Serving the dashboard & Testing Local API
# URL Base (Local): http://localhost:8051 | URL Base (Produção Railway): https://tcc-ren1000x414-production.up.railway.app
make serve                  # Frontend clássico (Vanilla JS) em http://localhost:8051
make frontend-next          # Frontend Next.js em http://localhost:3051 (backend local)
make frontend-next-railway  # Frontend Next.js em http://localhost:3051 (backend Railway)
make stack-next             # Backend local + frontend Next.js num único comando
make backend                # FastAPI em http://localhost:8051
make dev-serve              # Backend com --reload (também serve estáticos como fallback)

# Tests
make test-fast          # compile + imports + schema contracts + core artifacts
make test-smoke         # full smoke (neoenergia + dashboard + full validation)
make validate-contracts # schema contracts (raw/processed)
make qa-data            # numeric/data-quality audit for analysis artifacts
```

## Architecture

### Data Pipeline

```
ANEEL API (dadosabertos.aneel.gov.br)  +  IBGE (via tiers)
    |
src/etl/extract_aneel.py + extract_ibge.py  -> data/raw/*.csv  (NOT versioned, 7+ GB)
    |
src/etl/transform_aneel.py                  -> data/processed/*.{csv,parquet}  (NOT versioned)
    |
src/analysis/build_analysis_tables.py       -> data/processed/analysis/*.csv  (versioned)
    |
    +-> build_report.py            -> reports/relatorio_aneel.md
    +-> neoenergia_diagnostico.py  -> data/processed/analysis/neoenergia/*.csv
    +-> grupos_diagnostico.py      -> data/processed/analysis/grupos/*.csv (13 files)
    +-> build_dashboard_data.py    -> data/processed/dashboard/dashboard_data.json
    +-> dashboard_transgressoes.py -> data/processed/dashboard/dashboard_transgressoes.json
```

### Application Stack

| Layer | Tech |
|-------|------|
| ETL/Analysis | Python 3.10+, pandas, numpy |
| Backend | FastAPI + PostgreSQL + Redis (`app/backend/main.py`) no **Railway** |
| Frontend clássico | HTML5, Vanilla JS, Chart.js 4.4.7 (CDN), CSS puro no **Vercel** |
| Frontend Next.js | Next.js 14 + React + Tailwind + TanStack Query (`app/frontend-next/`) |
| Orchestration | GNU Make + Docker Compose |
| Data formats | PostgreSQL DB, Redis Cache, Parquet, JSON |

### Deploy híbrido (Vercel + Railway)

- **Frontend oficial (Vercel)**: Next.js em `app/frontend-next/`; rewrites em `next.config.mjs` encaminham `/api/*` e `/dashboard_*.json` para o Railway.
- **Backend (Railway)**: FastAPI em `app/backend/main.py`, PostgreSQL para tabelas analíticas (substitui o payload JSON gigante) e Redis para cache in-memory. URL base: `https://tcc-ren1000x414-production.up.railway.app`.
- **Headers do Next.js**: `app/frontend-next/vercel.json` mantém CSP com `script-src 'unsafe-inline'` para permitir boot/hydration do App Router; remover isso deixa a produção presa em skeleton/loading.
- **Sincronização de produção**: mudanças em `app/backend/main.py` ou `data/processed/dashboard/dashboard_*.json` exigem redeploy do Railway para atualizar endpoints como `/api/v1/groups-ranking`, `/api/v1/transgressoes` e os JSONs públicos.
- **Local**: `make backend` / `make dev-serve` rodam FastAPI em `localhost:8051` (mesma API, sem rewrite).

### Key Directories

- `src/etl/` — extraction and transformation scripts (ANEEL + IBGE)
- `src/analysis/` — analytical table builders, report generators
- `app/backend/main.py` — FastAPI (9 endpoints + static mount)
- `app/frontend-next/` — frontend oficial em Next.js 14 (7 páginas, Tailwind, TanStack Query)
- `app/frontend/` — SPA clássico legado (6 páginas + shared JS modules)
  - Load order: `utils.js → nav.js → filters.js → app.js → [page].js`
  - `utils.js` — formatters (fmtNum, fmtMoney, fmtMoneyFull, fmtPct, fmtVar)
  - `nav.js` — sidebar active-link, mobile toggle, toast system
  - `filters.js` — global period/porte/group state + `filters:change` event
  - `app.js` — Chart.js defaults (theme), shared constants
- `data/processed/dashboard/` — JSONs canônicos `dashboard_*.json` servidos pelo backend/Railway
- `data/processed/analysis/` — versioned analytical CSVs; Parquet mirrors are generated locally
- `docker/` — Docker Compose (app stack, PostgreSQL, Kestra)
- `docs/` — canonical docs (EXTRACAO_DADOS, DICIONARIO_DADOS, GUIA_ANALISE, PROXIMOS_PASSOS_TCC, ...)
- `.github/agents/` — specialized AI agents (aneel-data-guardian, backend-fastapi-specialist, frontend-next-specialist)
- `scripts/playwright/` — browser automation (`screenshot-all.js`, `check-charts.js`, `aneel-fetch.js`)
- `scripts/` — utilities (Postgres loader, artifact checkers, QA automation)

### Frontend Data Flow

Frontend Next.js consome endpoints REST via rewrites para o Railway:

- `/api/dashboard/{section}` — fatias do payload principal
- `/api/v1/timeseries-tendencia`, `/scatter-eficiencia`, `/heatmap-transgressoes`, `/radar-slas`, `/groups-ranking`, `/transgressoes` — micro-payloads otimizados
- `/dashboard_*.json` — fallback público servido de `data/processed/dashboard/`

Backend endpoints (`app/backend/main.py`):

- `/health` — liveness
- `/api/dashboard` — payload completo
- `/api/dashboard/{section}` — fatia por seção
- `/api/v1/timeseries-tendencia`, `/scatter-eficiencia`, `/heatmap-transgressoes`, `/radar-slas`, `/groups-ranking`, `/transgressoes` — micro-payloads otimizados (cache Redis)

Páginas principais em `app/frontend-next/app/` (espelhadas no legado `app/frontend/`):

- `index.html` / `app.js` — main dashboard (KPIs, trends, groups overview)
- `transgressoes.html` / `transgressoes.js` — time-series transgression analysis
- `benchmark.html` / `benchmark.js` — bubble chart: services volume × compensation by porte
- `evolucao.html` / `evolucao.js` — monthly heatmap: transgressions by holding
- `ranking.html` / `ranking.js` — horizontal bar chart: group ranking by metric
- `mapa.html` / `mapa.js` — interactive geographic map
- `relatorio.html` — print-optimized report (Ctrl+P → PDF)

### Analytical Tables (`data/processed/analysis/`)

Key files consumed by backend and dashboard:

- `fato_indicadores_anuais.csv` — annual indicators per distributor/service (2011-2023)
- `fato_transgressao_mensal_distribuidora.csv` — monthly transgressions per distributor
- `fato_transgressao_mensal_porte.csv` — monthly transgressions by size class
- `fato_uc_ativa_mensal_distribuidora.csv` — active consumer units (for normalization)
- `dim_distribuidora_porte.csv` — distributor-to-size mapping
- `dim_distributor_group.csv` — distributor → economic group/holding mapping
- `kpi_regulatorio_anual.csv` — annual regulatory KPIs for thesis narrative
- `fato_grupos_algoritmicos.csv` — algorithmically-classified group assignments
- `grupos/` — 13 CSVs group-level analytics: annual, monthly, trends, benchmarks, data quality, outliers (generated by `grupos_diagnostico.py`)

## Critical Constraints

1. **Port 8051 para local dev e Docker** — `make serve`, `make backend`, scripts Playwright e Docker usam 8051. O frontend Next.js usa `3051` via `make frontend-next`.
2. **Use `python3`, não `python`** — o binário `python` não existe nesta máquina. O Makefile já trata isso.
3. **Stacks de frontend divergentes** — `app/frontend/` é Vanilla JS puro + Chart.js via CDN (sem npm, sem frameworks). `app/frontend-next/` é Next.js 14 + React + Tailwind + TanStack Query. Não misturar convenções entre as duas.
4. **Nunca abrir o dashboard via `file://`** — CORS quebra. Use sempre `make serve` ou `make backend`.
5. **Não commitar raw/base processed** — `data/raw/` e `data/processed/*.{csv,parquet}` base são gerados localmente. `data/processed/analysis/**/*.csv` é versionado para auditoria/demo.
6. **Dashboard JSONs são gerados** — `data/processed/dashboard/dashboard_*.json` pode ficar versionado para demo/deploy, mas deve ser regenerado com `make dashboard-full` ou `make pipeline`. Cópias em `app/frontend/` são apenas espelho local legado e ficam ignoradas.

## Conventions

### Commits (Conventional Commits em português)

```
feat: adicionar endpoint de transgressões por porte
fix: corrigir porta no Makefile para 8051
docs: atualizar README com novos gráficos
refactor: separar build_analysis_tables por fonte
chore: atualizar requirements.txt
```

### Python Scripts

- Todos os scripts rodam como módulos: `python3 -m src.analysis.build_report`
- Cada script tem `if __name__ == "__main__": main()`
- Arquivos em `snake_case.py`
- Parquet para leitura de dados grandes; CSV para output human-readable

### Context Files for AI Agents

Após mudanças estruturais, mantenha sincronizados:

- `README.md`, `AGENTS.md`, `CLAUDE.md` (raiz)
- `app/frontend/README.md` (dashboard clássico), `app/frontend-next/README.md` (dashboard Next.js)
- `.ai/CONTEXT.md`, `.ai/PIPELINE.md`, `.ai/CONVENTIONS.md`, `.ai/DASHBOARD.md`, `.ai/DATA_OVERVIEW.md`
- `docs/EXTRACAO_DADOS.md` — guia canônico de extração ANEEL + IBGE
- `docs/DATA_QUALITY_AUDIT.md` — backlog e contrato da auditoria numerica

## Testing

Não há pytest. Testes são Make targets:

- `make test-fast` — validação rápida (imports, schema contracts, core artifacts)
- `make test-smoke` — smoke completo (neoenergia + dashboard + validação)
- `scripts/check_artifacts.py --profile core|full` — presença de artefatos
- `scripts/smoke_imports.py` — smoke de imports
- `scripts/validate_schema_contracts.py` — contratos de schema

## Docker

```bash
# Main stack (dashboard + backend), porta 8051 interna
docker compose up --build

# Kestra orchestration (pipelines de dados)
docker compose -f docker/docker-compose.kestra.yml up -d
```

## AI Tooling

- **MCP context7** — busca de docs de pandas, FastAPI, Chart.js durante desenvolvimento
- **Playwright** via Bash (`npx playwright test`, `npx playwright codegen`) ou plugin Claude Code para automação de browser
- **Agentes especializados** em `.github/agents/` — aneel-data-guardian (ETL), backend-fastapi-specialist (API), frontend-next-specialist (Next.js)
