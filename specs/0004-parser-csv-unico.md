# SPEC 0004 — Um único parser de CSV no projeto

- **Estado:** APROVADA
- **Autor:** Roberto
- **Data:** 2026-09-06
- **Entrega relacionada:** último item aberto da auditoria do PR #21; citado como fora de escopo no PR #23

---

## 1. Objetivo

Uma linha de CSV é interpretada do mesmo jeito em todo o app, venha ela do
`RProInv_Produtividade` ou de qualquer relatório do Crystal. Hoje existem dois parsers
com regras diferentes, e o mesmo arquivo produz células diferentes conforme a porta por
onde entra.

## 2. Escopo

- [ ] `parseInventoryCheckersCsv` passa a usar `csvParaMatriz()` de `csvMatriz.ts`
- [ ] O `detectSeparator` e o `parseRow` locais de `parsers.ts` são removidos
- [ ] A varredura do cabeçalho ignora linhas vazias ao contar o limite de 30 (D2)
- [ ] Testes cobrindo cada divergência da seção 7

### Não-escopo

- **Mudar a assinatura** `parseInventoryCheckersCsv(text: string): InventoryCheckerInput[]`.
  Cinco call sites dependem dela: `InventExpImportScreen` (3×),
  `AuditoriaAtribuicaoScreen`, `inventoryImportParsers`.
- **Mexer na heurística do Crystal** (`nonEmpties.length >= 10`, índices fixos 3/6/7/8/10/11/13)
  nem na inferência de colunas do ramo de fallback. Esta entrega troca **quem fatia a
  linha**, não quem interpreta as colunas.
- **Mexer nos clamps** de `erro`/`qtde1a1` — são da SPEC anterior e do PR #21.
- **Unificar `parseNumeroBr` com `parseNumberBR`.** Outra duplicação, outro ciclo.
- **Tornar `csvParaMatriz` tolerante a aspas não fechadas.** Não há caso real conhecido.

## 3. Decisões de arquitetura

| # | Decisão | Justificativa | Alternativa descartada |
|---|---------|---------------|------------------------|
| D1 | `parsers.ts` consome `csvMatriz.ts`, não o contrário | `csvMatriz` é puro e já testado por 15 casos; `parsers.ts` carrega a heurística do Crystal, que não pertence a um parser de CSV genérico | Extrair um terceiro módulo comum — criaria três arquivos onde bastam dois |
| D2 | A varredura do cabeçalho conta só linhas com conteúdo, até 30 | O código atual filtra as vazias **antes** de varrer. `csvParaMatriz` preserva a linha vazia, e relatório do Crystal traz título, filtros e vazias antes do cabeçalho — contar as vazias no limite de 30 pode deixar o cabeçalho fora do alcance e o parser devolver `[]` | Aumentar o limite para 100 — esconde o problema em vez de preservar o comportamento |
| D3 | Divergências da seção 7 são aceitas como correção, não como regressão | Todas vêm de o parser antigo estar errado: aspa escapada perdida, campo partido por quebra de linha, separador decidido linha a linha | Preservar o comportamento antigo por compatibilidade — manteria dois parsers na prática, com um imitando o bug do outro |

## 4. Restrições

- Os 6 testes de `parseInventoryCheckersCsv.test.ts` e o de `spreadsheetReader.test.ts`
  que chama o parser continuam passando **sem alteração**. Se algum precisar mudar, é
  sinal de regressão e a mudança tem de ser justificada aqui antes.
- Nenhum dos 5 call sites muda.
- `csvMatriz.ts` não ganha nada específico de produtividade.

## 5. Interfaces e contratos de dados

```typescript
// Inalterada — é a restrição principal desta entrega.
export const parseInventoryCheckersCsv: (text: string) => InventoryCheckerInput[];

// Já existe, já testada. Consumida como está.
export function csvParaMatriz(texto: string, separador?: string): string[][];
export function detectarSeparador(texto: string): string;
```

Após a troca, `parsers.ts` deixa de exportar ou declarar `detectSeparator` e `parseRow`.

## 6. Dependências

| Dependência | Estado | No escopo? |
|-------------|--------|------------|
| `src/utils/csvMatriz.ts` | JÁ EXISTE (PR #23) | — |
| `src/utils/__tests__/csvMatriz.test.ts` | JÁ EXISTE, 15 casos | — |

## 7. Casos extremos

Divergências **medidas** entre as duas implementações, não imaginadas. Cada linha foi
rodada nas duas antes de escrever esta spec.

| # | Caso | Antigo | Novo — comportamento esperado |
|---|------|--------|-------------------------------|
| E1 | `"CAIXA ""GRANDE"""` | `CAIXA GRANDE` — a aspa escapada some | `CAIXA "GRANDE"` |
| E2 | `"DIPIRONA; 500MG"` | correto | igual — sem mudança |
| E3 | Quebra de linha dentro de aspas | Vira duas linhas; a segunda (`SEGUNDA`) entra no loop de dados e só é descartada por acaso, em `qtde <= 0` | Uma linha só, campo inteiro preservado |
| E4 | Linha em branco no meio | Removida antes da varredura | Preservada como `[""]`; o loop de dados a descarta por `nome` vazio, e a varredura do cabeçalho não a conta no limite de 30 (D2) |
| E5 | Arquivo `;` com uma linha `B,C` | **Já correto** — a detecção por linha só rodava nas candidatas a cabeçalho; as linhas de dados reusavam o separador do cabeçalho. Ver seção 10 | O separador do documento vence: `B,C` fica numa célula. Comportamento preservado, com teste que faltava |
| E6 | Cabeçalho após 25 linhas de título/filtro do Crystal, com vazias entre elas | Encontrado | Continua encontrado (D2) |
| E7 | Arquivo com menos de 2 linhas úteis | `[]` | `[]` |

## 8. Questões em aberto

| # | Pergunta | Dono | Estado |
|---|----------|------|--------|
| Q1 | E3 muda a contagem de linhas de um arquivo com quebra dentro de aspas | Roberto | RESOLVIDA — aceito: a linha-fantasma é bug, não contrato |
| Q2 | Vale um `console.warn` quando uma linha tem contagem de separador muito diferente da mediana? | Roberto | RESOLVIDA — não nesta entrega; vira issue se aparecer caso real |

## 9. Critérios de aceitação

- [ ] `npm run check` termina verde
- [ ] `grep -n "detectSeparator\|parseRow" src/utils/parsers.ts` não retorna nada
- [ ] Os 6 testes de `parseInventoryCheckersCsv.test.ts` passam **sem edição** —
      verificável por `git diff` vazio nas linhas existentes do arquivo
- [ ] Testes novos, um por caso extremo:
  - [ ] E1 → `aspa escapada sobrevive ao parser de produtividade`
  - [ ] E3 → `descrição com quebra de linha não vira conferente fantasma`
  - [ ] E4 → `linha em branco antes do cabeçalho não atrapalha`
  - [ ] E5 → `separador do documento vence linha destoante`
  - [ ] E6 → `cabeçalho depois de 25 linhas de título do Crystal ainda é achado`
  - [ ] E7 → `arquivo curto demais devolve vazio`
- [ ] Nenhum arquivo fora desta lista foi tocado: `src/utils/parsers.ts`,
      `src/utils/__tests__/parseInventoryCheckersCsv.test.ts`,
      `specs/0004-parser-csv-unico.md`, `CLAUDE.md`

## 10. Registro de realimentação

| Data | Achado | Classificação | O que foi feito |
|------|--------|---------------|-----------------|
| 2026-09-06 | Spec escrita antes do código, com as divergências medidas nas duas implementações em vez de deduzidas | — | E1 a E5 saíram de execução comparada; E6 é risco que a leitura do código revelou e que eu não tinha previsto ao propor a unificação como "trivial" no PR #23 |
| 2026-09-06 | Spec aprovada pelo Roberto; Q1 e Q2 fechadas nas propostas | — | Estado RASCUNHO → APROVADA |
| 2026-09-06 | **E5 estava errado.** Medi a divergência rodando `detectSeparator` linha a linha, mas `parseInventoryCheckersCsv` só a chamava nas candidatas a cabeçalho e reusava o separador nas linhas de dados — não havia divergência a corrigir | LACUNA DE SPEC | E5 reescrito como comportamento preservado. O teste ficou: passa nas duas implementações e cobre um caso que não tinha teste. Confirmado empiricamente: contra a implementação antiga só E1 e E3 falham |
| 2026-09-06 | Restrição da seção 4 verificada: `git diff` vazio nos testes existentes, 12 testes no arquivo (6 antigos intactos + 6 novos) | — | `parsers.ts` ficou 26 linhas menor |
