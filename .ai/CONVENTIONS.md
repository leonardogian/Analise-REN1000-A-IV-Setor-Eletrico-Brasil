# 📐 Convenções — Guia para IA

## Commits

Conventional Commits em português, mensagens curtas:

```
feat: adicionar endpoint de transgressões por porte
fix: corrigir gráfica UC para anos sem dados da ANEEL
docs: atualizar README com novos gráficos
refactor: separar build_analysis_tables por fonte
chore: atualizar requirements.txt
```

Para ajustes visuais/cosméticos do dashboard, use `ajustes finos no dashboard` (commit único, mensagem única).

## Scripts Python

- Todos em `src/etl/` e `src/analysis/`
- Executados como módulo: `python3 -m src.analysis.build_report`
- Cada script tem `if __name__ == "__main__": main()`
- Use `python3` (não `python`) — Makefile já trata via variável PYTHON

## Nomes de Arquivos

- Scripts: `snake_case.py`
- CSVs analíticos: `snake_case.csv`
- Frontend Next.js: componentes `PascalCase.tsx`, hooks `useNome.ts`
- Docs: `UPPER_CASE.md` para guias, `snake_case.md` para relatórios

## Dados

- **NÃO versionar:** `data/raw/` e `data/processed/*.csv`/`*.parquet` base (`.gitignore`)
- **SIM versionar:** `data/processed/analysis/**/*.csv` e `data/processed/dashboard/dashboard_*.json`
- **JSONs são gerados:** `make dashboard-full` ou `make pipeline` — nunca edite manualmente
- Leitura rápida: `.parquet`; debug/humano: `.csv`

## Frontend (Next.js 14)

- Em `app/frontend-next/`
- TanStack Query para fetch `/api/*`
- Recharts para gráficos, Leaflet para mapa
- Rewrites em `next.config.mjs` → Railway (prod) ou `:8051` (dev)
- **Grupo A = alta tensão; Grupo B = baixa tensão** — sempre documente em legendas/tooltips
- **UC 2025-2026 ausente:** ANEEL não publicou; gráficos que dependem de UC mostram só anos disponíveis

## Branch e Worktrees

- Branch principal: `main`
- Worktrees: `TCC_leo_main` (desenvolvimento) + `TCC_leo_db_backend_spike` (main)
- Push para `origin/main` dispara deploy Vercel automático

## Deploy

- **Vercel:** `tcc-frontend-react` → auto-deploy de `main`. CSP com `unsafe-inline`.
- **Railway:** `tcc-ren1000x414-production.up.railway.app` → redeploy manual após mudanças em `app/backend/` ou JSONs.
- **Local:** `make stack-next` (backend + frontend) ou `API_REWRITE_URL=http://localhost:8051 npm run dev`

## ⛔ Não Fazer

1. **Nunca** alterar porta 8051/3051 sem verificar portas livres
2. **Nunca** usar `python` — usar `python3` ou `make`
3. **Nunca** commitar dados brutos (`data/raw/`)
4. **Nunca** editar `dashboard_*.json` manualmente — regenere
5. **Nunca** criar `.py` fora de `app/backend/` na raiz (conflita Vercel)
6. **Nunca** rodar `npm run build` enquanto `npm run dev` está ativo (corrompe `.next/`)
7. **Nunca** servir frontend por `file://` — use `make stack-next`

## Testes

Sem pytest. Testes são Make targets:

```bash
make test-fast          # imports + schema + artefatos core
make test-smoke         # grupos + dashboard + validação completa
make validate-contracts # schema contracts raw + processed
make qa-data            # auditoria numérica
scripts/check_artifacts.py --profile core|full  # presença de artefatos
```
