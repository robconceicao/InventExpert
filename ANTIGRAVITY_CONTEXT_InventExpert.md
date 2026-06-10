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

## 3. Status Atual — Módulo Avaliação (CONCLUÍDO)

O módulo passou por um overhaul completo, finalizado em junho/2026:

- **`tsc --noEmit` → 0 erros**
- **58/58 testes passando em 4 arquivos de teste**
- Validação end-to-end pendente apenas com arquivo `.prc` real (ver §5)

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

## 4. Outros módulos / trabalho recente

- **Google TTS** integrado (voz neural pt-BR) para avisos/alarmes, com expo-av.
- **Relatórios PDF** via expo-print espelhando exatamente o texto dos relatórios.
- **Padrão WhatsApp** de relatórios de campo com abreviações e valores em negrito.
- **APK release**: task documentada (incrementar `version` + `versionCode` no
  `app.json`, `npm install`, `expo export` para sanidade, depois build).
- **CLAUDE.md** criado na raiz — manter sincronizado com este arquivo.
- **Manual Técnico (.docx)** para supervisores sobre critérios de avaliação.

---

## 5. Pendências conhecidas (prioridade imediata)

1. **Validação end-to-end com `.prc` real** — testes automatizados cobrem a
   lógica, mas falta passar um `.prc` real do inventário L2395 pela tela de
   importação e conferir o RAIO-X (seção + produto) no relatório gerado.
   Confirmar tratamento da variante de 84 chars e resolução de produto no
   `catalogoLookup`.
2. **Smoke test do APK release** em dispositivo físico após o build.
3. Conferir se o de-para de áreas (`F CAIXA` → `FRENTE DE CAIXA`,
   `GELADEIRAS CAIXA` → `GELADEIRAS FRENTE CAIXA`) cobre todos os XLS reais
   recebidos em campo — qualquer área sem match deve disparar `console.warn`,
   nunca falhar silenciosamente.

---

## 6. Backlog de melhorias (para o Antigravity planejar)

Itens candidatos à próxima rodada — gerar Implementation Plan antes de codar:

1. **Perfil de operação ATACADO** no módulo de avaliação
   (config → types → service → hooks → UI → PDF → testes).
2. **Sistema de evolução do conferente** — tracking diário/quinzenal/mensal
   com histórico comparativo entre inventários.
3. **Robustez de parsers** — revisar index drift, fuzzy name matching e
   tratamento de rejeição em `Promise.all` (itens do audit anterior).
4. **UX da tela de importação** — feedback de progresso ao processar múltiplos
   `.prc` e validação prévia de estrutura dos arquivos.
5. **Dashboard de qualidade por loja/operação** agregando avaliações.

---

## 7. Regras de trabalho para agentes

- **Nunca codar sem plano aprovado.** Gerar Implementation Plan + Execution
  Task List (`TASK_LIST.md` na raiz) antes de qualquer edição.
- Ler `CLAUDE.md` antes de tocar em qualquer arquivo.
- Migrations sempre novas; nunca editar as existentes.
- Rodar `tsc --noEmit` e a suíte Jest completa após cada fase — o baseline é
  **0 erros TS / 58 testes verdes**; nenhuma regressão é aceitável.
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
