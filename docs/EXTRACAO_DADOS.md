# Extração e Tratamento de Dados — Guia Canônico

> **Escopo.** Este documento é a referência única para (a) **baixar** os dados usados no TCC a partir dos portais públicos da ANEEL e do IBGE e (b) **transformá-los** em insumos analíticos reprodutíveis. A camada analítica (tabelas de fato, dimensões, KPIs) está documentada em [`.ai/DATA_OVERVIEW.md`](../.ai/DATA_OVERVIEW.md) e [`docs/DICIONARIO_DADOS.md`](DICIONARIO_DADOS.md) — este doc para antes.

> **Público-alvo.** Engenheiro clonando o repositório do zero, quer reproduzir exatamente o mesmo pipeline e diagnosticar falhas quando o portal da ANEEL muda algo.

**Última atualização:** 2026-04-28

---

## Sumário

1. [Pré-requisitos](#1-pré-requisitos)
2. [Mapa de Fontes](#2-mapa-de-fontes)
3. [Reprodução do Zero](#3-reprodução-do-zero)
4. [Tratamento Aplicado (transform_aneel.py)](#4-tratamento-aplicado-transform_aneelpy)
5. [Verificação Pós-Extração](#5-verificação-pós-extração)
6. [Troubleshooting](#6-troubleshooting)
7. [Camada Analítica (referência)](#7-camada-analítica-referência)
8. [Gaps Conhecidos e Evolução](#8-gaps-conhecidos-e-evolução)

---

## 1. Pré-requisitos

### Ambiente

| Item | Requisito | Como validar |
|---|---|---|
| Python | 3.10 ou superior | `python3 --version` |
| Sistema | Linux/macOS (shell POSIX) ou WSL no Windows | `uname -a` |
| Disco livre | ≥ 12 GB (brutos + intermediários) | `df -h .` |
| Rede | banda estável; extract completa ≈ 15-25 min | — |

Ponto crucial: a máquina expõe apenas `python3`, **não existe alias `python`**. O Makefile trata isso automaticamente via `$(PYTHON_VENV)`. Se você rodar scripts fora do Make, use `python3 -m ...`.

### Setup do ambiente

```bash
git clone <url-do-repo> TCC_leo_main
cd TCC_leo_main

make venv-recreate   # cria .venv limpo
make install         # pip install -r requirements.txt
make doctor          # checa .venv + imports críticos do ETL, backend e carga opcional
```

`make doctor` deve terminar com `[OK] ambiente saudável`. Se falhar, revise Python version e permissões.

### Portas locais

A porta `8051` serve o backend FastAPI / dashboard estático. O frontend Next local usa `3051`. Não use `8000` para este dashboard. Nada disso afeta a extração, mas é pré-requisito do `make serve` posterior.

---

## 2. Mapa de Fontes

O catálogo de extração mora em código, não em YAML externo. As duas fontes de verdade são:

- [`src/etl/extract_aneel.py`](../src/etl/extract_aneel.py) — dict `CATALOGO` com 4 fontes ANEEL
- [`src/etl/extract_ibge.py`](../src/etl/extract_ibge.py) — dict `CATALOGO_IBGE` com 1 fonte IBGE

Cada fonte declara um campo `tier`:

| `tier` | Semântica | Comportamento padrão |
|---|---|---|
| `nuclear` | Entra nas métricas nucleares do TCC (taxa de transgressão, compensação R$, normalização por UC). Sem elas, pipeline quebra. | Sempre baixada. |
| `complementar` | Fonte de contexto. Hoje **não é consumida** por nenhum módulo em `src/analysis/`, mas mora no catálogo para rastreabilidade histórica e futura integração. | Só baixada com `--with-complementares`. |

### 2.1. `qualidade_comercial` — ANEEL (nuclear)

| Campo | Valor |
|---|---|
| Nome oficial | Qualidade do Atendimento Comercial |
| Portal | `dadosabertos.aneel.gov.br` (CKAN) |
| Dataset (landing) | https://dadosabertos.aneel.gov.br/dataset/qualidade-do-atendimento-comercial |
| Dataset UUID | `b7b32b0c-4bac-4584-b9ec-76a32c05ca02` |
| Recursos | `qualidade-atendimento-comercial.csv`, `dominio-indicadores.csv`, `dm-qualidade-do-atendimento-comercial.pdf` |
| Granularidade | anual × distribuidora × indicador |
| Cobertura temporal | 2011–2023 (uma linha por ano e indicador) |
| Periodicidade na ANEEL | anual |
| Tamanho esperado | ≈ 85 MB (`qualidade-atendimento-comercial.csv`) |
| Encoding | utf-8 |
| Separador | `;` |
| Papel no TCC | **Métrica nuclear pré-2022** (série longa 2011–2021, regime REN 414/2010) |
| Limitações | Granularidade anual impede análise mensal pré-2022. Indicadores CR* usados como proxy para compensação. |

### 2.2. `indger` — ANEEL (nuclear)

| Campo | Valor |
|---|---|
| Nome oficial | INDGER — Indicadores Gerenciais da Distribuição |
| Portal | `dadosabertos.aneel.gov.br` (CKAN) |
| Dataset (landing) | https://dadosabertos.aneel.gov.br/dataset/indger-indicadores-gerenciais-da-distribuicao |
| Dataset UUID | `7cacb2c4-b165-4591-a793-9ed20d1f167d` |
| Recursos | `indger-dados-servicos-comerciais.zip` (descompacta em 36 CSVs mensais), `indger-dados-comerciais.csv`, 2 PDFs de dicionário |
| Granularidade | mensal × distribuidora × município × tipo de serviço |
| Cobertura temporal | 2023-01 → 2025-12 (36 CSVs mensais, verificado em `data/raw/`) |
| Periodicidade na ANEEL | mensal |
| Tamanho esperado | ZIP ≈ 295 MB em 2026-04-28; descompactado ≈ 7.7 GB; `indger-dados-comerciais.csv` ≈ 107 MB |
| Encoding | misto (usar cascade — ver §4) |
| Separador | `;` |
| Papel no TCC | **Métrica nuclear pós-2022** (regime REN 1000/2021). Base do dashboard e diagnósticos por grupo. |
| Limitações | Códigos de serviço 69 e 93 têm cobertura inconsistente entre distribuidoras; ver [`.ai/DATA_OVERVIEW.md §6.D`](../.ai/DATA_OVERVIEW.md). |

### 2.3. `autos_infracao` — ANEEL (complementar)

| Campo | Valor |
|---|---|
| Nome oficial | Autos de Infração |
| Portal | `dadosabertos.aneel.gov.br` (CKAN) |
| Dataset (landing) | https://dadosabertos.aneel.gov.br/dataset/auto-de-infracao |
| Dataset UUID | `4d690c9d-8158-4b04-ae44-7d3de8616271` |
| Recursos | `auto-infracao.csv`, `dm-auto-de-infracao.pdf` |
| Granularidade | 1 linha por auto de infração lavrado |
| Cobertura temporal | contínua; portal acumula |
| Periodicidade na ANEEL | atualizações contínuas |
| Tamanho esperado | não baixado localmente hoje |
| Papel no TCC | **Não consumido** por `src/analysis/`. Mantido no catálogo para rastreabilidade e eventual integração (ver [`.ai/DATA_OVERVIEW.md §6.E`](../.ai/DATA_OVERVIEW.md) — multas não entram em `compensacao_rs`). |
| Como baixar | `make extract-aneel-full` ou `python3 -m src.etl.extract_aneel --with-complementares` |

### 2.4. `reclamacoes` — ANEEL (complementar)

| Campo | Valor |
|---|---|
| Nome oficial | Reclamações nos 1º e 2º Níveis da Distribuidora |
| Portal | `dadosabertos.aneel.gov.br` (CKAN) |
| Dataset (landing) | https://dadosabertos.aneel.gov.br/dataset/reclamacoes-no-1o-e-2o-niveis-da-distribuidora |
| Dataset UUID | `364859a2-7cb8-45ea-9c88-b4392516a6ba` |
| Recursos | 4 CSVs particionados (2010–2022 consolidado, 2023, 2024, 2025) + 1 PDF de dicionário |
| Granularidade | mensal × distribuidora × município × tipo de reclamação |
| Cobertura temporal | 2010–2025 (com lag de publicação esperado para 2024–2025) |
| Periodicidade na ANEEL | um CSV adicional por ano |
| Tamanho esperado | não baixado localmente hoje |
| Papel no TCC | **Não consumido**. Mantido para rastreabilidade. |
| Como baixar | `make extract-aneel-full` |

### 2.5. `ibge_dtb_2024` — IBGE (nuclear)

| Campo | Valor |
|---|---|
| Nome oficial | DTB — Divisão Territorial do Brasil 2024 |
| Portal | IBGE (geoftp público) |
| Landing institucional | https://www.ibge.gov.br/geociencias/organizacao-do-territorio/estrutura-territorial/23701-divisao-territorial-brasileira.html |
| URL do recurso | `https://geoftp.ibge.gov.br/organizacao_do_territorio/estrutura_territorial/divisao_territorial/2024/DTB_2024.zip` |
| Recursos | `DTB_2024.zip` (descompacta em `RELATORIO_DTB_BRASIL_2024_MUNICIPIOS.ods`, subdistritos, distritos) |
| Granularidade | 1 linha por município (variante .ods para municípios) |
| Cobertura temporal | versão 2024 (não há histórico versionado no script) |
| Periodicidade | anual (IBGE publica versão nova) |
| Tamanho esperado | ≈ 1.8 MB (ZIP) |
| Papel no TCC | **Dimensão municipal**. Cruza com `codmunicipioibge` em `indger_servicos_comerciais` para mapa do dashboard e integração rural/urbano pré-2022 (prevista em [`.ai/DATA_OVERVIEW.md §2.1`](../.ai/DATA_OVERVIEW.md)). |
| Idempotência | Script detecta ZIP já baixado (> 1 MB) e pula; sempre re-extrai. |

---

## 3. Reprodução do Zero

### 3.1. Fluxo canônico

```bash
# 1. Ambiente
make venv-recreate
make install
make doctor

# 2. Extração (nuclear apenas)
make extract        # ≡ extract-aneel + extract-ibge

# 3. Transformação para Parquet/CSV
make transform

# 4. Tabelas analíticas + relatórios + dashboards + validações
make pipeline
make qa-data

# 5. Servir localmente
make serve           # http://localhost:8051
# ou
make dev-serve       # backend FastAPI com --reload
```

`make pipeline` faz extração, transformação, análise, relatório, grupos, dashboards e validações. Para depurar uma etapa específica, rode `make extract`, `make transform`, `make analysis`, `make dashboard-full`, `make validate-contracts`, `make check-artifacts-full` e `make qa-data` separadamente.

### 3.2. Para baixar também as fontes complementares

```bash
make extract-aneel-full   # qualidade + indger + autos_infracao + reclamacoes
make extract-ibge
make transform
```

### 3.3. Saídas esperadas por etapa

| Etapa | Destino | O que verificar |
|---|---|---|
| `make extract` | `data/raw/` | Arquivos do catálogo nuclear presentes: `qualidade-atendimento-comercial.csv`, `dominio-indicadores.csv`, `indger-dados-comerciais.csv`, `indger-dados-servicos-comerciais-YYYY-MM.csv` (36 arquivos), `DTB_2024.zip` + conteúdo extraído. PDFs em `data/docs/`. |
| `make transform` | `data/processed/` | Parquet + CSV espelhados: `qualidade_comercial.*`, `indger_servicos_comerciais.*`, `indger_dados_comerciais.*`. |
| `make analysis` | `data/processed/analysis/` | CSVs raiz + `grupos/` + `neoenergia/`. CSVs são versionados para auditoria/demo; Parquets são espelhos locais gerados. |
| `make dashboard` | `app/frontend/dashboard_data.json` | ≈ 27 MB, versionado para demo/deploy estático e regenerado para reprodução científica. |

### 3.4. Diretórios ignorados pelo Git

| Padrão | Por quê |
|---|---|
| `data/raw/*.csv`, `data/raw/*.zip` | Pesados (até 7.7 GB), regeneráveis pelo script |
| `data/processed/*.{csv,parquet}` | Gerados pelo transform |
| `data/processed/analysis/**/*.parquet` | Espelhos analíticos locais, gerados por `make analysis` |

**Versionados intencionalmente:** `data/processed/analysis/**/*.csv` (auditoria) e `app/frontend/dashboard_*.json` (demo/deploy estático). Para reprodução científica, ambos devem ser regenerados após ETL.

---

## 4. Tratamento Aplicado (`transform_aneel.py`)

O módulo [`src/etl/transform_aneel.py`](../src/etl/transform_aneel.py) lê CSVs brutos e produz Parquet + CSV espelhado em `data/processed/`. As decisões de tratamento abaixo **não são óbvias do nome dos arquivos** — elas carregam história.

### 4.1. Encoding cascade

CSVs da ANEEL são heterogêneos em encoding entre arquivos (alguns utf-8, outros latin-1, um em cp1252). Em vez de assumir, o leitor tenta em ordem:

```
utf-16 → utf-8 → latin-1 → cp1252
```

Implementado de forma compartilhada em [`src/etl/schema_contracts.py`](../src/etl/schema_contracts.py) e no helper `_carregar_csv_aneel(...)` de `transform_aneel.py`. **Consequência reprodutível:** o mesmo CSV bruto produz sempre o mesmo Parquet determinístico.

Se um encoding novo aparecer, o sintoma é `UnicodeDecodeError` em cascata. Ver §6.

### 4.2. Separador `;`

Padrão CSV-BR adotado pela ANEEL. Hard-coded no leitor. Se um dia a ANEEL publicar com `,`, o sintoma é "1 coluna só" no DataFrame — capturado pela validação de contrato em seguida.

### 4.3. Deduplicação literal

```python
df.drop_duplicates().dropna(how="all")
```

Dedup é **por linha inteira idêntica**, não por chave de negócio. Consequência: se a ANEEL republicar uma linha com mudança em um único campo (ex.: correção monetária), mantém-se a versão antiga e a nova. Trade-off consciente — preferimos transparência a decisões silenciosas de merge.

### 4.4. Normalização de colunas

`df.columns = normalize_columns_list(df.columns)`

Garante que `sigAgente`, `SIGAGENTE`, `sigagente ` e cabeçalhos com BOM virem `sigagente`. É isso que permite os contratos de schema em `schema_contracts.py` usarem comparação case-insensitive.

### 4.5. Datas permanecem string

**Nenhuma coluna de data é convertida para `datetime64` em transform.** `datreferenciainformada` continua string `"YYYY-MM"` no Parquet. Motivo: evita erros de parse em linhas mal-formadas antes da análise; `build_analysis_tables.py` converte sob demanda com tratamento de erro explícito.

Se você importar o Parquet e quiser datas, faça:

```python
df["datreferenciainformada"] = pd.to_datetime(df["datreferenciainformada"], format="%Y-%m", errors="coerce")
```

### 4.6. Deduplicação de arquivos INDGER

O ZIP INDGER gera 36 CSVs mensais de serviços comerciais para 2023-01 a 2025-12. O transform deduplica os caminhos encontrados por `Path.resolve()`, ordena de forma determinística e falha se a contagem esperada deixar de ser 36 sem decisão explícita. Cada linha concatenada recebe `_source_file` para rastreabilidade.

### 4.7. Provenance e download seguro

Downloads usam retry/backoff, validação de `Content-Type`, conferência de `Content-Length`, arquivo temporário `.part` e remoção de parcial em erro. A extração ZIP protege contra zip-slip. Metadados mínimos (`url`, `ETag`, `Last-Modified`, tamanho, timestamp e git SHA) são gravados em `data/raw/provenance_downloads.jsonl`.

### 4.8. Sem chunking ou streaming

O transform carrega cada CSV inteiro em memória. O maior é `indger-dados-servicos-comerciais-*.csv` somados (≈ 7.7 GB). Em máquinas com < 16 GB RAM, o processo pode ser OOM-killed. Workaround atual: rodar em máquina com 16 GB+ de RAM. Solução futura: migrar para `polars` com lazy scan (ver §8).

### 4.9. Cutoff regulatório (`REN1000_CUTOFF_YEAR`)

A decisão de separar "pré-2022" vs "pós-2022" **não está em transform** — mora em [`src/analysis/build_analysis_tables.py`](../src/analysis/build_analysis_tables.py) com a constante `REN1000_CUTOFF_YEAR = 2021`. O transform preserva todos os anos; o filtro é downstream.

Contexto: REN 1000/2021 entrou em vigor em abril/2022. Todo ano ≤ 2021 é `pre_2022`; todo ano ≥ 2022 é `pos_2022`.

### 4.10. Saída espelhada Parquet + CSV

Para cada fonte nuclear, o transform grava:

- `data/processed/<nome>.parquet` — formato primário para análise (rápido, comprimido)
- `data/processed/<nome>.csv` — para inspeção humana / ferramentas sem pyarrow

Parquet é o formato canônico; CSV é conveniência.

### 4.11. Fail-fast por contrato

Ao final do transform, [`validate_processed_contracts`](../src/etl/schema_contracts.py#L199) roda e retorna `exit 1` se qualquer coluna obrigatória faltar. Regra: **nunca gerar tabelas analíticas em cima de Parquet inválido**.

---

## 5. Verificação Pós-Extração

Três níveis de verificação, do mais simples ao mais profundo.

### 5.1. Presença de arquivos

```bash
ls -la data/raw/ | grep -c "indger-dados-servicos-comerciais-"
# esperado: 36  (2023-01 a 2025-12)

test -f data/raw/qualidade-atendimento-comercial.csv && echo "qualidade OK"
test -f data/raw/indger-dados-comerciais.csv && echo "indger OK"
test -f data/raw/DTB_2024.zip && echo "dtb OK"
```

### 5.2. Contratos de schema

```bash
make validate-contracts
# esperado: "Schema contracts OK (raw + processed)."
```

O script [`scripts/validate_schema_contracts.py`](../scripts/validate_schema_contracts.py) confere:

- **Raw nuclear** (obrigatório): colunas mínimas presentes em cada CSV bruto esperado
- **Raw complementar** (opcional): valida apenas se o arquivo existe
- **Processed base**: colunas e dtypes mínimos nos Parquet gerados pelo transform
- **Analysis**: presença, dtypes/ranges críticos e regimes regulatórios nos CSVs em `data/processed/analysis/`

### 5.3. Smoke de imports + artefatos

```bash
make test-fast
# inclui: compilação, imports críticos, contratos de schema, artefatos core
```

### 5.4. Tamanhos de referência

Se os tamanhos abaixo divergirem > 20 %, desconfie (portal pode ter republicado com mudança de escopo):

| Arquivo | Tamanho esperado |
|---|---|
| `qualidade-atendimento-comercial.csv` | ≈ 85 MB |
| `dominio-indicadores.csv` | ≈ 80 KB |
| `indger-dados-comerciais.csv` | ≈ 107 MB |
| `indger-dados-servicos-comerciais-2023-01.csv` | ≈ 235 MB |
| `indger-dados-servicos-comerciais-*-*.csv` (total) | ≈ 7.7 GB |
| `DTB_2024.zip` | ≈ 1.8 MB |

### 5.5. Janela temporal efetiva

Para confirmar que o dado está fresco:

```bash
ls data/raw/indger-dados-servicos-comerciais-*.csv | sort | tail -1
# ex: indger-dados-servicos-comerciais-2025-12.csv  → cobertura vai até dez/2025
```

Se estiver faltando um mês recente, o portal ANEEL ainda não publicou. Políticas de lag: INDGER costuma ter 60–90 dias de atraso entre mês de referência e publicação.

---

## 6. Troubleshooting

### 6.1. `HTTPError: 404` em um recurso específico

**Sintoma:** `make extract-aneel` falha com "❌ ERRO HTTP: 404" num recurso específico.

**Causa:** ANEEL substituiu o CSV e o `resource_id` mudou.

**Correção:**

1. Abrir o `dataset_url` da fonte no navegador (ver §2)
2. Encontrar o recurso pelo nome (ex.: "Qualidade do Atendimento Comercial — CSV")
3. Copiar a nova URL de download (botão "Download" → URL tem padrão `/dataset/<uuid>/resource/<novo-id>/download/<arquivo>.csv`)
4. Substituir a `url` do recurso correspondente em [`src/etl/extract_aneel.py`](../src/etl/extract_aneel.py) (dict `CATALOGO`)
5. Re-rodar `make extract`

**Fallback por browser:** se o portal CKAN estiver instável, [`scripts/playwright/aneel-fetch.js`](../scripts/playwright/aneel-fetch.js) baixa recursos via Chromium headless. Sintaxe:

```bash
node scripts/playwright/aneel-fetch.js <INDICADOR> <ANO>
# ex: node scripts/playwright/aneel-fetch.js DIC 2024
```

### 6.2. `UnicodeDecodeError` em transform

**Sintoma:** `make transform` falha com `UnicodeDecodeError` mesmo após cascade.

**Causa:** CSV novo em encoding fora da lista conhecida (raro).

**Diagnóstico:**

```bash
file -bi data/raw/<arquivo>.csv
# ex: text/plain; charset=iso-8859-15
```

**Correção:** adicionar o encoding detectado à tupla em [`src/etl/schema_contracts.py:read_csv_header`](../src/etl/schema_contracts.py#L90):

```python
encodings = ("utf-16", "utf-8", "latin-1", "cp1252", "iso-8859-15")
```

Mesma mudança no leitor de transform (é o mesmo pattern).

### 6.3. `OSError: No space left on device`

**Sintoma:** disco cheio no meio do `make extract` (provavelmente durante descompactação do ZIP INDGER).

**Diagnóstico:**

```bash
df -h .         # espaço livre
du -sh data/   # quanto data/ ocupa hoje
```

**Correção:**

```bash
rm -rf data/raw/indger-dados-servicos-comerciais-*.csv data/raw/indger-dados-servicos-comerciais.zip
make extract-aneel
```

O pipeline é idempotente: re-extrai sem problema.

### 6.4. ZIP corrompido

**Sintoma:** `BadZipFile` na descompactação.

**Correção:**

```bash
rm data/raw/indger-dados-servicos-comerciais.zip   # ou DTB_2024.zip
make extract-aneel   # ou make extract-ibge
```

### 6.5. Validação de contrato falha (schema mismatch)

**Sintoma:** `make validate-contracts` retorna `raw schema mismatch: ... missing columns X, Y`.

**Causa:** a ANEEL renomeou uma coluna ou mudou o escopo do CSV.

**Correção:**

1. Abrir o CSV bruto com `head -1 data/raw/<arquivo>.csv` e comparar com as colunas em [`src/etl/schema_contracts.py:RAW_REQUIRED_COLUMNS_NUCLEAR`](../src/etl/schema_contracts.py)
2. Se a mudança foi só rename, ajustar o set
3. Se a mudança foi estrutural (coluna removida), investigar impacto downstream antes de relaxar o contrato

### 6.6. Memória insuficiente no transform

**Sintoma:** `make transform` mata o processo (`Killed` no terminal) em máquinas com < 16 GB RAM.

**Workaround:** rodar em máquina maior, ou comentar temporariamente o merge dos INDGER mensais em `transform_aneel.py` e processar em chunks. Solução definitiva em §8.

---

## 7. Camada Analítica (referência)

Esta seção é apenas um índice — detalhes moram em outros docs.

### 7.1. Fluxo downstream

```
data/processed/*.parquet
    │
    ▼
src/analysis/build_analysis_tables.py   → data/processed/analysis/*.csv (9 arquivos raiz)
    ├─▶ build_report.py                   → reports/relatorio_aneel.md
    ├─▶ grupos_diagnostico.py             → data/processed/analysis/grupos/*.csv (13 arquivos)
    ├─▶ neoenergia_diagnostico.py         → data/processed/analysis/neoenergia/*.csv (13 arquivos)
    └─▶ build_dashboard_data.py           → app/frontend/dashboard_data.json
                                            app/frontend/dashboard_*.json
```

### 7.2. Onde ler mais

| Pergunta | Doc |
|---|---|
| Granularidade e métricas de cada tabela analítica | [`.ai/DATA_OVERVIEW.md`](../.ai/DATA_OVERVIEW.md) |
| Colunas específicas (bruto + analítico) | [`docs/DICIONARIO_DADOS.md`](DICIONARIO_DADOS.md) + [`data/docs/table_schemas.txt`](../data/docs/table_schemas.txt) |
| Visão do pipeline para outro agente IA | [`.ai/PIPELINE.md`](../.ai/PIPELINE.md) |
| Convenções de código e commits | [`.ai/CONVENTIONS.md`](../.ai/CONVENTIONS.md) + [`CLAUDE.md`](../CLAUDE.md) |
| Arquitetura do dashboard frontend | [`app/frontend/README.md`](../app/frontend/README.md) + [`.ai/DASHBOARD.md`](../.ai/DASHBOARD.md) |

---

## 8. Gaps Conhecidos e Evolução

### 8.1. Integração IBGE DTB consumida pelo analytics

Hoje `extract_ibge.py` **baixa** e **descompacta** o DTB, mas nenhum módulo em `src/analysis/` cruza ainda `codmunicipioibge` com a dimensão municipal do IBGE. O protótipo isolado mora em worktree (ver histórico git), e o script alvo planejado é `src/analysis/integrate_ibge_rural_urbano.py` (ver [`.ai/DATA_OVERVIEW.md §2.1`](../.ai/DATA_OVERVIEW.md)). **Ação pendente:** implementar o consumidor.

### 8.2. Fontes complementares (`autos_infracao`, `reclamacoes`) sem consumidor

Ambas estão no catálogo e no validador, mas nenhuma análise as usa. Opções futuras:

- Integrar `auto-infracao.csv` para compor `custo_regulatorio_total` (multas + compensações) — ver [`.ai/DATA_OVERVIEW.md §6.E`](../.ai/DATA_OVERVIEW.md).
- Cruzar `reclamacoes` com transgressões como proxy de percepção do consumidor.

### 8.3. Sem checksum versionado dos brutos

Não há `SHA256SUMS` comprometido com o repo para sanity check de que o bruto baixado é idêntico ao que o autor do TCC usou. Risco baixo (ANEEL mantém recursos estáveis), mas vale formalizar.

### 8.4. Sem teste de integração ponta-a-ponta

`make test-fast` e `make test-smoke` cobrem imports, contratos e presença de artefatos. Não existe teste que mock-ou-real baixa + transforma + valida em um único run controlado. Candidato a uma fixture `tests/integration/test_extract_transform.py` usando `requests-mock`.

### 8.5. Transform sem streaming

O `indger-dados-servicos-comerciais-*.csv` combinado consome ≈ 10 GB de RAM no pandas atual. Migrar para `polars` lazy scan ou `pyarrow.dataset` resolveria.

### 8.6. PDFs de dicionário não são consumidos por código

Os 4 PDFs em `data/docs/` e `Manual-Envio-Dados-IndGer-ConectANEEL.pdf` são referência humana apenas. Candidato (ambicioso) futuro: extrair dicionário estruturado via LLM/OCR e versionar como YAML.

### 8.7. Lag de publicação das fontes complementares

`reclamacoes-n1e2-distribuidoras-2024.csv` e `-2025.csv` podem estar incompletos no portal da ANEEL. Se você estiver rodando `--with-complementares` num momento de publicação parcial, o contrato de schema continua passando (colunas iguais), mas a análise temporal fica viesada. Confira `datreferencia` máxima antes de usar.

---

## Apêndice — Comandos de Referência Rápida

```bash
# Extração
make extract                    # nuclear (ANEEL + IBGE)
make extract-aneel              # só ANEEL nuclear
make extract-aneel-full         # ANEEL nuclear + complementares
make extract-ibge               # só IBGE DTB

# Pipeline
make update-data                # extract + transform
make pipeline                   # update-data + analysis + report + grupos + dashboards

# Qualidade
make validate-contracts         # raw + processed
make test-fast                  # imports + contratos + artefatos core
make test-smoke                 # + neoenergia + dashboards

# Limpeza
make clean-analysis             # remove data/processed/analysis/
rm -rf data/raw/*               # reset total (vai precisar re-extrair)
```
