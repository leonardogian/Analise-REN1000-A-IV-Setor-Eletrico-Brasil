# 🤖 AI Context — TCC ANEEL REN 1000/2021

## Projeto

TCC analisando a eficácia da Resolução Normativa ANEEL nº 1.000/2021 sobre qualidade dos serviços comerciais das distribuidoras de energia do Brasil. Foco: transgressões de prazo, compensações financeiras (R$), e normalização por UC (unidades consumidoras), com recortes por distribuidora, grupo econômico, porte, território e período regulatório.

## Stack

| Camada | Tecnologia |
|--------|------------|
| ETL | Python 3.10+, pandas, numpy |
| Backend | FastAPI no Railway, JSONs canônicos, PostgreSQL/Redis degradáveis |
| Frontend | Next.js 14, React, Tailwind, TanStack Query (Vercel) |
| Build | GNU Make + Docker Compose |
| Dados | JSON canônico, PostgreSQL (opcional), Parquet |

## Fase Atual (2026-06-29)

- ETL e pipeline completos e validados (`make pipeline`).
- Backend FastAPI operacional no Railway com endpoints v1 (JSONs) e v2 (PostgreSQL fallback).
- Frontend oficial Next.js no Vercel (`tcc-frontend-react`).
- Gráficos inferiores da Home consomem `/api/v2/home-service-types` (CSV fallback com zeros preservados).
- **Dados UC:** ANEEL não publicou `uc_ativa_mes` para 2025-2026. Gráficos de UC mostram só anos com dados (2023-2024).
- **Grupo A** = tarifa alta tensão; **Grupo B** = tarifa baixa tensão. Não confundir com holdings.

## Arquitetura de Dados

```
ANEEL/IBGE → ETL → data/processed/*.csv
         → src/analysis/ → data/processed/analysis/*.csv (versioned)
                        → data/processed/dashboard/dashboard_*.json (canônico)
         → app/backend/main.py → Railway
         → next.config.mjs rewrites → Vercel
```

## Portas

| Porta | Serviço |
|-------|---------|
| 3051 | Frontend Next.js (dev) |
| 8051 | Backend FastAPI (dev) |
| 3000 | Ocupada (outro projeto) |
| 5433 | PostgreSQL (outro projeto) |

## Convenções Importantes

- **`python3`** (não `python`)
- **Commits curtos** em português (conventional commits)
- **JSONs regenerados:** `make dashboard-full`, nunca editar manualmente
- **Nenhum `.py` fora de `app/backend/`** na raiz (conflita Vercel)
- **CSP:** `vercel.json` mantém `script-src 'unsafe-inline'`

## Links

- Dashboard: https://tcc-frontend-react.vercel.app
- Backend: https://tcc-ren1000x414-production.up.railway.app
- `.ai/CONVENTIONS.md` — convenções de código e commits
- `app/frontend-next/README.md` — docs do dashboard frontend
- `docs/Fluxogramas_v2/` — fluxogramas acadêmicos do Capítulo 3
- `docs/mtdpipeline.excalidraw` — fluxograma do pipeline Make
- `reports/tcc_claims_audit.md` — auditoria de afirmações numéricas
