# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TCC (undergraduate thesis) analyzing the efficacy of ANEEL Normative Resolution no. 1.000/2021 on commercial service quality of Brazilian energy distributors. Focus: service deadline transgressions, financial compensations (R$), and normalization by UC (consumer units). Special focus on 5 Neoenergia distributors.

**Current phase:** ETL (com integração IBGE + tiers), backend FastAPI+Postgres+Redis e dois frontends (Vanilla JS clássico em `app/frontend/` e Next.js 14 em `app/frontend-next/`) estão operacionais. Backend expõe 9 endpoints: `/health`, `/api/dashboard`, `/api/dashboard/{section}` e seis micro-payloads em `/api/v1/*`. Próximos passos: fix do bug de nomes de distribuidoras em `fato_indicadores_anuais`, camada coroplética no mapa e redação da tese.

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
    +-> build_dashboard_data.py    -> app/frontend/dashboard_data.json
    +-> dashboard_transgressoes.py -> app/frontend/dashboard_transgressoes.json
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

- **Frontend (Vercel)**: estáticos + rewrites em `vercel.json` encaminham `/api/*` para o Railway transparentemente.
- **Backend (Railway)**: FastAPI em `app/backend/main.py`, PostgreSQL para tabelas analíticas (substitui o payload JSON gigante) e Redis para cache in-memory. URL base: `https://tcc-ren1000x414-production.up.railway.app`.
- **Local**: `make backend` / `make dev-serve` rodam FastAPI em `localhost:8051` (mesma API, sem rewrite).

### Key Directories

- `src/etl/` — extraction and transformation scripts (ANEEL + IBGE)
- `src/analysis/` — analytical table builders, report generators
- `app/backend/main.py` — FastAPI (9 endpoints + static mount)
- `app/frontend/` — SPA clássico (6 páginas + shared JS modules)
  - Load order: `utils.js → nav.js → filters.js → app.js → [page].js`
  - `utils.js` — formatters (fmtNum, fmtMoney, fmtMoneyFull, fmtPct, fmtVar)
  - `nav.js` — sidebar active-link, mobile toggle, toast system
  - `filters.js` — global period/porte/group state + `filters:change` event
  - `app.js` — Chart.js defaults (theme), shared constants
- `app/frontend-next/` — frontend alternativo em Next.js 14 (7 páginas, Tailwind, TanStack Query)
- `data/processed/analysis/` — versioned analytical CSVs/Parquets
- `docker/` — Docker Compose (app stack, PostgreSQL, Kestra)
- `docs/` — canonical docs (EXTRACAO_DADOS, DICIONARIO_DADOS, GUIA_ANALISE, PROXIMOS_PASSOS_TCC, ...)
- `.github/agents/` — specialized AI agents (aneel-data-guardian, backend-fastapi-specialist, frontend-next-specialist)
- `scripts/playwright/` — browser automation (`screenshot-all.js`, `check-charts.js`, `aneel-fetch.js`)
- `scripts/` — utilities (Postgres loader, artifact checkers, QA automation)

### Frontend Data Flow

Frontend clássico consome JSON estáticos + endpoints REST:

- `dashboard_data.json` — payload principal, ~27 MB (gerado por `build_dashboard_data.py`)
- `dashboard_transgressoes.json`, `dashboard_timeseries.json`, `dashboard_scatter.json`, `dashboard_heatmap.json`, `dashboard_radar.json`, `dashboard_groups_ranking.json` — micro-payloads por visualização

Backend endpoints (`app/backend/main.py`):

- `/health` — liveness
- `/api/dashboard` — payload completo
- `/api/dashboard/{section}` — fatia por seção
- `/api/v1/timeseries-tendencia`, `/scatter-eficiencia`, `/heatmap-transgressoes`, `/radar-slas`, `/groups-ranking`, `/transgressoes` — micro-payloads otimizados (cache Redis)

Páginas (todas em `app/frontend/` e espelhadas em `app/frontend-next/app/`):

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

1. **Port 8051 para local dev e Docker** — `make serve`, `make backend`, scripts Playwright e Docker usam 8051. O frontend Next.js usa `3051` via `make frontend-next` (3000/5433/6379/8000/8050/8080/8090 estão ocupados por outros serviços locais).
2. **Use `python3`, não `python`** — o binário `python` não existe nesta máquina. O Makefile já trata isso.
3. **Stacks de frontend divergentes** — `app/frontend/` é Vanilla JS puro + Chart.js via CDN (sem npm, sem frameworks). `app/frontend-next/` é Next.js 14 + React + Tailwind + TanStack Query. Não misturar convenções entre as duas.
4. **Nunca abrir o dashboard via `file://`** — CORS quebra. Use sempre `make serve` ou `make backend`.
5. **Não commitar raw data** — `data/raw/` e `data/processed/*.{csv,parquet}` estão no `.gitignore`. Só `data/processed/analysis/` CSVs são versionados.
6. **`dashboard_data.json` é gerado** — rode `make dashboard` para regenerar; não commitar manualmente.

## Conventions

### Commits (Conventional Commits em português)

```
feat: adicionar endpoint de transgressões por porte
fix: corrigir porta no Makefile para 8050
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
