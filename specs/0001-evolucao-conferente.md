# SPEC 0001 — Evolução do conferente entre inventários (fatia 1: o cálculo)

- **Estado:** APROVADA
- **Autor:** Roberto
- **Data:** 2026-08-26
- **Entrega relacionada:** backlog item 2 de `ANTIGRAVITY_CONTEXT_InventExpert.md`
  ("Sistema de evolução do conferente — tracking diário/quinzenal/mensal com histórico
  comparativo entre inventários")

---

## 1. Objetivo

Ao entregar a ficha individual, o líder consegue dizer ao conferente se ele **melhorou
ou piorou em relação aos próprios inventários anteriores**, com número no lugar de
impressão.

Hoje a ficha é uma fotografia de um evento só. Um conferente que caiu de 82 para 71 e
outro que subiu de 60 para 71 recebem exatamente o mesmo texto — e são duas conversas
opostas.

## 2. Escopo

Esta é a **fatia 1 de 3**. Ela entrega só o cálculo, como função pura, sem tocar em
rede, banco ou tela.

- [ ] Criar `src/services/HistoricoConferenteService.ts` exportando
      `compararEvolucao(historico, atual)`
- [ ] Criar `src/services/__tests__/HistoricoConferenteService.test.ts` com um teste por
      caso extremo da seção 7
- [ ] Exportar os tipos `RegistroHistorico`, `EvolucaoConferente` e `TendenciaEvolucao`
      em `src/types/index.ts`

### Não-escopo

Nada disto entra nesta fatia. Se aparecer no diff, é violação de escopo, não bônus:

- Ler o Supabase. A fatia 2 cria `historicoConferenteRepository.ts` seguindo o padrão de
  `src/repositories/modalidadeRepository.ts`. Aqui o histórico chega **por parâmetro**.
- Escrever no Supabase, criar tabela ou migration. A tabela `produtividade` já existe e
  já é alimentada por `ProdutividadePublishService.ts`.
- Bloco de evolução na ficha (`inventExpReportV3.ts`) ou no consolidado
  (`avaliacaoConsolidadaXlsx.ts`). É a fatia 3.
- Gráfico, sparkline, tela nova, item de menu.
- Alterar `InventoryEvaluationService.ts`, os pesos de `inventoryEvalConfig.ts` ou
  qualquer regra de score. A evolução **observa** a nota; não a altera.
- Comparação com a equipe, mediana ou ranking. Isto é v3 e tem regra de modalidade
  própria — ver E3.

## 3. Decisões de arquitetura

| # | Decisão | Justificativa | Alternativa descartada |
|---|---------|---------------|------------------------|
| D1 | Histórico vem da tabela `produtividade` existente | Ela já grava score, erro, produtividade, `data_inventario` e `inventario_ref` por conferente por evento (`supabase/schema_v2.sql:55`), já é idempotente por `(colaborador_id, data_inventario, inventario_ref)` (`migration_produtividade_idempotent.sql:25`) e já é alimentada em toda avaliação publicada. O histórico existe há meses; ninguém lê | Criar `avaliacoes_historico` — duplicaria a verdade e exigiria migration + backfill para dados que já temos. Ver ADR 0001 |
| D2 | `compararEvolucao` é função pura, sem IO | Roda no Jest sem mock de React Native, igual a `fileFormat.ts` e `spreadsheetReader.ts`. O projeto já paga caro pelo IO acoplado em `InventExpImportScreen` | Service que busca no Supabase e calcula — vira teste com mock de rede e deixa de ser verificável |
| D3 | Tendência decidida pelo **score final**, não por cada componente | O score é o único número que o conferente já conhece da ficha atual. Tendência por componente vira quatro setas contraditórias e nenhuma conversa | Média das tendências de cada componente — dá tendência "estável" para quem melhorou muito em qualidade e piorou muito em produtividade |
| D4 | Zona morta de ±2,0 pontos vira `ESTAVEL` | Score é `NUMERIC(5,2)` e oscila com composição de área e volume do evento. Sem zona morta, 71,4 → 71,9 vira "melhorou" e o relatório perde credibilidade na primeira leitura | Comparar `>` e `<` diretamente |
| D5 | Compara com a **média dos últimos N eventos** (padrão N=3), não só com o anterior | Um inventário ruim isolado não é tendência; o conferente reconhece "estou pior que nos últimos três" e não reconhece "estou pior que na terça" | Comparar apenas com o evento imediatamente anterior |
| D6 | Registro com `score_final` nulo é ignorado no cálculo, mas contado em `eventosIgnorados` | Há linhas publicadas antes do motor de score; tratá-las como 0 inventaria uma queda que não houve. Silenciar sem contar esconde histórico incompleto do líder | Coalescer `null` para 0 |

## 4. Restrições

- **Função pura.** Sem `import` de `supabase`, `AsyncStorage`, `expo-*` ou React.
- **`tsc --noEmit` = 0 erros.** Sem `@ts-nocheck` no arquivo novo — o débito de
  `@ts-nocheck` do módulo é herdado, não se aumenta.
- Baseline atual **415 testes / 28 suites** não regride.
- Ordenação de entrada não confiável: o chamador pode passar o histórico em qualquer
  ordem. A função ordena internamente.
- Nada de `Date.now()` nem de fuso: as datas chegam como `YYYY-MM-DD` (string) e são
  comparadas como string. `data_inventario` é `DATE` no Postgres, sem hora.

## 5. Interfaces e contratos de dados

```typescript
/** Espelha uma linha de public.produtividade (schema_v2.sql:55-69). */
export interface RegistroHistorico {
  /** YYYY-MM-DD. Nunca vazio. */
  data_inventario: string;
  /** Chave do evento — nº da loja, ref do inventário. Distingue dois eventos no mesmo dia. */
  inventario_ref: string;
  /** null = linha publicada antes do motor de score existir. Não é zero. */
  score_final: number | null;
  /** Divergências absolutas do evento. */
  erro: number;
  /** Peças contadas no evento. Denominador de erro%. */
  qtde: number;
  /** Itens por hora. 0 = não informado. */
  produtividade_ph: number;
}

export type TendenciaEvolucao = 'MELHORA' | 'ESTAVEL' | 'PIORA' | 'SEM_HISTORICO';

export interface EvolucaoConferente {
  tendencia: TendenciaEvolucao;
  /** Score do evento atual. */
  scoreAtual: number;
  /** Média dos scores considerados. null quando não há histórico utilizável. */
  scoreMedioAnterior: number | null;
  /** scoreAtual - scoreMedioAnterior, 1 casa decimal. null sem histórico. */
  deltaScore: number | null;
  /** erro/qtde*100 do evento atual, 2 casas. */
  erroPctAtual: number;
  /** Média de erro% dos eventos considerados. null sem histórico. */
  erroPctMedioAnterior: number | null;
  /** produtividade_ph do evento atual. */
  produtividadeAtual: number;
  /** Média de produtividade dos eventos considerados. null sem histórico. */
  produtividadeMediaAnterior: number | null;
  /** Quantos eventos entraram no cálculo (≤ janela). */
  eventosConsiderados: number;
  /** Descartados por score_final nulo. Aparece na ficha como ressalva. */
  eventosIgnorados: number;
}

export interface OpcoesEvolucao {
  /** Quantos eventos anteriores entram na média. Padrão 3. */
  janela?: number;
  /** Zona morta em pontos de score. Padrão 2.0. */
  zonaMorta?: number;
}

export function compararEvolucao(
  historico: RegistroHistorico[],
  atual: RegistroHistorico,
  opcoes?: OpcoesEvolucao,
): EvolucaoConferente;
```

**Semântica de `historico`:** eventos **anteriores** ao atual, em qualquer ordem.
Se `atual` aparecer também dentro de `historico` (mesma `data_inventario` +
`inventario_ref`), a função o remove antes de calcular — ver E4.

## 6. Dependências

| Dependência | Estado | No escopo? |
|-------------|--------|------------|
| Tabela `public.produtividade` | JÁ EXISTE (`schema_v2.sql:55`) | Não é tocada |
| Índice único `uq_produtividade_colab_data_ref` | JÁ EXISTE (`migration_produtividade_idempotent.sql:25`) — mas ver `docs/SUPABASE_ESTADO.md`: nem toda migration foi aplicada | Não. A fatia 1 não lê o banco, então a aplicação da migration não a bloqueia |
| `ProdutividadePublishService.ts` alimentando a tabela | JÁ EXISTE | Não é tocado |
| `src/types/index.ts` | JÁ EXISTE | Sim — só acréscimo de tipos novos |
| Repository de leitura | A CRIAR | **Não** — fatia 2 |

## 7. Casos extremos

| # | Caso | Comportamento esperado |
|---|------|------------------------|
| E1 | Primeiro inventário do conferente — `historico` vazio | `tendencia: 'SEM_HISTORICO'`, todos os campos `*Anterior` e `deltaScore` em `null`, `eventosConsiderados: 0`. **Nunca** tratar ausência como piora |
| E2 | Histórico com 7 eventos, janela 3 | Só os 3 mais recentes por `data_inventario` entram; `eventosConsiderados: 3` |
| E3 | Conferente FREE | O retorno é idêntico ao de CLT. A função **não conhece modalidade** — comparar a pessoa com ela mesma não é comparação com a equipe, e é isso que a regra do FREE proíbe. A restrição de linguagem vive no relatório (fatia 3), não aqui |
| E4 | O evento atual também está dentro de `historico` (releitura do mesmo inventário) | Removido por `data_inventario` + `inventario_ref` antes da média. Sem isso, o conferente compara consigo mesmo e a tendência trava em `ESTAVEL` |
| E5 | Dois eventos na mesma `data_inventario` com `inventario_ref` diferente (duas lojas no mesmo dia) | Ambos contam como eventos distintos. Desempate de ordenação por `inventario_ref` para o resultado ser reproduzível — mesma regra do mapa de áreas em `AreaMappingService` |
| E6 | Registro com `score_final: null` | Fora da média de score; `eventosIgnorados` incrementa. Se **todos** forem nulos, cai em `SEM_HISTORICO` |
| E7 | `qtde: 0` no evento atual | `erroPctAtual: 0`. Divisão por zero nunca chega ao relatório |
| E8 | Delta dentro da zona morta (ex.: 71,4 vs 71,9) | `ESTAVEL`, com `deltaScore` preenchido mesmo assim — o número aparece, o rótulo é que não muda |
| E9 | `produtividade_ph: 0` no histórico (não informado) | Fora da média de produtividade, sem afetar a média de score. Zero não é "trabalhou e não produziu" |

## 8. Questões em aberto

| # | Pergunta | Dono | Estado |
|---|----------|------|--------|
| Q1 | Janela 3 é a certa, ou deve ser por período (últimos 30 dias)? | Roberto | ABERTA — fatia 1 sai com 3 e `janela` configurável; decidir com dado real |
| Q2 | Zona morta ±2,0 é adequada à variância real dos eventos? | Roberto | ABERTA — medir contra o histórico do L2601 antes da fatia 3 |
| Q3 | `inventario_ref` é preenchido de forma consistente em produção? | Roberto | ABERTA — E4/E5 dependem dele; conferir na fatia 2 |

## 9. Critérios de aceitação

- [ ] `npm run check` termina sem erro
- [ ] `src/services/HistoricoConferenteService.ts` existe, **sem** `@ts-nocheck` e sem
      `import` de `supabase`, `AsyncStorage`, `expo-*` ou `react`
- [ ] `src/services/__tests__/HistoricoConferenteService.test.ts` com um teste por caso
      extremo, nomeado pelo caso:
  - [ ] E1 → `sem histórico devolve SEM_HISTORICO e nenhum delta`
  - [ ] E2 → `usa apenas os N eventos mais recentes da janela`
  - [ ] E3 → `resultado independe da modalidade do conferente`
  - [ ] E4 → `remove o evento atual quando ele aparece no histórico`
  - [ ] E5 → `dois eventos no mesmo dia contam separado e a ordem é reproduzível`
  - [ ] E6 → `score_final nulo é ignorado e contado em eventosIgnorados`
  - [ ] E7 → `qtde zero não gera divisão por zero`
  - [ ] E8 → `delta dentro da zona morta fica ESTAVEL com delta preenchido`
  - [ ] E9 → `produtividade zero fica fora da média de produtividade`
- [ ] Suíte total ≥ 424 testes (415 + 9), 29 suites, zero regressão
- [ ] Diff toca **apenas**: `src/services/HistoricoConferenteService.ts`,
      `src/services/__tests__/HistoricoConferenteService.test.ts`, `src/types/index.ts`
- [ ] Nenhuma alteração em `supabase/`, `package.json`, `app.json` ou qualquer tela

## 10. Registro de realimentação

| Data | Achado | Classificação | O que foi feito |
|------|--------|---------------|-----------------|
| | | | |
