# 🎓 Guia Rápido de Git

Repositório: `https://github.com/Costenar0/TCC_leo.git`

## Fluxo de Trabalho Diário

```bash
# 1. Atualize sua pasta antes de trabalhar
git pull

# 2. Trabalhe normalmente: edite código, crie arquivos etc.

# 3. Veja o que mudou
git status

# 4. Prepare e salve suas mudanças
git add .
git commit -m "descreva o que fez"

# 5. Envie para o GitHub
git push
```

## Fluxo recomendado para este projeto (dados + analise)

```bash
# 1. Atualize antes de iniciar
git pull

# 2. Rode pipeline quando for atualizar base
python -m src.etl.extract_aneel
python -m src.etl.transform_aneel
python -m src.analysis.build_analysis_tables
python -m src.analysis.build_report

# 3. Revise o que mudou
git status

# 4. Commit (idealmente pequeno e com mensagem objetiva)
git add README.md docs/GUIA_ANALISE.md src/analysis reports
git commit -m "Atualiza pipeline analitico e documentacao operacional"

# 5. Push
git push
```

Atalho equivalente com Makefile:

```bash
make pipeline
make test-fast
```

## Resumo de Comandos

| Comando | O que faz |
|---|---|
| `git clone <link>` | Baixa o projeto pela 1ª vez |
| `git pull` | Atualiza com as novidades da nuvem |
| `git status` | Mostra o que mudou |
| `git add .` | Prepara tudo para salvar |
| `git commit -m "..."` | Salva o progresso local |
| `git push` | Envia para o GitHub |
| `git checkout -b <nome>` | Cria uma branch (ramo paralelo) |

## Dicas

- **Commits pequenos:** Fez algo? Salve. Não espere acumular.
- **Erro no push?** Faça `git pull` primeiro e tente de novo.
- **Branches:** Crie uma branch para experimentos: `git checkout -b teste-nova-analise`
- **Antes de concluir análise:** confira `reports/relatorio_aneel.md` e os notebooks.
- **Evite commit de arquivo pesado desnecessário:** prefira Parquet para fatos grandes.
