# SPEC 0002 — Cabeçalho ausente nos parsers v3: ler às cegas sem avisar acabou

- **Estado:** APROVADA
- **Autor:** Roberto
- **Data:** 2026-08-27
- **Entrega relacionada:** achado durante a revisão de `docs/PROMPT_TRIAGEM_ARQUIVOS_INVENTARIO.md`

---

## 1. Objetivo

Quando um relatório do Crystal Reports chega com layout diferente do esperado, o líder
fica sabendo — na tela e no consolidado — que aquele arquivo foi lido às cegas, em vez de
receber um número plausível e falso dentro da nota do conferente.

## 2. Escopo

- [ ] `parseProdSecaoMatrix`, `parseNaoContadosMatrix`, `parseDobroMatrix` e
      `parseBlocoMatrix` passam a devolver resultado com diagnóstico em vez de array cru
- [ ] Os quatro call sites em `InventExpImportScreen.tsx` desempacotam o resultado e
      avisam quando o cabeçalho não foi encontrado
- [ ] `DiagnosticoConsolidado` ganha `arquivosSemCabecalho`, renderizado pela aba
      Ressalvas
- [ ] Um teste por parser cobrindo matriz sem cabeçalho — cobertura que hoje não existe

### Não-escopo

- **Mudar o `parseAcuracidadeMatrix`.** Ele já lança erro quando não acha o cabeçalho, já
  tem teste (`falha alto quando o cabeçalho não existe`) e continua assim.
- **Remover ou alterar os índices fixos.** Eles são o layout real observado no L2601 e
  há import que depende deles. O que muda é a visibilidade, não o comportamento de leitura.
- **Mexer no motor de score**, nos pesos ou em qualquer coisa de `InventoryEvaluationService`.
- **Mexer no `prcParser`**, que já tem o próprio diagnóstico.
- **Tornar o fallback configurável** por tela, arquivo ou perfil de operação.
- **Bloquear o processamento** quando o cabeçalho falta. A avaliação continua; a ressalva
  é que passa a existir.

## 3. Decisões de arquitetura

| # | Decisão | Justificativa | Alternativa descartada |
|---|---------|---------------|------------------------|
| D1 | Cabeçalho ausente **não** interrompe a leitura: o fallback por índice fixo continua | Os índices nasceram no mesmo commit que `localizarCabecalho()` (`d3557b2`) — são o layout real do L2601, não resquício. Fazer os quatro lançarem erro transformaria um import que funciona hoje numa falha dura, descoberta no meio de uma avaliação | Lançar erro como o ACURACIDADE |
| D2 | O diagnóstico viaja no retorno do parser, seguindo `PrcParseResult` | `parsePrcFileDetalhado()` já devolve `{ contagens, linhasIgnoradas, enderecosForaPadrao, datasDistintas }`. Repetir o padrão mantém uma única forma de "resultado com ressalva" no módulo | Variável de módulo, callback de aviso, ou função paralela `...ComDiagnostico()` — todas criam duas formas de ler o mesmo arquivo |
| D3 | A lacuna aparece na tela **e** na aba Ressalvas | Regra já registrada no `CLAUDE.md`: `console.warn` ninguém lê em produção. O caminho já existe — `areasSemLimiteBloco` em `DiagnosticoConsolidado` e `abaRessalvas()` | Só `console.warn`; só alerta na tela (o consolidado é o que sobra depois da importação) |
| D4 | O aviso não impede o uso do arquivo | O líder pode ter um relatório legítimo de layout novo. Quem decide se confia é ele, com a informação na mão | Descartar o arquivo automaticamente |
| D5 | `linhaCabecalho` viaja junto com o booleano | Saber **em que linha** o cabeçalho foi achado é o que permite diagnosticar layout novo sem abrir a planilha; e `null` diz "não foi achado" sem ambiguidade | Só o booleano |

## 4. Restrições

- `tsc --noEmit` = 0 erros, sem `@ts-nocheck` nos arquivos tocados.
- Baseline de 415 testes / 28 suites não regride.
- As linhas efetivamente lidas por cada parser não mudam: mesma entrada, mesmas linhas
  na saída. Só o invólucro muda.
- Nada em `supabase/`, `app.json` ou `eas.json`.

## 5. Interfaces e contratos de dados

```typescript
/** Resultado de parser de matriz do Crystal, com a ressalva de leitura junto. */
export interface ResultadoParseMatriz<T> {
  linhas: T[];
  /**
   * false = localizarCabecalho() não achou a linha de cabeçalho e as colunas
   * vieram dos índices fixos. As linhas podem estar corretas — ou podem ser
   * outra coluna inteira. Quem consome é obrigado a mostrar isso.
   */
  cabecalhoEncontrado: boolean;
  /** Índice 0-based da linha de cabeçalho; null quando não foi encontrada. */
  linhaCabecalho: number | null;
}

export function parseProdSecaoMatrix(m: any[][]): ResultadoParseMatriz<ProdSecaoRow>;
export function parseNaoContadosMatrix(m: any[][]): ResultadoParseMatriz<NaoContadoInput>;
export function parseDobroMatrix(m: any[][]): ResultadoParseMatriz<DobroRow>;
export function parseBlocoMatrix(m: any[][]): ResultadoParseMatriz<BlocoRow>;

// parseAcuracidadeMatrix NÃO muda: continua devolvendo AcuracidadeRow[] e lançando.
```

Em `DiagnosticoConsolidado` (`src/utils/avaliacaoConsolidadaXlsx.ts`):

```typescript
/** Arquivos lidos por índice fixo, sem cabeçalho reconhecido. Ex.: ['BLOCO', 'DOBRO']. */
arquivosSemCabecalho?: string[];
```

## 6. Dependências

| Dependência | Estado | No escopo? |
|-------------|--------|------------|
| `localizarCabecalho()` | JÁ EXISTE — devolve `null` quando não acha | Não muda |
| `PrcParseResult` como precedente de forma | JÁ EXISTE (`src/utils/prcParser.ts`) | Não é tocado |
| `DiagnosticoConsolidado` + `abaRessalvas()` | JÁ EXISTE | Sim — só acréscimo de campo e de linha |
| `pickSheetAsMatrix()` | JÁ EXISTE | Não é tocado |

## 7. Casos extremos

| # | Caso | Comportamento esperado |
|---|------|------------------------|
| E1 | Matriz sem nenhuma linha de cabeçalho reconhecível | `cabecalhoEncontrado: false`, `linhaCabecalho: null`, `linhas` vindas dos índices fixos (podem ser 0 ou N) |
| E2 | Cabeçalho existe, mas na linha 201 — fora do limite de 200 de `localizarCabecalho()` | Mesmo que E1. O limite é o que é; o que muda é o arquivo passar a **declarar** que estourou |
| E3 | Matriz vazia (`[]`) | `linhas: []`, `cabecalhoEncontrado: false`, `linhaCabecalho: null`. Sem exceção |
| E4 | Cabeçalho encontrado, mas falta uma coluna **opcional** (ex.: FAMILIA no DOBRO) | `cabecalhoEncontrado: true`. A ressalva é sobre a linha de cabeçalho, não sobre cada coluna — coluna opcional ausente já é tratada pelos índices de reserva |
| E5 | Cabeçalho ausente **e** o fallback produz linhas plausíveis | O caso perigoso, e o motivo desta spec: `cabecalhoEncontrado: false` mesmo com `linhas.length > 0`. A tela avisa e a aba Ressalvas registra |
| E6 | Cabeçalho ausente e o fallback produz zero linhas | Além da ressalva, a tela mostra o alerta de "nenhuma linha reconhecida" que hoje só o PROD_SEÇÃO tem |
| E7 | Dois ou mais arquivos lidos às cegas na mesma importação | `arquivosSemCabecalho` acumula os nomes, em ordem de importação |

## 8. Questões em aberto

| # | Pergunta | Dono | Estado |
|---|----------|------|--------|
| Q1 | O limite de 200 linhas de `localizarCabecalho()` é suficiente para os relatórios de supermercado? | Roberto | ABERTA — E2 torna o estouro visível; decidir com dado real da primeira loja |
| Q2 | A ressalva deve aparecer também na ficha individual do conferente, ou basta tela + consolidado? | Roberto | ABERTA — fora do escopo desta spec; a ficha é lida junto com o conferente e a ressalva é de método, não de desempenho |

## 9. Critérios de aceitação

- [ ] `npm run check` termina sem erro
- [ ] Os quatro parsers devolvem `ResultadoParseMatriz<T>`; `parseAcuracidadeMatrix`
      permanece com a assinatura e o `throw` de hoje
- [ ] Testes novos, um por parser, cobrindo matriz sem cabeçalho:
  - [ ] E1/E5 → `parseProdSecaoMatrix` · `denuncia leitura por indice fixo quando nao acha cabecalho`
  - [ ] E1/E5 → `parseNaoContadosMatrix` · `denuncia leitura por indice fixo quando nao acha cabecalho`
  - [ ] E1/E5 → `parseDobroMatrix` · `denuncia leitura por indice fixo quando nao acha cabecalho`
  - [ ] E1/E5 → `parseBlocoMatrix` · `denuncia leitura por indice fixo quando nao acha cabecalho`
- [ ] A aba Ressalvas mostra a linha quando `arquivosSemCabecalho` vem preenchido, e
      **não** a mostra quando vem vazio (dois testes em
      `src/utils/__tests__/avaliacaoConsolidadaXlsx.test.ts`)
- [ ] Suíte total ≥ 419 testes, 28 suites, zero regressão
- [ ] Diff toca apenas: `src/utils/avaliacaoV3Parsers.ts`,
      `src/utils/__tests__/avaliacaoV3Parsers.test.ts`,
      `src/utils/avaliacaoConsolidadaXlsx.ts`,
      `src/utils/__tests__/avaliacaoConsolidadaXlsx.test.ts`,
      `src/screens/InventExpImportScreen.tsx`, mais esta spec e o ajuste de numeração
      em `docs/SDD_AGENTES.md`
- [ ] Nenhuma alteração em `supabase/`, `app.json`, `eas.json` ou no motor de score

## 10. Registro de realimentação

| Data | Achado | Classificação | O que foi feito |
|------|--------|---------------|-----------------|
| 2026-08-27 | Quatro parsers leem por índice fixo em silêncio quando o cabeçalho não bate | LACUNA DE SPEC | Origem desta spec. Verificado que os índices nasceram junto com `localizarCabecalho()` (`d3557b2`), logo são deliberados; o que faltava era decidir a visibilidade |
| 2026-08-27 | A spec listou os arquivos do diff, mas esqueceu `src/utils/__tests__/avaliacaoConsolidadaXlsx.test.ts`. A decisão D3 exige que a ressalva chegue à aba Ressalvas, e afirmar isso pede teste — que mora naquele arquivo | LACUNA DE SPEC | Arquivo acrescentado à seção 9, com dois critérios novos (mostra quando há; não mostra quando não há). Encontrado na revisão do diff, antes do commit |
| 2026-08-27 | Ao escrever o teste do BLOCO sem cabeçalho, o dano real mostrou-se **pior** que o previsto em E5: além de ler outra coluna, o início fixo (linha 8) engole a primeira linha de dados. Duas bipadas em bloco viram uma | LACUNA DE SPEC | E5 falava só em "linhas plausíveis lidas de outra coluna". O teste passou a travar a perda de linha (`toHaveLength(1)` vs `toHaveLength(2)`), e o texto do aviso na tela e na aba Ressalvas diz "linhas podem ter ficado de fora" |
