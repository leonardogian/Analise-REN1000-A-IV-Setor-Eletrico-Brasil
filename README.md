# 📊 Análise ANEEL REN 1000/2021: Dashboard Interativo de Transgressões Regulatórias

## 🎯 O que é este projeto?

Este é um **TCC (Trabalho de Conclusão de Curso)** que analisa a eficácia da Normativa ANEEL nº 1.000/2021 (REN 1000) sobre a qualidade comercial de distribuidoras de energia no Brasil. 

Em prático: **Quando uma distribuidora erra em atender você dentro do prazo regulado, ela tem que te compensar na fatura.** Este projeto mede se essa compensação está realmente acontecendo e qual é o padrão por holding (Neoenergia, CPFL, Equatorial, etc.).

---

## 🚀 O que tem de novo (Frontend Next.js 14 + Modernização)

A branch **`frontend-react`** entrega uma transformação completa do dashboard:

- ✨ **Frontend moderno em Next.js 14**: páginas `benchmark`, `mapa`, `ranking` e `transgressoes` totalmente refatoradas em `app/frontend-next/`
- ⚡ **React Query (TanStack)**: carregamento eficiente de dados com cache automático e sincronização em tempo real
- 🎨 **Design responsivo com Tailwind CSS**: layouts que funcionam em desktop, tablet e mobile
- 📡 **API REST integrada**: consumo de dados do backend FastAPI local em `http://localhost:8051/api/dashboard`
- 📊 **Dados sempre frescos**: JSON atualizados automaticamente do pipeline analítico

---

## 🧭 Começando (Guia Rápido)

### Opção 1: Explorar o Dashboard Classicamente (Vanilla JS + Chart.js)

Se quer ver rápido como ficou, com o mínimo de dependências:

```bash
# 1. Certifique-se de estar na branch frontend-react
git checkout frontend-react

# 2. Ative o ambiente Python e rode o backend
source .venv/bin/activate
make dev-serve
```

Pronto! Abra `http://localhost:8051` no navegador.

### Opção 2: Testar o Novo Frontend (Next.js 14)

Se prefere ver a versão moderna com React e Tailwind:

```bash
# 1. Inicie o backend em um terminal
make backend

# 2. Em outro terminal, rode o Next.js
make frontend-next
```

Acesse `http://localhost:3051`.

### Opção 3: Stack Completo (Backend + Next.js Integrado)

Para simular o ambiente de produção localmente:

```bash
make stack-next
```

Automaticamente: backend (8051) + frontend Next.js (3051) juntos.

---

## 📚 Curiosidades do Projeto

### 💡 O que você vai descobrir analisando os dados

1. **Qual holding paga mais compensação por transgressão?** (spoiler: varia MUITO por tipo de serviço)
2. **As compensações aumentaram desde 2022** (quando a REN 1000 entrou em vigor)?
3. **Distribuidoras grandes cometem menos transgressões que as pequenas?** (a resposta não é óbvia)
4. **Qual é o município que mais sofre atrasos de ativação?** (mapa geografico mostra!)
5. **Qual período do ano tem mais transgressões?** (seasonal patterns aparece na heatmap)

### 🏗️ Stack Técnico: Por que essas tecnologias?

| Camada | Tech | Por quê |
|--------|------|---------|
| **Dados** | Python + Pandas + Parquet | Volume grande + transformações complexas + performance |
| **Backend** | FastAPI + PostgreSQL + Redis | Escalabilidade, async, cache, deploy rápido no Railway |
| **Frontend (v1)** | Vanilla JS + Chart.js 4.4.7 | Sem dependências npm, 0 transpile, direto no CDN |
| **Frontend (v2)** | Next.js 14 + React 19 + TanStack Query | SSR, componentes reutilizáveis, cache inteligente, tipagem TypeScript |
| **Deploy** | Vercel + Railway | Vercel para frontend estático (CDN global), Railway para API (paga apenas uso) |

---

## 🚀 Pipeline Completo: Da Fonte Até o Dashboard

```
ANEEL dadosabertos.aneel.gov.br (portal público)
         ↓
extract_aneel.py (download automático)
         ↓
data/raw/*.csv (7+ GB, não vai pra Git)
         ↓
transform_aneel.py (limpeza, tipagem, validação)
         ↓
data/processed/*.parquet (versioned analytics layer)
         ↓
build_analysis_tables.py (agrega por distribuidora/porte/período)
         ↓
data/processed/analysis/*.csv (13 tabelas dimensionais + facts)
         ↓
build_dashboard_data.py (converte pra JSON)
         ↓
app/frontend/dashboard_data.json (27 MB)
         ↓
Frontend consome via REST API (/api/dashboard) ou arquivo estático
         ↓
Chart.js / Recharts renderizam no navegador
         ↓
Dashboard interativo com filtros, zoom, hover info
```

**Tempo de pipeline:** ~5-10 min (extract) + ~2-3 min (transform) + ~1-2 min (análise). 

---

## 📊 Páginas do Dashboard e o que Cada Uma Conta

| Página | Pergunta que Responde | Tech |
|--------|------------------------|------|
| **Dashboard (Home)** | Como está a saúde regulatória do setor em 2025? | KPIs + Line chart de tendência |
| **Transgressões** | Qual é a série temporal de transgressões por holding? | Time-series com zoom/pan |
| **Benchmark** | Distribuidoras grandes transgridem menos que as pequenas? | Scatter: Volume UC × Compensação R$ |
| **Evolução** | Tem sazonalidade nas transgressões (verão vs inverno)? | Heatmap: mês × holding |
| **Ranking** | Qual holding é mais "delinquente" em cada métrica? | Horizontal bar chart |
| **Mapa** | Onde geograficamente tem mais transgressões? | Choropleth por estado + pins de distribuidoras |
| **Relatório** | Resumo executivo para imprimir/PDF | Print-friendly HTML |

---

## 🔧 Configurando o Ambiente (Detalhado)

## 📷 Prints e evidências de funcionamento

Os screenshots já existentes para o dashboard estão em `docs/images/` e conferem as páginas principais:

- `docs/images/dashboard_visao_geral.png`
- `docs/images/dashboard_transgressoes.png`
- `docs/images/dashboard_benchmark.png`
- `docs/images/dashboard_evolucao.png`
- `docs/images/dashboard_ranking.png`
- `docs/images/dashboard_mapa.png`

### Páginas principais do novo frontend

| Página | O que mostra | Screenshot |
|---|---|---|
| `benchmark` | Benchmark de serviços por porte e compensação | `docs/images/dashboard_benchmark.png` |
| `transgressoes` | Séries temporais de transgressão e compensação | `docs/images/dashboard_transgressoes.png` |
| `ranking` | Ranking de grupos econômicos por métrica | `docs/images/dashboard_ranking.png` |
| `mapa` | Mapa geográfico interativo com distribuidoras | `docs/images/dashboard_mapa.png` |
| `evolucao` | Heatmap mensal de transgressões | `docs/images/dashboard_evolucao.png` |
| `index` | Visão geral de KPIs e tendências | `docs/images/dashboard_visao_geral.png` |

## 📈 Análises mais atualizadas nesta branch

### Conteúdo de dados atualizado

Nesta branch, os dados e scripts estão alinhados com as últimas análises de transgressões e compensações:

- `data/processed/analysis/` contém CSVs atualizados usados para gerar os dashboards
- `src/analysis/build_analysis_tables.py` e `src/analysis/build_dashboard_data.py` foram revisados para a nova lógica de consumo
- `reports/neoenergia_diagnostico.md` reflete a análise mais recente do grupo Neoenergia

### Temas de análise prioritários

- evolução de transgressões em `2023-2025`
- comparação entre grupos econômicos e holdings
- normalização por UC ativa para avaliar R$/UC-mês
- análise de benchmark por porte de distribuidora
- identificação de padrões regionais no mapa geográfico

## 🧠 Nota de implementação

Esta branch é voltada para a evolução do dashboard visual e para a migração de conteúdo estático para um frontend Next.js com rotas modernas.

Use este README como guia principal para entender o novo fluxo de desenvolvimento e testar localmente a interface.

## ✅ Commit desta branch

Este arquivo foi criado e será commitado na branch `frontend-react` como documentação da implementação e dos recursos visuais.

> 📖 Documentação técnica completa (como alterar gráficos, arquitetura, módulos compartilhados):
>
> 👉 [`app/frontend/README.md`](app/frontend/README.md)

---

## 📂 Estrutura do Projeto

```text
├── data/
│   ├── raw/              ← CSVs brutos baixados da ANEEL (não vai pro Git)
│   ├── processed/        ← Dados limpos em Parquet/CSV + camada analítica
│   └── docs/             ← Dicionários de dados e manuais (PDFs)
│
├── src/
│   ├── etl/
│   │   ├── extract_aneel.py    ← Baixa os dados do portal Dados Abertos
│   │   └── transform_aneel.py  ← Limpa e salva em Parquet/CSV
│   └── analysis/               ← Análises, benchmark e geração de dados
│
├── app/
│   ├── frontend/         ← Dashboard SPA (6 páginas + módulos compartilhados)
│   │   ├── index.html         ← Visão geral (KPIs, tendências, grupos)
│   │   ├── transgressoes.html ← Séries temporais de transgressão
│   │   ├── benchmark.html     ← Bubble chart: volume × compensação
│   │   ├── evolucao.html      ← Heatmap mensal por holding
│   │   ├── ranking.html       ← Ranking horizontal por métrica
│   │   ├── mapa.html          ← Mapa geográfico interativo
│   │   ├── relatorio.html     ← Relatório otimizado para PDF (Ctrl+P)
│   │   ├── styles.css         ← Design system dark mode (CSS puro)
│   │   ├── utils.js           ← Formatadores pt-BR (fmtNum, fmtMoney…)
│   │   ├── nav.js             ← Sidebar, mobile toggle, toast system
│   │   ├── filters.js         ← Estado global de filtros + evento filters:change
│   │   ├── app.js             ← Chart.js defaults, constantes compartilhadas
│   │   └── README.md          ← Documentação técnica do frontend
│   └── backend/
│       └── main.py       ← FastAPI: API REST + serving de estáticos
│
├── reports/              ← Relatórios gerados em Markdown
├── notebooks/            ← Notebooks de exploração analítica
├── docs/                 ← Guias, imagens e documentação
├── logos/                ← Logos PNG das holdings (espelhados em app/frontend/assets/logos/)
├── _archive/             ← Arquivos da versão anterior do projeto
├── requirements.txt      ← Bibliotecas Python necessárias
└── COMO_USAR_GIT.md      ← Guia rápido de Git
```

---

---

## 🔒 Sobre a Fidelidade e Segurança dos Dados

### 🎓 Por que esses dados são confiáveis?

Os dados deste projeto vêm **diretamente do portal de dados abertos da ANEEL** (`dadosabertos.aneel.gov.br`). Isso significa:

- ✅ **Fonte oficial**: publicados pela própria agência reguladora brasileira
- ✅ **Dados públicos**: qualquer pessoa pode baixá-los e verificar
- ✅ **Auditados**: as distribuidoras reportam esses indicadores obrigatoriamente
- ✅ **Histórico longo**: temos séries desde 2011 para análises de tendência
- ✅ **Múltiplas fontes integradas**: cruzamos dados de qualidade, compensação e UC ativa para validação cruzada

### 🔍 Como garantimos a qualidade?

Cada dado passa por **4 camadas rigorosas de processamento**:

1. **Extração (ETL)**: Download automático via API CKAN com versionamento
2. **Limpeza (Transform)**: Remoção de duplicatas, ajustes de tipo de dado, tratamento de valores ausentes
3. **Validação (Schema Contracts)**: Cada tabela é checada contra um contrato de schema esperado
4. **Análise (Quality Checks)**: Comparação de valores com período anterior, detecção de anomalias

**Resultado:** Dados **consolidados em Parquet/CSV na pasta `data/processed/analysis/`** — limpos, tipados, validados e prontos para consumo.

### 🛡️ Segurança dos Dados

- 📦 **Dados não identificáveis**: Não temos informações pessoais de consumidores. Apenas agregados por distribuidora/município.
- 🔐 **Sem dados sensíveis**: As compensações são valores públicos, já pagos na fatura dos clientes.
- 🚫 **Dados brutos privados**: A pasta `data/raw/` não é commitada no Git — apenas a camada analítica pré-processada.
- ☁️ **Controle de acesso em produção**: No Railway (produção), o banco PostgreSQL e Redis têm credenciais criptografadas.
- 📊 **Rastreabilidade**: Cada mudança nos dados é versionada em Git, permitindo auditoria completa.

### 📈 Sobre a Fidelidade dos Indicadores

Os indicadores de qualidade comercial seguem o **padrão ANEEL**:

- **QS (Qualidade de Serviço)** — Prazo médio de ativação de solicitações
- **QV (Qualidade de Voz)** — Taxa de sucesso em primeira chamada
- **PM (Prazo de Multa)** — Prazo para iniciar investigação de fraude
- **CR (Compensação Regulatória)** — R$ pagos ao consumidor por transgressão

Cada um desses é medido **oficialmente pelas distribuidoras**, reportado à ANEEL, auditado, e publicado. Nosso pipeline apenas reorganiza esses dados para análise comparativa.

---

## ✅ Estado Atual dos Dados

> **Os dados já passaram por etapas rigorosas de ETL, aderência de tipos e validação de qualidade.** Eles estão limpos, corretos, consolidados em Parquet/CSV na pasta `data/processed/analysis/` e prontos para consumo da aplicação.

- **Qualidade Comercial:** 2011–2025 (com 2024/2025 ainda incompletos para inferência de tendência).
- **INDGER Serviços Comerciais:** 2023–2025 (nível detalhado mensal/municipal).
- **INDGER Dados Comerciais:** 2023–2025 (usado para porte por UC ativa).
- **Valor pago/compensação:** disponível localmente nas bases:
  - `vlrpagocompensacao` (INDGER serviços)
  - indicadores `CR*` (Qualidade Comercial)

---

```bash
# Passo 1: Preparar ambiente
make venv-recreate    # Cria .venv limpo
make install          # Instala dependências de requirements.txt
make doctor           # Valida se tudo está OK (numpy, pandas, fastapi, etc)

# Passo 2: Rodar backend isolado
make backend          # FastAPI em http://localhost:8051

# Passo 3: (Opcional) Rodar frontend Vanilla JS estático
make serve            # Servidor em http://localhost:8051 (mesma porta)

# Passo 4: (Opcional) Rodar frontend Next.js separado
make frontend-next    # Next.js em http://localhost:3051

# Passo 5: (Completo) Backend + Next.js integrados
make stack-next       # Tudo junto de uma vez
```

**Dica:** Se está testando, use `make dev-serve` para backend com hot-reload (detecta mudanças automáticamente).

---

## 📂 Estrutura do Projeto em Detalhes

```
projeto-ren-1000/
│
├── 📊 data/                      ← Tudo relacionado a dados
│   ├── raw/                      ← CSVs brutos ANEEL (7+ GB, NÃO commitados)
│   ├── processed/                ← Dados transformados (Parquet/CSV)
│   └── analysis/                 ← CAMADA ANALÍTICA (isso SIM é versionado!)
│       ├── dim_*.csv             ← Dimensões (distribuidora, porte, serviço)
│       ├── fato_*.csv            ← Fatos (transgressões, compensação)
│       ├── kpi_*.csv             ← KPIs consolidados para TCC
│       ├── neoenergia/           ← Diagnóstico detalhado das 5 Neoenergias
│       └── grupos/               ← Análise por grupo econômico (13 CSVs)
│
├── 🐍 src/                       ← Python: ETL e análises
│   ├── etl/
│   │   ├── extract_aneel.py      ← Baixa dados do portal ANEEL
│   │   ├── extract_ibge.py       ← (futuro) IBGE para dados socioeconômicos
│   │   └── transform_aneel.py    ← Limpa e transforma em Parquet
│   └── analysis/
│       ├── build_analysis_tables.py      ← Gera 13 tabelas analíticas
│       ├── build_dashboard_data.py       ← Transforma em JSON pro frontend
│       ├── build_report.py               ← Gera markdown relatório
│       ├── grupos_diagnostico.py         ← Análise por grupo econômico
│       └── neoenergia_diagnostico.py     ← Deep-dive nas 5 Neoenergias
│
├── 🎨 app/
│   ├── frontend/                 ← Dashboard Vanilla JS (v1 - clássico)
│   │   ├── index.html            ← Home: KPIs + trends
│   │   ├── transgressoes.html    ← Time-series por holding
│   │   ├── benchmark.html        ← Scatter: volume × compensação
│   │   ├── evolucao.html         ← Heatmap mensal
│   │   ├── ranking.html          ← Ranking horizontal
│   │   ├── mapa.html             ← Choropleth interativo
│   │   ├── relatorio.html        ← Print-friendly summary
│   │   ├── styles.css            ← Design system (dark mode, CSS puro)
│   │   ├── *.js                  ← Módulos: utils, nav, filters, app, page-specific
│   │   └── dashboard_*.json      ← Dados estáticos (gerados pela análise)
│   │
│   ├── frontend-next/            ← Dashboard Next.js 14 (v2 - moderno)
│   │   ├── app/                  ← App Router (pages + layouts)
│   │   ├── components/           ← React components reutilizáveis
│   │   ├── hooks/                ← Custom hooks (useDashboardData, etc)
│   │   ├── package.json          ← Deps: react, tailwind, recharts, tanstack-query
│   │   └── tailwind.config.ts    ← Tema Tailwind (dark mode Iberdrola colors)
│   │
│   └── backend/                  ← FastAPI (v1) ou Railway (produção)
│       ├── main.py               ← Endpoints REST + serve estáticos
│       ├── core/                 ← DB connections (PostgreSQL + Redis)
│       └── schemas/              ← Pydantic models (validação de requests)
│
├── 📝 reports/                   ← Saídas de análise
│   ├── relatorio_aneel.md        ← Relatório consolidado markdown
│   └── neoenergia_diagnostico.md ← Deep-dive Neoenergia
│
├── 📚 docs/                      ← Documentação
│   ├── EXTRACAO_DADOS.md         ← Como baixar dados do zero (URLs, periodicidade)
│   ├── DICIONARIO_DADOS.md       ← Descrição de cada coluna/CSV
│   ├── VERCEL_QA_REPORT.md       ← QA checklist para produção
│   ├── images/                   ← Screenshots do dashboard
│   └── referencias/              ← PDFs da ANEEL
│
├── 🐳 docker/                    ← Containerização
│   ├── docker-compose.yml        ← Stack principal (nginx + api + front)
│   ├── docker-compose.kestra.yml ← Orquestração Kestra (agendamento ETL)
│   ├── Dockerfile                ← Build da app
│   └── nginx.conf                ← Config proxy reverso
│
├── 🧪 notebooks/                 ← Jupyter exploratórios
│   ├── diagnostico_dados.ipynb   ← Análise exploratória (EDA) dos dados
│   └── ...
│
├── scripts/                      ← Utilitários
│   ├── check_artifacts.py        ← Valida se todos os outputs existem
│   ├── validate_schema_contracts.py ← Checa schema raw vs processed
│   ├── smoke_imports.py          ← Testa imports críticos (pandas, fastapi, etc)
│   └── qa_audit.py               ← Auditoria QA do dashboard
│
├── Makefile                      ← Todos os comandos (make help)
├── requirements.txt              ← Dependências Python
├── vercel.json                   ← Config deploy Vercel (produção frontend)
├── railway.toml                  ← Config deploy Railway (produção backend)
└── CLAUDE.md, AGENTS.md          ← Documentação pra IAs/devs
```

---

## 🌐 Arquitetura em Nuvem (Hybrid Cloud)

Nosso projeto usa uma arquitetura **3-tier modern**:

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENTE (Browser)                    │
│                   HTML/CSS/JS/React                     │
└──────────────┬──────────────────────────────────────────┘
               │ fetch() /api/dashboard
┌──────────────▼──────────────────────────────────────────┐
│              VERCEL (Frontend Estático)                 │
│   Next.js + Recharts renderizados para CDN global      │
│   Rota raiz / aponta para Railway backend               │
└──────────────┬──────────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────────┐
│            RAILWAY (Backend FastAPI)                    │
│   - FastAPI + Uvicorn                                   │
│   - PostgreSQL (tabelas analíticas)                     │
│   - Redis (cache de queries frequentes)                 │
│   - Endpoint: /api/dashboard/{section}                  │
└──────────────┬──────────────────────────────────────────┘
               │ SQL queries
┌──────────────▼──────────────────────────────────────────┐
│    DADOS ANALÍTICOS (data/processed/analysis/)          │
│   Tabelas CSV/Parquet versionadas em Git               │
│   Carregadas no PostgreSQL via scripts/load_to_postgres │
└─────────────────────────────────────────────────────────┘
```

**Curiosidade:** Por que esse design? Porque a ANEEL publica dados **1x por mês**. Não precisa API dinâmica em tempo real — podemos regenerar os JSONs 1x/mês e cachear por 30 dias! Economia massiva em infraestrutura.

### Caching Estratégico

1. **CDN do Vercel** (frontend): Cacheado por 1 hora
2. **Redis no Railway** (backend): Resultado de queries complexas cacheado por 24 horas
3. **PostgreSQL** (backend): Índices nas colunas de filtro (distribuidor, período, porte)

Resultado: **99% das requisições resolvidas em <100ms**.

---

## 🧮 Análises Prontas (Nem Precisa Rodar o Pipeline)

Se você só quer **explorar os dados sem rodar nada**, estão aqui:

```
📊 Dados Prontos (Versioned em Git):
├── data/processed/analysis/
│   ├── dim_distribuidora_porte.csv          ← Porte de cada distribuidora por ano
│   ├── fato_indicadores_anuais.csv          ← Série histórica 2011-2025
│   ├── fato_transgressao_mensal_*.csv       ← Transgressões mensais
│   ├── kpi_regulatorio_anual.csv            ← KPIs consolidados para TCC
│   └── neoenergia/                          ← Análises exclusivas Neoenergia
│
📄 Relatórios Gerados:
├── reports/relatorio_aneel.md               ← Análise completa em markdown
└── reports/neoenergia_diagnostico.md        ← Deep-dive nos 5 Neoenergias
```

**O que fazer com esses CSVs:**
- Abrir no Excel/Sheets e filtrar por holding/período
- Plotar com matplotlib/seaborn diretamente em Jupyter
- Importar em banco de dados próprio para análise
- Baixar o dashboard pronto em `http://localhost:8051` se backend estiver rodando

---

## 📋 Tabelas Analíticas: O que Cada Uma Oferece

| Arquivo | Linhas típicas | Granularidade | Melhor para |
|---------|--------|--------------|------------|
| `dim_distribuidora_porte.csv` | 200+ | Distribuidora-ano | Entender tamanho relativo (porte A-D) |
| `fato_indicadores_anuais.csv` | 5000+ | Distrib-ano-serviço | Séries longas (2011-2025) de QS/QV/PM/CR |
| `fato_transgressao_mensal_distribuidora.csv` | 3000+ | Distrib-mês | Acompanhamento recorrente (dashboard) |
| `fato_transgressao_mensal_porte.csv` | 1000+ | Porte-mês | Comparar A vs B vs C vs D |
| `fato_uc_ativa_mensal_distribuidora.csv` | 1000+ | Distrib-mês | Normalizar por tamanho real |
| `kpi_regulatorio_anual.csv` | 14 | Ano | Narrativa TCC (14 KPIs consolidados) |
| `neoenergia/neo_mensal_*.csv` | 60+ | Neoenergia-mês | Deep-dive nas 5 empresas |
| `grupos/grupo_*.csv` | 13 arquivos | Grupo-mês | Ranking por holding (Neoenergia, CPFL, Equatorial, etc) |

---

## 🎯 Como Explorar o Projeto (Roteiro para Curiosos)

### Nível 1: "Quero ver rapidão"
1. Clone o repo: `git clone <url> && cd TCC_leo_main`
2. Ative venv: `source .venv/bin/activate` (ou recrie: `make venv-recreate`)
3. Rode: `make backend` (1 terminal) + abra `http://localhost:8051`
4. Explore os 6 gráficos (transgressoes, benchmark, ranking, etc)
5. Use os filtros para comparar holdings/períodos

⏱️ **Tempo:** 5-10 min

### Nível 2: "Quero entender os dados"
1. Abra `data/processed/analysis/fato_indicadores_anuais.csv` no Excel
2. Filtre por 1 distribuidora (ex: Neoenergia São Paulo)
3. Veja como os indicadores (QS, QV, PM, CR) evoluem 2011-2025
4. Leia `docs/DICIONARIO_DADOS.md` para entender cada coluna
5. Compare com outra holding e note diferenças de padrão

⏱️ **Tempo:** 20-30 min

### Nível 3: "Quero rodar minha própria análise"
1. `make pipeline` (roda ETL + análise completa, ~20 min primeira vez)
2. Abra `notebooks/diagnostico_dados.ipynb` com Jupyter
3. Customize as queries SQL (veja `docs/DBEAVER_SQL_MIGRATION.md`)
4. Exporte novos gráficos com matplotlib/plotly
5. Contribua insights para o TCC

⏱️ **Tempo:** 1-2 horas

### Nível 4: "Quero entender e modificar o código"
1. Leia `CLAUDE.md` (arquitetura)
2. Leia `app/frontend/README.md` (modules JS + data flow)
3. Faça um fork, crie branch feature: `git checkout -b feat/nova-analise`
4. Modifique scripts em `src/analysis/` ou adicione novo gráfico
5. Teste localmente com `make dev-serve`
6. Abra PR com screenshots antes/depois

⏱️ **Tempo:** 2-4 horas por feature

---

## 🚀 Rodar o Pipeline Completo (Para Análises Customizadas)

Se quer baixar dados **do zero** de ANEEL e regenerar tudo:

```bash
# Passo 1: Baixar CSVs brutos (7+ GB, pode levar 5-10 min)
python3 -m src.etl.extract_aneel

# Passo 2: Limpeza, tipagem, validação (2-3 min)
python3 -m src.etl.transform_aneel

# Passo 3: Agrega para análise (1-2 min)
python3 -m src.analysis.build_analysis_tables

# Passo 4: Gera relatório markdown
python3 -m src.analysis.build_report

# Passo 5: Deep-dive Neoenergia
python3 -m src.analysis.neoenergia_diagnostico

# Passo 6: Análise por grupo econômico
python3 -m src.analysis.grupos_diagnostico

# Passo 7: Gera JSONs para dashboard
python3 -m src.analysis.build_dashboard_data

# Atalho: Tudo junto
make pipeline
```

Após rodar, veja os outputs em:
- `reports/relatorio_aneel.md` ← Achados principais
- `data/processed/analysis/` ← Tabelas versionadas
- `app/frontend/dashboard_*.json` ← Dados do dashboard

---

## 🧪 Testes e Validação

O projeto inclui validação automática:

```bash
# Rápido (30 seg): verifica imports + schema contracts
make test-fast

# Completo (5 min): tudo + gera dashboard + Neoenergia
make test-smoke

# Específico: valida se artefatos existem
make check-artifacts-full

# Específico: valida schema raw vs processed
make validate-contracts
```

---

## 🐳 Docker (Se Preferir Containerizado)

```bash
# Stack completo em container
docker compose up --build

# Acesse http://localhost:8051 (api + frontend)
# Banco PostgreSQL + Redis inclusos

# Apenas Kestra (orquestração de dados com Gemini)
docker compose -f docker/docker-compose.kestra.yml up -d
# Acesse http://localhost:8080/kestra
```

---

## 📸 Screenshots e Provas

### Relatórios

- `reports/relatorio_aneel.md` — relatório consolidado geral
- `reports/neoenergia_diagnostico.md` — diagnóstico das 5 Neoenergias

### Dashboard e Relatório Visual

- `app/frontend/index.html` — **dashboard interativo** (6 páginas com sidebar, Chart.js)
- `app/frontend/relatorio.html` — **relatório imprimível** (Ctrl+P → PDF)
- `app/frontend/dashboard_data.json` — payload principal, ~27 MB (gerado automaticamente)
- JSONs auxiliares: `dashboard_transgressoes.json`, `dashboard_timeseries.json`, `dashboard_scatter.json`, `dashboard_heatmap.json`, `dashboard_radar.json`, `dashboard_groups_ranking.json`

### Notebooks de apoio

- `notebooks/diagnostico_dados.ipynb` — **Diagnóstico completo + análises estatísticas** (3 partes: qualidade dados, testes estatísticos, melhorias dashboard)
- `notebooks/01_mapa_dados_e_qualidade.ipynb`
- `notebooks/02_tendencia_regulatoria_414_vs_1000.ipynb`
- `notebooks/03_porte_e_benchmark_distribuidoras.ipynb`
- `notebooks/04_exploracao_sql_avancada.ipynb`
- `notebooks/05_analise_5_maiores_grupos.ipynb`

---

## ❓ Como Responder as Perguntas do TCC

1. **"Ficou menos fora do prazo?"**
   Use `kpi_regulatorio_anual` e `fato_indicadores_anuais` (`taxa_fora_prazo`).

2. **"As compensações aumentaram?"**
   Use `compensacao_rs` em `kpi_regulatorio_anual` e `fato_transgressao_mensal_distribuidora`.

3. **"Comparação justa por tamanho da distribuidora?"**
   Use `fora_prazo_por_100k_uc_mes` e `compensacao_rs_por_uc_mes` em `fato_transgressao_mensal_distribuidora`.

4. **"Grupo A/B e rural/urbana?"**
   Use `classe_local` em `fato_indicadores_anuais` e `classe_local_servico` em `fato_transgressao_mensal_porte`.

---

## 🔄 Rotina Recomendada de Trabalho

### Atualização mensal (quando ANEEL publicar novo mês)

```bash
make pipeline
# ou passo a passo:
python3 -m src.etl.extract_aneel
python3 -m src.etl.transform_aneel
python3 -m src.analysis.build_analysis_tables
python3 -m src.analysis.build_report
python3 -m src.analysis.build_dashboard_data
```

### Exploração e escrita analítica

1. Validar cobertura e qualidade: `notebooks/01_mapa_dados_e_qualidade.ipynb`
2. Atualizar tendência regulatória: `notebooks/02_tendencia_regulatoria_414_vs_1000.ipynb`
3. Atualizar benchmark por porte: `notebooks/03_porte_e_benchmark_distribuidoras.ipynb`
4. Consolidar texto final em `reports/relatorio_aneel.md`

---

## 🎯 Próximos Passos (Desenvolvimento)

1. **Integração de Dashboards:** Unificar as visualizações recém criadas de Transgressões (`app/frontend/transgressoes.html`) com o SPA principal, organizando a navegação.
2. **Back-End (FastAPI):** Migrar o fornecimento estático do `dashboard_transgressoes.json` para endpoints dinâmicos na API visando atualizar a data em tempo real por banco relacional.
3. Fechar o capítulo metodológico da monografia com definição explícita das métricas trabalhadas (R$/UC-mês, taxa de reincidência, etc).
4. Exportar análises finais e capturar os gráficos para o texto da dissertação.

---

## 📘 Documentação Adicional

| Documento | Conteúdo |
|---|---|
| [`docs/GUIA_ANALISE.md`](docs/GUIA_ANALISE.md) | Guia operacional detalhado (métricas, exemplos, checklist) |
| [`docs/PROXIMOS_PASSOS_TCC.md`](docs/PROXIMOS_PASSOS_TCC.md) | Roadmap de execução até a versão final |
| [`app/frontend/README.md`](app/frontend/README.md) | Documentação técnica do frontend (páginas, módulos compartilhados, JSONs, como alterar) |
| [`COMO_USAR_GIT.md`](COMO_USAR_GIT.md) | Guia rápido de Git para trabalho em equipe |

---

## 📊 Fontes de Dados

Duas fontes **nucleares** (entram nas métricas do TCC):

| Fonte | Conteúdo | Portal |
|---|---|---|
| **Qualidade do Atendimento Comercial** (ANEEL) | Prazos, transgressões, compensações R$ — anual 2011–2023 | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br) |
| **INDGER — Indicadores Gerenciais da Distribuição** (ANEEL) | Serviços comerciais mensais 2023–2025 (ZIP + CSV consolidado) | [dadosabertos.aneel.gov.br](https://dadosabertos.aneel.gov.br) |
| **DTB — Divisão Territorial do Brasil 2024** (IBGE) | Dimensão municipal para mapa e rural/urbano | [geoftp.ibge.gov.br](https://geoftp.ibge.gov.br) |

Duas fontes **complementares** (no catálogo para rastreabilidade, não usadas hoje): `autos_infracao` e `reclamacoes`. Só baixam com `make extract-aneel-full`.

**Documentação canônica de extração e tratamento:** [`docs/EXTRACAO_DADOS.md`](docs/EXTRACAO_DADOS.md) — mapa completo das fontes (URLs CKAN, periodicidade, limitações), reprodução do zero e troubleshooting.

## 🎯 Variáveis de Interesse

- **Eficácia:** Serviços realizados dentro do prazo regulamentar
- **Transgressões:** Serviços fora do prazo (Anexo IV da REN 1000)
- **Compensações:** Valores financeiros (R$) creditados ao consumidor
- **Segmentação:** Por distribuidora, estado, grupo tarifário (A/B), zona (rural/urbana)
- **Temporal:** Antes × depois da vigência da REN 1000

## 📚 Contexto Normativo

- **REN ANEEL nº 1.000/2021:** Consolida as regras de distribuição de energia
- **Anexo IV:** Define prazos máximos para prestação de serviços comerciais
- **PRODIST (Módulo 8, Seção 8.3):** Detalhamento dos procedimentos
