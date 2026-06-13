# Projeto — Fluxogramas do Capítulo 3 do TCC

Este repositório tem como objetivo apoiar a criação de fluxogramas acadêmicos para o Capítulo 3 — Metodologia — do TCC sobre regulação por incentivos e impacto da REN 1.000/2021 nas distribuidoras de energia elétrica no Brasil.

A estratégia visual adotada é:

1. Criar um **fluxograma macro** da metodologia inteira.
2. Criar fluxogramas derivados que funcionem como "zooms" dos blocos principais.
3. Garantir que todos os fluxos estejam conectados entre si.
4. Usar linguagem conceitual/científica, sem comandos de terminal, nomes de scripts ou caminhos de diretórios.
5. Gerar versões em Mermaid e, quando possível, converter ou recriar em Excalidraw.

## Estrutura recomendada

```text
.
├── 00_README.md
├── 01_contexto_metodologico.md
├── 02_especificacao_figuras.md
├── 03_mermaid_fluxogramas.md
├── 04_prompt_codex.md
└── exports/
    ├── mermaid/
    ├── excalidraw/
    └── png/
```

## Resultado esperado

Ao final, o projeto deve conter:

- fluxogramas em Mermaid para validação rápida;
- versões redesenhadas em Excalidraw;
- imagens exportadas em PNG ou SVG;
- nomes e títulos compatíveis com o Capítulo 3;
- padrão visual preto e branco, acadêmico e legível em A4.

## Ordem final recomendada das figuras

| Figura | Título |
|---|---|
| Figura 1 | Fluxo metodológico geral da pesquisa |
| Figura 2 | Fluxograma da coleta e tratamento dos dados |
| Figura 3 | Fluxograma da consolidação analítica |
| Figura 4 | Fluxograma da validação e reprodutibilidade dos dados |
| Figura 5 | Fluxograma da arquitetura do painel analítico |

## Princípio metodológico central

O dashboard ou painel analítico **não é a fonte primária da evidência científica**. Ele é uma camada derivada de comunicação e exploração. A evidência científica deve permanecer vinculada às tabelas analíticas tratadas, validadas e auditáveis.
