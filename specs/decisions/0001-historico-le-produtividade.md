# ADR 0001 — O histórico do conferente é lido de `produtividade`, não de uma tabela nova

- **Estado:** ACEITO
- **Data:** 2026-08-26
- **Spec relacionada:** 0001

## Contexto

O backlog pede "sistema de evolução do conferente com histórico comparativo entre
inventários". O instinto é criar uma tabela `avaliacoes_historico` e passar a gravar
cada avaliação nela.

Só que o histórico **já existe e já é gravado**. A tabela `public.produtividade`
(`supabase/schema_v2.sql:55-69`) guarda, por conferente e por evento:
`data_inventario`, `inventario_ref`, `qtde`, `qtde1a1`, `produtividade_ph`, `erro`,
`horas_estimadas`, `operacao_tipo`, `score_final` e `nivel`. Quem escreve nela é o
`ProdutividadePublishService.ts`, que roda a cada avaliação publicada, e
`migration_produtividade_idempotent.sql:25` garante uma linha única por
`(colaborador_id, data_inventario, inventario_ref)`.

Ou seja: o dado está lá desde que o módulo de avaliação existe. O que falta não é
armazenamento — é leitura.

## Decisão

A evolução do conferente **lê `public.produtividade`**. Nenhuma tabela nova, nenhuma
migration, nenhum backfill.

## Alternativas descartadas

| Alternativa | Por que não |
|-------------|-------------|
| Criar `avaliacoes_historico` com o `InventoryCheckerEvaluation` completo | Duplica a verdade: dois lugares com o score do mesmo evento, que passam a divergir na primeira vez que alguém republica uma avaliação. O projeto já viveu isso — `docs/SUPABASE_ESTADO.md` registra o caso da view `attendance_stats` apontando para uma tabela órfã e devolvendo vazio sem erro |
| Guardar o histórico em AsyncStorage no aparelho do líder | O mesmo conferente trabalha em lojas diferentes com líderes diferentes. Histórico local dá evolução diferente para a mesma pessoa dependendo de quem abre o app — o mesmo motivo pelo qual `modalidadeRepository` tem o Supabase como fonte de verdade |
| Recalcular a evolução relendo os arquivos de inventários passados (`.prc`, `PRODUÇÃO.xls`) | Exigiria o líder guardar e reanexar meses de arquivos. E os arquivos do Crystal Reports mudam de layout entre versões — a reconstrução do passado ficaria refém do parser do presente |

## Consequências

**Positivas**

- A fatia 1 não depende de banco: `compararEvolucao()` é função pura e testável no Jest.
- Zero risco de migration. O único banco envolvido já está em produção e não é alterado.
- O histórico começa cheio: todo inventário já publicado conta desde o primeiro dia.

**Negativas** (o custo, que é real)

- `produtividade` guarda o **agregado** do conferente por evento, não o detalhe por
  área. Evolução por área — "você melhorou em MEDICAMENTOS e piorou em PERFUMARIA" —
  fica impossível sem uma tabela nova. Se o negócio pedir isso, este ADR será superado.
- `score_final` é anulável, e há linhas antigas publicadas antes do motor de score.
  A spec 0001 trata isso explicitamente (caso extremo E6, decisão D6) em vez de fingir
  que o histórico é homogêneo.
- A qualidade do histórico depende de `inventario_ref` ser preenchido de forma
  consistente pelo líder. É a questão Q3 em aberto na spec 0001.
