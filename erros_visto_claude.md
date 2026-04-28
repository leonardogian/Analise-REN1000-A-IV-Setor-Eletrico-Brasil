# Auditoria de Engenharia de Dados — TCC ANEEL (REN 414 vs REN 1000)

## Contexto

Auditoria completa do pipeline ETL/análise/dashboard do TCC que compara a eficácia da REN 1000/2021 contra a revogada REN 414/2010 nos serviços comerciais de distribuidoras de energia. Solicitada pelo autor para garantir **integridade da análise comparativa** antes da defesa.

**Escopo coberto:**
- ETL: `src/etl/extract_aneel.py`, `extract_ibge.py`, `transform_aneel.py`, `schema_contracts.py`
- Análise: `src/analysis/build_analysis_tables.py` (43KB), `build_dashboard_data.py` (57KB), `grupos_diagnostico.py`, `dashboard_transgressoes.py`, `distributor_groups.py`, `metrics.py`, `build_report.py`, `neoenergia_diagnostico.py`, `config.py`
- Validação/Carga: `scripts/validate_schema_contracts.py`, `check_artifacts.py`, `load_to_postgres.py`, `qa_audit.py`, `smoke_imports.py`, `doctor_env.py`, `Makefile`

**Resultado:** 70+ achados, sumarizados por severidade. Os de severidade CRÍTICA distorcem diretamente os números que vão para o texto da tese.

---

## Sumário Executivo (top 10 que mais ameaçam a validade científica)

| # | Achado | Arquivo | Tipo | Severidade |
|---|---|---|---|---|
| 1 | CSVs ANEEL lidos sem `decimal=","` e sem cast numérico → todo `vlrpagocompensacao` pode estar como `string` | `transform_aneel.py:84,179,236,293,358` | Risco de Distorção | **CRÍTICA** |
| 2 | `fillna(0.0)` em pivot histórico mascara ausência como zero, inflando variação % pre/pos REN 1000 | `build_analysis_tables.py:332-333` | Risco de Distorção | **CRÍTICA** |
| 3 | Médias de razões em `rk_agg` e `ind_agg` (média de taxas já-derivadas) → holdings pequenas sobreponderadas | `build_dashboard_data.py:1093-1114` | Erro de Lógica | **CRÍTICA** |
| 4 | Janela assimétrica: 11 anos pré vs 2 anos pós somados como totais sem normalização anual | `build_analysis_tables.py:711-722`, `build_dashboard_data.py:185-210` | Risco de Distorção | **CRÍTICA** |
| 5 | Sobrescrita silenciosa de nomes de distribuidoras (4 fontes) — **provável raiz do bug do CLAUDE.md** | `build_analysis_tables.py:1070-1076` + 3 outros | Erro de Lógica | **CRÍTICA** |
| 6 | Schema contracts NÃO valida dtypes nem ranges; cobre só 3 de 18+ artefatos analíticos | `schema_contracts.py:72-87,90-98` | Faltante | **CRÍTICA** |
| 7 | Pipeline inteiro sem coluna `regime_regulatorio` versionada — comparação 414 vs 1000 sem rastro | Schema processed | Faltante | **CRÍTICA** |
| 8 | `load_to_postgres` faz DROP+APPEND não-atômico; tabela fica em estado inconsistente em caso de falha | `load_to_postgres.py:13-19` | Erro | **CRÍTICA** |
| 9 | `glob + rglob` no INDGER duplica leitura dos mesmos CSVs no `data/raw/` raiz | `transform_aneel.py:156-168` | Erro de Lógica | **CRÍTICA** |
| 10 | Drift CSV vs Parquet **observado AGORA em disco**: alguns CSVs de 22-abr coexistem com parquets de 03-abr | `data/processed/analysis/` | Erro (estado runtime) | **CRÍTICA** |

---

## RELATÓRIO DETALHADO POR CAMADA

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# CAMADA 1 — EXTRAÇÃO (`src/etl/extract_*.py`)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### A1. Download não valida `Content-Type` nem integridade

- 📍 **Arquivo/Módulo:** `src/etl/extract_aneel.py:201-237` (`baixar_arquivo`)
- 🚨 **Tipo de Problema:** Erro de Lógica (CRÍTICA)
- 💡 **Análise Crítica:** Se o CKAN da ANEEL responder 200 com HTML de manutenção, ou se a conexão truncar durante o stream, o arquivo é salvo como CSV "OK" e o pipeline lê HTML como CSV. Sem checagem de `Content-Type`, `Content-Length` esperado, hash, ou ETag — uma queda silenciosa de servidor invalida a comparação REN 414 vs REN 1000 sem ninguém perceber.
- 🛠️ **Solução:**
```python
ct = response.headers.get("Content-Type", "")
if recurso_tipo == "csv" and "html" in ct.lower():
    raise RuntimeError(f"Servidor retornou HTML ({ct}) em vez de CSV")
expected = response.headers.get("Content-Length")
if expected and int(expected) != bytes_baixados:
    caminho_destino.unlink(missing_ok=True)
    raise RuntimeError("Download truncado")
```

### A2. `except Exception` deixa arquivo parcial em disco
- 📍 **Arquivo/Módulo:** `extract_aneel.py:235-237`
- 🚨 **Tipo:** Erro de Lógica (ALTA)
- 💡 **Análise:** Em caso de disco cheio durante download de 7,5 GB do INDGER, o arquivo parcial **não é removido**. Próxima execução pode confundir parcial com baixado.
- 🛠️ **Solução:**
```python
except Exception as e:
    caminho_destino.unlink(missing_ok=True)
    print(f"ERRO inesperado: {e}")
    return False
```

### A3. `requests.get(timeout=120)` aplica timeout só em headers, não no corpo
- 📍 **Arquivo/Módulo:** `extract_aneel.py:213`
- 🚨 **Tipo:** Faltante (ALTA)
- 💡 **Análise:** Para ZIPs de 7,5 GB, conexão estagnada no meio do stream pendura indefinidamente. Sem retry/backoff, instabilidade de rede invalida toda a extração.
- 🛠️ **Solução:** `requests.adapters.HTTPAdapter(max_retries=Retry(total=3, backoff_factor=2))` + watchdog de progresso por chunk.

### A4. Vulnerabilidade Zip-Slip em `descompactar_zip`
- 📍 **Arquivo/Módulo:** `extract_aneel.py:240-251`
- 🚨 **Tipo:** Erro de Lógica (ALTA — segurança + integridade)
- 💡 **Análise:** `zf.extract(membro, destino)` sem validar que `membro` resolve dentro de `destino` permite arquivos com path `../../...`. Sem hash do ZIP baixado, MITM ou substituição maliciosa pode gravar fora de `data/raw/`. Também: nenhuma validação de número de CSVs extraídos vs. esperado (~36) → ZIP truncado passa despercebido.
- 🛠️ **Solução:**
```python
target = (destino / membro).resolve()
if not str(target).startswith(str(destino.resolve())):
    raise RuntimeError(f"Zip-slip: {membro}")
zf.extract(membro, destino)
```

### A5. Validação de contratos só roda se `total_falha == 0`
- 📍 **Arquivo/Módulo:** `extract_aneel.py:312-324`
- 🚨 **Tipo:** Erro de Lógica (MÉDIA)
- 💡 **Análise:** Falha de download de PDF não-crítico bloqueia validação de schema dos CSVs nucleares. Dissociar criticidade.

### A6. Sem idempotência: `extract_aneel` re-baixa 7,5 GB sempre
- 📍 **Arquivo/Módulo:** `extract_aneel.py` (geral)
- 🚨 **Tipo:** Faltante (MÉDIA)
- 💡 **Análise:** `extract_ibge.py:58-60` já implementa cache; `extract_aneel.py` não. Encoraja o estudante a comentar partes do catálogo e introduzir inconsistências.

### A7. Sem validação pós-extração além de schema de colunas
- 📍 **Arquivo/Módulo:** `extract_aneel.py` (geral)
- 🚨 **Tipo:** Faltante (ALTA)
- 💡 **Análise:** Não checa: número mínimo de linhas, range de datas (`AnoIndice` deve cobrir 2011–2023; INDGER deve cobrir 2023-01–2025-12), UFs/distribuidoras esperadas. Arquivo truncado em janeiro/2024 é aceito → análise enviesada.

### A8. `extract_ibge.py` cache frágil (`tamanho > 1MB`)
- 📍 **Arquivo/Módulo:** `extract_ibge.py:58-60`
- 🚨 **Tipo:** Erro de Lógica (MÉDIA)
- 💡 **Análise:** Heurística de tamanho não detecta atualização do DTB IBGE — pipeline pode rodar 6 meses com versão velha de municípios. Sem ETag/HEAD check.

### A9. `extract_ibge.py` sem `validate_raw_contracts`
- 📍 **Arquivo/Módulo:** `extract_ibge.py` (geral)
- 🚨 **Tipo:** Faltante (ALTA)
- 💡 **Análise:** O `.ods` IBGE nunca é validado (existe? aba esperada? colunas certas?). Mudança de aba quebra silenciosamente todos os joins distribuidora→município.

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# CAMADA 2 — TRANSFORMAÇÃO (`src/etl/transform_aneel.py`, `schema_contracts.py`)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### B1. ⚠️ **CRÍTICA MÁXIMA** — Sem `decimal=","`, sem `parse_dates`, sem `dtype=` no `read_csv`
- 📍 **Arquivo/Módulo:** `transform_aneel.py:84,179,236,293,358` (todas as `transformar_*`)
- 🚨 **Tipo:** Risco de Distorção (CRÍTICA)
- 💡 **Análise:** Toda métrica financeira da ANEEL usa vírgula decimal BR (`"1.234,56"`). Sem `decimal=","`, o pandas lê como `dtype=object`. Soma e média sobre object com vírgulas BR retornam concatenação ou NaN silencioso. `AnoIndice` vira `float64` se houver UM NaN (chave `2023.0` ≠ `2023`). `DatReferenciaInformada` sem `parse_dates` agrupa por mês/ano de forma lexicográfica (`"01/2024" < "1/2023"`). **Toda a comparação financeira REN 414 vs REN 1000 está, hoje, sob risco real de estar somando strings ou ordenando datas como texto.**
- 🛠️ **Solução:**
```python
df = pd.read_csv(
    arquivo, sep=";", encoding=enc, low_memory=False,
    decimal=",", thousands=".",
    parse_dates=["DatReferenciaInformada", "DatLavraturaAutoInfracao"],
    dayfirst=True,
    dtype={
        "AnoIndice": "Int64",
        "SigAgente": "string",
        "CodIBGEMunicipio": "Int64",
    },
)
# Pós-leitura, conversão explícita do que for métrica:
for col in ["VlrIndiceEnviado", "VlrPagoCompensacao", "QtdServRealizado", "QtdServRealizDescPrazo"]:
    if col in df.columns:
        df[col] = pd.to_numeric(df[col], errors="coerce")
```

### B2. `glob + rglob` duplica CSVs do INDGER
- 📍 **Arquivo/Módulo:** `transform_aneel.py:156-168`
- 🚨 **Tipo:** Erro de Lógica (CRÍTICA)
- 💡 **Análise:** `list(...glob) + list(...rglob)` retorna o mesmo arquivo 2x se o CSV estiver em `data/raw/` raiz. Resultado: concat duplicado → todas as métricas de INDGER serviços comerciais inflada em 2x. Os globs `*servico*comercia*.csv` e `*servicos*comercia*.csv` também são redundantes.
- 🛠️ **Solução:**
```python
arquivos = sorted({p for p in DIR_RAW.rglob("*servico*comercia*.csv")})
```

### B3. Concat dos 36 CSVs INDGER sem rastrear origem
- 📍 **Arquivo/Módulo:** `transform_aneel.py:175-190`
- 🚨 **Tipo:** Erro de Lógica (ALTA)
- 💡 **Análise:** Se um CSV mensal vier sem `vlrpagocompensacao`, `concat` insere NaN sem warning, e o mês fica como "zero compensações" — distorce o teste de hipótese central da tese.
- 🛠️ **Solução:** registrar `_source_file` por DataFrame, validar interseção de colunas via `assert set(df.columns) == EXPECTED_COLS`.

### B4. `drop_duplicates()` sem `subset=`
- 📍 **Arquivo/Módulo:** `transform_aneel.py:104,193,246,306,373`
- 🚨 **Tipo:** Erro de Lógica (ALTA)
- 💡 **Análise:** Sem `subset` deduplica só linhas 100% idênticas. Duplicatas de chave de negócio com pequena diferença em descrição livre sobrevivem; verdadeiras retransmissões duplicadas inflam totais.
- 🛠️ **Solução:** `df.drop_duplicates(subset=["sigagente","datreferenciainformada","codtiposervico","anoindice"], keep="last")`.

### B5. `dropna(how="all")` insuficiente; sem `dropna=False` em groupbys
- 📍 **Arquivo/Módulo:** `transform_aneel.py:110,194,247,311,378` + uso a jusante
- 🚨 **Tipo:** Risco de Distorção (MÉDIA)
- 💡 **Análise:** Linhas com chave preenchida mas métrica NaN sobrevivem. Pior: nenhum `groupby(..., dropna=False)` no projeto inteiro — categorias com chave NaN somem silenciosamente das agregações.

### B6. Encoding fallback inconsistente entre transform e schema_contracts
- 📍 **Arquivo/Módulo:** `transform_aneel.py:82-96` vs `schema_contracts.py:101-121`
- 🚨 **Tipo:** Erro de Lógica (MÉDIA)
- 💡 **Análise:** transform usa `["utf-8","latin-1","cp1252"]`; schema_contracts usa `["utf-16","utf-8","latin-1","cp1252"]`. Latin-1 nunca falha na decodificação (todos bytes válidos), então iteração sempre para nele mesmo se o arquivo for cp1252/utf-16. Validação verde + transform corrompido = pior cenário.

### B7. `transformar_reclamacoes` valida múltiplos anos com schema único
- 📍 **Arquivo/Módulo:** `transform_aneel.py:381-386`
- 🚨 **Tipo:** Erro de Lógica (ALTA)
- 💡 **Análise:** Valida CSVs 2010-2022, 2023, 2024, 2025 usando contrato apenas de 2023. A transição REN 414→1000 é exatamente onde os schemas mudam — e o validador está cego justamente nesse ponto.

### B8. `df.columns.str.lower()` aplicado **depois** de `drop_duplicates`
- 📍 **Arquivo/Módulo:** `transform_aneel.py:113,195,248,312,379`
- 🚨 **Tipo:** Risco de Distorção (MÉDIA)
- 💡 **Análise:** Se houver duas colunas que diferem só em case (`DatReferencia` e `datreferencia`), elas colidem após o lower e a segunda sobrescreve a primeira sem aviso.

### B9. Boilerplate idêntico em 5 funções `transformar_*`
- 📍 **Arquivo/Módulo:** `transform_aneel.py:62-143, 175-200, 220-270, 277-331, 358-400`
- 🚨 **Tipo:** Redundância (MÉDIA)
- 💡 **Análise:** 200+ linhas idênticas (encontrar arquivo → encoding → drop_duplicates → dropna → strip+lower → validar contrato → salvar parquet+csv). Adicionar `decimal=","` exige editar em 5 lugares.
- 🛠️ **Solução:**
```python
def _carregar_csv_aneel(
    path: Path,
    contrato: list[str],
    contexto: str,
    dtype_overrides: dict | None = None,
    parse_dates: list[str] | None = None,
) -> pd.DataFrame:
    """Single source of truth para leitura+limpeza de CSV ANEEL."""
    encodings = ["utf-8", "latin-1", "cp1252"]
    last_err = None
    for enc in encodings:
        try:
            df = pd.read_csv(
                path, sep=";", encoding=enc, low_memory=False,
                decimal=",", thousands=".",
                dtype=dtype_overrides or {},
                parse_dates=parse_dates or [],
                dayfirst=True,
            )
            break
        except Exception as e:
            last_err = e
    else:
        raise RuntimeError(f"Falha em todos encodings para {path}") from last_err

    df.columns = [str(c).strip().lstrip("﻿").lower() for c in df.columns]
    df = df.drop_duplicates(subset=_chave_negocio(contexto), keep="last")
    validate_raw_columns(df, contrato, contexto)
    return df
```

### B10. `schema_contracts` valida só **nomes de colunas**, nunca dtypes
- 📍 **Arquivo/Módulo:** `schema_contracts.py:72-87, 199-220`
- 🚨 **Tipo:** Faltante (CRÍTICA)
- 💡 **Análise:** Como B1 não converte tipos, e B10 não valida tipos, a regressão silenciosa fica indetectável de ponta a ponta. Este é o gap arquitetural mais grave.
- 🛠️ **Solução:** Estender contratos para `dict[str, dict[str, str]]` com `{coluna: dtype_esperado}`, comparar via `pq.read_schema(path).field(col).type` ou usar `pandera`.

### B11. Cobertura processed parcial — só 3 de 18+ artefatos
- 📍 **Arquivo/Módulo:** `schema_contracts.py:72-87`
- 🚨 **Tipo:** Faltante (CRÍTICA)
- 💡 **Análise:** Nenhum dos artefatos em `data/processed/analysis/` (que alimentam o capítulo de resultados do TCC) tem contrato — `fato_indicadores_anuais`, `fato_transgressao_mensal_*`, `fato_uc_ativa_mensal_distribuidora`, `kpi_regulatorio_anual`, `dim_*` ficam sem schema check.

### B12. Reclamações 2010-2022/2024/2025 sem contrato
- 📍 **Arquivo/Módulo:** `schema_contracts.py:32-51`
- 🚨 **Tipo:** Faltante (ALTA)
- 💡 **Análise:** Apenas `-2023.csv` tem contrato. O arquivo histórico **mais importante para a tese** (2010-2022, período REN 414) não tem schema check.

### B13. BOM `﻿` não removido em `normalize_columns`
- 📍 **Arquivo/Módulo:** `schema_contracts.py:90-92`
- 🚨 **Tipo:** Risco de Distorção (BAIXA)
- 💡 **Análise:** `strip()` não remove BOM. Primeira coluna pode virar `﻿sigagente` e nunca bater com contrato.
- 🛠️ **Solução:** `str(col).strip().lstrip("﻿").lower()`.

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# CAMADA 3 — ANÁLISE (`src/analysis/`)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### C1. `fillna(0.0)` no pivot histórico mascara ausência de reporte
- 📍 **Arquivo/Módulo:** `build_analysis_tables.py:332-333`
- 🚨 **Tipo:** Risco de Distorção (CRÍTICA)
- 💡 **Análise:** Distribuidora que não reportou compensação em 2018 vira "compensou R$ 0,00". Quando se calcula `(pos_comp - pre_comp) / pre_comp * 100` em `build_dashboard_data.py:1133`, o `pre_comp` agregado fica artificialmente próximo de zero por causa de muitos zeros falsos → variação % vira `+∞%` ou `+90.000%`. As flags `has_qs/has_qv/has_pm/has_cr` que detectariam isso **nunca são consultadas** a jusante.
- 🛠️ **Solução:** Preservar NaN nas séries históricas; propagar `has_*` para etapas a jusante e excluir das variações % onde a presença não está garantida em ambos os períodos.

### C2. Médias de razões em `rk_agg` (ranking de grupos)
- 📍 **Arquivo/Módulo:** `build_dashboard_data.py:1093-1100`
- 🚨 **Tipo:** Erro de Lógica (CRÍTICA)
- 💡 **Análise:** `rk_agg` agrega por `group_id` usando `mean` de `taxa_fora_prazo`, `compensacao_rs_por_uc_mes` etc. Estas métricas já são razões calculadas por linha. Tirar média simples ignora o porte de cada distribuidora — Coelba e Cosern viram peso 1:1. Holdings com muitas distribuidoras pequenas (Energisa, Equatorial) parecem piores do que são. **Falsifica o ranking comparativo.**
- 🛠️ **Solução:** somar numerador e denominador, depois dividir:
```python
rk_agg["taxa_fora_prazo"] = rk_agg["qtd_fora_prazo"] / rk_agg["qtd_serv_realizado"]
rk_agg["fora_prazo_por_100k_uc_mes"] = (rk_agg["qtd_fora_prazo"] / rk_agg["exposicao_uc_mes"]) * 100_000
rk_agg["compensacao_rs_por_uc_mes"] = rk_agg["compensacao_rs"] / rk_agg["exposicao_uc_mes"]
```

### C3. Mesmo erro em `ind_agg` para variação pre/pos
- 📍 **Arquivo/Módulo:** `build_dashboard_data.py:1110-1114`
- 🚨 **Tipo:** Erro de Lógica (CRÍTICA — afeta o número central da tese)
- 💡 **Análise:** Cada linha de `fato_indicadores_anuais` é {ano, group_id, distributor_id, codigo_base, classe_local}. Tirar média mistura serviços (cód. 60 com cód. 81), classes (rural com urbana) e anos (2011 com 2021). O número final perde significado científico.
- 🛠️ **Solução:** somar QV/QS/compensação/UC nos níveis grupo×período e calcular as razões a partir dos somatórios.

### C4. Janela assimétrica REN 414 (11 anos) vs REN 1000 (2 anos)
- 📍 **Arquivo/Módulo:** `build_analysis_tables.py:711-722`, `build_dashboard_data.py:185-210`
- 🚨 **Tipo:** Risco de Distorção (CRÍTICA)
- 💡 **Análise:** `pre_compensacao_total` soma 11 anos contra 2 anos pós, mas é exibido como "delta_compensacao" — leitor recebe a falsa impressão de redução de 80%+ quando na verdade é só janela 5x menor. O frontend não recebe a duração de cada janela.
- 🛠️ **Solução:** expor `n_anos_pre` e `n_anos_pos` no payload e calcular `media_anual_compensacao` ou `compensacao_anualizada`. Considerar também usar período pareado (2018-2021 vs 2022-2025) para simetria.

### C5. Bug "distributor names" — sobrescrita silenciosa de 4 fontes
- 📍 **Arquivo/Módulo:** `build_analysis_tables.py:1070-1076` + `build_dashboard_data.py:118-145` + `grupos_diagnostico.py:88-130` + `distributor_groups.py:267-270`
- 🚨 **Tipo:** Erro de Lógica (CRÍTICA — provável raiz do bug do CLAUDE.md)
- 💡 **Análise:** **4 implementações divergentes** de `compose_distributor_label`:
  - Uma retorna `legal` quando `sigagente` vazio.
  - Outra retorna `" — Legal"` (com hífen sem prefixo).
  - Outra ignora alias.
  - Pior: `distributor_id = slugify(sig or name)` — se `sigagente` mudar de "CELESC-DIS" para "CELESC DIS", vira **dois IDs distintos**, dim ganha duas linhas, e a sobrescrita escolhe arbitrariamente.
- 🛠️ **Solução:**
  1. Mover `compose_distributor_label` para `distributor_groups.py` como **fonte única**.
  2. Resolver aliases via `distributor_aliases.json` **antes** de derivar `distributor_id`.
  3. `assert` que cada `distributor_id` tem nome único; raise se houver divergência.
  4. Remover as 3 cópias.

### C6. Dupla contagem por `classe_local` em `fato_indicadores_anuais`
- 📍 **Arquivo/Módulo:** `build_analysis_tables.py:294-323`
- 🚨 **Tipo:** Erro de Lógica (CRÍTICA)
- 💡 **Análise:** `classe_local` é derivado por regex em `dscindicador`. Mesmo `(ano, distributor_id, codigo_base)` pode aparecer com **2 linhas** se `dscindicador` tiver variantes ("CR60 (Rural)" e "CR60"). Quando `build_franquias_insights` agrega por `group_id, periodo_regulatorio`, conta a mesma compensação 2x.
- 🛠️ **Solução:**
```python
assert fact.duplicated(subset=["ano","distributor_id","codigo_base"]).sum() == 0, "Dupla contagem detectada"
```
+ canonização de `classe_local` antes do pivot.

### C7. Fallback silencioso em `build_regulatory_long_summary` mistura classes
- 📍 **Arquivo/Módulo:** `build_dashboard_data.py:720-726`
- 🚨 **Tipo:** Erro de Lógica (CRÍTICA)
- 💡 **Análise:**
```python
if class_filtered.empty or class_filtered["ano"].nunique() < 5:
    long_base = long_base[long_base["ano"] <= 2023].copy()  # FALLBACK: TODAS as classes!
```
Quando uma classe tem < 5 anos, o código silenciosamente descarta o filtro e usa todas. Frontend exibe "Distribuidoras Rural — série longa" mas mostra dados misturados de Urbana, Grupo A etc. **Sem flag, sem aviso.**
- 🛠️ **Solução:** preservar a classe e marcar `data_quality_note = "fallback_to_all_classes"` para o frontend ocultar/avisar.

### C8. `Grupo B` colapsa rural+urbano — perde a distinção central da REN 1000
- 📍 **Arquivo/Módulo:** `build_analysis_tables.py:104-118` + `513-519` (`normalize_regulatory_class`)
- 🚨 **Tipo:** Risco de Distorção (ALTA)
- 💡 **Análise:** A REN 1000 aumentou prazos especificamente para **áreas rurais**. O pipeline classifica corretamente em 4 classes mas depois colapsa para 3. O usuário do dashboard que clica em "Grupo B" vê média misturando rural e urbano — perdendo justamente a hipótese mais relevante da tese.
- 🛠️ **Solução:** preservar 4 classes (`grupo_a`, `grupo_b_rural`, `grupo_b_urbana`, `outros`).

### C9. Análise de mix de serviços só cobre 2023+ (omite a transição)
- 📍 **Arquivo/Módulo:** `grupos_diagnostico.py:407,458` + `dashboard_transgressoes.py:36-37`
- 🚨 **Tipo:** Erro de Lógica (ALTA)
- 💡 **Análise:** `ANOS_COMPARAVEIS = (2023, 2025)` — alertas de quebra de mix não captam **nada** na transição REN 414→1000 (que é o ponto da tese). Dashboard de "transgressões" é só pós-1000 mas o nome sugere comparação.

### C10. Top-20 com `latest_year` instável quando 2025 é parcial
- 📍 **Arquivo/Módulo:** `build_dashboard_data.py:866-867`
- 🚨 **Tipo:** Risco de Distorção (ALTA)
- 💡 **Análise:** Se 2025 só tem 3 meses, distribuidoras Norte/Nordeste com sazonalidade ficam com `uc_ativa_media_mensal` artificialmente baixa.
- 🛠️ **Solução:** `latest_year = max(ano for ano in dim_porte.ano if (dim_porte[dim_porte.ano==ano].meses_com_dados >= 12).all())`.

### C11. Métricas reescritas inline em 10+ lugares em vez de usar `metrics.py`
- 📍 **Arquivo/Módulo:** `build_dashboard_data.py:411-425, 546-560, 589-603, 646-655, 683-697` + `build_analysis_tables.py:751-755, 812-816, 832-836`
- 🚨 **Tipo:** Redundância (ALTA)
- 💡 **Análise:** `metrics.py` define `calc_taxa_fora_prazo`, `calc_fora_prazo_por_100k`, `calc_compensacao_por_uc` mas funções de dashboard reescrevem inline. Em mudança de regra, atualiza-se 3 e esquece-se 7. Em particular, `calc_fora_prazo_por_100k` multiplica por `PER_100K`, mas inline às vezes esquece.
- 🛠️ **Solução:** importar `from src.analysis.metrics import calc_*` em todos os pontos.

### C12. `holding mapping` duplicado em 3 lugares (regex + override + lista hardcoded)
- 📍 **Arquivo/Módulo:** `distributor_groups.py:51-78,170-199` + `build_dashboard_data.py:1085-1090` (`_KNOWN_LABELS`)
- 🚨 **Tipo:** Redundância (ALTA)
- 💡 **Análise:** Adicionar nova holding requer editar 3 lugares. `_KNOWN_LABELS` não consulta o JSON override → labels divergentes. Fallback `gid.replace("_"," ").title()` produz "Cpfl Paulista" sem acento.
- 🛠️ **Solução:** consumir único `distributor_groups_overrides.json` em todos os pontos; remover lista hardcoded.

### C13. `taxa_fora_prazo > 1.0` apenas contada, não corrigida
- 📍 **Arquivo/Módulo:** `grupos_diagnostico.py:194-196`
- 🚨 **Tipo:** Faltante (validação) (ALTA)
- 💡 **Análise:** Taxa = transgressões/serviços ∈ [0,1]. Valores > 1 indicam bug de escopo (QV de uma família, QS de outra) ou erro de raw. Linhas inválidas vão para o dashboard e inflam médias.
- 🛠️ **Solução:** raise ou clip(0,1) com `flag_dado_invalido=True` para o frontend filtrar.

### C14. Re-derivação inline de `periodo_regulatorio` com fallback para 9999
- 📍 **Arquivo/Módulo:** `build_dashboard_data.py:1196-1207`
- 🚨 **Tipo:** Redundância + Erro de Lógica (ALTA)
- 💡 **Análise:**
```python
ano_ts = int(row["date_str"].split("-")[0])  # parse manual
ts_data.append({..., "periodo_regulatorio": "pre_2022" if ano_ts <= 2021 else "pos_2022"})
```
`try/except` retorna `9999` em falha → silenciosamente classificado como `pos_2022`.
- 🛠️ **Solução:** usar `classify_periodo_regulatorio` de `metrics.py`.

### C15. `exposicao_uc_mes` na pré-agregação inclui meses sem UC ativa
- 📍 **Arquivo/Módulo:** `build_analysis_tables.py:622-624` + `build_dashboard_data.py:550-559`
- 🚨 **Tipo:** Risco de Distorção (ALTA)
- 💡 **Análise:** Distribuidora reportou serviços mas não UC num mês → `uc_ativa_mes=NaN`. Soma anual via `("uc_ativa_mes","sum")` trata NaN como 0; `exposicao_uc_mes` agregada fica baixa, inflando `fora_prazo_por_100k_uc_mes`.
- 🛠️ **Solução:** raise se `uc_ativa_mes.isna()` for >0 nos meses com `qtd_serv_realizado > 0`; ou interpolar último valor conhecido.

### C16. `exposicao_uc_mes` nome ambíguo (soma anual ≠ média mensal)
- 📍 **Arquivo/Módulo:** `grupos_diagnostico.py:233-234`
- 🚨 **Tipo:** Code smell + Risco (ALTA)
- 💡 **Análise:** O nome `fora_prazo_por_100k_uc_mes` sugere "por 100k UC-mês" mas o denominador anual é soma de 12 meses (12×média). Comparação anual vs mensal com mesma label produz números 12x diferentes.
- 🛠️ **Solução:** renomear para `fora_prazo_por_100k_uc_mes_anual` ou padronizar denominador.

### C17. JSON de 27MB — payload mal otimizado
- 📍 **Arquivo/Módulo:** `build_dashboard_data.py:1037-1276` + `1354` (`indent=2`)
- 🚨 **Tipo:** Otimização (ALTA)
- 💡 **Análise:** Causas:
  - `fato_grupos_algoritmicos` inclui 5570 municípios × 3 períodos = 16700 linhas;
  - `serie_mensal_nacional` serializa 20k+ linhas inteiras de `fato_transgressao_mensal_distribuidora`;
  - 5 campos de nome por record (`sigagente`, `nomagente`, `distributor_name_sig`, `distributor_name_legal`, `distributor_label`);
  - `indent=2` adiciona 30%;
  - `round(v, 6)` em valores R$ de 8 dígitos é overkill.
- 🛠️ **Solução:** filtrar top-N municípios; manter apenas `distributor_id + distributor_label`; expor dim separado; `separators=(",",":")`; arredondar com regra contextual (`2` para R$, `6` para taxas).

### C18. Pipeline sem logging `n_in → n_out` por etapa
- 📍 **Arquivo/Módulo:** `build_*.py` (geral)
- 🚨 **Tipo:** Faltante (ALTA)
- 💡 **Análise:** 10+ joins/groupbys sem log. Quando uma distribuidora some, ninguém percebe.
- 🛠️ **Solução:** decorator `@log_shape` ou wrapper mínimo `log(f"step X: {len(df)} rows, {df['distributor_id'].nunique()} dists")`.

### C19. `neoenergia_diagnostico.py` é wrapper morto
- 📍 **Arquivo/Módulo:** `neoenergia_diagnostico.py` inteiro
- 🚨 **Tipo:** Redundância (BAIXA)
- 💡 **Análise:** ~200 linhas só para `rename(columns={"distributor_label": "neo_distribuidora"})`. Se ninguém lê os artefatos `data/processed/analysis/neoenergia/*.csv`, é dead code.

### C20. Default group_id "neoenergia" como fallback — viés de framing
- 📍 **Arquivo/Módulo:** `build_dashboard_data.py:339-340`
- 🚨 **Tipo:** Code smell (BAIXA)
- 💡 **Análise:** Em trabalho científico, default deveria ser maior por UC ou alfabético, não a holding-foco.

### C21. `classify_segment` perde "Grupo B Rural" em `normalize_regulatory_class`
- 📍 **Arquivo/Módulo:** `build_analysis_tables.py:104-118` + `513-519`
- 🚨 **Tipo:** (ver C8 — overlap) (MÉDIA)

### C22. `inflection_point` usa `idxmax` em diff (não detecta queda brusca)
- 📍 **Arquivo/Módulo:** `dashboard_transgressoes.py:97-108`
- 🚨 **Tipo:** Erro de Lógica (MÉDIA)
- 💡 **Análise:** Salto mais relevante pode ser queda — `idxmax` ignora.
- 🛠️ **Solução:** `.abs().idxmax()` se a intenção for "maior magnitude".

### C23. Cutoff regulatório espalhado em 3 arquivos
- 📍 **Arquivo/Módulo:** `config.py:8` + `metrics.py:47-53` + `build_report.py:60` + `build_dashboard_data.py:1207`
- 🚨 **Tipo:** Redundância (CRÍTICA)
- 💡 **Análise:** Três classificações coexistem: `pre_2022`, `pos_2022`, `operacional_2023_plus`. Cada arquivo redefine inline.
- 🛠️ **Solução:** centralizar em `metrics.classify_periodo_regulatorio` e usar em **todos** os pontos.

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# CAMADA 4 — VALIDAÇÃO, CARGA, MAKEFILE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### D1. `load_to_postgres` — DROP+APPEND não-atômico
- 📍 **Arquivo/Módulo:** `scripts/load_to_postgres.py:13-19`
- 🚨 **Tipo:** Erro (CRÍTICA)
- 💡 **Análise:** `DROP TABLE` em uma transação, mas `to_sql(..., if_exists='append')` em outras transações independentes. Falha no lote 5 deixa tabela parcialmente populada e antiga deletada.
- 🛠️ **Solução:** load-then-swap atômico:
```python
with engine.begin() as conn:
    df.to_sql(f"{table_name}_new", conn, if_exists="replace", index=False, chunksize=50_000, dtype=dtype_map)
    conn.execute(text(f"DROP TABLE IF EXISTS {table_name}"))
    conn.execute(text(f"ALTER TABLE {table_name}_new RENAME TO {table_name}"))
```

### D2. Tipos SQL inferidos pelo pandas (`FLOAT` em vez de `NUMERIC`)
- 📍 **Arquivo/Módulo:** `load_to_postgres.py:19`
- 🚨 **Tipo:** Erro (ALTA)
- 💡 **Análise:** `to_sql` sem `dtype=` mapeia `float64` para `DOUBLE PRECISION` (IEEE-754, imprecisão). Compensação financeira deveria ser `NUMERIC(15,2)`. Datas mensais viram `TIMESTAMP` em vez de `DATE`.
- 🛠️ **Solução:**
```python
from sqlalchemy.types import NUMERIC, Date, String
dtype_map = {
    "vlrpagocompensacao": NUMERIC(15,2),
    "datreferenciainformada": Date,
    "sigagente": String(50),
    "anoindice": Integer,
}
```

### D3. Erros de carga não param o script (exit 0 mesmo com falhas)
- 📍 **Arquivo/Módulo:** `load_to_postgres.py:60-63`
- 🚨 **Tipo:** Erro (ALTA)
- 💡 **Análise:** `except Exception as e: print(...)` continua e termina com 0. CI acha que rodou.
- 🛠️ **Solução:** acumular erros em lista; `if errors: sys.exit(1)` no final.

### D4. `load_to_postgres` faz `glob('*.parquet')` indiscriminado
- 📍 **Arquivo/Módulo:** `load_to_postgres.py:39-50`
- 🚨 **Tipo:** Risco (MÉDIA)
- 💡 **Análise:** Qualquer parquet temporário em `data/processed/` vira tabela. Não percorre `analysis/grupos/` (CSVs) — as 13 tabelas críticas nunca chegam ao Postgres.
- 🛠️ **Solução:** allowlist explícita = `CORE_REQUIRED + grupos/`.

### D5. Sem encoding/collation explícito no engine
- 📍 **Arquivo/Módulo:** `load_to_postgres.py:27-35`
- 🚨 **Tipo:** Risco (MÉDIA)
- 💡 **Análise:** Cluster com collation `C` ou `SQL_ASCII` quebra ordenação de nomes acentuados.
- 🛠️ **Solução:** `create_engine(db_url, connect_args={"client_encoding": "utf8"})`.

### D6. `qa_audit.py` é frontend smoke, **não** QA de dados
- 📍 **Arquivo/Módulo:** `scripts/qa_audit.py` (todo)
- 🚨 **Tipo:** Faltante / Nomeação enganosa (ALTA)
- 💡 **Análise:** Nome sugere QA do dataset; na realidade só conta `console.error` em 6 páginas Chromium. **Não compara totais agregados** entre parquet e dashboard, não valida 414 vs 1000.
- 🛠️ **Solução:** renomear para `frontend_smoke.py`; criar `qa_data_audit.py` separado que: (a) compara totais com `expected_totals.json`; (b) verifica monotonicidade anual; (c) confere FK distribuidora→dim.

### D7. `qa_audit` sempre exit 0
- 📍 **Arquivo/Módulo:** `qa_audit.py:99-133`
- 🚨 **Tipo:** Erro (ALTA)
- 💡 **Análise:** Mesmo com erros em todas as páginas, `make qa-audit` reporta sucesso.

### D8. `test-fast` nem é fast nem testa lógica
- 📍 **Arquivo/Módulo:** `Makefile:235-250`
- 🚨 **Tipo:** Risco / nomeação enganosa (MÉDIA)
- 💡 **Análise:** Faz `py_compile`, `smoke_imports`, `validate-contracts`, `check-artifacts`. **Zero pytest, zero comparação numérica.**
- 🛠️ **Solução:** renomear para `lint-structure`; criar `test-fast` real com `pytest tests/`.

### D9. `test-smoke` regenera + valida → mascara regressão
- 📍 **Arquivo/Módulo:** `Makefile:252-254`
- 🚨 **Tipo:** Erro (ALTA)
- 💡 **Análise:** Como builders são executados antes da validação, teste só falha se o builder atual produzir arquivo errado, mas nunca detecta drift entre commits.

### D10. `pipeline` não chama `validate-contracts` nem `check-artifacts`
- 📍 **Arquivo/Módulo:** `Makefile:148`
- 🚨 **Tipo:** Risco (ALTA)
- 💡 **Análise:** `make pipeline` pode produzir artefatos quebrados sem aviso.
- 🛠️ **Solução:** `pipeline: ... && $(MAKE) validate-contracts && $(MAKE) check-artifacts-full`.

### D11. `load-postgres` órfão do pipeline
- 📍 **Arquivo/Módulo:** `Makefile:142-143,148`
- 🚨 **Tipo:** Risco (MÉDIA)
- 💡 **Análise:** `make pipeline` não carrega o banco. Orientador rodando o pipeline vê dashboard estático mas banco fica desatualizado.

### D12. Drift CSV vs Parquet AGORA em disco
- 📍 **Arquivo/Módulo:** `data/processed/analysis/`
- 🚨 **Tipo:** Erro (estado runtime) (ALTA)
- 💡 **Análise:** **Bug ativo:** alguns CSVs de 22-abr 21:18 (ex.: `fato_indicadores_anuais.csv`) coexistem com parquets de 03-abr 12:53. Backend lê parquet; pesquisador olha CSV; veem dados diferentes.
- 🛠️ **Solução:** rerodar `make clean-analysis && make analysis`. Estrutural: builders escrevem ambos atomicamente; check_artifacts valida `abs(parquet.mtime - csv.mtime) < 60s`.

### D13. Sem `regime_regulatorio` versionado nas tabelas
- 📍 **Arquivo/Módulo:** Schema processed (geral)
- 🚨 **Tipo:** Faltante (CRÍTICA)
- 💡 **Análise:** Pipeline inteiro sem coluna `regime_regulatorio ∈ {REN_414, REN_1000, TRANSICAO}`. Comparação inteira sem rastro auditável.
- 🛠️ **Solução:**
```python
df["regime_regulatorio"] = np.select(
    [df["anoindice"] <= 2021, df["anoindice"] >= 2022],
    ["REN_414", "REN_1000"],
    default="TRANSICAO",
)
```
Validar no schema_contracts; logar contagens por regime no fim do transform.

### D14. Sem teste de regressão numérica run-to-run
- 📍 **Arquivo/Módulo:** Ausente
- 🚨 **Tipo:** Faltante (CRÍTICA)
- 💡 **Análise:** Nenhum `expected_aggregates.json`. Mudança em transform que altere total nacional 2023 passa despercebida.
- 🛠️ **Solução:** criar `tests/regression/expected_aggregates.json` com `{ano, total_compensacao_BRL, num_distribuidoras, sum_qtducativa, num_transgressoes_por_regime}`. Comparar em `test-fast` com tolerância documentada.

### D15. Sem hash/checksum em `data/processed/analysis/`
- 📍 **Arquivo/Módulo:** Ausente
- 🚨 **Tipo:** Faltante (ALTA)
- 💡 **Análise:** Sem `MANIFEST.sha256`, drift D12 fica indetectável programaticamente.

### D16. Notebook `notebooks/diagnostico_dados.ipynb` **NÃO EXISTE**
- 📍 **Arquivo/Módulo:** `notebooks/` (pasta inexistente)
- 🚨 **Tipo:** Faltante / Documentação enganosa (MÉDIA)
- 💡 **Análise:** O CLAUDE.md afirma "Statistical diagnostics notebook completed (`notebooks/diagnostico_dados.ipynb`)". A pasta `notebooks/` não existe e não há nenhum `.ipynb` no repositório. Toda referência é "vapor".
- 🛠️ **Solução:** criar o notebook com EDA real (missingness por ano, distribuição de compensação, contagem por regime), ou remover a menção do CLAUDE.md.

### D17. Sem provenance (git_sha, source_url, ETag)
- 📍 **Arquivo/Módulo:** Ausente
- 🚨 **Tipo:** Faltante (MÉDIA)
- 💡 **Análise:** Para defesa de TCC, é o que permite ao avaliador refazer a tabela do capítulo 4. Sem `_provenance/<run_id>.json`, a tese não é reprodutível.

### D18. Listas de artefatos duplicadas (sem manifest)
- 📍 **Arquivo/Módulo:** `check_artifacts.py:10-39` (manual)
- 🚨 **Tipo:** Redundância (MÉDIA)
- 🛠️ **Solução:** `config/analysis_manifest.yaml` consumido por `check_artifacts`, `validate_schema_contracts`, `load_to_postgres`.

### D19. `read_csv_header` engole TODA exceção
- 📍 **Arquivo/Módulo:** `schema_contracts.py:101-121`
- 🚨 **Tipo:** Erro de Lógica (MÉDIA)
- 🛠️ **Solução:** capturar última exceção e relançar com `raise RuntimeError(...) from last_exc`.

### D20. Param `incluir_complementares` nunca usado
- 📍 **Arquivo/Módulo:** `schema_contracts.py:158-172`
- 🚨 **Tipo:** Bug dormente (MÉDIA)

---

## PLANO DE REMEDIAÇÃO PRIORIZADO

Sugestão de ordem de ataque para máximo impacto na validade da tese:

### Fase 1 — Integridade dos números (BLOQUEADOR para escrita)
1. **B1** — Adicionar `decimal=","`, `parse_dates=`, `dtype=` em `transform_aneel.py` (refatorar para `_carregar_csv_aneel`).
2. **B2** — Corrigir `glob+rglob` duplicado.
3. **C1, C5, C6** — fillna histórico, distributor names, dupla contagem por classe_local.
4. **C2, C3** — Substituir médias de razões por sum/sum em `rk_agg` e `ind_agg`.
5. **D12** — Rerodar `make clean-analysis && make analysis` para resolver drift CSV/parquet.

### Fase 2 — Demarcação regulatória explícita
6. **D13** — Adicionar coluna `regime_regulatorio` em todos os fatos.
7. **C23** — Centralizar `classify_periodo_regulatorio` em `metrics.py`.
8. **C4** — Normalizar janelas por anos (`compensacao_anualizada`).
9. **C8** — Preservar 4 classes (rural separado de urbana no Grupo B).

### Fase 3 — Validação automatizada
10. **B10, B11** — Estender `schema_contracts` para dtypes/ranges e cobrir `data/processed/analysis/*`.
11. **D14** — Criar `expected_aggregates.json` + `test-fast` real com pytest.
12. **D15** — `MANIFEST.sha256` atualizado pelos builders.

### Fase 4 — Robustez ETL
13. **A1, A2, A3, A4** — Download seguro (Content-Type, retry, zip-slip, cleanup parcial).
14. **B4** — `drop_duplicates(subset=...)` com chave de negócio.
15. **D1, D2, D3** — `load_to_postgres` atômico com `dtype=` e exit-on-error.

### Fase 5 — Polimento
16. **C11, C12** — Consolidar uso de `metrics.py` e `distributor_groups_overrides.json`.
17. **C17** — Otimizar payload JSON (filtros, separators, rounding contextual).
18. **D6, D7** — Renomear `qa_audit` → `frontend_smoke` + criar `qa_data_audit`.
19. **D16** — Criar ou remover referência ao notebook.

---

## VERIFICAÇÃO (como validar end-to-end depois)

1. `make clean-analysis && make pipeline` — pipeline limpo do zero.
2. `python -c "import pandas as pd; df = pd.read_parquet('data/processed/qualidade_comercial.parquet'); print(df.dtypes); assert df['vlrpagocompensacao'].dtype == 'float64'"` — confirma B1.
3. `pytest tests/regression/test_aggregates.py` — confirma D14.
4. `make validate-contracts` — confirma B10/B11 cobrem analysis/.
5. `make qa-audit` (após D6) — distingue smoke de UI vs QA de dados.
6. Comparar manual: `(SELECT SUM(vlrpagocompensacao) FROM fato_indicadores_anuais)` em PG vs `pd.read_parquet(...).vlrpagocompensacao.sum()` — devem bater (D2).

---

## Arquivos críticos a modificar (ordem)

1. `src/etl/transform_aneel.py` (B1, B2, B4, B5, B8, B9)
2. `src/etl/schema_contracts.py` (B10, B11, B12, B13, D19)
3. `src/analysis/build_analysis_tables.py` (C1, C5, C6, C8, C15, D13)
4. `src/analysis/build_dashboard_data.py` (C2, C3, C4, C7, C11, C14, C17, C20)
5. `src/analysis/metrics.py` (C23 — centralização)
6. `src/analysis/distributor_groups.py` (C5, C12 — fonte única de label)
7. `scripts/load_to_postgres.py` (D1, D2, D3, D4, D5)
8. `scripts/qa_audit.py` → renomear + criar `qa_data_audit.py` (D6, D7)
9. `Makefile` (D8, D9, D10, D11)
10. `tests/regression/` (novo) — D14
11. `config/analysis_manifest.yaml` (novo) — D18
