# 📐 Convenções — Guia para IA

## Commits

Usar **Conventional Commits** em português:

```
feat: dashboard interativo com 4 abas
fix: porta do make serve para 8051
docs: README com showcase do dashboard
refactor: separação das tabelas analíticas
```

Prefixos: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `test:`

## Estrutura de Scripts Python

- Todos em `src/etl/` e `src/analysis/`
- Executados como módulo: `python3 -m src.analysis.build_report`
- Cada script tem `if __name__ == "__main__": main()`
- O Makefile usa `.venv/bin/python` quando disponível (fallback: `python3`)

## Nomes de Arquivos

- Scripts: `snake_case.py`
- CSVs analíticos: `snake_case.csv` (convenção do pipeline)
- HTML/CSS/JS: `snake_case` ou descritivo (`index.html`, `app.js`, `styles.css`)
- Docs: `UPPER_CASE.md` para guias, `snake_case.md` para relatórios

## Dados

- **NÃO versionar** dados brutos/processados (`.gitignore`)
- **SIM versionar** tabelas analíticas em `data/processed/analysis/`
- `data/processed/dashboard/dashboard_*.json` é gerado e versionado para demo/deploy; regenere com `make dashboard-full` depois do ETL
- `app/frontend/dashboard*.json` é apenas espelho local legado e fica ignorado no Git
- Formato preferido para leitura: `.parquet` (mais rápido, menor)
- Formato para humanos/debug: `.csv`

## Dashboard (Frontend Legado)

- **Zero frameworks JS**: Vanilla JS puro
- **Chart.js via CDN**: Não instalar localmente
- **CSS puro**: Sem Tailwind, sem Bootstrap
- **Dark mode**: Cores definidas em variáveis CSS (`:root`)
- **Glassmorphism**: `backdrop-filter: blur()` + bordas translúcidas

## Branch

- Branch principal: `main`
- Não existem branches de feature ativas

## Ambiente

- OS: Linux (Ubuntu)
- Python: Usar `python3` (não `python`)
- Venv: `.venv/` no root do projeto
- IDE: VS Code (configuração em `.vscode/`, ignorada no Git)

## Testes

Não há framework de teste formal (pytest). Os testes existentes são:

- `make test-fast`: Compila scripts + verifica imports + contratos + artefatos core
- `make test-smoke`: Roda análise + neoenergia + dashboard + validação completa
- `scripts/check_artifacts.py`: Verifica artefatos (`--profile core|full`)
- `scripts/smoke_imports.py`: Testa se imports dos módulos funcionam
- `scripts/validate_schema_contracts.py`: Valida contratos de schema raw/processed

## Coisas para NÃO Fazer

1. **NÃO alterar a porta 8051** (local dev e Docker) sem verificar portas livres.
2. **NÃO usar `python`** — usar `python3` ou `make` (que trata automaticamente)
3. **NÃO commitar dados brutos** (`data/raw/`) — são muito grandes
4. **NÃO editar manualmente `data/processed/dashboard/dashboard_*.json`** — gere pelos scripts e revise o diff
5. **NÃO abrir o dashboard via `file://`** — não funciona (CORS)
6. **NÃO instalar Chart.js localmente** — usa CDN
7. **NÃO usar frameworks CSS/JS** — o dashboard é vanilla puro
