# 🔄 Pipeline de Dados — Guia para IA

## Visão Geral do Fluxo

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
    ├─▶ neoenergia_diagnostico.py → reports/neoenergia_diagnostico.md
    │                                data/processed/analysis/neoenergia/*.csv
    └─▶ build_dashboard_data.py   → dashboard/dashboard_data.json
```

## Etapa 1: Extração (`make extract`)

**Script**: `src/etl/extract_aneel.py`

- Fonte: `dadosabertos.aneel.gov.br`
- Datasets baixados:
  - Qualidade do Atendimento Comercial
  - INDGER — Dados Comerciais
  - INDGER — Serviços Comerciais
- Saída: `data/raw/*.csv`
- **ALERTA**: Os CSVs brutos são grandes (7+ GB para serviços comerciais).
  Não tente baixá-los se o espaço for limitado.

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

## Etapa 3: Análise (`make analysis`)

**Script**: `src/analysis/build_analysis_tables.py`

- Lê: `data/processed/*.parquet`
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

### Dados Neoenergia (`data/processed/analysis/neoenergia/`)

Gerados por `make neoenergia-diagnostico` (`src/analysis/neoenergia_diagnostico.py`):

| Arquivo | Descrição |
|---------|-----------|
| `neo_anual_2023_2025.csv` | Dados anuais das 5 distribuidoras |
| `neo_tendencia_2023_2025.csv` | Variação percentual 2023→2025 |
| `neo_benchmark_porte_latest.csv` | Benchmark vs distribuidoras de mesmo porte |
| `neo_classe_local_2023_2025.csv` | Transgressões por classe (urbana/rural/grupo A) |
| `neo_longa_resumo_2011_2023.csv` | Série longa 2011-2023 |
| `neo_mensal_2023_2025.csv` | Séries mensais detalhadas |

## Etapa 4: Dashboard (`make dashboard`)

**Script**: `src/analysis/build_dashboard_data.py`

- Lê: CSVs de `data/processed/analysis/` e `neoenergia/`
- Gera: `dashboard/dashboard_data.json` (≈1.7 MB)
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

## Dependências entre Etapas

```
extract → transform → analysis ─┬─→ report
                                 ├─→ neoenergia-diagnostico
                                 └─→ dashboard → serve
```

`make pipeline` executa tudo em ordem: `update-data → analysis → report → dashboard`

## Como Regenerar Tudo do Zero

```bash
source .venv/bin/activate
make clean-analysis   # limpa tabelas analíticas
make pipeline         # roda tudo: ETL → análise → relatório → dashboard
make serve            # sobe dashboard em http://localhost:8050
```

## Gotchas e Armadilhas

1. **`python` vs `python3`**: Na máquina do usuário, só existe `python3`.
   O Makefile trata isso automaticamente.
2. **Dados brutos são enormes**: `indger_servicos_comerciais.csv` = 7.7 GB.
   Só rode `make extract` se tiver espaço.
3. **`.venv` não ativado**: Scripts chamados via `make` usam
   `.venv/bin/python` automaticamente. Para rodar direto, ative o venv.
4. **`dashboard_data.json` não está no Git**: É gerado. Rode `make dashboard`.
5. **Dashboard via `file://` não funciona**: Precisa de servidor HTTP (CORS).
   Use `make serve` (porta 8050).
6. **Porta 8050**: Confirmada livre. Portas 3000/5433/6379/8000/8080/8090
   estão ocupadas por outros serviços (AgentCycle, Airflow, Kestra).
