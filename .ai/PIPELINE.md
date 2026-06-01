# 🔄 Pipeline de Dados — Guia para IA

## Visão Geral do Fluxo

O fluxograma editável do pipeline Make fica em
[`docs/mtdpipeline.excalidraw`](../docs/mtdpipeline.excalidraw), com foco nos
targets, artefatos e validações de reprodutibilidade.

```
ANEEL API (CSVs)
    │
    ▼
[1] extract_aneel.py       → data/raw/*.csv
    │
    ▼
[2] transform_aneel.py     → data/processed/*.csv + *.parquet
    │
    ▼
[3] build_analysis_tables.py → data/processed/analysis/*.csv
    │
    ├─▶ build_report.py           → reports/relatorio_aneel.md
    ├─▶ neoenergia_diagnostico.py → artefatos legados de compatibilidade
    │                                data/processed/analysis/neoenergia/*.csv
    └─▶ build_dashboard_data.py   → data/processed/dashboard/dashboard_data.json
                                      data/processed/dashboard/dashboard_*.json
```

## Etapa 1: Extração (`make extract`)

**Scripts**: `src/etl/extract_aneel.py` + `src/etl/extract_ibge.py`

- Portais: `dadosabertos.aneel.gov.br` (CKAN) + `geoftp.ibge.gov.br` (IBGE DTB)
- Duas camadas: **nuclear** (default) e **complementar** (via `--with-complementares`)
- Saída: `data/raw/*.csv` + `data/raw/DTB_2024.zip` e conteúdo extraído
- **ALERTA**: CSVs brutos nucleares ocupam ≈ 7.7 GB. Exige ≥ 12 GB livres.
- **Fail-fast**: valida contratos mínimos de schema raw após download.

📖 **Doc canônico com URLs, periodicidades, tamanhos, troubleshooting e tratamento:** [`docs/EXTRACAO_DADOS.md`](../docs/EXTRACAO_DADOS.md)

## Etapa 2: Transformação (`make transform`)

**Script**: `src/etl/transform_aneel.py`

- Lê: `data/raw/*.csv`
- Operações:
  - Normalização de nomes de colunas
  - Parsing de datas
  - Remoção de duplicatas
  - Conversão para Parquet (compressão)
- Saída: `data/processed/*.{csv,parquet}`
- **Arquivo grande**: `indger_servicos_comerciais.csv` = 7.7 GB (Parquet = 139 MB)
- **Fail-fast**: se faltar coluna obrigatória ou dataset essencial, retorna erro (exit 1).

## Etapa 3: Análise (`make analysis`)

**Script**: `src/analysis/build_analysis_tables.py`

- Lê: `data/processed/*.parquet`
- Deriva a referência mensal INDGER com parser próprio:
  - `indger_servicos_comerciais.parquet`: mês autoritativo vem de `_source_file` (`indger-dados-servicos-comerciais-YYYY-MM.csv`).
  - `indger_dados_comerciais.parquet`: quando `datreferenciainformada` aparece como `YYYY-01-DD`, usa o dia `1..12` como mês codificado.
  - A análise falha se as tabelas mensais não cobrirem exatamente `2023-01` a `2025-12`.
- Gera tabelas analíticas em `data/processed/analysis/`:

| Arquivo | Descrição |
|---------|-----------|
| `kpi_regulatorio_anual.csv` | KPIs agregados por ano (pré/pós REN 1000) |
| `fato_indicadores_anuais.csv` | Indicadores por distribuidora/ano |
| `fato_transgressao_mensal_distribuidora.csv` | Transgressões mensais por distribuidora |
| `fato_transgressao_mensal_porte.csv` | Transgressões mensais por porte |
| `fato_uc_ativa_mensal_distribuidora.csv` | Unidades consumidoras ativas |
| `dim_distribuidora_porte.csv` | Dimensão: mapa distribuidora → porte |
| `dim_indicador_servico.csv` | Dimensão: mapa indicador → serviço |

### Artefatos legados de compatibilidade (`data/processed/analysis/neoenergia/`)

Gerados por `make neoenergia-diagnostico` (`src/analysis/neoenergia_diagnostico.py`). Esses arquivos preservam compatibilidade com análises antigas e payloads legados; não definem o foco do TCC, que é setorial.

| Arquivo | Descrição |
|---------|-----------|
| `neo_anual_2023_2025.csv` | Dados anuais do grupo correspondente |
| `neo_tendencia_2023_2025.csv` | Variação percentual 2023→2025 |
| `neo_benchmark_porte_latest.csv` | Benchmark vs distribuidoras de mesmo porte |
| `neo_classe_local_2023_2025.csv` | Transgressões por classe (urbana/rural/grupo A) |
| `neo_longa_resumo_2011_2023.csv` | Série longa 2011-2023 |
| `neo_mensal_2023_2025.csv` | Séries mensais detalhadas |

## Etapa 4: Dashboard (`make dashboard`)

**Script**: `src/analysis/build_dashboard_data.py`

- Lê: CSVs de `data/processed/analysis/`, `grupos/` e artefatos legados quando necessários
- Gera: `data/processed/dashboard/dashboard_data.json` e micro-payloads `data/processed/dashboard/dashboard_*.json`
- Política: JSONs canônicos podem estar versionados para demo/deploy, mas devem ser regenerados depois de `make pipeline` para reprodução científica. O frontend oficial consome esses arquivos via FastAPI/rewrites do Next.js.
- **Fail-fast**: falha se entradas obrigatórias estiverem ausentes ou seções críticas ficarem vazias.
- Estrutura do JSON:

```json
{
  "meta": { "generated_at": "...", "project": "..." },
  "kpi_overview": { ... },
  "serie_anual": [ ... ],
  "serie_mensal_nacional": [ ... ],
  "neo_anual": [ ... ],
  "neo_tendencia": [ ... ],
  "neo_benchmark": [ ... ],
  "neo_classe_local": [ ... ],
  "neo_longa_resumo": [ ... ],
  "neo_mensal": [ ... ]
}
```

## Etapa 5: Relatórios (`make report`)

**Script**: `src/analysis/build_report.py`

- Lê: CSVs analíticos
- Gera: `reports/relatorio_aneel.md`

## Etapa 6: Carga para Relacional (Opcional)

**Scripts**: `scripts/load_to_postgres.py`, `scripts/load_chunked.py`

- Objetivo: Ingestão de `data/processed` para o PostgreSQL.
- Uso: Facilitar SQL avançado (`04_exploracao_sql_avancada.ipynb`).

## Dependências entre Etapas

```
extract → transform → analysis ─┬─→ report
                                 ├─→ artefatos legados de compatibilidade
                                 └─→ dashboard → backend/Next.js
```

`make pipeline` executa tudo em ordem: `update-data → analysis → report → grupos → neoenergia-diagnostico (compatibilidade legada) → dashboard → dashboard-transgressoes → validate-contracts → check-artifacts-full → qa-data`

As validações finais protegem a mensalidade INDGER: `validate-contracts` exige 36 pares `(ano, mes)` nas três tabelas mensais, `check-artifacts-full` exige série mensal do dashboard além de janeiro e incluindo `2025-12`, e `qa-data` reporta erro se a cobertura mensal regredir.

## Como Regenerar Tudo do Zero

```bash
source .venv/bin/activate
make clean-analysis   # limpa tabelas analíticas
make pipeline         # roda tudo: ETL → análise → relatório → dashboard
make site-refresh     # regenera dashboard e sobe backend + Next.js
```

## Gotchas e Armadilhas

1. **`python` vs `python3`**: Na máquina do usuário, só existe `python3`.
   O Makefile trata isso automaticamente.
2. **Dados brutos são enormes**: `indger_servicos_comerciais.csv` = 7.7 GB.
   Só rode `make extract` se tiver espaço.
3. **`.venv` não ativado**: Scripts chamados via `make` usam
   `.venv/bin/python` automaticamente. Para rodar direto, ative o venv.
4. **`dashboard_data.json` é gerado e pode estar versionado**: a fonte canônica é `data/processed/dashboard/`; não edite manualmente, rode `make dashboard-full` ou `make pipeline`.
5. **Frontend oficial via `file://` não existe**: use o Next.js local.
   Use `make site`, `make site-refresh`, `make stack-next` ou `make backend` + `make frontend-next`.
6. **Contratos de schema e cobertura mensal**: valide com `make validate-contracts` quando mudar ETL/análise. Para dashboard/TCC, rode também `make check-artifacts-full` e `make qa-data`.
7. **Backend local**: para API e JSONs públicos use `make backend`/`make dev-serve`.
8. **Porta 8051**: Porta do dev local e Docker do TCC. Use `3051` para Next.js local.
