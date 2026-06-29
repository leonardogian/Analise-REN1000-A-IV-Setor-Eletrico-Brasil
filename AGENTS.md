# AI Agent Guidelines — TCC REN 1000/2021 ANEEL

> **⚠️ IAs:** Leia `CLAUDE.md` (comandos, arquitetura, constraints) e `.ai/` (`CONTEXT.md`, `CONVENTIONS.md`) antes de atuar. Frontend: `app/frontend-next/README.md`.

## 🎯 Estado Atual (2026-06-29)

- **ETL/pipeline:** Completo e validado. `make pipeline` gera artefatos confiáveis.
- **Backend:** FastAPI em `app/backend/main.py`, roda local em `:8051`, deploy no Railway. Endpoints v1 servem JSONs canônicos; v2 usa PostgreSQL quando disponível (degradável).
- **Frontend oficial:** Next.js 14 em `app/frontend-next/` → deploy Vercel (`tcc-frontend-react`).
- **Branch ativa:** `main` recebe pushes diretos. Worktrees: `TCC_leo_main` (desenvolvimento) + `TCC_leo_db_backend_spike` (worktree `main`).
- **Dados UC:** ANEEL não publicou `uc_ativa_mes` para 2025-2026. Gráficos que dependem de UC mostram apenas anos com dados. Isso é um contrato, não um bug.

## 🔄 Rotina Obrigatória

1. `git log -n 5 --stat` + `git status` — oriente-se.
2. Leia arquivos recém-modificados e relacionados ao domínio.
3. Após mudanças estruturais, atualize: `README.md`, `AGENTS.md`, `CLAUDE.md`, `.ai/CONTEXT.md`, `app/frontend-next/README.md`.

## 🛑 Escopo e Limites

- **Domínio:** Regulação ANEEL REN 1000/2021 — transgressões, compensações, UCs.
- **Backend exclusivo em `app/backend/`** — nenhum `.py` solto na raiz ou fora desse diretório (conflita com build Vercel).
- **JSONs canônicos:** Gerados por `make dashboard-full` ou `make pipeline`. Nunca edite manualmente.
- **Grupo A/B:** São classes tarifárias ANEEL (alta/baixa tensão), **não** holdings. Documento isso em legendas e tooltips.

## 💾 Dados e Portas

- **Portas:** Backend `:8051`, Frontend Next `:3051`. Porta 3000 está ocupada.
- **Dados prontos:** `data/processed/analysis/` (CSVs versionados), `data/processed/dashboard/` (JSONs canônicos).
- **Mensalidade INDGER:** Base `2023-01` a `2025-12`, aceita meses posteriores contíguos.
- **Rewrites:** `next.config.mjs` → `/api/*` e `/dashboard_*.json` → Railway (prod) ou `localhost:8051` (dev com `API_REWRITE_URL`).

## Convenções de Commit

Conventional Commits em português, mensagens curtas:
```
fix: corrigir gráfico UC Média para anos sem dados
feat: adicionar endpoint de transgressões por porte
docs: atualizar README com novos gráficos
```

Para ajustes visuais/cosméticos do dashboard, use `ajustes finos no dashboard` (mensagem única, commit único).

## Deploy

- **Vercel (tcc-frontend-react):** Auto-deploy de pushes em `main`. CSP deve manter `script-src 'unsafe-inline'`.
- **Railway (tcc-ren1000x414):** Serve backend + JSONs. Mudanças em `app/backend/` ou `data/processed/dashboard/` exigem redeploy.
- **Sincronização:** Push para `origin/main` dispara o deploy Vercel. Railway redeploy via `railway redeploy --from-source`.
