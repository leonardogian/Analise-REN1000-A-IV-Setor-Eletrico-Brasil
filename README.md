# 📊 TCC — Análise ANEEL REN 1000/2021

**Eficácia da Resolução Normativa ANEEL nº 1.000/2021 na qualidade comercial das distribuidoras de energia elétrica do Brasil.**

Foco setorial em **transgressões de prazo, compensações financeiras (R$)** e normalização por UC (unidades consumidoras), com recortes por distribuidora, grupo econômico, porte, território e período regulatório.

---

<!-- TODO: Adicione badges abaixo (5-8 linhas)
   Objetivo: comunicar status, stack e link de produção rapidamente.
   Candidatos: deploy status Vercel, linguagens (Python + TypeScript), licença, link ao TCC.

   Exemplo simples (substitua as URLs reais):
   [![Deploy](https://img.shields.io/badge/frontend-Next.js_14-black?logo=vercel)](https://tcc-frontend-react.vercel.app)
   [![Backend](https://img.shields.io/badge/backend-FastAPI-009688?logo=fastapi)](https://tcc-ren1000x414-production.up.railway.app/health)
   [![Python](https://img.shields.io/badge/python-3.10+-3776AB?logo=python)](requirements.txt)
   [![TCC](https://img.shields.io/badge/TCC-ANEEL_REN_1000-orange)](https://tcc-frontend-react.vercel.app)

   Dica: menos é mais. 4 badges máximo pra não virar poluição visual.
-->

---

## 🌐 Acessar o Projeto

| Ambiente | URL | Descrição |
|----------|-----|-----------|
| **Frontend (Next.js) — Produção** | [tcc-frontend-react.vercel.app](https://tcc-frontend-react.vercel.app) | Dashboard principal, React + Tailwind |
| **Backend API — Produção** | [Railway](https://tcc-ren1000x414-production.up.railway.app/health) | FastAPI + PostgreSQL + Redis |
| **Frontend (Vanilla JS) — Legado** | [analise-ren-1000-a-iv-setor-eletric.vercel.app](https://analise-ren-1000-a-iv-setor-eletric.vercel.app) | Preservado na branch `legacy/vanilla-dashboard` |

---

## 🎯 O que é este projeto?

Quando uma distribuidora de energia atrasa um atendimento além do prazo regulado pela ANEEL, ela é obrigada a **compensar o consumidor na fatura**. Este TCC responde: **isso está acontecendo na prática? Quais grupos pagam mais? A REN 1.000/2021 mudou o comportamento?**

O projeto combina ~7 GB de dados históricos da ANEEL (2011–2025), pipeline ETL em Python, API FastAPI no Railway e frontend principal em Next.js 14 (React + Tailwind).

---

## 🚀 Como Usar Localmente

Há dois caminhos diferentes:

1. **Ver a demo com dados versionados.** Usa os CSVs analíticos e JSONs já presentes no clone. Serve para explorar o dashboard rapidamente, mas não reproduz cientificamente a base.
2. **Reproduzir do zero.** Baixa os dados brutos da ANEEL/IBGE, transforma, valida e regenera os JSONs. Este é o caminho obrigatório para conferir os números.

### VS Code Dev Container

O devcontainer oficial usa Python 3.12 em Debian Bookworm, Node 20 e Docker-in-Docker. A `.venv` dentro do container fica em um volume Docker nomeado (`tcc-ren1000-devcontainer-venv`), isolado da `.venv` do host, para que `make doctor` valide as dependências do próprio container.

No VS Code, use `Dev Containers: Rebuild and Reopen in Container`. Depois de entrar, rode:

```bash
make doctor
```

### Demo rápida — Backend + Frontend Next.js

```bash
source .venv/bin/activate   # ou: make venv-recreate && make install
make site                    # backend (8051) + Next.js (3051) com JSON atual
# Abra http://localhost:3051
```

### Reprodução científica do zero

Os dados brutos não estão no Git por tamanho. Antes de considerar a visualização válida para auditoria, rode:

```bash
make venv-recreate
make install
make doctor
make pipeline
make qa-data
make stack-next
# Abra http://localhost:3051
```

`make pipeline` executa extração, transformação, análise, geração dos JSONs e validações (`validate-contracts`, `check-artifacts-full`, `qa-data`). Em uma máquina comum, reserve ao menos 12 GB livres, conexão estável e uma janela longa de execução; o gargalo principal é baixar/descompactar e transformar o INDGER.

Guia canônico das URLs, periodicidade, diretórios e troubleshooting: [`docs/EXTRACAO_DADOS.md`](docs/EXTRACAO_DADOS.md).

O fluxograma editável do pipeline Make fica em
[`docs/mtdpipeline.excalidraw`](docs/mtdpipeline.excalidraw), como apoio visual
para explicar os targets, artefatos e validações de reprodutibilidade.

### Só o backend (API)

```bash
make backend   # FastAPI em http://localhost:8051
```

### Instalar dependências do Next.js (primeira vez)

```bash
make frontend-next-install   # npm ci em app/frontend-next/
make frontend-next           # Next.js dev em http://localhost:3051
```

---

## 🏗️ Arquitetura em Produção

```
Browser
   │  fetch() /api/...
   ▼
Vercel — Next.js 14  (tcc-frontend-react.vercel.app)
   │  rewrite transparente via next.config.mjs
   ▼
Railway — FastAPI + Docker  (tcc-ren1000x414-production.up.railway.app)
   │  queries SQL
   ▼
PostgreSQL + Redis (no Railway)
   │  carregado a partir de
   ▼
data/processed/analysis/*.csv  (versioned em Git)
```

| Camada | Tech | Por quê |
|--------|------|---------|
| ETL | Python + Pandas + Parquet | Volume 7 GB + transformações complexas |
| Backend | FastAPI + PostgreSQL + Redis | Async, cache, deploy fácil Railway |
| Frontend principal | Next.js 14 + React 18 + TanStack Query + Tailwind | SSR, cache inteligente, tipagem TS |
| Deploy | Vercel + Railway | CDN global (front) + pay-per-use (back) |

Nota operacional: o Next.js em produção depende da CSP em `app/frontend-next/vercel.json` permitir `script-src 'unsafe-inline'` para os scripts inline de boot/hydration. Quando `app/backend/main.py` ou `data/processed/dashboard/dashboard_*.json` mudarem, o Railway também precisa ser redeployado para publicar os endpoints e dados atuais.

---

## 📡 Pipeline de Dados


```
ANEEL dadosabertos.aneel.gov.br
   ↓  extract_aneel.py
data/raw/*.csv  (7+ GB — não vai pro Git)
   ↓  transform_aneel.py
data/processed/*.parquet
   ↓  build_analysis_tables.py
data/processed/analysis/*.csv  (13 tabelas — VERSIONED)
   ↓
build_dashboard_data.py → data/processed/dashboard/dashboard_*.json
build_report.py         → reports/relatorio_aneel.md
grupos_diagnostico.py   → data/processed/analysis/grupos/
```

Política de versionamento: `data/raw/` e `data/processed/` base são gerados localmente e não entram no Git. `data/processed/analysis/**/*.csv` e `data/processed/dashboard/dashboard_*.json` podem ficar versionados para auditoria/demo/deploy, mas devem ser regenerados após ETL para reprodução científica. O frontend oficial consome esses JSONs via FastAPI/rewrites do Next.js.

Comandos rápidos:

```bash
make pipeline            # extract → transform → análise → JSONs → validações
make dashboard-full      # só a camada analítica → JSONs (sem re-extrair)
make site                # backend + Next.js com JSON atual
make site-refresh        # dashboard-full + backend + Next.js
make site-railway        # Next.js local usando o backend Railway, igual à Vercel
make grupos-diagnostico  # CSVs de grupos econômicos
```

---

## 📂 Estrutura de Pastas Relevante

```
TCC_leo_main/
├── app/
│   ├── frontend-next/     ← Next.js 14 (principal)
│   │   ├── app/           ← App Router (rotas: benchmark, mapa, ranking…)
│   │   ├── components/    ← React components (KPICard, ChartCard, Sidebar…)
│   │   ├── hooks/         ← Custom hooks (useDashboardData…)
│   │   └── next.config.mjs ← Rewrites → Railway
│   └── backend/
│       └── main.py        ← FastAPI: REST + CORS
├── src/
│   ├── etl/               ← extract_aneel.py, transform_aneel.py
│   └── analysis/          ← build_analysis_tables, build_dashboard_data…
├── data/processed/analysis/ ← CSVs versionados consumidos pelo app
├── data/processed/dashboard/ ← JSONs canônicos servidos pelo backend/Next.js
├── docs/                  ← Documentação, auditorias e imagens
├── railway.toml           ← Config Docker Railway (backend)
└── Makefile               ← Todos os comandos (make help)
```

---

## 🧪 Testes e Validação

```bash
make test-fast        # 30s: imports + schema contracts + artefatos core
make test-smoke       # 5min: smoke completo (grupos + dashboard)
make validate-contracts  # valida schema raw vs processed
make qa-data          # auditoria numerica dos artefatos analiticos
```

---

## 📚 Documentação Técnica Detalhada

| Documento | Conteúdo |
|-----------|----------|
| [`CLAUDE.md`](CLAUDE.md) | Comandos, arquitetura, convenções de código (para devs e IAs) |
| [`docs/DATA_QUALITY_AUDIT.md`](docs/DATA_QUALITY_AUDIT.md) | Backlog e contrato da auditoria numerica dos dados |
| [`.ai/CONTEXT.md`](.ai/CONTEXT.md) | Visão de arquitetura para agentes IA |
| [`docs/EXTRACAO_DADOS.md`](docs/EXTRACAO_DADOS.md) | Como baixar dados do zero (URLs CKAN, periodicidade, troubleshooting) |
| [`docs/metodologia_tcc.excalidraw`](docs/metodologia_tcc.excalidraw) | Fluxograma visual da metodologia real do TCC, em blocos para banca |
| [`docs/mtdpipeline.excalidraw`](docs/mtdpipeline.excalidraw) | Fluxograma editável do pipeline Make, artefatos e validações de reprodutibilidade |
| [`app/frontend-next/README.md`](app/frontend-next/README.md) | Rotas, componentes e padrões do Next.js |
| [`AGENTS.md`](AGENTS.md) | Diretrizes operacionais para agentes IA |

---

## 📊 Fontes de Dados

| Fonte | Conteúdo | Granularidade |
|-------|----------|---------------|
| **Qualidade do Atendimento Comercial** (ANEEL) | Prazos, transgressões, compensações R$ | Anual 2011–2023 por distribuidora/serviço |
| **INDGER — Indicadores Gerenciais** (ANEEL) | Serviços comerciais mensais com volume + valor | Mensal 2023–2025 |
| **DTB 2024** (IBGE) | Divisão territorial municipal para mapa e rural/urbano | Por município |

Fonte dos dados: [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br) (portal público oficial)

---

## 🔬 Abertura, Fidelidade dos Dados e Pesquisas Futuras

Este projeto foi desenhado para ser **aberto por padrão** — tanto nos dados quanto na infraestrutura. Esta seção explica o porquê e como outros pesquisadores podem reutilizá-lo.

### Por que o projeto pode ficar público sem restrições

Todas as fontes são **dados abertos obrigatórios por lei** (Lei de Acesso à Informação + Resolução Normativa ANEEL nº 1.000/2021) e disponíveis no portal oficial [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br):

- Os indicadores são **agregados por distribuidora (pessoa jurídica), serviço ou município** — sem nenhum identificador de consumidor individual. A LGPD não se aplica, pois não há titular de dado pessoal envolvido.
- A API pública do backend serve exclusivamente leitura (`GET`) — sem endpoints de escrita, upload ou autenticação, por design: dados abertos não devem exigir login.
- Nenhum dado sintético, estimado ou preenchido artificialmente: todas as transformações são determinísticas e auditáveis via histórico `git`.

### Fidelidade e rastreabilidade da cadeia de dados

A cadeia completa é reproduzível a partir do zero com `make pipeline`:

| Etapa | Script | Saída |
|-------|--------|-------|
| Extração | `src/etl/extract_aneel.py` | `data/raw/*.csv` — CSVs brutos dos endpoints CKAN/ANEEL |
| Transformação | `src/etl/transform_aneel.py` | `data/processed/*.parquet` — Parquet tipados |
| Análise | `src/analysis/build_analysis_tables.py` | `data/processed/analysis/*.csv` — **13 tabelas versionadas no Git** |
| Validação | `scripts/validate_schema_contracts.py` | Contratos de schema contra o raw e o processado |
| Auditoria numérica | `scripts/qa_data_audit.py` | Unicidade, taxas, labels, cobertura e drift CSV/parquet |

As tabelas analíticas em `data/processed/analysis/` entram no controle de versão para permitir **auditoria independente**. Para reproduzir os dados, porém, o clone deve regenerar raw/processado base e JSONs locais com `make pipeline`. A documentação ponta-a-ponta das fontes, URLs, cadência de atualização e troubleshooting está em [`docs/EXTRACAO_DADOS.md`](docs/EXTRACAO_DADOS.md).

### Caminhos para pesquisas futuras

O pipeline foi estruturado para ser extensível. Alguns ganchos concretos:

- **Ampliar a janela temporal** — o pipeline é idempotente por ano/mês; basta rodar `make pipeline` após novas safras INDGER ou de Qualidade Comercial serem publicadas pela ANEEL.
- **Cross-análise com outras bases ANEEL** — indicadores de continuidade (DIC/FIC/DEC), tarifas, perdas não-técnicas. As dimensões `dim_distribuidora_porte.csv` e `dim_distributor_group.csv` funcionam como chave de junção.
- **Estudos longitudinais pós-REN 1.000** — ex.: análise da trajetória de compensação per capita vs. complexidade geográfica municipal com dados IBGE DTB já integrados.
- **Econometria em painel** — a separação fatos/dimensões facilita modelos com efeitos fixos por distribuidora e ano (`linearmodels`, `statsmodels`).
- **Comparação setorial** — metodologia análoga pode ser aplicada a indicadores de qualidade de outras agências regulatórias (ANATEL, ANS, ANTT).

Forks, issues e pull requests são bem-vindos. O repositório está aberto justamente para ser uma base reutilizável além do TCC original.

---

> 🤖 **Para agentes IA:** antes de qualquer mudança estrutural, leia `CLAUDE.md` e `AGENTS.md`. Rotas, portas e targets Make estão documentados lá.
