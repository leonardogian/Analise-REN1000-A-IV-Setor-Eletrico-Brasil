# Metodologia do Pipeline Make

Este documento explica o pipeline reprodutivel do TCC como cadeia metodologica
de evidencias. Ele serve de apoio para a secao 3.5 do texto escrito
("Validacao, rastreabilidade e reprodutibilidade") e para o fluxograma em
`Tcc_escrito/mtdpipeline.excalidraw`.

O objetivo nao e substituir o `Makefile`, mas traduzir o que cada comando faz em
termos de pesquisa: de onde o dado vem, qual script e executado, que artefato e
gerado e qual risco metodologico a etapa controla.

## Regra de Execucao

O `Makefile` usa a variavel `PYTHON` para evitar ambiguidade de ambiente:

```makefile
PYTHON_VENV := $(PROJECT_ROOT)/.venv/bin/python
PYTHON ?= $(if $(shell test -x "$(PYTHON_VENV)" && echo ok),$(PYTHON_VENV),python3)
```

Na pratica, os comandos usam primeiro `.venv/bin/python`. Se o ambiente virtual
nao existir, usam `python3`. Nao se deve pressupor o comando `python`, pois ele
pode nao existir na maquina local. Para reproduzir cientificamente o pipeline,
prepare o ambiente antes de rodar a cadeia completa:

```bash
make venv-recreate
make install
make doctor
make pipeline
```

## Fluxograma dos Comandos

O fluxograma abaixo espelha o desenho `Tcc_escrito/mtdpipeline.excalidraw`.
As setas pontilhadas para o lado explicam a funcao metodologica de cada target.

```mermaid
flowchart LR
  subgraph PREP["Preparacao do ambiente"]
    V["make venv-recreate"]
    I["make install"]
    D["make doctor"]
  end

  V -.-> VN["Recria .venv<br/>python3 -m venv .venv"]
  I -.-> IN["Instala requirements.txt<br/>.venv/bin/python -m pip install"]
  D -.-> DN["Verifica ambiente<br/>scripts/doctor_env.py"]

  PY["Interpretador do Makefile"]
  PY -.-> PYN["Preferencia: .venv/bin/python<br/>fallback: python3"]

  PREP --> PY --> P["make pipeline<br/>cadeia completa"]
  P -.-> PN["Executa update-data, dashboard-full,<br/>validate-contracts, check-artifacts-full e qa-data"]

  P --> UD["make update-data"]
  UD -.-> UDN["Atualiza dados de base<br/>extract + transform"]

  UD --> EX["make extract"]
  EX -.-> EXN["Baixa fontes nucleares<br/>ANEEL Dados Abertos + IBGE DTB"]

  EX --> EA["make extract-aneel"]
  EA -.-> EAN["Executa src.etl.extract_aneel<br/>Qualidade Comercial + INDGER"]

  EX --> EI["make extract-ibge"]
  EI -.-> EIN["Executa src.etl.extract_ibge<br/>referencia territorial IBGE"]

  EA -. opcional .-> EAF["make extract-aneel-full"]
  EAF -.-> EAFN["Inclui fontes complementares<br/>autos de infracao e reclamacoes"]

  UD --> TR["make transform"]
  TR -.-> TRN["Executa src.etl.transform_aneel<br/>data/raw -> data/processed<br/>CSV + Parquet"]

  P --> DF["make dashboard-full"]
  DF -.-> DFN["Regenera a camada analitica<br/>relatorios, grupos e JSONs"]

  DF --> AN["make analysis"]
  AN -.-> ANN["Executa build_analysis_tables<br/>gera data/processed/analysis"]

  DF --> RP["make report"]
  RP -.-> RPN["Executa build_report<br/>gera reports/relatorio_aneel.md"]

  DF --> GD["make grupos-diagnostico"]
  GD -.-> GDN["Executa grupos_diagnostico<br/>diagnosticos por grupos economicos"]

  DF --> ND["make neoenergia-diagnostico"]
  ND -.-> NDN["Mantem artefatos legados<br/>compatibilidade historica"]

  DF --> DB["make dashboard"]
  DB -.-> DBN["Executa build_dashboard_data<br/>gera dashboard_data.json e micro-payloads"]

  DF --> DT["make dashboard-transgressoes"]
  DT -.-> DTN["Executa dashboard_transgressoes<br/>gera JSON especifico de transgressoes"]

  P --> VC["make validate-contracts"]
  VC -.-> VCN["Valida raw, processed e analysis<br/>arquivos, colunas, tipos, faixas e regimes"]
  VC --> C{"Contratos<br/>aprovados?"}
  C -- "nao" --> STOP1["Interrompe a cadeia<br/>revisar fonte, ETL ou contrato"]
  C -- "sim" --> CA["make check-artifacts-full"]

  CA -.-> CAN["Confere artefatos esperados<br/>profile full em scripts/check_artifacts.py"]
  CA --> QA["make qa-data"]

  QA -.-> QAN["Audita coerencia numerica<br/>chaves, taxas, denominadores,<br/>identidade e cobertura temporal"]
  QA --> Q{"QA<br/>aprovado?"}
  Q -- "nao" --> STOP2["Interrompe interpretacao<br/>revisar artefatos analiticos"]
  Q -- "sim" --> TA["data/processed/analysis<br/>tabelas versionadas e auditaveis"]

  TA --> JS["data/processed/dashboard<br/>JSONs derivados para painel"]
  TA --> RES["Resultados do TCC<br/>interpretacao regulatoria"]
```

## Mapa dos Targets

| Target | O que executa | Entrada principal | Saida principal | Papel metodologico |
|---|---|---|---|---|
| `make venv-recreate` | `python3 -m venv .venv` | Python local | `.venv/` | Recria ambiente limpo para reduzir variacao local. |
| `make install` | `.venv/bin/python -m pip install -r requirements.txt` | `requirements.txt` | Dependencias instaladas | Garante bibliotecas consistentes para ETL e analise. |
| `make doctor` | `scripts/doctor_env.py` | Ambiente Python | Diagnostico do ambiente | Verifica imports e dependencias criticas antes da reproducao. |
| `make extract-aneel` | `$(PYTHON) -m src.etl.extract_aneel` | Dados Abertos ANEEL | `data/raw/*.csv` | Baixa fontes nucleares de Qualidade Comercial e INDGER. |
| `make extract-aneel-full` | `src.etl.extract_aneel --with-complementares` | Dados Abertos ANEEL | Raw nuclear + complementar | Permite baixar autos/reclamacoes, fora das metricas nucleares. |
| `make extract-ibge` | `$(PYTHON) -m src.etl.extract_ibge` | IBGE DTB | `data/raw/DTB_2024.zip` e extraidos | Integra referencia territorial e municipal. |
| `make extract` | `extract-aneel extract-ibge` | ANEEL + IBGE | `data/raw/` | Reproduz a camada bruta a partir das fontes oficiais. |
| `make transform` | `$(PYTHON) -m src.etl.transform_aneel` | `data/raw/` | `data/processed/*.{csv,parquet}` | Normaliza, tipa e comprime dados para analise. |
| `make update-data` | `extract transform` | Fontes oficiais | Dados tratados | Refaz a base bruta e processada antes da analise. |
| `make analysis` | `$(PYTHON) -m src.analysis.build_analysis_tables` | `data/processed/*.parquet` | `data/processed/analysis/*.csv` | Gera a camada auditavel principal do TCC. |
| `make report` | `$(PYTHON) -m src.analysis.build_report` | Tabelas analiticas | `reports/relatorio_aneel.md` | Produz relatorio textual derivado dos artefatos analiticos. |
| `make grupos-diagnostico` | `$(PYTHON) -m src.analysis.grupos_diagnostico` | Tabelas analiticas | `data/processed/analysis/grupos/*.csv` | Cria recortes por grupos economicos. |
| `make neoenergia-diagnostico` | `$(PYTHON) -m src.analysis.neoenergia_diagnostico` | Tabelas analiticas | `data/processed/analysis/neoenergia/*.csv` | Mantem compatibilidade com artefatos historicos. |
| `make dashboard` | `$(PYTHON) -m src.analysis.build_dashboard_data` | `data/processed/analysis/` | `data/processed/dashboard/dashboard_*.json` | Gera camada derivada para comunicacao no painel. |
| `make dashboard-transgressoes` | `$(PYTHON) -m src.analysis.dashboard_transgressoes` | Tabelas analiticas | `dashboard_transgressoes.json` | Separa payload especifico de transgressoes. |
| `make dashboard-full` | `analysis report grupos-diagnostico neoenergia-diagnostico dashboard dashboard-transgressoes` | Dados ja tratados | Analise + relatorios + JSONs | Regenera artefatos derivados sem rebaixar dados brutos. |
| `make validate-contracts` | `scripts/validate_schema_contracts.py` | Raw, processed e analysis | Falha ou OK | Detecta mudancas de schema, tipos, faixas e regimes. |
| `make check-artifacts-full` | `scripts/check_artifacts.py --profile full` | Artefatos gerados | Falha ou OK | Confirma completude dos arquivos necessarios. |
| `make qa-data` | `scripts/qa_data_audit.py` | `data/processed/analysis/` | Falha, alertas ou OK | Audita coerencia numerica, chaves, identidades e cobertura. |
| `make pipeline` | `update-data dashboard-full validate-contracts check-artifacts-full qa-data` | Fontes oficiais | Cadeia completa validada | Reproduz a pesquisa de ponta a ponta. |

## Como Usar no Texto do TCC

Ao descrever a secao 3.5, trate os comandos como controles de validade:

- `make pipeline` representa a reproducao integral da cadeia de evidencias.
- `make validate-contracts` representa a validacao estrutural.
- `make check-artifacts-full` representa a verificacao de completude.
- `make qa-data` representa a auditoria numerica e relacional.
- `data/processed/analysis/` e a camada auditavel principal.
- `data/processed/dashboard/` e camada derivada de comunicacao, nao fonte primaria.

Evite apresentar esses comandos como simples automacao. No texto academico, eles
devem aparecer como mecanismos de rastreabilidade, controle de erro e defesa
contra conclusoes baseadas em artefatos incompletos ou inconsistentes.

## Manutencao

Sempre que o `Makefile` mudar, revise:

- este documento;
- `.ai/PIPELINE.md`;
- `CLAUDE.md`;
- `README.md`;
- `AGENTS.md`;
- o desenho `Tcc_escrito/mtdpipeline.excalidraw`, quando a mudanca alterar o fluxo visual.
