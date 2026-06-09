# CLAUDE.md — InventExpert

Arquivo de contexto persistente para o Claude Code.
Atualizar sempre que houver mudança arquitetural relevante.

---

## Visão Geral do Projeto

**InventExpert** é um app mobile de gerenciamento de inventário físico,
desenvolvido em React Native + Expo + TypeScript. Voltado para operações
de campo (farmácias, supermercados, hipermercados), com foco em avaliação
de desempenho de conferentes e geração de relatórios individuais.

**Backend:** Supabase (PostgreSQL + Auth + Storage)
**Navegação:** React Navigation
**Build:** Expo (EAS Build ou local via Gradle)
**Testes:** Jest + React Native Testing Library

---

## Stack e Dependências Relevantes

```
react-native + expo
typescript
supabase-js
@react-navigation/native
expo-document-picker     ← leitura de arquivos .xls, .prc, .txt
expo-file-system         ← leitura de conteúdo de arquivos
expo-sharing / expo-print ← exportação PDF
xlsx (SheetJS)           ← parse de arquivos .xls/.xlsx
expo-speech              ← TTS (usar ttsService, não speak() direto)
```

---

## Estrutura de Arquivos — Módulos Principais

### Avaliação (módulo principal, maior complexidade)

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
│   ├── prcParser.ts                    ← parser de arquivos .prc (NOVO)
│   ├── catalogoLookup.ts               ← lookup produto: cadastro.txt/invent_DSP.old (NOVO)
│   ├── inventExpReports.ts             ← gera texto Markdown/WhatsApp do relatório
│   ├── inventExpReportHtml.ts          ← gera HTML/PDF do relatório
│   ├── inventoryImportParsers.ts       ← adapters DPSP/Sysled/RMS + PRODUÇÃO_SEÇÃO.xls
│   ├── excelParser.ts                  ← leitura genérica .xlsx/.xls via SheetJS
│   ├── parsers.ts                      ← parseInventoryCheckersCsv(), parseInventoryFull()
│   ├── fileImport.ts                   ← leitura de arquivos como texto/CSV
│   ├── nomeMatching.ts                 ← fuzzy matching de nomes
│   └── inventExpUtils.ts               ← normalizarNomeArea() e auxiliares gerais
│
├── hooks/inventExp/
│   ├── useInventExpImport.ts           ← orquestra importação + avaliação + historização
│   ├── useInventExpEvaluations.ts      ← perfil operacional, modalidades de contrato
│   └── useInventExpExport.ts           ← orquestra exportação CSV/PDF/WhatsApp
│
├── components/
│   └── CheckerFeedbackReport.tsx       ← componente visual de feedback individual
│
├── screens/
│   ├── InventExpImportScreen.tsx       ← tela principal: importação + avaliação + exportação
│   └── CheckersScreen.tsx             ← CRUD de conferentes e níveis de experiência
│
└── types/
    └── index.ts                        ← todos os tipos e interfaces do módulo
```

### Banco de Dados (Supabase)

```
supabase/
├── schema_v2.sql                              ← schema principal
├── functions.sql                              ← views e functions de score
├── migration_campos_adicionais.sql            ← campos extras (codigo_loja, segmento)
├── migration_limites_bloco_area.sql           ← limites de bloco por área (NOVO)
├── migration_limites_bloco_area_patch1.sql    ← 3 áreas adicionais (NOVO)
├── migration_secao_lookup.sql                 ← lookup seção código → nome (NOVO)
├── fix_security_definer_views.sql
└── fix_function_search_path.sql
```

---

## Tipos Principais (src/types/index.ts)

```typescript
InventoryCheckerInput         // dados brutos do conferente para avaliação
InventoryCheckerEvaluation    // resultado calculado com score e componentes
SectionAccuracyRecord         // acurácia por área (inclui bloco_pct, limite_bloco)
ContagemDetalhada             // linha do .prc resolvida (area, produto, is_bloco)
ViolacaoBloco                 // violação de limite de bloco por área
ErroAreaDetalhe               // erro localizado (área + produto) para o RAIO-X
ModalidadeContrato            // 'CLT' | 'INTERMITENTE' | 'FREE'
InventoryOperationType        // 'FARMACIA' | 'SUPERMERCADO' | 'HIPERMERCADO' | ...
```

---

## Regras de Negócio Críticas

### Avaliação — Score

Quatro componentes: **Qualidade**, **Produtividade**, **Aderência ao Método**,
**Volume (ICV)**. Score final é combinação ponderada conforme `inventoryEvalConfig.ts`.

**Regra absoluta:** Qualidade **nunca pode ser 100** quando há violação de bloco.
Assertion presente em `InventoryEvaluationService.ts`.

### Bloco por área — Farmácia

Limites armazenados em `limites_bloco_area` (Supabase). Áreas críticas (limite 0%):
ANTIBIÓTICOS, AVARIAS E VENCIDOS, MEDICAMENTOS, PSICOTRÓPICOS, TERMOLÁBEIS,
CAIXAS, SALA DE APLICAÇÃO, GELADEIRAS MEDICAMENTOS.

**Para operações que NÃO são FARMÁCIA:** bloco não é penalizado em nenhum
componente. Retornar `[]` de `detectarViolacoesBloco()` imediatamente.

### Normalização de nomes de área

Sempre chamar `normalizarNomeArea()` (em `inventExpUtils.ts`) ao ler
o nome da área do XLS ou do `.prc`. A tabela de aliases cobre:

```
'F CAIXA'          → 'FRENTE DE CAIXA'
'GELADEIRAS CAIXA' → 'GELADEIRAS FRENTE CAIXA'
'AVARIAS'          → 'AVARIAS E VENCIDOS'
'B ATENDIMENTO'    → 'BALCÃO DE ATENDIMENTO'
'P OTC'            → 'MEDICAMENTOS OTC'
```

Se uma área chegar sem match na tabela `limites_bloco_area`, emitir
`console.warn` — nunca falhar silenciosamente.

### Relatório por modalidade de contrato

- **CLT:** linguagem formal, pode mencionar "medida disciplinar" e "CLT"
- **INTERMITENTE:** mencionar impacto em convocações futuras
- **FREE:** nunca usar "colaborador", "funcionário", "medida disciplinar".
  Usar "prestador de serviço". Rodapé diferente (ver `inventExpReports.ts`).

"Perfil Operacional" foi **removido** de todos os relatórios — não exibir.

### TTS / Voz

Usar sempre `ttsService.speak(mensagem)`. **Nunca** chamar `speak()` com
objeto de opções no estilo expo-speech — causa crash em produção
(bug corrigido em `ReportAScreen.tsx:226`).

---

## Arquivos de Entrada do Módulo Avaliação

### Obrigatórios

| Arquivo | Formato | Conteúdo |
|---------|---------|----------|
| `PRODUÇÃO.xls` | XLS (Crystal Reports) | Totais por conferente: peças, horas, erro%, bloco total |
| `PRODUÇÃO_SEÇÃO.xls` | XLS (Crystal Reports) | Breakdown por área × conferente com ajustes de auditoria |

### Opcionais (enriquecem RAIO-X com seção e produto)

| Arquivo | Formato | Conteúdo |
|---------|---------|----------|
| `.prc` (múltiplos) | Texto fixo 83 chars/linha | Bips brutos por dispositivo/sessão |
| `cadastro.txt` | Texto fixo 38 chars/linha, latin-1 | Código interno → descrição produto |
| `invent_DSP_[DATA].old` | CSV `;`, latin-1 | Código → EAN real → descrição + classe legal |

### Formato .prc (posições fixas, 83 chars)

```
[00-05] Código evento    [32-42] Matrícula (11d)
[06-11] Código loja      [43]    Flag: P=unitário X=bloco
[12-17] Seq. sessão      [51-52] Prefixo tipo (PI)
[18-25] Data YYYYMMDD    [53-58] Código seção (6d)
[26-31] Hora HHMMSS      [59-73] Código produto (15d, zero-padded)
                         [74-79] Quantidade (6d)
```

Variante 84 chars (campo interno 44-51 com 8d em vez de 7d): offset +1
a partir da posição 44. Detectar por `linha.length`.
Ignorar linhas sem prefixo `PI` nas posições corretas.

### Classificações legais no invent_DSP

Sufixo no campo descrição: `A1/A2/A3` = entorpecentes, `B1/B2` = psicotrópicos,
`C1/C2/C3` = outras controladas. Sem sufixo = sem restrição.

---

## Fluxo de Importação e Avaliação

```
1. Usuário seleciona PRODUÇÃO.xls + PRODUÇÃO_SEÇÃO.xls (obrigatórios)
2. Usuário seleciona arquivos .prc (opcional, múltiplos)
3. Usuário seleciona cadastro.txt e/ou invent_DSP.old (opcional)

4. Parser lê PRODUÇÃO.xls → lista de InventoryCheckerInput
5. Parser lê PRODUÇÃO_SEÇÃO.xls → SectionAccuracyRecord[] por agente
   └── normalizarNomeArea() aplicado em cada nome de área
6. Parser lê .prc (todos) → ContagemDetalhada[] acumulada
   └── resolverProduto() chamado para cada linha (lookup no catálogo)
   └── resolverAreaNome() chamado para cada linha (lookup secao_lookup)

7. InventoryEvaluationService.evaluateChecker() por conferente:
   ├── calcularBlocoPorArea() a partir de ContagemDetalhada[]
   ├── detectarViolacoesBloco() contra limites_bloco_area
   ├── calcularQualidade() com penalidade de bloco incluída
   └── calcularAderencia() com limites por área

8. Relatório gerado (Markdown, HTML, WhatsApp) com:
   ├── Alerta de área crítica (se houver violação com limite ≤ 5%)
   ├── SUAS SEÇÕES — ACURÁCIA POR ÁREA (bloco_pct + ícone de status)
   ├── RAIO-X com localização por área e produto (quando disponível)
   ├── COMO A NOTA FOI CALCULADA (Como avaliamos + Motivo quando < max)
   └── DIRECIONAMENTO balanceado (positivos + pontos de melhora)
```

---

## Testes

```bash
npm test                    # rodar todos os testes
npm test -- --coverage      # com cobertura
npx tsc --noEmit            # type check sem compilar
```

**Estado atual:** 58 testes passando em 4 arquivos de teste.

Arquivos de teste relevantes:
```
src/utils/__tests__/prcParser.integration.test.ts   ← parser .prc + catalogoLookup
src/utils/__tests__/relatorioOutput.test.ts          ← 3 cenários completos de relatório
```

**Antes de encerrar qualquer task:** rodar `tsc --noEmit` e confirmar
que todos os testes passam.

---

## Build e Release

```bash
# Type check
npx tsc --noEmit

# Build APK release (EAS)
eas build --platform android --profile production

# Build local (se ejetado)
cd android && ./gradlew assembleRelease

# APK gerado em:
# android/app/build/outputs/apk/release/app-release.apk
```

Sempre incrementar `versionCode` no `app.json` antes de gerar release.

---

## Decisões Arquiteturais Registradas

| Decisão | Justificativa |
|---------|---------------|
| Limites de bloco em tabela Supabase (não hardcoded) | Facilita ajustes sem deploy |
| Ausência de registro = sem penalidade de bloco | Outros setores (supermercado) não penalizados |
| normalizarNomeArea() no parser, não na tabela | Nomes completos na tabela são mais legíveis |
| "Perfil Operacional" removido do relatório | Baseado em histórico: incoerente com classificação do evento atual |
| Alerta de área crítica antes de qualquer seção | Visibilidade máxima para ocorrência grave |
| catalogoLookup prefere invent_DSP sobre cadastro.txt | invent_DSP tem EAN real e classificação legal |

---

## O que NÃO fazer

- ❌ Não chamar `speak()` com objeto de opções — usar `ttsService.speak()`
- ❌ Não exibir "Perfil Operacional" no relatório individual
- ❌ Não retornar Qualidade = 100 quando há violação de bloco (assertion presente)
- ❌ Não penalizar bloco em operações que não sejam FARMÁCIA
- ❌ Não usar linguagem de vínculo empregatício no relatório FREE
- ❌ Não processar apenas um .prc — sempre acumular todos os arquivos selecionados
- ❌ Não editar migrations já aplicadas — criar patch migrations novas
