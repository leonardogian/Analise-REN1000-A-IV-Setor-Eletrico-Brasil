# Exportações dos fluxogramas do Capítulo 3

Esta pasta concentra os artefatos editáveis dos fluxogramas metodológicos do Capítulo 3.

## Estrutura

```text
exports/
├── mermaid/
├── svg/
├── excalidraw/
└── png/
```

- `mermaid/`: versões textuais rápidas para revisar lógica, sequência e rótulos.
- `svg/`: imagens renderizadas para leitura direta no GitHub.
- `excalidraw/`: canvas editável com todas as figuras no mesmo arquivo.
- `png/`: pasta reservada para imagens exportadas manualmente para TCC/Word.

## Arquivos Mermaid

Os arquivos `.mmd` estão separados por figura para facilitar revisão e citação:

1. `figura_01_fluxo_metodologico.mmd`
2. `figura_02_coleta_tratamento.mmd`
3. `figura_03_consolidacao_analitica.mmd`
4. `figura_04_validacao_reprodutibilidade.mmd`
5. `figura_05_painel_analitico.mmd`

Use esses arquivos para ajustar textos e validar a lógica antes de redesenhar ou exportar.

## Arquivos SVG

Os arquivos `.svg` são gerados a partir dos Mermaid canônicos e usados no
`README.md` da raiz:

1. `figura_01_fluxo_metodologico.svg`
2. `figura_02_coleta_tratamento.svg`
3. `figura_03_consolidacao_analitica.svg`
4. `figura_04_validacao_reprodutibilidade.svg`
5. `figura_05_painel_analitico.svg`

Para regenerar:

```bash
for f in docs/Fluxogramas_v2/exports/mermaid/*.mmd; do
  base=$(basename "$f" .mmd)
  npx --yes @mermaid-js/mermaid-cli \
    -i "$f" \
    -o "docs/Fluxogramas_v2/exports/svg/${base}.svg" \
    -b white
done
```

## Arquivo Excalidraw

O arquivo `excalidraw/fluxogramas_capitulo_3.excalidraw` reúne as cinco figuras em um único canvas.

A Figura 1 funciona como fluxo macro da metodologia. As Figuras 2 a 5 aparecem como detalhamentos dos blocos principais da Figura 1.

## Revisão metodológica

Antes de usar as figuras no TCC, confira:

- a Figura 1 preserva a cadeia dados oficiais → coleta → tratamento → consolidação → validação → indicadores → análise → painel;
- a Figura 2 detalha apenas fontes, coleta, dados brutos, tratamento e dados tratados;
- a Figura 3 não possui seta da camada derivada para a evidência científica;
- a Figura 4 separa aprovação dos dados e correção do processo;
- a Figura 5 apresenta o painel como camada derivada de exploração, sem recálculo da evidência;
- os textos continuam conceituais, sem comandos, nomes de scripts ou caminhos de diretórios.

## Exportação

Para gerar PNGs, abra o arquivo `.excalidraw` no Excalidraw ou em uma extensão compatível e exporte cada área como PNG para `exports/png/`.

Recomenda-se revisar a legibilidade em página A4, com impressão monocromática simulada.
