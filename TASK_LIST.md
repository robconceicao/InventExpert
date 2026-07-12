# TASK_LIST — Overhaul Módulo Avaliação de Conferentes (v2.1 consolidada)

> **Fase 0:** Alinhamento — concluída em 2026-07-12.  
> **Baseline real (Git + execução local):** `tsc --noEmit` = 0 erros · **63 testes / 6 suites** verdes.  
> **Regra:** nenhuma fase de código começa sem aprovação explícita do Roberto ("Yes, once" ou similar).  
> **Após cada fase:** `npx tsc --noEmit` + `npm test` + commit descritivo + parar e aguardar.

---

## Fonte de verdade (prioridade)

Quando houver conflito entre documentos, adotar nesta ordem:

1. **Este plano + decisões do Roberto na conversa atual**
2. **Prompt v2 consolidado do usuário** (`prompt_antigravity_avaliacao_v2.md` + mensagem v2.1)
3. **CLAUDE.md** (mais completo e recente sobre regras de negócio)
4. **ANTIGRAVITY_CONTEXT_InventExpert.md** (status histórico + backlog)
5. **TASK_avaliacao_overhaul_reimplementacao.md** (versão antiga — tipos e limites desatualizados; **não usar como contrato de tipos**)

**Nota crítica:** o overhaul **não precisa ser reescrito do zero**. Já existe no Git (commits `3841c3e`…`5738393` + ATACADO). O trabalho é **consolidar, alinhar, completar gaps e remover débito**.

---

## Baseline verificado (Fase 0)

| Métrica | Docs legados | Realidade (2026-07-12) |
|--------|--------------|-------------------------|
| Testes | 30 / 52 / 58 (conflitantes) | **63 passando / 6 suites** |
| TypeScript | 0 erros (ok) | **0 erros** (`tsc --noEmit`) |
| Branch | — | `main`, clean, +18 commits vs `origin/main` |
| Status módulo | "concluído" vs "reimplementar" | **Parcialmente completo — gaps listados abaixo** |

### Suites atuais
1. `InventoryEvaluationService.test.ts`
2. `AuditoriaAtribuicaoService.test.ts`
3. `AuditoriaReconciliacaoService.test.ts`
4. `prcParser.integration.test.ts`
5. `parseInventoryCheckersCsv.test.ts`
6. `relatorioOutput.test.ts`

---

## Divergências / duplicidades resolvidas na Fase 0

| # | Tema | Conflito | Decisão (v2.1) |
|---|------|----------|----------------|
| D1 | Baseline de testes | 30 / 52 / 58 | **63/6** é o baseline real; não regredir |
| D2 | Status do overhaul | ANTIGRAVITY "CONCLUÍDO" vs TASK "reimplementar" | **Consolidar o que já existe**; não greenfield |
| D3 | `ModalidadeContrato` | `FREE` vs `FREE_LANCE` vs `FREELANCE` | Canônico: **`CLT \| INTERMITENTE \| FREE`**; manter aliases legados só para parse/compat |
| D4 | Limite FRENTE DE CAIXA | config hardcoded **15%** vs migration **90%** | **Migration vence (90%)** |
| D5 | Limites de bloco | Hardcoded `LIMITES_BLOCO_FARMACIA` (incompleto) vs Supabase `limites_bloco_area` (completo) | **Supabase + fallback local completo espelhando migration**; deprecar default 20% em área desconhecida |
| D6 | Área sem limite | `getViolacoesBloco` aplica limite 20 default | **Só `console.warn` + não penalizar** (regra absoluta) |
| D7 | Path de violações | `detectarViolacoesBloco` existe mas **não é o path principal** de `evaluateChecker` | Wire: contagens/.prc → `detectarViolacoesBloco`; secoes → limites alinhados |
| D8 | Hooks `src/hooks/inventExp/*` | CLAUDE/prompt listam; **não existem no disco** | Lógica hoje em `InventExpImportScreen`; extrair hooks **só se necessário** na Fase 5 (opcional, não bloquear) |
| D9 | `inventExpReportHtml.ts` | Documentado; **não existe** | Criar na Fase 6 (PDF fiel ao texto) |
| D10 | Services fantasma | `AvaliacaoHistoricoService`, `CheckerDBService`, `avaliacaoEscalaSync`, `ttsService`, `CheckersScreen` | **Não criar** nesta rodada (fora do escopo do overhaul de score/relatório) |
| D11 | `migration_limites_bloco_area_patch1.sql` | CLAUDE cita; **não existe** | Só criar se faltar área real em campo |
| D12 | Exclusão do líder | Nome contém "LIDER" vs Acompanhamento | Preferir `role`/`leaderName` do fluxo; manter fallback por nome |
| D13 | Alerta crítico | Só `critica===true` | Spec: **`area_critica \|\| limite_pct <= 5`** |
| D14 | `scoreICV` / 4º componente | Tipo existe; motor não calcula ICV | Avaliar na Fase 4: se pesos atuais são 3 pilares, manter 3 e documentar; ICV só se Roberto priorizar |
| D15 | k da qualidade | Hardcoded `1.5` | Ideal: **k por perfil** (FARMACIA 1.5, SUPER 0.8, etc.) — Fase 4 |
| D16 | TTS | ReportA ainda usa `Speech.speak({...})` | Fora do núcleo Avaliação; **não reabrir** nesta task salvo pedido |

---

## Inventário de arquivos

### Já existentes (tocar com cuidado)

| Arquivo | Papel | Estado Fase 0 |
|---------|-------|---------------|
| `src/types/index.ts` | Tipos do módulo | Dual naming (legacy + snake_case) |
| `src/config/inventoryEvalConfig.ts` | Pesos, penalidades, limites hardcoded | ATACADO ok; limites incompletos vs migration |
| `src/services/InventoryEvaluationService.ts` | Motor de score | Core ok; `@ts-nocheck`; path Supabase não wired |
| `src/utils/inventExpUtils.ts` | `normalizarNomeArea` | OK (5 aliases) |
| `src/utils/prcParser.ts` | Parser 83/84 | OK |
| `src/utils/catalogoLookup.ts` | cadastro + invent_DSP | OK |
| `src/utils/inventoryImportParsers.ts` | PRODUÇÃO_SEÇÃO + normalização | `@ts-nocheck`; OK parcial |
| `src/utils/parsers.ts` | CSV conferentes | OK |
| `src/utils/inventExpReports.ts` | Texto gerencial + individual | Seções presentes; texto incompleto vs v2 full |
| `src/components/CheckerFeedbackReport.tsx` | UI card feedback | Parcial (sem SUAS SEÇÕES completa / alerta formal) |
| `src/screens/InventExpImportScreen.tsx` | Import + processar | Multi-.prc OK; `@ts-nocheck`; N+1 em secao_lookup; não usa `getLimitesBlocoArea` |
| `src/screens/LeaderEvaluationDashboard.tsx` | Dashboard líder | ATACADO UI |
| `src/repositories/limitesBlocoRepository.ts` | Supabase limites | Existe, **não usado no fluxo de avaliação** |
| `src/repositories/secaoLookupRepository.ts` | Supabase seções | Usado, mas **dentro do loop** (N+1) |
| `supabase/migration_limites_bloco_area.sql` | Schema + seed FARMACIA | Completo |
| `supabase/migration_secao_lookup.sql` | Schema vazio | Sem seed |
| Testes em `src/**/__tests__/*` | 63 testes | Verdes |

### Documentados mas **ausentes** (decidir por fase)

| Arquivo | Ação |
|---------|------|
| `src/utils/inventExpReportHtml.ts` | **Criar** (Fase 6) |
| `src/hooks/inventExp/*.ts` | Opcional (Fase 5) |
| `supabase/migration_limites_bloco_area_patch1.sql` | Só se necessário |
| `AvaliacaoHistoricoService`, `CheckerDBService`, `ttsService`, `CheckersScreen`, `exportPdf`, `nomeMatching` | **Fora de escopo** desta rodada |

### Não editar
- Migrations já aplicadas (`migration_limites_bloco_area.sql`, `migration_secao_lookup.sql`, etc.) — só **novas** patches.
- Não reintroduzir "Perfil Operacional".

---

## Implementation Plan (fases de código)

### Fase 0 — Alinhamento ✅
- [x] Ler CLAUDE.md, ANTIGRAVITY_CONTEXT, prompt v2, TASK reimplement
- [x] Mapear arquivos reais vs docs
- [x] Confirmar baseline testes + tsc
- [x] Documentar divergências e decisões
- [x] Gerar este `TASK_LIST.md`
- [ ] **Aguardar aprovação do Roberto**

---

### Fase 1 — Banco de Dados
**Objetivo:** garantir schema/seed corretos sem reescrever migrations aplicadas.

- [x] Auditar `migration_limites_bloco_area.sql` vs `LIMITES_BLOCO_FARMACIA` (diff de áreas e valores)
- [x] Documentar: migration base **não editada**; patch novo apenas
- [x] Criado `supabase/migration_limites_bloco_area_patch1.sql` (upsert canônico + alias OTC + RLS)
- [x] `secao_lookup`: sem seed de códigos (aguarda dados reais de campo); RLS de SELECT/ALL para authenticated
- [x] RLS alinhado ao padrão `schema_v2` (SELECT authenticated)

**Audit (2026-07-12):**

| Área | Migration base | Config TS (LIMITES_BLOCO_FARMACIA) | Ação |
|------|----------------|-------------------------------------|------|
| FRENTE DE CAIXA | 90% | **15% (ERRADO)** | Migration vence; corrigir TS na Fase 3 |
| GELADEIRAS FRENTE CAIXA | 100% | **15% (ERRADO)** | Idem Fase 3 |
| AVARIAS, TERMOLÁBEIS, CAIXAS, G1–G10, etc. | presentes | **ausentes no TS** | Fallback TS na Fase 3 |
| OTC / MIP (CAIXA) | ausente | 5% | **Adicionado no patch1** |
| MEDICAMENTOS OTC | 5% crítica | via alias P OTC | ok |

**Validação:** `tsc` + `npm test` (sem regressão)  
**Commit:** `chore: auditar e alinhar migrations do modulo avaliacao (fase 1)`  
**Parar e aguardar aprovação.**

---

### Fase 2 — Tipos
**Objetivo:** consolidar contrato sem quebrar os 63 testes.

- [x] Definir campos canônicos (preferir snake_case da v2 onde o motor/reports já usam)
- [x] Manter aliases legados (`area`/`area_nome`, `critica`/`area_critica`, `FREE`/`FREE_LANCE`) com deprecação documentada
- [x] `ModalidadeContrato` canônico: `'CLT' | 'INTERMITENTE' | 'FREE'` (+ aliases)
- [x] `InventoryOperationType` manter: FARMACIA | SUPERMERCADO | HIPERMERCADO | LOJA_GERAL | ATACADO
- [x] Garantir `ContagemDetalhada`, `ViolacaoBloco`, `SectionAccuracyRecord`, `ErroAreaDetalhe` coerentes
- [x] Helpers: `normalizeModalidade`, `buildViolacaoBloco`, getters dual-field; ContagemDetalhada com campos principais obrigatórios

**Validação:** `tsc` + `npm test`  
**Commit:** `refactor: consolidar tipos do modulo avaliacao (fase 2)`  
**Parar e aguardar aprovação.**

---

### Fase 3 — Config & Utils
**Objetivo:** uma única fonte de limites + utils estáveis.

- [x] Espelhar seed da migration em fallback local completo (offline / Supabase vazio)
- [x] Corrigir `getViolacoesBloco`: área desconhecida → **warn + skip**, nunca limite default 20
- [x] Alinhar FRENTE DE CAIXA = 90%, GELADEIRAS FRENTE CAIXA = 100% (migration)
- [x] Incluir áreas da migration ausentes no hardcoded (AVARIAS, TERMOLÁBEIS, CAIXAS, G1–G10, etc.)
- [x] Revisar `normalizarNomeArea` (+ aliases OTC)
- [x] `getLimitesBlocoFallback` / `lookupLimiteBlocoArea` / `qualityDecayK` por perfil
- [x] `prcParser` / `catalogoLookup`: smoke review OK (sem mudança)

**Validação:** `tsc` + `npm test`  
**Commit:** `fix: alinhar limites de bloco e regras de config (fase 3)`  
**Parar e aguardar aprovação.**

---

### Fase 4 — Motor de Avaliação
**Objetivo:** path único de violações + assertion + líder + tipagem.

- [x] Wire fallback/`limites` → `detectarViolacoesBloco` quando há `contagensDetalhadas`
- [x] Unificar saída de `ViolacaoBloco` via `buildViolacaoBloco` (dual-field)
- [x] Assertion qualidade nunca 100 + testes
- [x] Operação ≠ FARMACIA → `[]` imediato
- [x] k exponencial por perfil (`qualityDecayK`)
- [x] Exclusão de líder: `role` + nome + `leaderName?` → retorna `null`
- [x] Removido `@ts-nocheck` do service
- [x] ICV: 3 pilares mantidos (scoreICV não implementado)
- [x] Baseline testes: **70** (era 63)

**Validação:** `tsc` + `npm test`  
**Commit:** `feat: unificar motor de violacoes de bloco e tipagem (fase 4)`  
**Parar e aguardar aprovação.**

---

### Fase 5 — Parsers & Importação
**Objetivo:** import robusto, sem N+1, multi-.prc correto.

- [x] `getSecaoLookup` **uma vez** antes do loop de contagens
- [x] Carregar limites via repository **uma vez** + fallback; passar a `evaluateChecker`
- [x] `normalizarNomeArea` em PRODUÇÃO_SEÇÃO e resolução de áreas .prc
- [x] Associar contagens/seções por matrícula (fallback nome)
- [x] Preview: `N arquivo(s) · X linhas` + alert pós-load
- [x] Campo `leaderName` + exclusão no processar
- [x] Matrícula no parser CSV/XLS; helpers em `inventoryImportParsers`
- [x] Hooks inventExp: **não extraídos** (lógica na screen, risco controlado)

**Validação:** `tsc` + `npm test`  
**Commit:** `feat: robustecer importacao prc/xls e wiring de limites (fase 5)`  
**Parar e aguardar aprovação.**

---

### Fase 6 — Relatórios & UI
**Objetivo:** relatórios fiéis à spec v2.1 sem "Perfil Operacional".

- [x] Alerta: `area_critica || limite_pct <= 5`; textos CLT / INTERMITENTE / FREE
- [x] SUAS SEÇÕES: Área | Seções | C1 | Ajuste | Final | Bloco% | Status
- [x] RAIO-X: detalhe área/produto quando `ErroAreaDetalhe` disponível
- [x] COMO A NOTA: "Como avaliamos" + "Motivo da pontuação"
- [x] DIRECIONAMENTO balanceado (positivos + melhorias)
- [x] FREE: sem medida disciplinar / vínculo; rodapé prestação de serviço
- [x] `inventExpReportHtml.ts` + `sharePdfFromHtml` (expo-print)
- [x] `CheckerFeedbackReport`: alerta visual + seções; sem Perfil Operacional
- [x] PDF 1º ranking na InventExpImportScreen

**Validação:** `tsc` + `npm test` (70 verdes)  
**Commit:** `feat: relatorios e UI alinhados a v2.1 (fase 6)`  
**Parar e aguardar aprovação.**

---

### Fase 7 — Testes & Verificação Final
**Objetivo:** baseline ≥ 70, zero regressão, docs sincronizados.

- [x] Testes alerta limite ≤ 5 (OTC)
- [x] Teste: área desconhecida → warn + sem penalidade
- [x] Teste: FRENTE DE CAIXA 90% + dual-field `buildViolacaoBloco`
- [x] `npx tsc --noEmit` → 0
- [x] `npm test` → todos verdes
- [x] CLAUDE.md + ANTIGRAVITY_CONTEXT sincronizados (baseline, estrutura real)

**Commit:** `test: fechar overhaul avaliacao v2.1 + sincronizar docs`  
**Overhaul v2.1 ENCERRADO** após este commit.

---

## Regras absolutas (nunca violar)

1. Qualidade **nunca** = 100 com violação de bloco  
2. Não reintroduzir **"Perfil Operacional"**  
3. TTS: `ttsService.speak(msg)` se tocar em voz (não `Speech.speak` com options)  
4. ≠ FARMACIA → sem penalidade de bloco  
5. Área sem limite → `console.warn`, sem penalidade  
6. `normalizarNomeArea` em toda leitura de área  
7. Multi-.prc: acumular todos  
8. Migrations: só **novas**  
9. Commit + aprovação entre fases  

---

## Riscos de regressão

| Risco | Mitigação |
|-------|-----------|
| Dual naming quebra relatórios/testes | Preencher ambos os campos na saída do motor |
| Mudar limites FRENTE DE CAIXA 15→90 | Cenário EVERALDO já valida 70.5% ok |
| Remover `@ts-nocheck` cedo demais | Fazer por arquivo, depois dos tipos |
| Extrair hooks desnecessário | Só se screen exigir; default manter lógica inline |
| PDF novo quebra export | Feature additiva; texto permanece |

---

## Critério de aceite global

- [ ] 0 erros `tsc`
- [ ] ≥ 63 testes verdes (ou mais, se novos)
- [ ] Path único de limites (fallback = migration)
- [ ] Relatório individual: Alerta → Números → SUAS SEÇÕES → RAIO-X → COMO A NOTA → DIRECIONAMENTO
- [ ] Sem "Perfil Operacional"
- [ ] FREE sem linguagem de vínculo
- [ ] Commits por fase com mensagens descritivas

---

## Próximo passo

**Aguardando aprovação explícita do Roberto para iniciar a Fase 1.**  
Respostas aceitas: `Yes, once` / `Aprovado Fase 1` / equivalente.
