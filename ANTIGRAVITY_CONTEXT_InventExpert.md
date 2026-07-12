# ANTIGRAVITY CONTEXT — InventExpert

> Arquivo de contexto para o Google Antigravity (Agent Manager / Planning Mode).
> Objetivo: dar visão completa do estado atual do projeto e direcionar a próxima
> rodada de melhorias. Ler junto com o `CLAUDE.md` na raiz do projeto.
> Última atualização: 10/06/2026

---

## 1. Visão Geral

**InventExpert** é um app mobile de gerenciamento de inventário físico em
**React Native + Expo + TypeScript**, voltado para operações de campo
(farmácias, supermercados, hipermercados). O foco central é a **avaliação de
desempenho de conferentes** e a geração de relatórios individuais de qualidade,
produtividade e aderência ao método.

| Camada | Tecnologia |
|---|---|
| Mobile | React Native + Expo + TypeScript |
| Backend | Supabase (PostgreSQL + Auth + Storage) |
| Navegação | React Navigation |
| Testes | Jest + React Native Testing Library |
| Build | Expo (EAS Build ou Gradle local) |
| TTS | Google Cloud TTS (`pt-BR-Neural2-C`) via expo-av — substituiu expo-speech |
| PDF | expo-print + expo-sharing |
| Parse XLS | xlsx (SheetJS) |
| Arquivos de campo | expo-document-picker + expo-file-system (.xls, .prc, .txt, .old) |

**Regra de banco:** toda mudança de schema entra como **migration nova e
separada** — nunca editar migrations existentes.

**Segurança:** chaves de API só via variáveis de ambiente
(ex.: `EXPO_PUBLIC_GOOGLE_TTS_KEY` no `.env`). Nunca hardcoded.

---

## 2. Estrutura de Arquivos — Módulos Principais

```
src/
├── services/
│   ├── InventoryEvaluationService.ts   ← motor de cálculo de score
│   ├── AvaliacaoHistoricoService.ts    ← persistência AsyncStorage
│   ├── avaliacaoEscalaSync.ts          ← integração com escala
│   └── CheckerDBService.ts             ← BD local de conferentes
│
├── config/
│   └── inventoryEvalConfig.ts          ← pesos, metas, penalidades de bloco
│
├── utils/
│   ├── prcParser.ts                    ← parser de arquivos .prc
│   ├── catalogoLookup.ts               ← lookup produto (cadastro.txt + invent_DSP.old)
│   ├── inventoryImportParsers.ts       ← parsers PRODUÇÃO.xls / PRODUÇÃO_SEÇÃO.xls
│   │                                      (inclui normalizarNomeArea com de-para)
│   └── inventExpReports.ts             ← geração de relatórios texto/WhatsApp
│
├── types/index.ts                      ← interfaces (perfis, avaliação, áreas)
└── screens/                            ← CheckersScreen, ReportAScreen etc.

supabase/migrations/                    ← inclui migration_limites_bloco_area.sql
```

---

## 3. Mapa de Telas — 12 abas (RootTabs.tsx)

| Tab | Tela | Função |
|---|---|---|
| ReportA | `ReportAScreen` | Relatório operacional padrão + sistema de avisos/alarme |
| ReportB | `ReportBScreen` | Relatório farmácias/mercados |
| Attendance | `AttendanceScreen` | Controle de presença |
| Escala | `EscalaDashboardScreen` | Dashboard de escala |
| InventExp | `InventExpImportScreen` | Importação de contagens + avaliação pós-importação |
| InventExpEvolution | `InventExpEvolutionScreen` | Evolução histórica de conferentes |
| Management | `ManagementScreen` | Clientes, colaboradores, inventários |
| Scanner | `ScannerScreen` | Scanner de código de barras (só mobile) |
| Acompanhamento | `AcompanhamentoScreen` | Acompanhamento em tempo real da operação |
| ReportFarmaconde | `ReportFarmacondeScreen` | Relatório Farmaconde |
| Checkers | `CheckersScreen` | Avaliação de conferentes (LeaderEvaluationDashboard) |
| InventoryDivergence | `InventoryDivergenceScreen` | Divergências de inventário |

> Toda a navegação requer autenticação Supabase. Usuário não autenticado vê `AuthScreen`.

### Notas por módulo

**ReportAScreen** — contém o sistema de avisos sonoros/visuais (`alarmActive`,
banners, sons via expo-av). O botão de "Auditoria IA" foi removido em sessão
anterior; o restante do sistema de alarme está 100% intacto.

**AcompanhamentoScreen** — fornece o `leaderName` usado pelo módulo Avaliação
para excluir o líder das avaliações automáticas.

**InventExpImportScreen** — ponto de entrada dos arquivos `.xls` e `.prc`;
filtra `null` retornado por `evaluateChecker` quando o conferente é o líder.

**LeaderEvaluationDashboard** — simulações, ranking da equipe e geração de
avaliações via IA pelo gestor; também suporta o perfil ATACADO.

**ManagementScreen** — arquitetura `controller → service → repository` via
`src/modules/`; queries Supabase nunca direto nas telas.

### Arquitetura de módulos (`src/modules/`)
```
src/modules/
├── clientes/          ← inclui segmentação por tipo de operação (ATACADO adicionado)
├── colaboradores/
├── inventarios/       ← validação de transações atualizada para ATACADO
└── */repository.ts    ← único ponto de acesso ao Supabase por módulo
```

### Perfis de operação disponíveis (`inventoryEvalConfig.ts`)

| Perfil | Peso Qualidade | Peso Produtividade | k (decaimento) | Meta prod. |
|---|---|---|---|---|
| `FARMACIA` | 55% | 20% | 1.5 (rigoroso) | 800 itens/h |
| `SUPERMERCADO` | 52% | 28% | 0.8 (tolerante) | 1200 itens/h |
| `LOJA_GERAL` | 50% | 25% | 1.1 (médio) | 1000 itens/h |
| `ATACADO` | 45% | 40% | — | 1500 itens/h |

**Fórmula de qualidade (exponencial):**
```
scoreQualidade = 100 × e^(-k × pctErro)
```
Não usar a fórmula linear antiga `100 - pctErro × 100`.

**Nível de experiência do conferente:**
`novato (×0.70)` → `junior (×0.85)` → `pleno (×1.00)` → `senior (×1.15)` → `expert (×1.30)`

---

## 4. Status Atual — Módulo Avaliação (CONSOLIDADO v2.1 — 2026-07)

Overhaul consolidado em fases 0–7 (tipos, config, motor, import, relatórios, docs):

- **`tsc --noEmit` → 0 erros**
- **≥70 testes / 6 suites** verdes (baseline pós-Fase 7)
- Fallback de limites alinhado à migration (`FRENTE DE CAIXA` 90%, etc.)
- Path único de violações: manuais → .prc+limites → seções
- PDF individual via `inventExpReportHtml` + expo-print
- Validação end-to-end com `.prc` real de campo ainda recomendada (ver §5)

### Funcionalidades implementadas

| Capacidade | Antes | Agora |
|---|---|---|
| Limite de bloco | único global (20%) | por área, por tipo de operação |
| Bloco penaliza Qualidade | não | sim, com gradação por severidade |
| Alerta formal de área crítica | não | sim, linguagem por modalidade contratual |
| RAIO-X por área + produto | não | sim (quando .prc disponível) |
| SUAS SEÇÕES — ACURÁCIA | removido | restaurado com bloco% por área |
| DIRECIONAMENTO | só elogios | positivos + pontos de melhora |
| COMO A NOTA FOI CALCULADA | só valores | + explicação do método e motivo |
| Parser .prc | não | sim (registros fixed-width 83/84 chars) |
| Lookup de produto | não | cadastro.txt + invent_DSP.old (EAN real) |
| Seleção múltipla de .prc | não | sim (um arquivo por coletor) |

### Regras de negócio consolidadas

1. **Farmácias** têm limites de bloco por área:
   - **0% (hard block / crítica):** MEDICAMENTOS, PSICOTRÓPICOS, ANTIBIÓTICOS,
     GELADEIRAS MEDICAMENTOS, SALA DE APLICAÇÃO (contexto ANVISA/SNGPC)
   - **30%:** MEDICAMENTOS CARTELADOS (blísteres em pilhas uniformes)
   - **5%:** OTC/MIP em caixa (risco de confusão de dosagem)
   - Escalonado até **20%** em conveniência; **90%** em ESTOQUE FRENTE DE CAIXA
2. **Operações não-farmácia:** sem penalidade de bloco.
3. **Qualidade nunca chega a 100** quando há violação de bloco.
4. Campo **"Perfil Operacional" foi removido permanentemente** dos relatórios
   (historicamente inconsistente). Não reintroduzir.
5. Linguagem do relatório adapta-se ao vínculo: **CLT, Intermitente, Free Lance**
   (Free Lance sem termos que sugiram vínculo empregatício).
6. `console.warn` obrigatório quando uma área chega sem entrada na tabela de limites.
7. Penalidades comportamentais calibradas: **omissão 0,7 pt/item**,
   **duplicação 0,2 pt/item**. Perfis: PULA_ITENS, FANTASMA, DESATENTO_GERAL,
   EQUILIBRADO.
8. Líder da operação (vindo do módulo Andamento) é **excluído** das avaliações.
9. Total de peças e duração são **auto-detectados** do arquivo de produtividade.

### Arquivos de entrada do fluxo de avaliação

- `PRODUÇÃO.xls` e `PRODUÇÃO_SEÇÃO.xls` — produtividade por conferente/área
- `.prc` — registros fixed-width (83 chars, variante 84) com seção + produto
- `cadastro.txt` — descrições de produto
- `invent_DSP.old` — EAN reais + classificação legal de medicamentos

---

## 5. Outros módulos / trabalho recente

- **Google TTS** integrado (voz neural pt-BR) para avisos/alarmes, com expo-av.
- **Relatórios PDF** via expo-print espelhando exatamente o texto dos relatórios.
- **Padrão WhatsApp** de relatórios de campo com abreviações e valores em negrito.
- **APK release**: task documentada (incrementar `version` + `versionCode` no
  `app.json`, `npm install`, `expo export` para sanidade, depois build).
- **CLAUDE.md** criado na raiz — manter sincronizado com este arquivo.
- **Manual Técnico (.docx)** para supervisores sobre critérios de avaliação.

---

## 6. Pendências conhecidas (prioridade imediata)

1. **Validação end-to-end com `.prc` real** — testes automatizados cobrem a
   lógica; falta smoke com arquivo real de inventário (ex. L2395) na tela de
   importação e conferência do RAIO-X no relatório.
2. **Popular `secao_lookup`** com códigos reais por evento (tabela existe; seed vazio).
3. **Smoke test do APK release** em dispositivo físico após o build.
4. Expandir aliases de `normalizarNomeArea` conforme XLS reais de campo
   (área sem match em limites → `console.warn`, sem penalidade).

---

## 7. Backlog de melhorias (próximas rodadas)

Itens candidatos — gerar Implementation Plan antes de codar:

1. ~~**Perfil ATACADO**~~ — **feito** (config + UI + pesos).
2. **Sistema de evolução do conferente** — tracking diário/quinzenal/mensal
   com histórico comparativo entre inventários.
3. **Extrair hooks inventExp** (opcional) se a screen crescer demais.
4. **Dashboard de qualidade por loja/operação** agregando avaliações.
5. **scoreICV / 4º pilar** — só se o negócio priorizar (hoje: 3 pilares).

---

## 8. Regras de trabalho para agentes

- **Nunca codar sem plano aprovado.** Gerar Implementation Plan + Execution
  Task List (`TASK_LIST.md` na raiz) antes de qualquer edição.
- Ler `CLAUDE.md` antes de tocar em qualquer arquivo.
- Migrations sempre novas; nunca editar as existentes.
- Rodar `tsc --noEmit` e a suíte Jest completa após cada fase — o baseline é
  **0 erros TS / ≥70 testes verdes (6 suites)**; nenhuma regressão é aceitável.
- **Commit obrigatório ao final de cada fase.** Nenhuma fase é considerada
  concluída sem um `git commit` com mensagem descritiva do que foi feito.
  O agente **não inicia a próxima fase** sem confirmar ao Roberto que o commit
  foi realizado e qual foi o hash/mensagem. Isso evita perda de trabalho por
  restauração de branch ou sobreposição de arquivos locais não-comitados.
- **Aprovação do Roberto em três momentos obrigatórios:**
  1. Após o Implementation Plan (antes de qualquer edição de arquivo)
  2. Após cada fase concluída — com `tsc` + Jest limpos **e** commit feito
  3. Antes de qualquer operação que afete arquivos já existentes no repositório
- Não reintroduzir "Perfil Operacional" nos relatórios.
- Não usar `expo-speech` — TTS é via `ttsService` (Google TTS).
- Mudanças destrutivas ou sensíveis exigem aprovação explícita do Roberto
  (padrão "Yes, once").
