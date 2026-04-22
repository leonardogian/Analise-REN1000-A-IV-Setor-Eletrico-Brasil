# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TCC (undergraduate thesis) analyzing the efficacy of ANEEL Normative Resolution no. 1.000/2021 on commercial service quality of Brazilian energy distributors. Focus: service deadline transgressions, financial compensations (R$), and normalization by UC (consumer units). Special focus on 5 Neoenergia distributors.

**Current phase:** ETL, data infrastructure, and frontend design system are complete. The dashboard has 6 active pages (index, transgressoes, benchmark, evolucao, ranking, mapa) + relatorio.html (print). Dead scripts, stub pages, and orphaned API endpoints were cleaned up (March 2026). Backend exposes 3 endpoints: `/health`, `/api/dashboard`, `/api/dashboard/{section}`. Statistical diagnostics notebook completed (`notebooks/diagnostico_dados.ipynb`). Next steps: fix distributor names bug in `fato_indicadores_anuais` pipeline, choropleth layer on the map, and thesis writing.

## Essential Commands

```bash
# Environment setup
make venv-recreate     # recreate .venv from scratch
make install           # pip install -r requirements.txt
make doctor            # validate .venv + critical imports

# Full pipeline (ETL -> analysis -> report -> dashboard)
make pipeline

# Individual pipeline steps
python3 -m src.etl.extract_aneel          # download raw CSVs from ANEEL
python3 -m src.etl.transform_aneel        # clean and save as Parquet/CSV
python3 -m src.analysis.build_analysis_tables  # generate analytical tables
python3 -m src.analysis.build_report      # generate markdown report
python3 -m src.analysis.build_dashboard_data   # generate dashboard JSON
python3 -m src.analysis.grupos_diagnostico     # generate group benchmarks (grupos/ CSVs)
python3 -m src.analysis.dashboard_transgressoes  # generate dashboard_transgressoes.json

# Generating dashboard data
make grupos-diagnostico    # generate data/processed/analysis/grupos/ analytics CSVs
make neoenergia-diagnostico # generate data/processed/analysis/neoenergia/ CSVs
make dashboard-full        # analysis + grupos + neoenergia + all dashboard JSONs
make clean-analysis        # remove data/processed/analysis/ outputs

# Serving the dashboard & Testing Local API
# URL Base (Local): http://localhost:8051 | URL Base (Produção Railway): https://tcc-ren1000x414-production.up.railway.app
make serve             # Frontend classico (Vanilla JS) em http://localhost:8051
make frontend-next     # Frontend Next.js em http://localhost:3051 apontando para backend local
make frontend-next-railway # Frontend Next.js em http://localhost:3051 usando Railway
make stack-next        # Backend local + frontend Next.js com um unico comando
make backend           # FastAPI backend at http://localhost:8051
make dev-serve         # Backend with --reload (also serves static files locally as a fallback)

# Tests
make test-fast         # compile + imports + schema contracts + core artifacts
make test-smoke        # full smoke (neoenergia + dashboard + full validation)
make validate-contracts  # validate raw/processed schema contracts

```

## Architecture

### Data Pipeline

```
ANEEL API (dadosabertos.aneel.gov.br)
    |
src/etl/extract_aneel.py      -> data/raw/*.csv  (NOT versioned, 7+ GB)
    |
src/etl/transform_aneel.py    -> data/processed/*.{csv,parquet}  (NOT versioned)
    |
src/analysis/build_analysis_tables.py -> data/processed/analysis/*.csv  (versioned)
    |
    +-> build_report.py           -> reports/relatorio_aneel.md
    +-> neoenergia_diagnostico.py -> data/processed/analysis/neoenergia/*.csv
    +-> grupos_diagnostico.py     -> data/processed/analysis/grupos/*.csv (13 files)
    +-> build_dashboard_data.py   -> app/frontend/dashboard_data.json
    +-> dashboard_transgressoes.py -> app/frontend/dashboard_transgressoes.json
```

### Application Stack

| Layer | Tech |
|-------|------|
| ETL/Analysis | Python 3.10+, pandas, numpy |
| Backend | FastAPI + PostgreSQL + Redis (`app/backend/main.py`) no **Railway** |
| Frontend | HTML5, Vanilla JS, Chart.js 4.4.7 (CDN), CSS pure no **Vercel** |
| Orchestration | GNU Make + Docker Compose |
| Data formats | PostgreSQL DB, Redis Cache, Parquet, JSON |

### Filosofia de Arquitetura Híbrida (Vercel x Railway x PostgreSQL x Redis)

Nossa configuração de Produção opera de maneira estritamente desacoplada e escalável:

1. **Frontend (Vercel)**: Qualquer modificação de roteamento, arquivos estáticos puros ou redirecionamentos de chamadas à API são governados unicamente pelo cliente e por seu arquivo de setup principal, **`vercel.json`**.
2. **Backend (Railway)**: Toda a inteligência da API REST está concentrada no `app/backend/main.py`.
   - Utilizamos um banco de dados **PostgreSQL** para hospedar as tabelas de análise via SQL (substituindo o antigo payload gigante em JSON estático e permitindo filtros infinitos).
   - Utilizamos um cache em memória **Redis** para servir requests repetidas de forma instantânea.
   - URL Base da API em Produção: `https://tcc-ren1000x414-production.up.railway.app`

*Nota sobre testes locais e mock:* Durante simulações de teste e desenvolvimento local da API, nós mapeamos e testamos internamente as rotas FastAPI via `make dev-serve` / `make backend` rodando em `http://localhost:8051`. No frontend Vercel (Produção), os `fetch()` para `/api/...` são implicitamente reescritos e encaminhados à nossa URL Base do Railway transparentemente por causa das regras de rewrite em `vercel.json`!

### Key Directories

- `src/etl/` — extraction and transformation scripts
- `src/analysis/` — analytical table builders, report generators
- `app/backend/main.py` — FastAPI serving static files + REST endpoints
- `app/frontend/` — SPA dashboard (6 active pages + shared JS modules)
  - Shared modules (load order): `utils.js → nav.js → filters.js → app.js → [page].js`
  - `utils.js` — formatters (fmtNum, fmtMoney, fmtMoneyFull, fmtPct, fmtVar)
  - `nav.js` — sidebar active-link, mobile toggle, toast system
  - `filters.js` — global period/porte/group state + `filters:change` event
  - `app.js` — Chart.js defaults (theme), shared constants
- `data/processed/analysis/` — versioned analytical CSVs/Parquets consumed by the app
- `docker/` — Docker Compose files (app stack, PostgreSQL, Kestra)
- `scripts/playwright/` — browser automation: `screenshot-all.js`, `check-charts.js`, `aneel-fetch.js`
- `scripts/` — utilities (PostgreSQL loader, artifact checkers, QA automation)
- `notebooks/` — Jupyter notebooks for exploratory analysis

### Frontend Data Flow

The frontend consumes static JSON files:
- `dashboard_data.json` — main payload, 27 MB (generated by `build_dashboard_data.py`)
- `dashboard_transgressoes.json` — transgressions by distributor/group/rural (generated by `dashboard_transgressoes.py`)
- `dashboard_timeseries.json` — monthly time-series for heatmap/trends (`evolucao.html`)
- `dashboard_scatter.json` — volume × compensation scatter data (`benchmark.html`)
- `dashboard_heatmap.json` — group × dimension matrix
- `dashboard_radar.json` — multi-dimensional group profiles
- `dashboard_groups_ranking.json` — top-N group ranking (`ranking.html`)

Frontend pages (all under `app/frontend/`):
- `index.html` / `app.js` — main dashboard (KPIs, trends, groups overview)
- `transgressoes.html` / `transgressoes.js` — time-series transgression analysis
- `benchmark.html` / `benchmark.js` — bubble chart: services volume × compensation by porte
- `evolucao.html` / `evolucao.js` — monthly heatmap: transgressions by holding
- `ranking.html` / `ranking.js` — horizontal bar chart: group ranking by metric
- `mapa.html` / `mapa.js` — interactive geographic map
- `relatorio.html` — print-optimized report (Ctrl+P → PDF)

The backend (`app/backend/main.py`) serves these JSON files via FastAPI endpoints and also mounts the frontend as static files.

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
- `grupos/` subdirectory (13 CSVs) — group-level analytics: annual, monthly, trends, benchmarks, data quality, outliers (generated by `grupos_diagnostico.py`)

## Critical Constraints

1. **Port 8051 for local dev and Docker** — `make serve`, `make backend`, Playwright scripts, and Docker all use port 8051. The Next.js comparison frontend uses port `3051` locally via `make frontend-next` because ports 3000/5433/6379/8000/8050/8080/8090 are occupied by other local services.
2. **Use `python3`, not `python`** — `python` binary does not exist on this machine. Makefile handles this automatically.
3. **No JS/CSS frameworks** — dashboard is pure Vanilla JS, pure CSS. No Tailwind, Bootstrap, or npm packages for the frontend. Chart.js is loaded via CDN only.
4. **Never open dashboard via `file://`** — CORS issues. Always use `make serve` or `make backend`.
5. **Do not commit raw data** — `data/raw/` and `data/processed/*.{csv,parquet}` are in `.gitignore`. Only `data/processed/analysis/` CSVs are versioned.
6. **`dashboard_data.json` is generated** — run `make dashboard` to regenerate; do not commit it.

## Conventions

### Commits (Conventional Commits in Portuguese)
```
feat: adicionar endpoint de transgressões por porte
fix: corrigir porta no Makefile para 8050
docs: atualizar README com novos gráficos
refactor: separar build_analysis_tables por fonte
chore: atualizar requirements.txt
```

### Python Scripts
- All scripts run as modules: `python3 -m src.analysis.build_report`
- Each script has `if __name__ == "__main__": main()`
- Files use `snake_case.py`
- Parquet is the preferred format for large data reading; CSV for human-readable output

### Context Files for AI Agents
After making structural changes, update these files to keep AI context current:
- `README.md` — human documentation (directory structure, outputs, workflow)
- `AGENTS.md` — AI directives, current phase, operational rules
- `CLAUDE.md` — commands, architecture, constraints (this file)
- `app/frontend/README.md` — frontend pages, shared modules, JSON data flow
- `.ai/CONTEXT.md` — AI-focused architecture overview
- `.ai/PIPELINE.md` — data pipeline details
- `.ai/CONVENTIONS.md` — coding and commit conventions
- `.ai/DASHBOARD.md` — dashboard-specific AI context
- `.ai/DATA_OVERVIEW.md` — data sources, schemas and column reference
- `docs/EXTRACAO_DADOS.md` — canonical guide for extraction + transformation (ANEEL + IBGE), URLs, periodicity, troubleshooting

## Testing

No pytest framework. Tests are Make targets:
- `make test-fast` — fast validation (imports, schema contracts, core artifacts)
- `make test-smoke` — full smoke test including neoenergia and dashboard generation
- `scripts/check_artifacts.py --profile core|full` — artifact presence check
- `scripts/smoke_imports.py` — import smoke test
- `scripts/validate_schema_contracts.py` — schema contract validation

## Docker

```bash
# Main stack (dashboard + backend), Docker uses port 8051 internally
docker compose up --build

# Kestra orchestration (data pipelines + Gemini AI flows)
docker compose -f docker/docker-compose.kestra.yml up -d
# Requires GEMINI_API_KEY in .env for AI flows
```

## AI Tooling para este Projeto

### MCP Relevante
- **context7** — busca de docs de pandas, FastAPI, Chart.js durante desenvolvimento

### Browser Automation
- Usar **playwright CLI** via Bash: `npx playwright test` ou `npx playwright codegen`
- Plugin **playwright** (Claude Code) fornece skills e agentes para automação

### MCPs Fora do Escopo
- firebase, stripe, linear, gitlab, laravel-boost, asana — não se aplicam ao stack Python/Vanilla JS

### Skills Úteis neste Projeto
- `/commit` (commit-commands) — commits convencionais em português
- `feature-dev` — ao adicionar novas páginas/análises ao dashboard
- `code-review` — antes de merges importantes
- `claude-md-management` — para manter este CLAUDE.md atualizado
- `systematic-debugging` (superpowers) — ao debugar pipeline ETL ou frontend
