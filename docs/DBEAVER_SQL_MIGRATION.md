# Migração de Blocos Pesados para SQL (DBeaver)

## Dialeto e compatibilidade
- Script: `sql/grupos_diagnostico_dbeaver.sql`
- Dialeto alvo: **PostgreSQL** (executado via DBeaver).
- O script usa recursos específicos de Postgres:
  - `CREATE INDEX IF NOT EXISTS`
  - cast `::text`
  - CTE (`WITH ...`)
  - window functions (`LAG(...) OVER (...)`)
  - `SET LOCAL search_path`
- Resultado prático:
  - **Roda no DBeaver sem ajustes** quando a conexão é PostgreSQL e as tabelas base existem.
  - **Precisa adaptação** somente em banco não-Postgres ou quando schema/tipos divergirem.

## Escopo coberto
O script materializa 3 saídas equivalentes ao pipeline Python (`src/analysis/grupos_diagnostico.py`):
1. `grupos_share_codigos_69_93` (`build_service_code_share`)
2. `grupos_anual_sem_cod_69_93` (`build_annual_excluding_codes`)
3. `grupos_alertas_comparabilidade` (`build_comparability_alerts`)

## Pré-requisitos
No banco alvo, com o `search_path` apropriado (default `public`), devem existir:
- `fato_servicos_municipio_mes`
- `fato_transgressao_mensal_distribuidora`
- `dim_distributor_group`

Permissões mínimas:
- `CREATE TABLE`
- `CREATE INDEX`
- `DROP TABLE` (o script recria as 3 tabelas de saída)

## Ordem de execução (DBeaver)
1. Abrir `sql/grupos_diagnostico_dbeaver.sql`.
2. Validar a conexão PostgreSQL correta e o schema ativo.
3. Executar o script completo.
4. Conferir se as 3 tabelas de saída foram criadas.

## Exportação para CSV e encaixe no pipeline
No DBeaver, exportar cada tabela para CSV (separador vírgula, header habilitado):
- `grupos_share_codigos_69_93` -> `grupos_share_codigos_69_93.csv`
- `grupos_anual_sem_cod_69_93` -> `grupos_anual_sem_cod_69_93.csv`
- `grupos_alertas_comparabilidade` -> `grupos_alertas_comparabilidade.csv`

Depois, copiar os arquivos para:
- `data/processed/analysis/grupos/`

## Checklist rápido de validação pós-run
- As 3 tabelas de saída existem no schema alvo.
- Não houve erro de permissão na criação de índice/tabela.
- As colunas-chave (`group_id`, `distributor_id`, `ano`) estão preenchidas.
- Os CSVs exportados estão com os nomes esperados pelo pipeline.

## Limitações conhecidas
- Escopo temporal explícito: **2023–2025**.
- Dependência dos nomes de tabela/colunas da camada analítica atual.
- Tabelas grandes podem aumentar o tempo de execução e o custo inicial de índices.
- Em bancos não-PostgreSQL, sintaxes e funções precisam ser adaptadas.

## Troubleshooting rápido
- `permission denied` em `CREATE INDEX`/`CREATE TABLE`:
  - Executar com usuário com privilégios adequados ou remover índices se necessário.
- `relation does not exist`:
  - Conferir schema (`public` vs outro) e se tabelas base foram carregadas.
- Resultado vazio/incompleto:
  - Verificar cobertura de anos (2023–2025) e presença de dados nas tabelas base.
