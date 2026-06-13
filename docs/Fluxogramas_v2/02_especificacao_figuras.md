# Especificação das figuras

## Regras visuais obrigatórias

Todas as figuras devem manter padrão acadêmico, monocromático e legível em A4:

| Aspecto | Especificação |
|---|---|
| Cores | Preto e branco, com fundo branco |
| Bordas | Pretas, simples |
| Texto | Preto, fonte sem serifa |
| Formas | Retângulos de cantos retos e losangos para decisões |
| Conectores | Setas ortogonais, com ângulos de 90 graus |
| Decoração | Sem ícones, sombras, gradientes ou cores decorativas |
| Linguagem | Conceitual e científica, sem comandos ou caminhos técnicos |

## Princípio metodológico central

A evidência científica não nasce do painel. Ela nasce das tabelas analíticas tratadas, consolidadas, validadas e auditáveis. O painel é uma camada derivada para comunicação, exploração visual e apoio interpretativo.

```text
tabelas analíticas validadas -> indicadores -> análises -> resultados científicos
tabelas analíticas validadas -> artefatos canônicos -> painel -> exploração visual
```

## Figura 1 — Fluxo metodológico geral da pesquisa

Função: mapa-mãe do Capítulo 3. Os blocos de coleta, consolidação, validação e painel apontam explicitamente para as Figuras 2, 3, 4 e 5.

Fluxo principal:

```text
Fontes oficiais de dados
-> Coleta e tratamento dos dados
-> Consolidação analítica
-> Validação e reprodutibilidade
-> Dados aprovados?
```

Se aprovado:

```text
Dados aprovados?
-> Construção dos indicadores
-> Análise comparativa
-> Resultados e evidência científica
```

Fluxos complementares:

- `Análise comparativa -> Painel analítico e interpretação`
- `Painel analítico e interpretação -> Resultados e evidência científica`, com rótulo `apoio interpretativo`
- `Dados aprovados? -> Coleta e tratamento dos dados`, com rótulo `correção ou reprocessamento`
- `Análise comparativa -> Construção dos indicadores`, com rótulo `ajuste de métricas`
- `Painel analítico e interpretação -> Análise comparativa`, com rótulo `identificação de padrões e outliers`

## Figura 2 — Coleta e tratamento dos dados

Função: detalhar o bloco de coleta e tratamento da Figura 1.

Fluxo:

```text
Fontes ANEEL + Fontes IBGE + Bases financeiras
-> Critérios de seleção
-> Coleta automatizada
-> Dados brutos
-> Padronização e limpeza
-> Integração territorial e regulatória
-> Dados consistentes?
```

Se consistente:

```text
Dados consistentes?
-> Dados tratados
-> Entrada da Figura 3 — Consolidação Analítica
```

Se inconsistente:

```text
Dados consistentes?
-> Reprocessamento
-> Padronização e limpeza
```

## Figura 3 — Consolidação analítica

Função: deixar claro que a camada primária é a fonte da evidência científica.

Fluxo:

```text
Dados tratados
-> Modelagem analítica
-> Tabelas analíticas
-> Consistência analítica?
```

Se consistente:

```text
Consistência analítica?
-> Camada primária
-> Evidência científica
```

Também:

```text
Camada primária -> Camada derivada
```

Se inconsistente:

```text
Consistência analítica?
-> Revisão da modelagem
-> Modelagem analítica
```

Regra crítica: não criar seta da camada derivada para a evidência científica.

## Figura 4 — Validação e reprodutibilidade dos dados

Função: mostrar que os dados só avançam para indicadores se forem aprovados.

Fluxo:

```text
Tabelas analíticas geradas
-> Validação estrutural
-> Verificação de completude
-> Auditoria numérica e relacional
-> Teste de reprodutibilidade
-> Dados aprovados?
```

Se aprovado:

```text
Dados aprovados?
-> Avanço para indicadores
-> Retorno à Figura 1 — Construção dos Indicadores
```

Se reprovado:

```text
Dados aprovados?
-> Correção de inconsistências
-> Validação estrutural ou Tabelas analíticas geradas
```

## Figura 5 — Painel analítico e interpretação

Função: mostrar o painel como camada derivada, sem recálculo da evidência científica.

Fluxo:

```text
Tabelas analíticas tratadas e validadas
-> Artefatos canônicos
-> Camada de serviço
-> Interface de exploração
-> Exploração visual
-> Padrões ou outliers?
```

Se houver padrões ou outliers:

```text
Padrões ou outliers?
-> Interpretação dos resultados
-> Apoio à discussão do Capítulo 4
```

Se não houver:

```text
Padrões ou outliers?
-> Retorno à análise
-> Exploração visual
```

## Arquivos canônicos

As versões textuais finais estão em `exports/mermaid/`. A prancha editável única está em `exports/excalidraw/fluxogramas_capitulo_3.excalidraw`.
