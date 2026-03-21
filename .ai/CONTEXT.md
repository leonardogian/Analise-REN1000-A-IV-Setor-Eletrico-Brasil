# 🤖 AI Context — TCC Análise REN 1000/2021 ANEEL

> Este arquivo é para agentes de IA que precisam entender o repositório e
> continuar trabalhando nele. Não é um README para humanos — veja `README.md`.

## O que é este projeto?

Trabalho de Conclusão de Curso (TCC) que analisa a eficácia da **Resolução
Normativa nº 1.000/2021 da ANEEL** na qualidade dos serviços comerciais das
distribuidoras de energia elétrica do Brasil. Foco especial nas **5 distribuidoras
do grupo Neoenergia** (Brasília, Coelba, Cosern, Elektro, Pernambuco).

> **🎯 Fase Atual do Projeto:** ETL, dados e design system do frontend estão completos. O dashboard tem 6 páginas ativas com módulos compartilhados unificados (utils.js, nav.js, filters.js, app.js). Notebook de diagnóstico e análises estatísticas concluído (`notebooks/diagnostico_dados.ipynb`). Próximos passos: corrigir bug de nomes de distribuidoras em `fato_indicadores_anuais`, camada coroplética no mapa, e refinamento das análises estatísticas.

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
| Dashboard     | HTML5, CSS3, Vanilla JS, Chart.js (na Vercel)    |
| Relatório     | HTML print-optimized (Ctrl+P → PDF)              |
| Build         | GNU Make                                         |
| Dados         | PostgreSQL DB, Redis Cache, Parquet              |
| Versionamento | Git (branch: main)                               |

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
│       └── build_dashboard_data.py   ← Gera dashboard/dashboard_data.json
│   └── backend/
│       └── main.py                  ← Backend local (API + static em localhost)
│
├── app/
│   ├── frontend/             ← Dashboard SPA (6 páginas ativas)
│   │   ├── index.html / app.js           ← Visão Geral (KPIs, tendências, grupos)
│   │   ├── transgressoes.html / .js      ← Séries temporais de transgressões
│   │   ├── benchmark.html / .js          ← Bubble chart: volume × compensação
│   │   ├── evolucao.html / .js           ← Heatmap mensal por holding
│   │   ├── ranking.html / .js            ← Ranking horizontal por métrica
│   │   ├── mapa.html / .js               ← Mapa interativo (Leaflet + timeline)
│   │   ├── relatorio.html                ← Relatório imprimível (Ctrl+P → PDF)
│   │   ├── utils.js                      ← Formatadores pt-BR compartilhados
│   │   ├── nav.js                        ← Sidebar + toast system
│   │   ├── filters.js                    ← Estado global de filtros (período/porte/grupo)
│   │   └── styles.css                    ← Design system: dark mode, cards, grid
│   └── backend/main.py       ← FastAPI: endpoints REST + serve static files
│
├── data/
│   ├── raw/                  ← CSVs brutos da ANEEL (não versionados)
│   └── processed/
│       ├── *.csv / *.parquet ← Dados limpos (não versionados)
│       └── analysis/         ← Tabelas analíticas versionadas no Git
│           ├── kpi_regulatorio_anual.csv
│           ├── fato_transgressao_mensal_distribuidora.csv
│           ├── fato_indicadores_anuais.csv
│           └── neoenergia/   ← CSVs específicos do grupo Neoenergia
│
├── reports/                  ← Relatórios gerados (markdown)
├── notebooks/                ← Jupyter (exploratórios + diagnóstico)
│   ├── diagnostico_dados.ipynb              ← Diagnóstico + análises estatísticas (3 partes)
│   ├── diagnostico_dados_executed.ipynb     ← Versão executada com outputs
│   ├── 01_mapa_dados_e_qualidade.ipynb      ← Mapa de dados e qualidade
│   ├── fig_teste_medias_pre_pos.png         ← Box plot pré/pós REN 1000
│   ├── fig_decomposicao_sazonal.png         ← Decomposição sazonal 4 painéis
│   ├── fig_ranking_melhoria_piora.png       ← Top 15 melhoria/piora
│   ├── fig_porte_vs_transgressao.png        ← Scatter porte × transgressão
│   └── fig_compensacoes_evolucao.png        ← Evolução compensações R$
├── docs/                     ← Documentação auxiliar + imagens
├── logos/                    ← Logos PNG de holdings (espelhados em app/frontend/assets/logos/)
├── docker/                   ← Infraestrutura local em contêineres (Stack Docker nome: "tcc", ex: app, Postgres, Kestra)
├── scripts/                  ← Utilitários (cargas PostgreSQL, check_artifacts, validações)
│   └── generate_tcc_investigacao_pptx.py ← Gera apresentação .pptx do trabalho (output/)
├── Makefile                  ← Orquestração: make pipeline, make serve, etc.
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
make dashboard-full  # analysis + neoenergia + dashboard

# Dashboard local
make serve           # HTTP server em http://localhost:8051
make backend         # FastAPI em http://localhost:8051
make dev-serve       # dashboard-full + preflight + backend (--reload)

# Testes
make validate-contracts  # valida contratos de schema (raw + processed)
make test-fast           # compilação + imports + contratos + artefatos core
make test-smoke          # análise + neoenergia + dashboard + validação completa
make check-artifacts     # verifica artefatos core
make check-artifacts-full # verifica artefatos completos + dashboard_data.json

# Limpeza
make clean-analysis  # remove data/processed/analysis/
```

## Portas Ocupadas na Máquina

| Porta | Serviço                    | Conflito? |
|-------|----------------------------|-----------|
| 3000  | AgentCycle Frontend        | ⚠️ Ocupada |
| 5433  | PostgreSQL (AgentCycle)    | ⚠️ Ocupada |
| 6379  | Redis (AgentCycle)         | ⚠️ Ocupada |
| 8000  | AgentCycle Backend         | ⚠️ Ocupada |
| 8050  | TCC Dashboard (Docker)     | ⚠️ Docker only |
| 8051  | **TCC Dashboard (make serve)** | ✅ Local dev |
| 8080  | Airflow Webserver / Kestra | ⚠️ Ocupada |
| 8090  | Kestra (Alternativa)       | ⚠️ Ocupada |

> Dev local: porta **8051**. Docker: porta 8050. Não usar 8000 para o dashboard.

## Arquivos Gerados (NÃO versionados)

Estes arquivos são gerados por scripts e listados no `.gitignore`:

- `data/raw/*.csv` — dados brutos da ANEEL
- `data/processed/*.csv` e `*.parquet` — dados transformados
- `dashboard/dashboard_data.json` — JSON do dashboard (1.7 MB)
- `output/apresentacao_tcc_investigacao_dados_analises.pptx` — apresentação executiva do TCC
- `.venv/` — ambiente virtual Python

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
- **Dashboard docs**: `dashboard/README.md`
- **Guia de análise**: `docs/GUIA_ANALISE.md`
- **Próximos passos TCC**: `docs/PROXIMOS_PASSOS_TCC.md`
- **Relatório Neoenergia**: `reports/neoenergia_diagnostico.md`
- **Apresentação executiva**: `output/apresentacao_tcc_investigacao_dados_analises.pptx`
- **Como usar Git**: `COMO_USAR_GIT.md`
- **Diagnóstico de dados e análises**: `notebooks/diagnostico_dados.ipynb`

## Resultados Estatísticos (Diagnóstico Mar 2026)

Notebook `diagnostico_dados.ipynb` contém análises estatísticas completas para o TCC:

| Análise | Resultado | Significância |
|---------|-----------|---------------|
| Taxa pré vs pós REN 1000 | 3.00% → 2.08% (Mann-Whitney p=0.015, d=0.283) | Significativo |
| Tendência temporal | Mann-Kendall S=-28, p=0.10, slope=-0.085 p.p./ano | Marginal |
| Distribuidoras que melhoraram | 44/102 (43%), binomial p=0.93 | Não significativo |
| Porte × transgressão | Spearman rho=-0.286, p=0.49 (apenas 8 distrib.) | Fraca |
| Compensação/transgressão | R$33 → R$207 (+528%) | Descritivo |

## Bugs Conhecidos no Pipeline

1. ~~**`distributor_label` NaN em `fato_indicadores_anuais`**~~: **CORRIGIDO** (2026-03-21). Adicionados 35 aliases em `data/config/distributor_names_overrides.json` mapeando IDs históricos (COELBA→neoenergia_coelba, AME→amazonas_energia, etc.). Groupby em `build_fato_indicadores_anuais()` agora preserva colunas de nome. Resultado: 99.1% label fill, 95.2% match com dim_distributor_group, 5 Neoenergias rastreadas 2011-2023.
2. **Ano 2023 com 25% do volume**: 7M serviços vs 28M em 2022 (91 vs 105 distribuidoras). Causa indeterminada.
3. **Anos 2024-2025 fragmentados**: 17 e 11 distribuidoras respectivamente. Excluir de análises anuais comparativas.
