# Auditoria de Qualidade dos Dados

Documento de acompanhamento para transformar o rascunho `erros_visto_claude.md`
em backlog verificavel. O objetivo e separar achados confirmados por comando de
hipoteses que ainda precisam de evidencias.

## Estado Atual

Rodada de reprodutibilidade de 2026-04-28:

- `make validate-contracts`: passou cobrindo raw, processed base e analysis CSV.
- `make check-artifacts-full`: passou com a politica de artefatos atual.
- `make qa-data`: passou com 0 erros e 6 alertas. Os alertas sao linhas de dado
  bruto com denominador invalido ou numerador maior que denominador; a taxa e
  limitada/tratada com cautela em vez de mascarada silenciosamente.
- `make test-fast`: passou.
- `make doctor`: passou apos `make install` sincronizar `psycopg2-binary`.

## Contrato de Identidade

- `distributor_id` representa uma distribuidora factual.
- Aliases de nome nao podem fundir CNPJs ou siglas distintas no mesmo ano.
- `group_id` e o unico campo autorizado para agregacao por holding/grupo
  economico.
- Quando uma sigla historica muda de marca, o relacionamento com a marca nova
  deve aparecer como metadado (`distributor_alias_of`) ou como `group_id`, nao
  como sobrescrita da chave factual.

## Achados Confirmados

| ID | Status | Evidencia | Acao |
|---|---|---|---|
| B1 | corrigido | Valores financeiros brutos chegavam ao processed como texto BR. | Leitura centralizada em `_carregar_csv_aneel(...)` com `decimal=","`, `thousands="."` e conversoes numericas. |
| C1 | corrigido | `build_fato_indicadores_anuais()` preenchia ausencias historicas com `0.0`. | Preservar `NaN` nos indicadores ausentes e usar flags `has_*`. |
| C2/C3 | corrigido | `build_dashboard_data.py` agregava razoes por media simples. | Usar `sum(numerador) / sum(denominador)`. |
| D12 | corrigido | `qa-data` detectou drift de 19,4 dias em CSV/parquet de tabelas raiz. | Artefatos regenerados; `check-artifacts-full` OK. |
| Identidade | confirmado | Aliases antigos colapsavam `EBO`/`EPB` e `ENF`/`ESS` em um mesmo `distributor_id`. | Preservar id factual e usar `group_id` para holding. |
| Validacao | confirmado | `validate-contracts` e `check-artifacts-full` passavam mesmo com erros numericos. | Adicionar `scripts/qa_data_audit.py` e `make qa-data`. |

## Achados Deferidos

| ID | Status | Motivo |
|---|---|---|
| C8 | parcialmente tratado | Dashboard preserva classes regulatórias mais especificas e evita fallback silencioso; ainda pode exigir revisao UX fina. |
| C17 | deferido | Payload grande do dashboard e conhecido, mas nao bloqueia validade numerica. |
| D1-D5 | deferido | Carga PostgreSQL nao faz parte do caminho estatico usado pelo dashboard versionado. |

## Precisa Decisao ou Evidencia

- Chaves de negocio para deduplicacao no transform bruto por fonte ANEEL.
- Politica para linhas brutas com `qtd_fora_prazo > qtd_serv_realizado`: hoje a
  taxa derivada e limitada a 100% e o auditor registra alerta.
- Se CSV ou Parquet deve ser tratado como formato canonico quando ambos existem
  no mesmo diretorio. No estado atual, a regra operacional e manter ambos
  sincronizados por regeneracao.

## Comandos

```bash
make validate-contracts
make check-artifacts-full
make qa-data
make clean-analysis && make dashboard-full
```
