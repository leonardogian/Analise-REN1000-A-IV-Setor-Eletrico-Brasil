# Deploy Checklist — TCC REN 1.000/2021

**Stack oficial:** Vercel (`app/frontend-next`) + Railway (`app/backend`)  
**Frontend:** `https://tcc-frontend-react.vercel.app`  
**Backend:** `https://tcc-ren1000x414-production.up.railway.app`

Este checklist cobre o deploy atual do projeto. O dashboard Vanilla ficou legado
na branch `legacy/vanilla-dashboard`; não use o diretório legado do Vanilla,
páginas `.html` ou `vercel.json` da raiz como referência para o deploy oficial.

## 1. Dados e Validação

- [ ] Rodar `make dashboard-full` quando a mudança depender apenas de artefatos analíticos já processados.
- [ ] Rodar `make pipeline` quando for necessário reproduzir desde a extração ANEEL/IBGE.
- [ ] Rodar `make validate-contracts-processed` para validar contratos processados quando não houver raw local completo.
- [ ] Rodar `make check-artifacts-full` para confirmar todos os CSVs/JSONs canônicos.
- [ ] Rodar `make qa-data` e revisar erros/alertas.
- [ ] Confirmar que as tabelas mensais de transgressão cobrem ao menos `2023-01` a `2025-12` e que eventuais meses posteriores são contíguos.
- [ ] Confirmar que `data/processed/dashboard/dashboard_timeseries.json` inclui `2025-12`.

## 2. Código

- [ ] Rodar `make test-fast`.
- [ ] Se o frontend mudou, rodar `make frontend-next-build`.
- [ ] Verificar que o frontend usa chamadas relativas (`/api/*` e `/dashboard_*.json`), sem URL `localhost` hardcoded.
- [ ] Conferir que `app/frontend-next/vercel.json` mantém `script-src 'unsafe-inline'` na CSP.
- [ ] Conferir que nenhum segredo foi adicionado ao Git (`.env`, `.env.local` e variantes seguem ignorados).

## 3. Railway Backend

- [ ] `railway.toml` usa `docker/Dockerfile.backend`.
- [ ] `docker/railway-start.sh` continua sendo o start command.
- [ ] `/health` responde e expõe `dashboard_artifacts_ready`, `database_connected` e `redis_connected`.
- [ ] Postgres/Redis indisponíveis aparecem como modo degradado, sem impedir entrega dos JSONs.
- [ ] Testar endpoints principais:
  - [ ] `GET /health`
  - [ ] `GET /api/dashboard`
  - [ ] `GET /api/dashboard/kpi_overview`
  - [ ] `GET /api/v1/timeseries-tendencia`
  - [ ] `GET /api/v1/scatter-eficiencia`
  - [ ] `GET /api/v1/heatmap-transgressoes`
  - [ ] `GET /api/v1/groups-ranking`
  - [ ] `GET /api/v1/transgressoes`
  - [ ] `GET /dashboard_data.json`

## 4. Vercel Frontend Oficial

- [ ] Projeto Vercel: `tcc-frontend-react`.
- [ ] Production branch: `main`.
- [ ] Root Directory: `app/frontend-next`.
- [ ] Install Command: `npm install` ou `npm ci`, conforme configuração do projeto.
- [ ] Build Command: `npm run build`.
- [ ] Env production: `API_REWRITE_URL=https://tcc-ren1000x414-production.up.railway.app`.
- [ ] `app/frontend-next/next.config.mjs` mantém rewrites para `/api/*` e `/dashboard_*.json`.
- [ ] `app/frontend-next/vercel.json` define apenas headers/security policy; rewrites ficam no Next config.

## 5. Ordem de Deploy

1. Publicar/redeployar Railway primeiro quando houver mudança em `app/backend/**` ou `data/processed/dashboard/dashboard_*.json`.
2. Confirmar `/health` e endpoints `/api/v1/*` no Railway.
3. Publicar/rebuildar Vercel depois.
4. Abrir `https://tcc-frontend-react.vercel.app` e conferir as rotas:
   - [ ] `/`
   - [ ] `/transgressoes`
   - [ ] `/benchmark`
   - [ ] `/evolucao`
   - [ ] `/ranking`
   - [ ] `/mapa`

## 6. Pós-Deploy

- [ ] Console do navegador sem erros de CORS/CSP.
- [ ] Home sai de skeleton/loading e renderiza KPIs.
- [ ] `/evolucao` mostra série mensal completa, não apenas janeiro por ano.
- [ ] `/ranking` e `/transgressoes` carregam dados dos endpoints `/api/v1/*`.
- [ ] `/mapa` carrega tiles e dados geográficos sem quebrar a página.
- [ ] Se `dashboard_*.json` mudou, confirmar que o Railway está servindo o `meta.generated_at` esperado.

## 7. Rollback

| Falha | Ação |
|---|---|
| Railway `/health` falha | Ver logs Railway e redeployar commit anterior se necessário |
| JSONs ausentes ou antigos | Redeployar Railway com os artefatos versionados atuais |
| Frontend preso em skeleton | Conferir backend, rewrites e CSP `unsafe-inline` |
| CORS/CSP no navegador | Verificar `app/backend/main.py` e `app/frontend-next/vercel.json` |
| Build Vercel falha | Rodar `make frontend-next-build` localmente e comparar logs |
