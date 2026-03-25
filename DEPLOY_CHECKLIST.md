# Deploy Checklist — TCC REN 1.000/2021 Dashboard

**Date:** 2026-03-21
**Stack:** Vercel (frontend) + Railway (backend: FastAPI + PostgreSQL + Redis)
**Railway URL:** `https://tcc-ren1000x414-production.up.railway.app`

---

## 1. Pre-Deploy — Data Pipeline

- [ ] Raw data is up to date (`make extract` ran successfully against ANEEL API)
- [ ] Transform step completed without errors (`make transform`)
- [ ] Analytical tables regenerated (`make analysis`)
- [ ] Group diagnostics regenerated (`make grupos-diagnostico`)
- [ ] Dashboard JSONs regenerated (`make dashboard-full`)
- [ ] Schema contracts pass (`make validate-contracts`)
- [ ] `dashboard_data.json` is NOT committed (it's generated at build time via `railway-start.sh`)

## 2. Pre-Deploy — Code Quality

- [ ] `make test-fast` passes (imports + schema contracts + core artifacts)
- [ ] `make test-smoke` passes (full smoke including neoenergia + dashboard)
- [ ] No hardcoded `localhost:8051` URLs in frontend JS (all `/api/` calls should be relative)
- [ ] `vercel.json` rewrites point to correct Railway production URL
- [ ] `CSP` header in `vercel.json` includes all required CDN domains (jsdelivr, unpkg, carto, openstreetmap)
- [ ] No secrets or API keys in committed files (check `.env` is in `.gitignore`)
- [ ] `requirements.txt` is up to date with all Python dependencies

## 3. Pre-Deploy — Railway Backend

- [ ] `docker/Dockerfile.backend` builds locally: `docker build -f docker/Dockerfile.backend .`
- [ ] `railway.toml` healthcheck path is `/health` and timeout is adequate (currently 60s)
- [ ] `railway-start.sh` fallback JSON generation works (removes dependency on pre-built JSON)
- [ ] Environment variables set on Railway:
  - [ ] `DATABASE_URL` (PostgreSQL connection string)
  - [ ] `REDIS_URL` (Redis connection string)
  - [ ] `PORT` (Railway sets this automatically, default 8051)
  - [ ] `SERVE_STATIC=true` (set in Dockerfile ENV)
- [ ] PostgreSQL tables loaded with latest analytical CSVs (`data/processed/analysis/`)
- [ ] Redis is reachable from Railway backend

## 4. Pre-Deploy — Vercel Frontend

- [ ] `vercel.json` → `outputDirectory` is `app/frontend`
- [ ] All 6 dashboard pages present: `index.html`, `transgressoes.html`, `benchmark.html`, `evolucao.html`, `ranking.html`, `mapa.html`
- [ ] Shared JS load order correct: `utils.js → nav.js → filters.js → app.js → [page].js`
- [ ] Chart.js CDN version pinned at 4.4.7 (not `latest`)
- [ ] No `file://` references anywhere in frontend code
- [ ] Security headers configured (X-Content-Type-Options, X-Frame-Options, CSP, etc.)
- [ ] JSON cache headers set (`Cache-Control: public, max-age=3600, s-maxage=86400`)

## 5. Deploy — Railway (Backend First)

- [ ] Push to main / trigger Railway deploy
- [ ] Wait for build to complete (Docker image builds ~2-3 min)
- [ ] Healthcheck passes: `curl https://tcc-ren1000x414-production.up.railway.app/health`
- [ ] Test key API endpoints:
  - [ ] `GET /api/dashboard-data` returns valid JSON
  - [ ] `GET /api/transgressoes` returns data
  - [ ] `GET /api/grupos/ranking` returns group data
- [ ] Check Railway logs for startup errors or DB connection failures
- [ ] Verify Redis cache is warming up (first requests may be slower)

## 6. Deploy — Vercel (Frontend Second)

- [ ] Push to main / trigger Vercel deploy
- [ ] Verify Vercel build succeeds (no build command needed, just static files)
- [ ] Test rewrite rules: frontend `/api/*` calls route to Railway backend
- [ ] Open each page and verify charts render:
  - [ ] `index.html` — KPIs, annual trends, group overview
  - [ ] `transgressoes.html` — time-series charts load
  - [ ] `benchmark.html` — bubble chart renders
  - [ ] `evolucao.html` — heatmap renders
  - [ ] `ranking.html` — horizontal bar chart renders
  - [ ] `mapa.html` — map tiles load, markers appear

## 7. Post-Deploy Verification

- [ ] No CORS errors in browser console (Railway allows Vercel origin)
- [ ] No mixed-content warnings (all HTTPS)
- [ ] `relatorio.html` print-to-PDF works (Ctrl+P)
- [ ] Mobile sidebar toggle works on all pages
- [ ] Filters (period/porte/group) trigger `filters:change` events and update charts
- [ ] Response times acceptable (< 2s for main dashboard load)

## 8. Rollback Plan

| Trigger | Action |
|---------|--------|
| Railway `/health` returns non-200 | Redeploy previous Railway commit |
| API returns 500 errors | Check Railway logs → DB connection → Redis connection |
| Frontend shows blank charts | Verify `dashboard_data.json` generation in Railway logs |
| CORS errors on Vercel | Check `vercel.json` rewrite URLs match Railway domain |
| PostgreSQL connection refused | Verify `DATABASE_URL` env var on Railway |

**Railway rollback:** Railway dashboard → Deployments → click previous successful deploy → Redeploy
**Vercel rollback:** Vercel dashboard → Deployments → promote previous deployment to production

## 9. Maintenance Notes

- ANEEL data updates: re-run `make pipeline` to refresh all downstream artifacts
- After adding new frontend pages: update `vercel.json` CSP if new CDNs are needed
- After schema changes in analytical CSVs: update `REQUIRED_JSON_KEYS` in `main.py` and run `make validate-contracts`
- PostgreSQL table reloads: use loader scripts in `scripts/` directory
