# Visão Completa dos Dados — Análise REN 1000

> **Referência técnica única para estrutura, cobertura, limitações e operacionalização dos dados do projeto TCC.**  
> Consultar este documento sempre antes de iniciar exploração ou análise de dados.

**Última atualização:** Mar 2026  
**Escopo:** REN 1000/2021 (regulação distribuidoras ANEEL); compensações financeiras & prazos de serviços.

---

## 1. Visão Geral — Tabelas de Fatos e Dimensões

### Tabelas de Análise (Processadas)

Localização: `data/processed/analysis/`

| Tabela | Tipo | Granularidade | Anos | Principal Métrica | Status |
|--------|------|---------------|------|-------------------|--------|
| **fato_transgressao_mensal_distribuidora** | Fato | Mensal × Distribuidora | 2023–2025 | `qtd_fora_prazo`, `compensacao_rs` | ✅ Validado |
| **fato_transgressao_mensal_porte** | Fato | Mensal × Distribuidora × Classe (Rural/Urbana) | 2023–2025 | Idem acima | ✅ Validado |
| **fato_indicadores_anuais** | Fato | Anual × Distribuidora × Indicador | 2011–2023 | `taxa_fora_prazo`, `compensacao_rs`, `prazo_medio` | ✅ Validado |
| **fato_servicos_municipio_mes** | Fato | Mensal × Município × Tipo Serviço × Distribuidora | 2023–2025 | `qtd_serv_realizado`, `qtd_fora_prazo` | ✅ Validado |
| **fato_uc_ativa_mensal_distribuidora** | Fato | Mensal × Distribuidora | 2023–2025 | `uc_ativa_mes` | ✅ Normalização |
| **fato_grupos_algoritmicos** | Fato Agregado | Pré-computado por dimensão | 2023–2025 | Consolidados por agrupamento | ✅ Performance |
| **kpi_regulatorio_anual** | KPI | Anual Brasil (agregado) | 2011–2023 | `taxa_fora_prazo`, `compensacao_rs` | ✅ Agregado |
| **dim_distribuidora_porte** | Dimensão | Anual × Distribuidora | 2023–2025 | `bucket_porte` (P/M/G/GG), `rank_porte_ano` | ⚠️ Apenas pós-2023 |
| **dim_indicador_servico** | Dimensão | Catálogo | Estático | Mapeamento serviços → famílias (QS/QV/PM/CR) | ✅ Referência |
| **dim_distributor_group** | Dimensão | Mapeamento Holdings | Estático | Agrupamento corporativo (Neoenergia, CPFL, Equatorial, etc.) | ✅ Hierarquia |

### Arquivos Brutos Processados

Localização: `data/processed/` (Parquet + CSV)

| Arquivo | Granularidade | Anos | Fonte Bruta | Validação |
|---------|---------------|------|-------------|-----------|
| **qualidade_comercial.parquet** | Anual × Indicador × Distributor | 2011–2023 | ANEEL `qualidade-atendimento-comercial.csv` | ✅ Schema contrato |
| **indger_servicos_comerciais.parquet** | Mensal × Município × Tipo Serviço × Distributor | 2023–2025 | ANEEL INDGER (36 CSVs mensais) | ✅ Schema contrato |
| **indger_dados_comerciais.parquet** | Mensal × Município × Distributor | 2023–2025 | ANEEL INDGER | ✅ Schema contrato |

---

## 2. Cobertura Temporal — Matriz Detalhada

### Períodos e Regulações

```
REN 414/2010 (Legacy)           REN 1000/2021 (Vigente)
┌────────────────────────┬──────────────────────────────┐
│  2011–2021 (anual)     │  2022–2025 (mensal + anual)  │
│  pre_2022              │  pos_2022                    │
└────────────────────────┴──────────────────────────────┘
```

**Cutoff:** `REN1000_CUTOFF_YEAR = 2021`

- **`pre_2022`:** ano ≤ 2021 (antes REN 1000 entrar em vigor em abr/2022)
- **`pos_2022`:** ano ≥ 2022 (depois REN 1000)

### Cobertura por Métrica

| Métrica | Pre-2022 (2011–2021) | Pos-2022 (2022–2025) | Comparabilidade | Notas |
|---------|:----:|:----:|:---:|------|
| **Taxa Fora Prazo %** | ✅ Anual | ✅ Mensal + Anual | **Excelente** | Série contínua 2011–2025 |
| **Compensação Total R$** | ✅ Anual | ✅ Mensal + Anual | **Excelente** | Série contínua 2011–2025 |
| **Normalizado (per 100k UC)** | ⚠️ UC proxy apenas | ✅ Mensal | **Moderada** | UC baseline estimado pré-2022 |
| **Classe Rural/Urbano** | ❌ Não existe | ✅ Mensal | **Limitada** | Pós-2022 somente |
| **Tipo Serviço Granular** | ❌ Não existe mensal | ✅ 43 tipos (mensal) | **Limitada** | INDGER pós-2022 |
| **Porte (P/M/G/GG)** | ✅ Anual proxy | ✅ Anual confirmado | **Moderada** | Via UCs categorizadas em quartis |

### Janelas de Tempo Confiáveis

```python
# Em src/analysis/config.py
SERIES_HISTORICA = (2011, 2023)    # TCC: análise pré/pós REN1000
ANOS_COMPARAVEIS = (2023, 2025)    # Dashboard: dados operacionais recentes
LONGRUN_CUTOFF = 2023              # Limite tabelas anuais longas
MENSAL_INICIO = 2023               # Dados mensais começam Jan 2023 (INDGER)
MENSAL_FIM = 2025                  # Até Mar 2025
```

---

## 3. Dicionário de Métricas

### Métricas Nucleares

#### `qtd_fora_prazo` — Contagem absoluta de transgressões
- **Tipo:** Integer (count)
- **Disponibilidade:**
  - Pre-2022: ✅ Anual em `fato_indicadores_anuais`
  - Pos-2022: ✅ Mensal em `fato_transgressao_mensal_*`
- **Cálculo:** Contagem de serviços realizados fora do prazo regulatório
- **Agregação:** Soma por período/distribuidora/serviço
- **Unidade:** Contagem (unitário)

#### `qtd_serv_realizado` (ou `qtd_serv`) — Total de serviços realizados
- **Tipo:** Integer (count)
- **Disponibilidade:**
  - Pre-2022: ✅ Anual em `fato_indicadores_anuais`
  - Pos-2022: ✅ Mensal em `fato_transgressao_mensal_*` e `fato_servicos_municipio_mes`
- **Cálculo:** Soma de todos os serviços (dentro + fora de prazo)
- **Agregação:** Soma por período
- **Unidade:** Contagem (unitário)

#### `taxa_fora_prazo` — Taxa de transgressão (%)
- **Tipo:** Float ∈ [0, 1]
- **Cálculo:** `taxa_fora_prazo = qtd_fora_prazo / qtd_serv_realizado`
- **Disponibilidade:** Pré-calculada em TODAS tabelas de fatos
- **Agregação:** Ponderada por `qtd_serv_realizado` (não média aritmética simples)
- **Unidade:** Proporção (0.05 = 5%)

#### `compensacao_rs` — Créditos cedidos na fatura (R$)
- **Tipo:** Float (moeda)
- **Componentes:**
  - **Pre-2022:** Débito de Grupo de Consumidor (DGC) / Crédito Regulatório (CR) apenas
  - **Pos-2022:** `vlrpagocompensacao` INDGER
- **⚠️ Limitação:** Não inclui multas ANEEL (Autos de Infração) ou indenizações judiciais
- **Disponibilidade:** Anual (pre-2022), Mensal (pos-2022)
- **Agregação:** Soma por período
- **Unidade:** BRL (Real)

#### `uc_ativa_mes` — Unidades Consumidoras ativas no mês
- **Tipo:** Integer
- **Disponibilidade:** ✅ Mensal 2023–2025 (INDGER) | ⚠️ Annual proxy pré-2022
- **Fonte:** INDGER `qtducativa` (campo mensal)
- **Agregação:** Usa-se a média mensal anual para representar ano calendário
- **Unidade:** Contagem de UCs

#### `fora_prazo_por_100k_uc_mes` — Taxa normalizada por 100k UCs
- **Tipo:** Float
- **Cálculo:** `(qtd_fora_prazo / uc_ativa_mes) × 100_000`
- **Disponibilidade:** ✅ Pos-2022 (mensal) | ⚠️ Não é calculada pré-2022 (UC proxy não mensal)
- **Unidade:** Falhas por 100k UCs / mês

#### `compensacao_rs_por_uc_mes` — Impacto financeiro por UC
- **Tipo:** Float (moeda)
- **Cálculo:** `compensacao_rs / uc_ativa_mes`
- **Disponibilidade:** ✅ Pos-2022 (mensal) | ❌ Pré-2022 indisponível
- **Unidade:** BRL/UC/mês

#### `compensacao_media_por_transgressao_rs` — Custo por falha
- **Tipo:** Float (moeda)
- **Cálculo:** `compensacao_rs / qtd_fora_prazo` (evitar divisão por zero)
- **Disponibilidade:** ✅ Mensal pos-2022
- **Unidade:** BRL/transgressão

#### `bucket_porte` — Categorização de tamanho
- **Tipo:** Categorical ∈ {P, M, G, GG}
- **Derivação:** Quartis das UCs ativas médias anuais
  - **GG (Giant):** >80º percentil de UC
  - **G (Grande):** 60º–80º
  - **M (Médio):** 40º–60º
  - **P (Pequeno):** <40º
- **Disponibilidade:** ✅ Anual via `dim_distribuidora_porte`
- **Unidade:** Ordinal/Categoria

#### `prazo_medio` — Dias médios para cumprir serviço
- **Tipo:** Float (dias)
- **Disponibilidade:** ✅ Anual em `fato_indicadores_anuais` (pre-2022 + pos-2022)
- **Agregação:** Média ponderada por `qtd_serv_realizado`
- **Unidade:** Dias

#### `taxa_compensacao_vs_receita` — Impacto de compensações na receita (%)
- **Tipo:** Float ∈ [0, 1] (proporcional)
- **Cálculo:** Derivada: `compensacao_rs / (receita_bruta_estimada)`
- **Disponibilidade:** ⚠️ Não calculada (receita bruta externa ao escopo)
- **Status:** Gap identificado — ver Roadmap Seção 9

---

## 4. Relacionamentos & Chaves Primárias

### Diagrama de Entidades

```
dim_distributor_group (Holdings/Corporativo)
    ↓ (distributor_id FK)
dim_distribuidora_porte (Tamanho por Ano)
    ↓ (distributor_id, ano FK)
┌─────────────────────────────────────┐
│                                     ↓
fato_transgressao_mensal_distribuidora
    (ano, mes, distributor_id, group_id)
    ↓ (distributor_id, ano) ←────────┘
fato_uc_ativa_mensal_distribuidora (normalizador)
    (ano, mes, distributor_id)

┌──────────────────────────────────────┐
│                                      ↓
fato_transgressao_mensal_porte
    (ano, mes, distributor_id, classe_local_servico)
    + fato_servicos_municipio_mes
    (ano, mes, codmunicipioibge, codtiposervico)
    ↓
dim_indicador_servico
    (sigindicador) ← mapeamento tipo serviço
```

### Chaves Primárias por Tabela

| Tabela | Chave Primária Lógica | Unicidade | Mãe/Pai (FK) |
|--------|----------------------|-----------|---|
| `fato_transgressao_mensal_distribuidora` | (ano, mes, distributor_id) | ✅ Única combinação | dim_distribuidora_porte(ano, distributor_id) |
| `fato_transgressao_mensal_porte` | (ano, mes, distributor_id, classe_local_servico) | ✅ Única combinação | Idem + tipo classe |
| `fato_indicadores_anuais` | (ano, distributor_id, codigo_base, classe_local) | ✅ Única combinação | dim_indicador_servico(sigindicador) |
| `fato_servicos_municipio_mes` | (ano, mes, codmunicipioibge, distributor_id, codtiposervico) | ✅ Única combinação | dim_indicador_servico, geocodificação |
| `fato_uc_ativa_mensal_distribuidora` | (ano, mes, distributor_id) | ✅ Única combinação | — (normalizador) |
| `dim_distribuidora_porte` | (ano, distributor_id) | ✅ Única combinação | — |
| `dim_distributor_group` | (group_id, distributor_id) | ✅ Única combinação | — |
| `dim_indicador_servico` | sigindicador (ou codigo_base) | ✅ Única | — |

### Índices Recomendados (Se PostgreSQL)

```sql
-- Performance para queries de série temporal
CREATE INDEX idx_transgressao_ano_mes 
  ON fato_transgressao_mensal_distribuidora (ano, mes, distributor_id);

CREATE INDEX idx_uc_ativa_ano_mes 
  ON fato_uc_ativa_mensal_distribuidora (ano, mes, distributor_id);

CREATE INDEX idx_servicos_municipio_codtipo 
  ON fato_servicos_municipio_mes (ano, mes, codmunicipioibge, codtiposervico);

-- Joins com dimensões
CREATE INDEX idx_dim_distributor_group_id 
  ON dim_distributor_group (group_id, distributor_id);

CREATE INDEX idx_dim_porte_ano 
  ON dim_distribuidora_porte (ano, distributor_id);
```

---

## 5. Transformações & Normalizações (Pipeline ETL)

### Pipeline Implementado

```
data/raw/*.csv (ANEEL/IBGE; INDGER serviços = 36 CSVs mensais 2023-2025)
        ↓
[1] extract_aneel.py
    ├─ Validação de encoding (utf-8, latin-1, cp1252)
    ├─ Deduplicação básica
    └─ Type casting initial
        ↓
[2] transform_aneel.py
    ├─ Parsing números BR: "1.234,56" → 1234.56
    ├─ Limpeza de nulos & outliers
    ├─ Validação de schema contracts (schema_contracts.py)
    └─ Salvamento em Parquet
        ↓
data/processed/*.parquet
        ↓
[3] build_analysis_tables.py (src/analysis/)
    ├─ Carregamento de Parquets brutos
    ├─ Aplicação overrides de grupo (data/config/distributor_groups_overrides.json)
    ├─ Cálculo de categorias (bucket_porte via quartis)
    ├─ Agrupamento mensal → dimensões
    ├─ Cálculo de métricas derivadas:
    │  ├─ taxa_fora_prazo = qtd_fora_prazo / qtd_serv_realizado
    │  ├─ fora_prazo_por_100k_uc_mes = (qtd_fora_prazo / uc_ativa_mes) × 100_000
    │  ├─ compensacao_rs_por_uc_mes = compensacao_rs / uc_ativa_mes
    │  └─ compensacao_media_por_transgressao_rs = compensacao_rs / qtd_fora_prazo
    ├─ Classificação período regulatório (pre_2022 / pos_2022)
    └─ Salvamento análise
        ↓
data/processed/analysis/*.csv
        ↓
[4] build_dashboard_data.py
    ├─ Leitura análise
    ├─ Agregações para UI (JSON structure)
    └─ Export JSON → app/frontend/dashboard_*.json
        ↓
app/frontend/dashboard_*.json (payload principal + micro-payloads)
```

### Transformações Críticas

#### 1. Parsing de Números (Brasil)

```python
# Entrada: "1.234.567,89" (1 milhão)
# Transformação:
import locale
locale.setlocale(locale.LC_ALL, 'pt_BR.UTF-8')
valor = float("1.234.567,89".replace('.', '').replace(',', '.'))
# Saída: 1234567.89
```

#### 2. Classificação de Porte (Quartis)

```python
# Cálculo em build_analysis_tables.py
df_porte['bucket_porte'] = pd.qcut(
    df_porte['uc_ativa_media_mensal'],
    q=4,
    labels=['P', 'M', 'G', 'GG'],
    duplicates='drop'
)
```

#### 3. Período Regulatório (Binary Flag)

```python
df['periodo_regulatorio'] = df['ano'].apply(
    lambda x: 'pre_2022' if x <= 2021 else 'pos_2022'
)
```

#### 4. Normalização por UC (100k base)

```python
df['fora_prazo_por_100k_uc_mes'] = (
    df['qtd_fora_prazo'] / df['uc_ativa_mes']
) * 100_000

# ⚠️ Cuidado: NaN quando uc_ativa_mes = 0 (raro, mas possível)
```

### Validações de Schema (Contratos Obrigatórios)

Arquivo: `src/etl/schema_contracts.py`

**Raw CSV Must-Have Columns:**

```python
QUALIDADE_COMERCIAL_SCHEMA = {
    'sigagente': str,           # Identificador distribuidora
    'sigindicador': str,        # Tipo indicador (QS/QV/PM/CR)
    'anoindice': int,           # Ano
    'numperiodoindice': str,    # Período (bimestre, trimestre, etc.)
    'vlrindiceenviado': float,  # Valor da métrica
}

INDGER_COMERCIAL_SCHEMA = {
    'datreferenciainformada': str,  # Data período (YYYY-MM)
    'sigagente': str,               # Distribuidora
    'nomagente': str,               # Nome distribuidora
    'qtducativa': int,              # UCs ativas
}

INDGER_SERVICOS_SCHEMA = {
    'datreferenciainformada': str,          # Data
    'sigagente': str,                       # Distribuidora
    'codtiposervico': str,                  # Código serviço (ex: "69")
    'dsctiposervico': str,                  # Tipo (ex: "Serviços Diversos")
    'dscprazo': str,                        # Prazo esperado
    'qtdservrealizado': int,                # Total serviços
    'vlrpagocompensacao': float,            # Compensação R$
}
```

---

## 6. Limitações Críticas

### A. Granularidade Mensal Ausente Pré-2022

- **Problema:** `fato_indicadores_anuais` é agregado anualmente 2011–2023
- **Impacto:** Impossível analisar transição mensal 2021 → 2022
- **Workaround:** Usar agregados anuais e saltar para 2023 mensal em análises
- **Mitigation:** Buscar ANEEL "Série Histórica Indicadores Mensais" (pode não existir em data pública)

### B. UCs Ativas: Proxy Pré-2022, Real Pós-2023

- **Problema:**
  - **2011–2022:** Não há campo `uc_ativa_mes` mensal publicado (usar estimativa anual)
  - **2023+:** INDGER fornece mensal (confiável)
- **Impacto:** Normalizações (fora_prazo_por_100k_uc_mes) são imprecisas pré-2022
- **Workaround:** Sinalizar em análise quando normalização é "approximate"

### C. Classe Local (Rural/Urbano) Incompleta Pré-2022

- **Problema:**
  - **2011–2021:** Fatos contêm `classe_local` (14 categorias genéricas; não diferencia rural/urbano)
  - **2022+:** `classe_local_servico` (explicitamente Rural/Urbana/Grupo A/B)
- **Impacto:** Análise comparativa rural/urbano pré-2022 é impossível
- **Workaround:** Integrar DTB (referência IBGE em `DTB_2024.zip`); mapear município → rural/urbano usando IBGE criteria

### D. Códigos de Serviço 69 e 93 (Cobertura Duvidosa)

- **Problema:** Códigos "69" (Serviços Diversos) e "93" (Leitura de Medidor) aparecem em fatos INDGER
- **Status:** Cobertura inconsistente entre distribuidoras e meses
- **Impacto:** Totais de serviços podem estar inflados pós-2022
- **Solução:** Tabelas alternativas em `sql/grupos_diagnostico_dbeaver.sql` filtram com flag `escopo_servico = 'sem_cod_69_93'`
- **Decisão recomendada:** Publicar análises AMBAS (com e sem 69/93) como "sensibilidade"

### E. Compensação = Créditos Cedidos Apenas

- **Problema:** `compensacao_rs` combina:
  - **Pre-2022:** DGC (Débito de Grupo de Consumidor) / CR (Crédito Regulatório)
  - **Pos-2022:** `vlrpagocompensacao` INDGER (créditos na fatura)
- **Não inclui:** Multas ANEEL, indenizações judiciais, honorários
- **Impacto:** Custo regulatório completo é **subestimado**
- **Workaround:** Integrar Autos de Infração ANEEL (API/scraping separado); marcar como "future integration"

### F. Período Regulatório: Cutoff Abrupto

- **Problema:** Mudança REN 414 → REN 1000 em abr/2022, mas análise usa ano inteiro (≤2021 vs ≥2022)
- **Impacto:** Ano 2022 contém transição (4 meses REN 414, 8 meses REN 1000)
- **Status:** Não decomposto; misturado no agregado 2022
- **Workaround:** Usar 2023+ para análise pós-REN1000 "pura"; marcar 2022 como "transição"

### G. Identidade e nomes de distribuidoras

- **Regra atual:** `distributor_id` representa a distribuidora factual e nao deve colapsar CNPJs/siglas distintas. Agregacao por holding usa `group_id`.
- **Motivo:** aliases antigos como `EBO`/`EPB` e `ENF`/`ESS` pertencem a grupos comuns, mas podem coexistir como entidades reguladas distintas.
- **Validação:** `make qa-data` checa colisoes, chaves duplicadas, labels faltantes, taxas fora de faixa e drift CSV/parquet.

### H. Ano 2023 Potencialmente Incompleto

- **Problema:** 2023 tem apenas 25% do volume de 2022 (7M vs 28M serviços) e 14 distribuidoras a menos (91 vs 105)
- **Impacto:** Análises pós-REN 1000 baseiam-se essencialmente em 2022 (que é ano de transição) se 2023 for descartado
- **Status:** Causa indeterminada — pode ser cobertura parcial na ANEEL ou mudança de reporte
- **Recomendação:** Documentar como ressalva no TCC; usar 2023 com cautela

### I. Anos 2024-2025 com Cobertura Fragmentada

- **Problema:** 2024 tem apenas 17 distribuidoras, 2025 tem 11
- **Impacto:** Análises anuais comparativas são inviáveis para estes anos
- **Status:** Dados estão em processo de publicação pela ANEEL
- **Recomendação:** Excluir de análises anuais; usar apenas os dados mensais de 2024-2025 (INDGER) para análise de tendência

---

## 7. Exemplos Operacionais

### Exemplo 1: Comparar Taxa de Transgressão 2021 vs 2023 por Porte

**Cenário:** Visualizar se REN 1000 melhorou desempenho por tamanho de distribuidora.

**Código Pandas:**

```python
import pandas as pd

# Carregar dados
df_indicadores = pd.read_parquet('data/processed/analysis/fato_indicadores_anuais.parquet')
df_porte = pd.read_parquet('data/processed/analysis/dim_distribuidora_porte.parquet')

# Filtrar anos
df_2021 = df_indicadores[df_indicadores['ano'] == 2021].copy()
df_2023 = df_indicadores[df_indicadores['ano'] == 2023].copy()

# Juntar com porte
df_2021 = df_2021.merge(
    df_porte[df_porte['ano'] == 2021][['distributor_id', 'bucket_porte']],
    on='distributor_id'
)
df_2023 = df_2023.merge(
    df_porte[df_porte['ano'] == 2023][['distributor_id', 'bucket_porte']],
    on='distributor_id'
)

# Agregação por porte
comparacao = pd.concat([
    df_2021.groupby('bucket_porte')['taxa_fora_prazo'].agg(['mean', 'std', 'count']).assign(ano=2021),
    df_2023.groupby('bucket_porte')['taxa_fora_prazo'].agg(['mean', 'std', 'count']).assign(ano=2023)
])

print(comparacao)
```

**⚠️ Caveats:**
- 2021 é anual; 2023 é agregado anual de mensais
- Distribuição de portes pode ter mudado (UC crescimento)

---

### Exemplo 2: Quanto Custou Compensação (R$) em Dez/2024 por Distribuidora?

**Cenário:** Dashboard de impacto financeiro mensal pour decisão de reajustes tarifários.

**Código Pandas:**

```python
import pandas as pd

# Carregar mensal
df_mensal = pd.read_parquet('data/processed/analysis/fato_transgressao_mensal_distribuidora.parquet')

# Filtrar mês
df_dez_2024 = df_mensal[(df_mensal['ano'] == 2024) & (df_mensal['mes'] == 12)].copy()

# Juntar nomes distribuidoras
df_grupos = pd.read_parquet('data/processed/analysis/dim_distributor_group.parquet')
df_dez_2024 = df_dez_2024.merge(
    df_grupos[['distributor_id', 'group_label']],
    on='distributor_id',
    how='left'
)

# Ordenar por compensação
rank = df_dez_2024[['group_label', 'distributor_id', 'compensacao_rs', 'taxa_fora_prazo']]\
    .sort_values('compensacao_rs', ascending=False)\
    .head(20)

print(f"Top 20 Distribuidoras (Dez 2024) - R$ Compensação:")
print(rank.to_string(index=False))
print(f"\nTotal compensado: R$ {df_dez_2024['compensacao_rs'].sum():,.2f}")
```

**⚠️ Caveats:**
- Dados até Mar 2025; Dez/2024 está completo
- Compensação = créditos cedidos (não inclui multas)

---

### Exemplo 3: Distribuição de Classe (Rural vs Urbano) — Dez 2023

**Cenário:** Analisar se transgressões afetam mais rural ou urbano.

**Código Pandas:**

```python
import pandas as pd

# Carregar mensal por porte (inclui classe_local)
df_porte = pd.read_parquet('data/processed/analysis/fato_transgressao_mensal_porte.parquet')

# Filtrar período
df_dez_2023 = df_porte[(df_porte['ano'] == 2023) & (df_porte['mes'] == 12)].copy()

# Agregação por classe
agregado = df_dez_2023.groupby('classe_local_servico').agg({
    'qtd_serv_realizado': 'sum',
    'qtd_fora_prazo': 'sum',
    'compensacao_rs': 'sum',
    'uc_ativa_mes': 'mean',
}).reset_index()

# Calcular taxa
agregado['taxa_fora_prazo'] = agregado['qtd_fora_prazo'] / agregado['qtd_serv_realizado']
agregado['fora_prazo_por_100k_uc'] = (agregado['qtd_fora_prazo'] / agregado['uc_ativa_mes']) * 100_000
agregado['compensacao_media'] = agregado['compensacao_rs'] / agregado['qtd_fora_prazo']

print("Dez/2023 - Comparação Rural vs Urbano:")
print(agregado[['classe_local_servico', 'taxa_fora_prazo', 'fora_prazo_por_100k_uc', 'compensacao_media']])
```

**⚠️ Caveats:**
- `fato_transgressao_mensal_porte` existe apenas 2023+
- Pre-2022 não tem decomposição rural/urbano (ver Roadmap)

---

### Exemplo 4: Series Temporal 2023–2025 de Uma Distribuidora

**Cenário:** Dashboard em tempo real de desempenho mensal; trend de melhoria/piora.

**Código Pandas:**

```python
import pandas as pd
import matplotlib.pyplot as plt

# Carregar mensal
df_mensal = pd.read_parquet('data/processed/analysis/fato_transgressao_mensal_distribuidora.parquet')

# Filtrar distribuidora (ex: "NEOENERGIA SÃO PAULO")
sigagente_target = "SAOPAU"  # Exemplo; usar o código correto

df_sao_paulo = df_mensal[df_mensal['sigagente'] == sigagente_target].copy()
df_sao_paulo = df_sao_paulo.sort_values(['ano', 'mes'])
df_sao_paulo['data'] = pd.to_datetime(
    df_sao_paulo['ano'].astype(str) + '-' + df_sao_paulo['mes'].astype(str).str.zfill(2) + '-01'
)

# Plot
fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 8))

# Taxa
ax1.plot(df_sao_paulo['data'], df_sao_paulo['taxa_fora_prazo'] * 100, marker='o', label='Taxa (%)')
ax1.set_ylabel('Taxa Fora Prazo (%)')
ax1.set_title('NEOENERGIA SÃO PAULO - Série Temporal 2023–2025')
ax1.grid(True, alpha=0.3)
ax1.legend()

# Compensação
ax2.bar(df_sao_paulo['data'], df_sao_paulo['compensacao_rs'] / 1_000_000, label='R$ (Milhões)')
ax2.set_ylabel('Compensação (R$ Milhões)')
ax2.set_xlabel('Mês')
ax2.grid(True, alpha=0.3)
ax2.legend()

plt.tight_layout()
plt.savefig('output/sao_paulo_timeline.png', dpi=150)
plt.show()

print(f"\nResumo:\n{df_sao_paulo[['data', 'taxa_fora_prazo', 'compensacao_rs', 'uc_ativa_mes']].to_string()}")
```

**⚠️ Caveats:**
- Apenas pos-2022 (mensal); pré-2022 é anual
- Média móvel (3 meses) pode suavizar ruído mensal

---

## 8. Checklist de Validação de Dados

**Execute before any analysis:**

### ✅ Cobertura Temporal

- [ ] Seu análise usa anos dentro de `[2011, 2025]`? Se pré-2022, tem granularidade anual apenas? 
- [ ] Dados mensais — confirmar se ≥ 2023 (INDGER começa Jan 2023)?
- [ ] Usando 2022? Lembrar que é ano de **transição** REN 414 → REN 1000 (abr/2022).

### ✅ Normalização por UC

- [ ] Se usar `fora_prazo_por_100k_uc_mes` ou `compensacao_rs_por_uc_mes`: confirmar se post-2022?
- [ ] Se pré-2022 e precisar normalizar: usar `uc_ativa_media_mensal` anual de `dim_distribuidora_porte` (proxy)?
- [ ] Verificar NaN em `uc_ativa_mes`? (raro, mas sinaliza UC faltando)

```python
# Check
df.groupby('periodo_regulatorio')['fora_prazo_por_100k_uc_mes'].apply(lambda x: x.isna().sum())
```

### ✅ Classe Local (Rural/Urbano)

- [ ] Analisando classe_local_servico e usando pré-2022? ❌ PARAR — não existe mensal antes.
- [ ] Pós-2022 com classe_local_servico: confirmar valores únicos esperados (ex: "Rural", "Urbano", "Grupo A", "Grupo B")?

```python
# Check
print(df[df['periodo_regulatorio'] == 'pre_2022']['classe_local'].unique())
print(df[df['periodo_regulatorio'] == 'pos_2022']['classe_local_servico'].unique())
```

### ✅ Códigos 69 e 93 (Serviços Diversos / Leitura)

- [ ] Filtrando `codtiposervico`? Se incluindo 69/93, documentar como **sensibilidade**?
- [ ] Totais de serviço saltam ano-a-ano? Verificar se 69/93 começam/param em mês específico.

```python
# Check
df_mensal.groupby(['ano', 'mes']).apply(
    lambda x: (x['codtiposervico'] == '69').sum() / len(x) * 100
).describe()  # % de 69 ao longo do tempo
```

### ✅ Compensação (Interpretação)

- [ ] Comunicando `compensacao_rs` como "todas as multas"? ❌ Corrigir — é **créditos cedidos apenas**.
- [ ] Usando pré-2022 + pós-2022 comparação? Lembrar: estrutura DGC/CR pode diferir de `vlrpagocompensacao` INDGER (ambos incluídos, mas metodologia ≠).

### ✅ Agregações de Taxa

- [ ] Se agregando `taxa_fora_prazo` por período: **está ponderada por `qtd_serv_realizado`**? Não média aritmética simples?

```python
# ✅ Correto
taxa_agg = df.groupby('distributor_id').apply(
    lambda x: (x['qtd_fora_prazo'].sum() / x['qtd_serv_realizado'].sum())
)

# ❌ Errado (não ponderado)
taxa_agg_wrong = df.groupby('distributor_id')['taxa_fora_prazo'].mean()
```

### ✅ Chaves e Relacionamentos

- [ ] Juntando com `dim_distribuidora_porte`? Garantindo **mesmo ano** em ambas tabelas?
- [ ] Juntando com `dim_distributor_group`? Confirmar quais distribuidoras estão ativas (`selector_enabled = True`)?

```python
# Check
fato_2023 = fato[fato['ano'] == 2023]
porte_2023 = porte[porte['ano'] == 2023]
merged = fato_2023.merge(porte_2023, on=['ano', 'distributor_id'], how='left')
print(f"Rows merged: {len(merged)}, NaN na porte: {merged['bucket_porte'].isna().sum()}")
```

### ✅ Dados Faltando

- [ ] Contagem de linhas esperada vs real? Exemplo: 102 distribuidoras × 12 meses × 3 anos = 3672 linhas `fato_transgressao_mensal_distribuidora`?

```python
# Check
n_distributor = df['distributor_id'].nunique()
n_meses = df.groupby(['ano', 'mes']).ngroups
print(f"Distribuidoras: {n_distributor}, Períodos: {n_meses}, Esperado: {n_distributor * n_meses}")
print(f"Linhas reais: {len(df)}")
```

### ✅ Outliers e Anomalias

- [ ] Taxa > 1.0 (100%)? Verificar divisão por zero ou overflow.
- [ ] Compensação = 0 mas qtd_fora_prazo > 0? Investigar por quê (Ex: compensação não cedida, cliente não cobrado).
- [ ] Porte mudou entre anos (mesmo `distributor_id`)? Normal (crescimento UC).

```python
# Check anomalias
print("Taxa > 100%:")
print(df[df['taxa_fora_prazo'] > 1.0][['ano', 'distributor_id', 'qtd_fora_prazo', 'qtd_serv_realizado', 'taxa_fora_prazo']])

print("\nCompensação=0 mas Transgressões>0:")
print(df[(df['compensacao_rs'] == 0) & (df['qtd_fora_prazo'] > 0)].head())
```

---

## 9. Roadmap de Gaps & Prioridades

### Priority 1 (Alto Impacto, Baixo Esforço)

#### 1.1 Dados Mensais Pré-2022

- **Gap:** Qualidade Comercial (2011–2021) é anual; impossível análise mensal pré-2022.
- **Busca:** ANEEL "Série Histórica de Indicadores Mensais" (pode estar em portal dados abertos ou via FOIA).
- **Impacto:** Permitiria análise mensal contínua 2011–2025 (transição REN 414 → REN 1000 mais precisa).
- **Esforço:** Baixo (busca + reformatação se encontrados).
- **ETA:** Semanas.
- **Dono:** Pesquisa e documentação de fontes.

#### 1.2 Documentar Cobertura Códigos 69 e 93

- **Gap:** Cobertura de "Serviços Diversos" (69) e "Leitura Medidor" (93) não explicita quando começam/param.
- **Ação:** Análise em `fato_servicos_municipio_mes`: por distribuidora/mês, % de 69+93 no total de serviços.
- **Impacto:** Sensibilidade análises (rodar com e sem 69/93).
- **Esforço:** Baixo (script de verificação).
- **ETA:** Dias.
- **Dono:** Script em `scripts/analyze_codes_69_93.py`.

### Priority 2 (Moderado Impacto, Moderado Esforço)

#### 2.1 Integração Rural/Urbano Pré-2022 via IBGE DTB

- **Gap:** Classe local pré-2022 não diferencia rural/urbano; impossível análise comparativa.
- **Solução:** Usar IBGE DTB (DTB_2024.zip já na repo) para mapear município → rural/urbano (IBGE criteria).
- **Impacto:** Permitir análise rural/urbano 2011–2025.
- **Esforço:** Moderado (ETL municipal, join com municípios).
- **ETA:** 2–3 semanas.
- **Dono:** Script em `src/analysis/integrate_ibge_rural_urbano.py`.

#### 2.2 Validação UC-Ativa Baseline Pré-2022

- **Gap:** UC-ativa proxy pré-2022 pode estar desalinhada com realidade (usado em normalizações).
- **Ação:** Buscar ANEEL se publica UC ativa anual 2011–2022 (mesmo que anual).
- **Impacto:** Melhorar confiança de `fora_prazo_por_100k_uc` pré-2022.
- **Esforço:** Baixo (confirmação com ANEEL).
- **ETA:** Semanas (requer comunicação com ANEEL).
- **Dono:** Fiscal de integração com ANEEL.

### Priority 3 (Baixo Impacto, Alto Esforço)

#### 3.1 Integração de Multas ANEEL (Autos de Infração)

- **Gap:** `compensacao_rs` não inclui multas regulatórias; custo total está subestimado.
- **Solução:** Scraping/API de Autos de Infração ANEEL (se disponível) + ETL integrando com fatos.
- **Impacto:** Custo regulatório mais preciso.
- **Esforço:** Alto (coleta + cleaning + harmonização de períodos).
- **ETA:** 1–2 meses.
- **Dono:** Pesquisa de fontes ANEEL Multas.

#### 3.2 Feed Contínuo INDGER (Automação)

- **Gap:** Dashboard congelado em Mar/2025; atualizar manualmente mês-a-mês.
- **Solução:** Integrar Kestra ou cron com API ANEEL INDGER; pull automático mensalmente.
- **Impacto:** Dashboard sempre atualizado.
- **Esforço:** Alto (desenvolvimento Kestra + CI/CD).
- **ETA:** 1 mês.
- **Dono:** DevOps / Engenharia de dados.

#### 3.3 PostgreSQL Operacional + Índices

- **Gap:** Dados em Parquet; sem PostgreSQL operacional (só referência em SQL).
- **Solução:** Containerizar PostgreSQL (Docker), carregar Parquets, criar índices, expor via API FastAPI.
- **Impacto:** Performance queries complexas; analytics em tempo real.
- **Esforço:** Alto (setup + tuning + API).
- **ETA:** 2–3 semanas.
- **Dono:** Arquitetura de backend.

### Priority 4 (Nice to Have)

#### 4.1 Indicadores Confiabilidade (DEC/FEC)

- **Gap:** TCC não inclui DEC (Duração Equivalente Interrupção) / FEC (Frequência).
- **Status:** Out of scope oficial (TCC = prazos comerciais apenas).
- **Se explorar:** Buscar em ANEEL "Indicadores de Confiabilidade" (série separada).

#### 4.2 Receita Bruta (para Taxa Compensação vs Receita)

- **Gap:** Métrica proposta "taxa_compensacao_vs_receita" não calculada (receita bruta externa).
- **Status:** Out of scope (requer dados de receita operacional, não pública em ANEEL).
- **Se explorar:** Integrar relatórios financeiros das distribuidoras (CVM / balanços anuais).

---

## 📋 Status Geral

| Aspecto | Status | Detalhe |
|--------|--------|---------|
| **Dados prontos para análise?** | ✅ **Sim** | Parquets validados, limpos, derivadas computadas em `data/processed/analysis/` |
| **Cobertura temporal TCC?** | ✅ Excelente | 2011–2025 (pré/pós REN 1000 clara) |
| **Cobertura mensal?** | ⚠️ Parcial | ✅ 2023–2025 via INDGER; ⚠️ 2011–2021 apenas anual |
| **Normalización por UC?** | ⚠️ Parcial | ✅ 2023–2025 real; ⚠️ 2011–2022 proxy |
| **Classe Rural/Urbano?** | ⚠️ Parcial | ✅ 2023–2025; ❌ 2011–2021 |
| **SQL + Índices?** | ⚠️ Draft | Script de referencia; sem PG operacional |
| **Dashboard atualizado?** | ✅ Mar 2025 | JSON estático; feed automático = roadmap |
| **Documentação?** | ✅ Excelente | DICIONARIO_DADOS.md, GUIA_ANALISE.md, este DATA_OVERVIEW.md |
| **Limitações conhecidas?** | ✅ Documentadas | Códigos 69/93, UC proxy, compensação = créditos, período 2022 transição |

---

## 🔗 Referências Internas

- [DICIONARIO_DADOS.md](../docs/DICIONARIO_DADOS.md) — Dicionário completo de todas as colunas
- [GUIA_ANALISE.md](../docs/GUIA_ANALISE.md) — Padrões de análise recomendados
- [src/etl/schema_contracts.py](../src/etl/schema_contracts.py) — Validações de schema obrigatório
- [src/analysis/build_analysis_tables.py](../src/analysis/build_analysis_tables.py) — Pipeline de construção das tabelas
- [sql/grupos_diagnostico_dbeaver.sql](../sql/grupos_diagnostico_dbeaver.sql) — Queries de referência (com/sem 69/93)
- [data/config/distributor_groups_overrides.json](../data/config/distributor_groups_overrides.json) — Mapa de holdings
- [Auditoria de qualidade dos dados](../docs/DATA_QUALITY_AUDIT.md) — checks numericos e backlog de achados
