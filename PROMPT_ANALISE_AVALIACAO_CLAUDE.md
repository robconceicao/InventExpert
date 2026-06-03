# InventExpert — Contexto para análise e melhorias (módulo Avaliação)

**Como usar este arquivo:** envie este documento inteiro ao Claude (ou outro modelo) junto com os arquivos listados na seção 8, se quiser análise de código linha a linha. Peça sugestões de melhoria em **UX**, **parser**, **fórmulas**, **relatórios** e **testes** — sem quebrar a lógica de negócio já validada pelo cliente, a menos que a sugestão traga justificativa clara.

**Repositório:** https://github.com/robconceicao/InventExpert  
**Branch recente:** `correcao-alarme` (commit `63c9c80` — parser RProtmv)  
**App:** React Native / Expo 54, TypeScript, navegação por abas, Supabase (auth).

---

## 1. Objetivo do produto (escopo deste módulo)

O **InventExpert** é um app mobile/web para operações de inventário em lojas (farmácias, supermercados, varejo geral). A aba **"Avaliação"** (rota interna `InventExp`) permite ao líder:

1. Importar **Relatório de Produtividade** (CSV/Excel) dos conferentes.
2. Opcionalmente importar **Produtividade Tags** (`Qtd(A1)`) para omissão/excesso por seção.
3. Informar **total de peças** da loja e **duração real** do inventário (horas).
4. Escolher perfil: `FARMACIA` | `SUPERMERCADO` | `LOJA_GERAL`.
5. Calcular **ranking**, scores, tags de alerta, radar de risco.
6. Exportar CSV, relatório gerencial e individual (WhatsApp/texto).
7. Ajustar **modalidade de contrato** por conferente: `CLT` | `INTERMITENTE` | `FREELANCE` (muda tom do relatório individual).

**Removido (não reintroduzir sem pedido):** sistema legado `ConferrersEvaluationScreen`, `evaluationConfig.ts`, `evaluation.ts`, parsers antigos `parseConferrersCsv`.

---

## 2. Mapa de arquivos (módulo Avaliação)

| Arquivo                                      | Responsabilidade                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------ |
| `src/screens/InventExpImportScreen.tsx`      | Tela principal (~1000 linhas): import, processamento, UI ranking, export |
| `src/utils/parsers.ts`                       | `parseInventoryCheckersCsv`, `parseTagsExtended`, `parseTagsCsv`         |
| `src/services/InventoryEvaluationService.ts` | `evaluateChecker`, `sortRanking`, perfil comportamental                  |
| `src/config/inventoryEvalConfig.ts`          | Pesos, metas, alertas, `qualityDecayRate`, `duracaoPadrao` por perfil    |
| `src/utils/inventExpReports.ts`              | Texto gerencial e individual                                             |
| `src/components/CheckerFeedbackReport.tsx`   | Recibo visual do conferente                                              |
| `src/services/CheckerDBService.ts`           | Nível de experiência (`novato`…`expert`) por nome                        |
| `src/types/index.ts`                         | `InventoryCheckerInput`, `InventoryCheckerEvaluation`, etc.              |
| `src/navigation/RootTabs.tsx`                | Aba título **"Avaliação"**, rota `InventExp`                             |
| `src/screens/LeaderEvaluationDashboard.tsx`  | Dashboard exemplo — **não está na navegação**                            |

**Integração futura (parcial):** `src/modules/escala/service.ts` tem stub `importarProdutividadeInventExp` para histórico de produtividade.

---

## 3. Fluxo de dados

```
CSV Produtividade  ──► parseInventoryCheckersCsv ──► InventoryCheckerInput[]
CSV Tags (opcional)  ──► parseTagsExtended         ──► omissão/excesso/seções
                              │
Total peças + Duração + Perfil operação
                              │
                    getCheckerCurrentLevel (async)
                              │
                    evaluateChecker (por conferente)
                              │
                    sortRanking ──► UI + relatórios + export CSV
```

---

## 4. Formatos de importação

### 4.1 Relatório de Produtividade (RProtmv — formato principal)

Separador: `;`, `,` ou tab (detecção automática). Cabeçalho buscado nas **30 primeiras linhas**.

**Colunas típicas:**

```
Capa | Matrícula | Nome do Colaborador | Qtde | 1a. Coleta | Ult. Coleta | Horas | Produtividade | Erro (Qtde) | % (Erro/Qtd) | … | 1a1 | BLOCO
```

**Mapeamento no parser:**

| Campo app       | Coluna(s)                                                 |
| --------------- | --------------------------------------------------------- |
| `nome`          | Nome do Colaborador / Nome / Conferente                   |
| `matricula`     | Matrícula (opcional)                                      |
| `qtde`          | `Qtde` (prioridade) ou QTDE. VOLUMES                      |
| `qtde1a1`       | `1a1` (não usar "1a. Coleta"); se ausente: `Qtde − BLOCO` |
| `produtividade` | Produtividade / HorasProdutividade; senão `Qtde ÷ Horas`  |
| `erro`          | Erro (Qtde) / ERRO — **sempre quantidade absoluta**       |
| `% erro`        | Só usado se não houver coluna de erro em qtde             |

**Heurística Excel:** linhas com Capa+Matrícula numéricos + data `dd/mm/yyyy` em qualquer coluna → índices fixos (nome=2, qtde=3, horas=6, prod=7, erro=8, 1a1=13, bloco=14).

### 4.2 Formato legado (ainda suportado)

```
NOME DO CONFERENTE;PRODUTIVIDADE;QTDE. VOLUMES;1a1;BLOCO;HORAS ESTIMADAS;ERRO;% ERRO
```

### 4.3 Tags — formato simples

```
Nome;Qtd(A1)
AMANDA;15
JOÃO;-5
```

- `Qtd(A1) > 0` → itens **pulados** (omissão)
- `Qtd(A1) < 0` → itens **duplicados** (excesso)

### 4.4 Tags — formato estendido (`parseTagsExtended`)

Relatório por seção com colunas como `Área`, `Qtd(C1)`, `Qtd(A1)`, nome do colaborador. Gera:

- `porColaborador`: itensPulados, itensDuplicados, erroSecao, numSecoes
- `porSecao`: `SectionAccuracyRecord[]` para relatório gerencial

---

## 5. Modelo de dados (resumo)

```typescript
// Entrada
interface InventoryCheckerInput {
  nome: string;
  matricula?: string;
  qtde: number; // itens contados
  qtde1a1: number; // contagem 1 a 1
  produtividade: number; // itens/hora
  erro: number; // quantidade de erros (não %)
  experiencia?: "novato" | "junior" | "pleno" | "senior" | "expert";
  itensPulados?: number;
  itensDuplicados?: number;
  erroSecao?: number;
  numSecoes?: number;
  modalidadeContrato?: "CLT" | "INTERMITENTE" | "FREELANCE";
}

// Saída
interface InventoryCheckerEvaluation {
  pctErro: number; // (erro/qtde)*100
  pctBloco: number; // ((qtde-qtde1a1)/qtde)*100  ← recalculado pelo app
  scoreQualidade;
  scoreProdutividade;
  scoreAderencia: number;
  icv?;
  pontosVolume?;
  bonusVolume?;
  penalidadeVolume?;
  icsi?: number; // erroSecao/erro (consistência)
  scoreFinal: number; // 0-100
  nivel: "EXCELENTE" | "BOM" | "ATENCAO" | "CRITICO";
  tags: string[];
  perfilComportamental?:
    | "PULA_ITENS"
    | "FANTASMA"
    | "DESATENTO_GERAL"
    | "EQUILIBRADO";
}
```

---

## 6. Regras de pontuação (`evaluateChecker`)

**Não alterar sem validação de negócio.** Resumo das fórmulas atuais:

### 6.1 Métricas base

- `pctErro = (erro / qtde) * 100`
- `pctBloco = ((qtde - qtde1a1) / qtde) * 100` — coluna BLOCO do CSV é ignorada no score (só 1a1 ou derivação)

### 6.2 Qualidade (exponencial)

```
scoreQualidade = 100 * exp(-k * pctErro)
```

| Perfil       | k (`qualityDecayRate`) | Ex.: 1% erro ≈ |
| ------------ | ---------------------- | -------------- |
| FARMACIA     | 1.5                    | 78 pts         |
| LOJA_GERAL   | 1.1                    | 89 pts         |
| SUPERMERCADO | 0.8                    | 92 pts         |

### 6.3 Produtividade

Meta dinâmica (se `totalPecasLoja > 0`):

```
metaProdutividade = totalPecasLoja / numConferentes / duracaoPadrao
```

Senão: meta fixa do perfil (800 / 1200 / 1000 itens/h).

```
scoreProdutividade = min(100, (produtividade / meta) * 100)
```

Se `pctErro > erroCritico` → `scoreProdutividade *= 0.5`

### 6.4 Aderência (método bloco vs 1a1)

```
se pctBloco > maxBlockLimit:
  scoreAderencia = max(0, 100 - (pctBloco - maxBlockLimit) * 2)
senão: 100
```

| Perfil       | maxBlockLimit | erroTolerancia | erroCritico |
| ------------ | ------------- | -------------- | ----------- |
| FARMACIA     | 20%           | 0.35%          | 0.8%        |
| SUPERMERCADO | 50%           | 1.0%           | 2.0%        |
| LOJA_GERAL   | 35%           | 0.8%           | 1.5%        |

### 6.5 Volume (ICV) — só com total de peças

```
fatorTempo = duracaoPadrao / duracaoRealInventario
minimoIndividual = (totalPecas / numConferentes) * fatorTempo * fatorExperiencia
icv = (qtde / minimoIndividual) * 100
pontosVolume = calcularPontosVolume(icv, experiencia)  // bônus/penalidade por nível
```

Bônus volume (se icv≥100, pctErro≤3%, pctBloco≤20%): +1 a +10 pts  
Penalidade volume (icv<100): -2 a -15 pts (maior para senior/expert)

### 6.6 Score final

```
scoreFinal = wQ*qualidade + wP*produtividade + wA*aderencia + wV*volume
           + bonusVolume - penalidadeVolume
           + bonificações - penalidades tags
```

**Pesos:**

| Perfil       | Qualidade | Produtividade | Aderência | Volume |
| ------------ | --------- | ------------- | --------- | ------ |
| FARMACIA     | 55%       | 20%           | 15%       | 10%    |
| SUPERMERCADO | 45%       | 35%           | 10%       | 10%    |
| LOJA_GERAL   | 50%       | 25%           | 15%       | 10%    |

**Bonificações:** Zero erro + qtde≥1000 → +5; Flash Sniper → +3  
**Penalidades:** Contagem superficial (pctErro>1.5 e pctBloco>criticalBlockLimit) → -20  
**Omissão:** -0.7 pt/item (máx 40) | **Excesso:** -0.2 pt/item (máx 20)  
**Anti-gamificação:** tags de volume suspeito, produtividade impossível (>3× meta)

### 6.7 Níveis finais

| Score | Nível     |
| ----- | --------- |
| ≥90   | EXCELENTE |
| ≥80   | BOM       |
| ≥70   | ATENCAO   |
| <70   | CRITICO   |

### 6.8 Ranking (`sortRanking`)

1. `scoreFinal` desc
2. `pctErro` asc
3. `produtividade` desc

---

## 7. Relatórios

- **Gerencial:** `generateInventExpGerencialReportText` — resumo, top/bottom 5, risco, distribuição de níveis, perfil comportamental, acurácia por seção (se tags estendidas).
- **Individual:** `generateInventExpIndividualReportText` — tom adaptado à `modalidadeContrato` (FREELANCE = informativo, sem imperativos).
- **Componente:** `CheckerFeedbackReport` — visualização na tela.
- **Export:** `shareCsvFile`, `shareTextFile` em `src/utils/export.ts`.

---

## 8. Arquivos para anexar na análise profunda (opcional)

Prioridade alta:

1. `src/services/InventoryEvaluationService.ts`
2. `src/utils/parsers.ts` (funções `parseInventoryCheckersCsv`, `parseTagsExtended`)
3. `src/screens/InventExpImportScreen.tsx`
4. `src/config/inventoryEvalConfig.ts`
5. `src/utils/inventExpReports.ts`
6. `src/types/index.ts` (seção INVENTEXP)

Prioridade média:

7. `src/components/CheckerFeedbackReport.tsx`
8. `src/services/CheckerDBService.ts`

---

## 9. Estado atual e pendências conhecidas

### Feito recentemente

- Parser RProtmv com cabeçalhos reais do cliente.
- Correção: erro absoluto não confundido com percentual (`valErro < 5` removido).
- `qtde1a1 = 0` respeitado quando coluna 1a1 existe.
- UI: aba "Avaliação", mensagens de erro mais claras.
- Commit `63c9c80` na branch `correcao-alarme`.
- Auditoria v1.0 (P0/P1): heurística Excel ≥15 colunas, fuzzy match nomes tags, fallback experiência offline, preview de parse, duração H:MM, `.gitattributes`.

### Pendências / dúvidas para o Claude avaliar

1. **Working tree:** arquivos `inventoryEvalConfig.ts`, `RootTabs.tsx`, `InventoryEvaluationService.ts`, `types/index.ts`, `inventExpReports.ts` aparecem modificados localmente mas **sem diff de conteúdo** (provável CRLF) — vale normalizar `.gitattributes`?
2. **`LeaderEvaluationDashboard.tsx`** — integrar na navegação ou remover?
3. **Parser multi-linha:** relatórios com cabeçalho em 2 linhas (ex.: `CONTAGEM` + subcolunas `1a1`/`BLOCO`) podem falhar se colunas vazias no export.
4. **Excel binário:** importação depende de conversão para texto (`readFileAsCsvText`) — validar XLSX complexos.
5. **Match de nomes tags ↔ produtividade:** nomes truncados ("AMANDA DE OLIVEIRA P...") — fuzzy match?
6. **Testes automatizados:** não há suite para parser/score — sugerir casos de teste.
7. **Performance:** `InventExpImportScreen` muito grande — refatorar em hooks/subcomponentes?
8. **Acessibilidade e i18n:** textos hardcoded em PT-BR.
9. **Escala module:** completar `importarProdutividadeInventExp`?
10. **Validação jurídica:** textos FREELANCE vs CLT — revisão por especialista?

---

## 10. O que pedir ao Claude (prompt sugerido)

Copie e cole após este documento:

---

**Tarefa:** Analise o módulo de Avaliação de Conferentes do InventExpert conforme o contexto acima e os arquivos anexados.

**Entregue:**

1. **Auditoria de bugs** — parser, edge cases numéricos, inconsistências entre UI e `evaluateChecker`.
2. **Melhorias de UX** — fluxo de importação, feedback de erro, ranking, modalidades.
3. **Melhorias de código** — estrutura, tipos, testes unitários sugeridos (com exemplos de casos).
4. **Melhorias de relatórios** — clareza gerencial, métricas faltantes, formatação WhatsApp, incluir também as seções onde ele errou ou deixou de "bipar" o produto - que perfazem o total de erros que o conferente teve. deixar duas opções de envio, texto simples via whats ou arquivo em pdf, para o relatório gerencial criar um pdf e criar opção para acompanhar a evolução: um relatório diário, um quinzenal e um mensal da evolução da equipe.
5. **Calibragem de negócio** — apenas sugestões com impacto estimado; **não mude fórmulas** sem explicar trade-off.
6. **Priorização** — lista P0/P1/P2 com esforço (S/M/L).

**Restrições:**

- Manter compatibilidade com Relatório RProtmv e formato legado.
- Manter perfis FARMACIA / SUPERMERCADO / LOJA_GERAL.
- Respostas em português do Brasil.

---

## 11. Exemplo mínimo para teste do parser

```csv
Capa;Matrícula;Nome do Colaborador;Qtde;1a. Coleta;Ult. Coleta;Horas;Produtividade;Erro (Qtde);% (Erro/Qtd)
0001;12345678901;AMANDA DE OLIVEIRA;752;01/01/2026 08:00;01/01/2026 10:00;1,9;395,33;13;1,73%
```

**Saída esperada (1 conferente):** `qtde=752`, `produtividade=395.33`, `erro=13`, `qtde1a1=0`, `pctErro≈1.73%`.

---

## 12. Glossário

| Termo         | Significado                                   |
| ------------- | --------------------------------------------- |
| 1a1           | Contagem item a item                          |
| BLOCO         | Contagem por bloco/gôndola                    |
| ICV           | Índice de Cumprimento de Volume               |
| ICSI          | Índice de Consistência Seção vs Item          |
| RProtmv       | Relatório de Produtividade do sistema cliente |
| Tag / Qtd(A1) | Ajuste de auditoria por seção                 |

---

_Documento gerado para handoff de análise — InventExpert, maio/2026._
