# Plano de Ação — Fase 2: Demarcação Regulatória e Robustez

Este documento consolida o encerramento da **Fase 1** e prepara o terreno para a **Fase 2**. Utilize este arquivo como guia na próxima sessão.

## 🏁 Concluído na Fase 1 (Integridade e Identidade)
*   **B1 (Tipagem):** Pipeline agora usa `Int64` (suporte a NaNs) e tratamento robusto de datas brasileiras no ETL.
*   **C5 (Identidade):** Unificação de distribuidoras por `distributor_id` canônico via aliases (ex: colapsando variações de nome/sigla).
*   **C6 (Duplicatas):** Implementada salvaguarda contra dupla contagem de classes no pivot anual (com resolução automática de conflitos).
*   **C2/C3 (Métricas):** Substituídas médias de razões por cálculos ponderados (`sum/sum`) no dashboard.
*   **Ambiente:** Limpeza de diretórios residuais e criação de um `.devcontainer/devcontainer.json` funcional para VS Code.

---

## 🚀 Roteiro para a Fase 2 (Próxima Conversa)

O objetivo da Fase 2 é a **Demarcação Regulatória Explícita**, garantindo que a comparação REN 414 vs REN 1000 seja o eixo central de todas as tabelas.

### 1. Enriquecimento de Fatos (D13)
*   Adicionar a coluna `regime_regulatorio` (`REN_414`, `REN_1000`, `TRANSICAO`) em todas as tabelas de fato em `src/analysis/build_analysis_tables.py`.
*   Centralizar a lógica de classificação de período em `src/analysis/metrics.py` (C23).

### 2. Normalização Temporal (C4)
*   Implementar a métrica `compensacao_anualizada` no dashboard para permitir comparações justas entre janelas de tempo de tamanhos diferentes (ex: 4 anos de REN 414 vs 2 anos de REN 1000).

### 3. Granularidade de Classes (C8)
*   Refinar a classificação para preservar as 4 classes principais no Grupo B (Urbana e Rural separadas), evitando o agrupamento genérico que mascara o impacto regulatório no setor rural.

### 4. Validação de Contratos (B10/B11)
*   Estender o `src/etl/schema_contracts.py` para validar não apenas a presença de colunas, mas também os tipos de dados (dtypes) e intervalos (ranges) nos artefatos da pasta `analysis/`.

---

## 🛠️ Comandos de Verificação
Sempre valide o progresso com:
```bash
make test-fast     # Validação rápida de contratos e sintaxe
make pipeline      # Execução completa do pipeline e QA de dados
```
