# 🤖 AI Context — TCC Análise REN 1000/2021 ANEEL

> Este arquivo é para agentes de IA que precisam entender o repositório e
> continuar trabalhando nele. Não é um README para humanos — veja `README.md`.

## O que é este projeto?

Trabalho de Conclusão de Curso (TCC) que analisa a eficácia da **Resolução
Normativa nº 1.000/2021 da ANEEL** na qualidade dos serviços comerciais das
distribuidoras de energia elétrica do Brasil. Foco especial nas **5 distribuidoras
do grupo Neoenergia** (Brasília, Coelba, Cosern, Elektro, Pernambuco).

> **🎯 Fase Atual do Projeto:** ETL e backend estão operacionais; o frontend oficial é o Next.js/React em `app/frontend-next/` (`tcc-frontend-react` na Vercel). O Vanilla foi movido para a branch `legacy/vanilla-dashboard`. A rodada atual adicionou auditoria numérica (`make qa-data`), removeu targets locais do legado no Makefile e consolidou os JSONs canônicos em `data/processed/dashboard/`.

> **🔄 ROTINA OBRIGATÓRIA PARA IAs:**
>
> 1. Inicie lendo os commits recentes (`git log -n 5 --stat`).
> 2. Leia de certa em certa quantidade os arquivos recém-commitados e seus relacionados de negócio para formar base sólida antes de alterar qualquer código.
> 3. Ao finalizar, **sempre retroalimente o repositório** ajustando `README.md`, `AGENTS.md` e este `CONTEXT.md` para refletir as últimas mudanças estruturais para futuras conversas de IA.

## Linguagens e Tecnologias

| Camada        | Stack                                          |
|---------------|-------------------------------------------------|
| ETL           | Python 3.10+, pandas, numpy, requests           |
| Análise       | Python, pandas, numpy                            |
| Backend Cloud | FastAPI, PostgreSQL, Redis (no Railway)          |
| Dashboard     | Next.js 14, React, Tailwind, TanStack Query (Vercel) |
| Relatório     | HTML print-optimized (Ctrl+P → PDF)              |
| Build         | GNU Make                                         |
| Dados         | PostgreSQL DB, Redis Cache, Parquet              |
| Versionamento | Git (branch: main)                               |

> **Frontend oficial:** o Next.js (`app/frontend-next/`) roda na porta `3051` via `make frontend-next` ou `make stack-next`. Em produção, `app/frontend-next/vercel.json` deve manter `script-src 'unsafe-inline'` na CSP para o boot/hydration do App Router. A porta `8051` é do backend FastAPI local (`make backend`/`make dev-serve`).
> Na home, os cards pré-REN do topo permanecem no agregado histórico `kpi_overview`; os cards pós-REN e deltas do topo são calculados como visão Brasil fixa sobre `serie_mensal_nacional` na janela operacional 2023–2025. Os filtros de empresas continuam restritos aos gráficos e cards inferiores.

## Estrutura do Repositório

```
TCC_leo_main/
├── .ai/                  ← VOCÊ ESTÁ AQUI (contexto para IAs)
│   ├── CONTEXT.md        ← Visão geral (este arquivo)
│   ├── PIPELINE.md       ← Como funciona o pipeline de dados
│   ├── DASHBOARD.md      ← Como subir/modificar o dashboard
│   └── CONVENTIONS.md    ← Convenções de código e commits
│
├── src/
│   ├── etl/
│   │   ├── extract_aneel.py       ← Baixa CSVs de dadosabertos.aneel.gov.br
│   │   └── transform_aneel.py     ← Limpa e normaliza → data/processed/
│   ├── analysis/
│       ├── build_analysis_tables.py  ← Gera tabelas analíticas em CSV/Parquet
│       ├── build_report.py           ← Gera relatório markdown
│       ├── neoenergia_diagnostico.py ← Benchmark detalhado 5 Neoenergias
│       └── build_dashboard_data.py   ← Gera data/processed/dashboard/dashboard_data.json
│   └── backend/
│       └── main.py                  ← Backend local (API + JSONs publicos)
│
├── app/
│   ├── frontend-next/        ← Dashboard oficial Next.js/React
│   └── backend/main.py       ← FastAPI: endpoints REST + JSONs publicos
│
├── data/
│   ├── raw/                  ← CSVs brutos da ANEEL (não versionados)
│   └── processed/
│       ├── *.csv / *.parquet ← Dados limpos (não versionados)
│       ├── analysis/         ← Tabelas analíticas versionadas no Git
│           ├── kpi_regulatorio_anual.csv
│           ├── fato_transgressao_mensal_distribuidora.csv
│           ├── fato_indicadores_anuais.csv
│           └── neoenergia/   ← CSVs específicos do grupo Neoenergia
│       └── dashboard/        ← JSONs canônicos consumidos pelo backend/Next.js
│
├── reports/                  ← Relatórios gerados (markdown)
├── docs/                     ← Documentação auxiliar + imagens
├── logos/                    ← Logos PNG de holdings
├── docker/                   ← Dockerfile/Compose do backend e stacks opcionais
├── scripts/                  ← Utilitários (cargas PostgreSQL, QA, validações)
├── Makefile                  ← Orquestração: make pipeline, make stack-next, etc.
├── requirements.txt          ← Dependências Python
└── README.md                 ← Documentação principal para humanos
```

## Comandos Essenciais (Makefile)

```bash
# Setup inicial
make venv            # cria .venv
make install         # pip install -r requirements.txt

# Pipeline completo (ETL → análise → relatório → dashboard)
make pipeline

# Passos individuais
make extract         # baixa dados ANEEL
make transform       # limpa e transforma
make analysis        # gera tabelas analíticas
make report          # gera relatório markdown
make dashboard       # gera dashboard_data.json
make dashboard-full  # analysis + report + grupos + neoenergia + dashboard

# Aplicação local
make site            # backend + Next.js com JSON atual
make site-refresh    # regenera dashboard + backend + Next.js
make site-railway    # Next.js local usando Railway, igual à Vercel
make backend         # FastAPI em http://localhost:8051
make dev-serve       # dashboard-full + preflight + backend (--reload)
make frontend-next   # frontend Next.js em http://localhost:3051 usando API local
make stack-next      # backend local + frontend Next.js juntos

# Testes
make validate-contracts  # valida contratos de schema (raw + processed)
make test-fast           # compilação + imports + contratos + artefatos core
make test-smoke          # análise + neoenergia + dashboard + validação completa
make check-artifacts     # verifica artefatos core
make check-artifacts-full # verifica artefatos completos + dashboard_data.json
make qa-data             # auditoria numérica read-only dos artefatos

# Limpeza
make clean-analysis  # remove data/processed/analysis/
```

## Portas Ocupadas na Máquina

| Porta | Serviço                    | Conflito? |
|-------|----------------------------|-----------|
| 3000  | AgentCycle Frontend        | ⚠️ Ocupada |
| 3051  | Frontend Next.js do TCC    | ✅ Local dev |
| 5433  | PostgreSQL (AgentCycle)    | ⚠️ Ocupada |
| 6379  | Redis (AgentCycle)         | ⚠️ Ocupada |
| 8000  | AgentCycle Backend         | ⚠️ Ocupada |
| 8051  | **TCC Backend FastAPI** | ✅ Local dev |
| 8080  | Airflow Webserver / Kestra | ⚠️ Ocupada |
| 8090  | Kestra (Alternativa)       | ⚠️ Ocupada |

> Dev local e Docker do TCC: porta **8051**. Não usar 8000 para o dashboard.

## Arquivos Gerados e Política de Versionamento

Estes arquivos são gerados por scripts:

- `data/raw/*.csv` — dados brutos da ANEEL
- `data/processed/*.csv` e `*.parquet` — dados transformados
- `.venv/` — ambiente virtual Python

`data/raw/` e `data/processed/` base não são versionados. `data/processed/analysis/**/*.csv` e `data/processed/dashboard/dashboard_*.json` podem estar no Git para auditoria/demo/deploy, mas devem ser regenerados com `make pipeline` para reprodução científica. O frontend oficial consome os JSONs via FastAPI/rewrites do Next.js.

## Venv (Ambiente Virtual)

```bash
# Ativar
source .venv/bin/activate

# Instalar dependências
pip install -r requirements.txt

# NOTA: Na máquina do usuário, `python` não existe, use `python3`
# O Makefile já trata isso automaticamente via a variável PYTHON
```

## Links Importantes

- **Visão Completa dos Dados**: `.ai/DATA_OVERVIEW.md` ← **SEMPRE ler antes de qualquer análise**
- **README humano**: `README.md`
- **Dashboard docs**: `app/frontend-next/README.md`
- **Guia de análise**: `docs/GUIA_ANALISE.md`
- **Próximos passos TCC**: `docs/PROXIMOS_PASSOS_TCC.md`
- **Relatório Neoenergia**: `reports/neoenergia_diagnostico.md`
- **Como usar Git**: `COMO_USAR_GIT.md`
- **Auditoria de qualidade dos dados**: `docs/DATA_QUALITY_AUDIT.md`

## Bugs Conhecidos no Pipeline

1. **Identidade de distribuidoras**: `distributor_id` não deve colapsar CNPJs/siglas distintos; aliases ficam em `distributor_alias_of` e agregação por holding usa `group_id`.
2. **Ano 2023 com volume menor que 2022**: manter ressalva metodológica e validar com `make qa-data`.
3. **Linhas brutas com transgressões acima do total de serviços**: taxa derivada é limitada a 100% e o auditor registra alerta para revisão.
