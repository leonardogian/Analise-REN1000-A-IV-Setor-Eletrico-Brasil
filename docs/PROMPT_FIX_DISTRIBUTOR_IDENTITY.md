# Prompt para Corrigir Identidade das Distribuidoras — TCC REN 1000

> Cole este prompt inteiro numa conversa NOVA e VAZIA com Claude Opus em plan mode.

---

## PROMPT

Preciso que você entre em plan mode e crie um plano detalhado para corrigir o problema mais crítico do meu TCC: **a identidade das distribuidoras está inconsistente entre as tabelas analíticas**, causando joins quebrados, nomes NULL, e análises estatísticas com dados órfãos.

### Contexto do projeto

TCC de graduação analisando a eficácia da REN 1.000/2021 da ANEEL na qualidade dos serviços comerciais das distribuidoras de energia elétrica brasileiras. O projeto tem um pipeline Python (pandas) que:

1. Extrai CSVs da ANEEL (`src/etl/extract_aneel.py`)
2. Transforma e limpa (`src/etl/transform_aneel.py`) → Parquets em `data/processed/`
3. Gera tabelas analíticas (`src/analysis/build_analysis_tables.py`) → `data/processed/analysis/`
4. Gera JSONs para o dashboard (`src/analysis/build_dashboard_data.py`)

### O problema em detalhe

Existem **3 camadas do problema** que precisam ser resolvidas juntas:

#### CAMADA 1: distributor_id gerado diferente entre fontes

A função `build_distributor_id(sigagente, nomagente)` em `src/analysis/distributor_groups.py:45` gera IDs diferentes para a MESMA distribuidora dependendo de qual fonte de dados é usada:

- **Fonte anual** (`qualidade_comercial.parquet`): tem apenas `sigagente` (sem `nomagente`), então:
  - `COELBA` → `distributor_id = "coelba"`
  - `COSERN` → `distributor_id = "cosern"`
  - `ELEKTRO` → `distributor_id = "elektro"`
  - `CEEE-D` → `distributor_id = "ceee_d"`
  - `CEA` → `distributor_id = "cea"`

- **Fonte mensal** (`indger_dados_comerciais.parquet`): tem `sigagente` + `nomagente`, então:
  - `Neoenergia Coelba` → `distributor_id = "neoenergia_coelba"`
  - `Neoenergia Cosern` → `distributor_id = "neoenergia_cosern"`
  - `Neoenergia Elektro` → `distributor_id = "neoenergia_elektro"`
  - `CEEE Equatorial` → `distributor_id = "ceee_equatorial"`
  - `CEA Equatorial` → `distributor_id = "cea_equatorial"`

**Resultado:** 40 distribuidoras de `fato_indicadores_anuais` (114 total) não casam com nenhuma das 102 em `dim_distributor_group`. Apenas 74 (65%) têm match. As Neoenergias (foco do TCC!) são afetadas.

#### CAMADA 2: sigagente com formato diferente

- `fato_indicadores_anuais`: MAIÚSCULAS brutas da ANEEL (`AME`, `CEMIG-D`, `COELBA`)
- `dim_distributor_group`, `dim_distribuidora_porte`, tabelas mensais: Title Case normalizado (`Amazonas Energia`, `Cemig-D`, `Neoenergia Coelba`)

Isso acontece porque `annotate_distributor_group()` (linha 257) substitui `sigagente` pelo `distributor_name_sig`, mas o `build_fato_indicadores_anuais()` faz um `groupby` que preserva o `sigagente` original UPPERCASE antes dessa substituição ser aplicada.

#### CAMADA 3: distributor_label NULL em 99.3%

`build_fato_indicadores_anuais()` (linha 270-320) faz:
```python
keys = ["ano", "group_id", "distributor_id", "sigagente", "codigo_base", "classe_local"]
# groupby descarta TODAS as colunas de nome
fact = pd.concat([qs, qv, pm, cr], axis=1).reset_index()
```

Depois, `merge_fato_with_porte()` tenta trazer `distributor_label` de volta via merge com `dim_porte`, mas:
- `dim_porte` só tem anos 2023-2025
- O `sigagente` tem case diferente
- O `distributor_id` é diferente

Resultado: 33.969 de 34.193 registros (99.3%) em `fato_indicadores_anuais` têm `distributor_label = NaN`.

### Mapeamento das 40 distribuidoras órfãs

Estas são distribuidoras que existem em `fato_indicadores_anuais` mas NÃO em `dim_distributor_group`:

```
DISTRIBUIDORA ANTIGA (fato)          →  NOME ATUAL (INDGER 2023+)
──────────────────────────────────────────────────────────────────
COELBA (coelba)                      →  Neoenergia Coelba (neoenergia_coelba)
COSERN (cosern)                      →  Neoenergia Cosern (neoenergia_cosern)
ELEKTRO (elektro)                    →  Neoenergia Elektro (neoenergia_elektro)
CEA (cea)                            →  CEA Equatorial (cea_equatorial)
CEEE-D (ceee_d)                      →  CEEE Equatorial (ceee_equatorial)
CELESC (celesc)                      →  Celesc-Dis (celesc_dis)
AME (ame)                            →  Amazonas Energia (amazonas_energia)
BOA VISTA (boa_vista)                →  ??? (pode ser Roraima Energia)
LIGHT SESA (light_sesa)              →  ??? (provavelmente Light-Dis)
EQUATORIAL GO (equatorial_go)        →  ??? (provavelmente Equatorial Goiás)
EBO, EAC, EMR, EMS, EMT, ENF, EPB,  →  Rebranding Energisa (energisa_*)
ERO, ESE, ESS, ETO
CERAL (ceral), CERAL-DIS             →  Consolidações/renomeações
EDEVP, EEB, CNEE, CFLO               →  Podem ter sido incorporadas
ELETROPAULO (eletropaulo)            →  Enel SP (enel_sp)
CEB (ceb)                            →  Neoenergia Brasília (neoenergia_brasilia)
RGE SUL (rge_sul)                    →  ??? (CPFL ou manteve nome?)
```

### O que precisa ser feito

1. **Criar tabela de aliases** em `data/config/distributor_aliases.json` (ou usar o `distributor_names_overrides.json` existente) mapeando os 40 IDs antigos para os IDs canônicos atuais

2. **Corrigir `load_qualidade_comercial()`** em `build_analysis_tables.py` para aplicar os aliases ANTES do groupby, garantindo que `distributor_id` seja consistente com as tabelas mensais

3. **Corrigir `build_fato_indicadores_anuais()`** para preservar `distributor_label`, `distributor_name_sig`, e `nomagente` através do groupby (via `first()` no groupby ou re-merge após agregação)

4. **Regenerar todas as tabelas** com `python3 -m src.analysis.build_analysis_tables` e validar:
   - `fato_indicadores_anuais` tem `distributor_label` preenchido em >95% dos registros
   - `distributor_id` é consistente entre `fato_indicadores_anuais` e `dim_distributor_group`
   - As 5 Neoenergias (Brasília, Coelba, Cosern, Elektro, Pernambuco) aparecem corretamente com `group_id = "neoenergia"`

5. **Re-executar o notebook** `notebooks/diagnostico_dados.ipynb` e confirmar que o ranking não mostra mais `nan`

### Arquivos-chave para ler

```
src/analysis/distributor_groups.py          ← build_distributor_id(), annotate_distributor_group()
src/analysis/build_analysis_tables.py       ← build_fato_indicadores_anuais(), merge_fato_with_porte(), run_all()
data/config/distributor_groups_overrides.json  ← overrides manuais existentes
data/config/distributor_names_overrides.json   ← overrides de nomes existentes
data/processed/analysis/dim_distributor_group.csv  ← referência dos 102 IDs "corretos"
```

### Restrições

- Python 3.10+, pandas, na venv local (`.venv/`)
- `python3`, não `python`
- Não quebrar as tabelas mensais (2023-2025) que já estão corretas
- Não alterar os dados brutos (`data/raw/`, `data/processed/*.parquet`)
- Manter backward compatibility: o backend (`app/backend/main.py`) e dashboard devem continuar funcionando
- Rodar `make test-fast` sem erros após as mudanças

### Critérios de sucesso

```
✅ fato_indicadores_anuais.distributor_label preenchido >95%
✅ fato_indicadores_anuais.distributor_id ∩ dim_distributor_group.distributor_id > 100 (de 114)
✅ 5 Neoenergias com group_id="neoenergia" em TODOS os anos (2011-2023)
✅ sigagente consistente (Title Case) em TODAS as tabelas
✅ kpi_regulatorio_anual inalterado (métricas agregadas não devem mudar)
✅ make test-fast passa
✅ notebook ranking não mostra nan
```
