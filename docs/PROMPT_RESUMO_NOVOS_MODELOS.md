# Prompt — Novos modelos de Resumo do Inventário

## Contexto

O módulo **Resumo** hoje possui um único modelo, `ReportG` (Resumo Final
consolidado), acessado diretamente a partir da `HomeScreen`. O módulo
**Acompanhamento** já resolve o problema de múltiplos modelos e deve servir
de referência de arquitetura:

- Um menu de seleção (`AcompanhamentoMenuScreen.tsx`) lista os modelos em um
  array tipado `ITEMS: ReportItem[]`, cada item com `title`, `subtitle`,
  `reportKey` (união literal `"ReportA" | "ReportB" | ...`), `icon`, `color`.
- Cada modelo tem sua própria **interface** em `src/types/index.ts` (campos
  planos, sem union discriminada).
- Cada modelo tem sua própria **screen** (`ReportXScreen.tsx`), que define
  `initialState: ReportX` e renderiza os campos via o shell genérico
  `ReportFormShell` (storage/histórico/sync/preview/envio WhatsApp).
- Cada modelo tem um **formatter** dedicado em `src/utils/parsers.ts`
  (`formatReportX`) que gera o texto de WhatsApp.
- Cada modelo é registrado como rota própria em
  `src/navigation/RootNavigator.tsx` (`RootStackParamList` + `Stack.Screen`).
- A convenção de nomes é sequencial de letra única (`ReportA`...`ReportG`),
  sem reaproveitar sufixos por segmento.

## Objetivo

Adicionar **3 novos modelos** de Resumo do Inventário, seguindo exatamente o
mesmo padrão do Acompanhamento, e transformar "Resumo" em um submenu (hoje
aponta direto para `ReportG`).

Modelos a criar (dando sequência à convenção de letras — próximas livres
após `ReportG`: `ReportH`, `ReportI`, `ReportJ`):

| Novo modelo | Segmento | Sugestão de `reportKey` |
|---|---|---|
| Farmaconde | Farmácia | `ReportH` |
| Mercados | Mercados (exceto Atacado/Hiper) | `ReportI` |
| Demais Estabelecimentos | Outros segmentos | `ReportJ` |

## Escopo de trabalho

1. **`src/types/index.ts`** — adicionar as interfaces `ReportH`, `ReportI`,
   `ReportJ`, com os campos abaixo (nomes em camelCase, seguindo o padrão
   já usado em `ReportG`; todos `string`, exceto onde indicado):

   **`ReportH` — Farmaconde**
   `lojaNome, lojaNum, data, pivProgramado, pivRealizado, chegadaEquipe,
   inicioDeposito, terminoDeposito, inicioLoja, terminoLoja,
   inicioAuditoriaCliente, terminoAuditoriaCliente, inicioDivergencia,
   terminoDivergencia, inicioNaoContados, terminoNaoContados,
   qtdItensAlterados, qtdItensNaoContados, qtdItensEncontradosNaoContados,
   envioArquivo, terminoInventario, totalPecas, valorTotal,
   avalPrepDeposito, avalPrepLoja, responsavelInventario, satisfacao,
   acuracidadeCliente, acuracidadeTerceirizada, suporteSolicitado (boolean | null)`

   **`ReportI` — Mercados**
   `lojaNome, lojaNum, data, pivProgramado, pivRealizado, chegadaEquipe,
   inicioDeposito, terminoDeposito, inicioLoja, terminoLoja,
   inicioAuditoriaCliente, terminoAuditoriaCliente, inicioDivergencia,
   terminoDivergencia, inicioNaoContados, terminoNaoContados,
   qtdItensAlterados, qtdItensNaoContados, qtdItensEncontradosNaoContados,
   envioPrimeiroArquivo, terminoInventario, totalPecas, valorTotal`

   **`ReportJ` — Demais Estabelecimentos**
   `lojaNome, lojaNum, lider, qtdColaboradores, qtdPecas, pctInventario,
   chegada, inicioControlados, terminoControlados, inicioLoja, terminoLoja,
   inicioAuditoria, terminoAuditoria, avalEstoque, avalLoja,
   terminoInventario`

   > Nota: `ReportJ` reaproveita quase todos os campos já existentes em
   > `ReportF`/`ReportE` do Acompanhamento (mesma estrutura de "Demais
   > Estabelecimentos") — conferir se dá para reutilizar tipos em vez de
   > duplicar.

2. **`src/screens/ReportHScreen.tsx`, `ReportIScreen.tsx`, `ReportJScreen.tsx`**
   — clonar o padrão de `ReportGScreen.tsx`: `initialState` tipado,
   `ReportFormShell` com `storageKey` próprio (ex.:
   `inventexpert:reportH:resumo`), sem `mirrorToG` (não são fonte de
   mirror, são modelos finais de Resumo assim como o G).

3. **`src/utils/parsers.ts`** — adicionar `formatReportH`, `formatReportI`,
   `formatReportJ`, no mesmo estilo de `formatReportG`, respeitando os
   rótulos exatamente como enviados pelo usuário (ex.: `Cheg. Equipe:`,
   `Ini. Cont. Dep.:`, `Fim Cont. Dep.:`, `Solic. Suporte?:` etc.).

4. **`src/navigation/RootNavigator.tsx`** — declarar `ReportH`, `ReportI`,
   `ReportJ` em `RootStackParamList` (params `undefined`) e registrar os
   três `Stack.Screen` com título por segmento.

5. **Novo `src/screens/ResumoMenuScreen.tsx`** — clonar
   `AcompanhamentoMenuScreen.tsx`: array `ITEMS` com 4 entradas (Farmaconde
   → `ReportH`, Mercados → `ReportI`, Demais Estabelecimentos → `ReportJ`,
   e o modelo consolidado atual → `ReportG`, mantendo-o na lista).

6. **`src/screens/HomeScreen.tsx`** — trocar a navegação de "Resumo": em vez
   de ir direto para `ReportG`, apontar para `ResumoMenuScreen` (mesmo
   comportamento que "Acompanhamento" já tem hoje).

## Regras a respeitar (ver `CLAUDE.md`)

- Não introduzir "Perfil Operacional" em nenhum relatório.
- Nenhum campo de bloco/qualidade é aplicável aqui — estes são apenas
  relatórios de cronograma/produtividade do Resumo, sem lógica de score.
- Manter `ttsService.speak()` se houver qualquer leitura em voz desses
  relatórios (não usar `speak()` com objeto de opções).

## Critério de conclusão

- `npx tsc --noEmit` sem erros.
- Testes existentes continuam passando (`npm test`).
- Os 3 novos modelos acessíveis via Resumo → submenu → screen própria,
  com preview e envio via WhatsApp funcionando como nos demais modelos.
