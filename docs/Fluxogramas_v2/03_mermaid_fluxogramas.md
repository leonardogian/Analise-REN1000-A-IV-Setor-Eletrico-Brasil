# Mermaid — fluxogramas consolidados

As versões Mermaid canônicas ficam separadas em `exports/mermaid/` para evitar divergência entre texto, imagem e prancha Excalidraw.

## Arquivos

| Figura | Arquivo | Função |
|---|---|---|
| Figura 1 | `exports/mermaid/figura_01_fluxo_metodologico.mmd` | Mapa-mãe integrado do Capítulo 3 |
| Figura 2 | `exports/mermaid/figura_02_coleta_tratamento.mmd` | Detalhamento de fontes, coleta, dados brutos, tratamento e dados tratados |
| Figura 3 | `exports/mermaid/figura_03_consolidacao_analitica.mmd` | Detalhamento da consolidação analítica e da separação entre camada primária e derivada |
| Figura 4 | `exports/mermaid/figura_04_validacao_reprodutibilidade.mmd` | Detalhamento da validação, reprodutibilidade e retornos de correção |
| Figura 5 | `exports/mermaid/figura_05_painel_analitico.mmd` | Detalhamento do painel como camada derivada de exploração e interpretação |

## Critérios de revisão

Antes de exportar as figuras, confirme:

- cada figura possui ao menos uma decisão, retorno, bifurcação ou conexão explícita com outra figura;
- a Figura 1 contém referências visuais às Figuras 2, 3, 4 e 5;
- reprovação de dados retorna para correção ou reprocessamento;
- ajustes interpretativos podem retroalimentar métricas e recortes analíticos;
- a Figura 3 não contém seta da camada derivada para a evidência científica;
- a Figura 5 mostra o painel depois das tabelas tratadas e validadas, nunca como origem dos dados.

## Estilo Mermaid

Os arquivos usam tema base, fonte sem serifa, preenchimento branco e linhas pretas. O objetivo do Mermaid é validar a lógica; o acabamento final fica na prancha Excalidraw.
