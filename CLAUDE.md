# CLAUDE.md — InventExpert

Arquivo de contexto persistente para o Claude Code.
Atualizar sempre que houver mudança arquitetural relevante.

---

## Web pública = mesmo app (obrigatório)

**Não há segundo produto web.** A URL pública é o export Expo deste repositório.

| | |
|--|--|
| URL | https://robconceicao.github.io/InventExpert/ |
| Deploy | push `main` → workflow **Deploy GitHub Pages** |
| Scanner | só no mobile (`ScannerScreen.web.tsx` no browser) |
| Backend | mesmo Supabase |

Docs: [`docs/WEB_PUBLICA.md`](docs/WEB_PUBLICA.md).

Após mudanças no app: `git push origin main` — a web atualiza sozinha.

---

## Visão Geral do Projeto

**InventExpert** é um app de gerenciamento de inventário físico (mobile + web
responsiva), desenvolvido em React Native + Expo + TypeScript. Voltado para
operações de campo (farmácias, supermercados, hipermercados), com foco em
avaliação de desempenho de conferentes e geração de relatórios individuais.

**Backend:** Supabase (PostgreSQL + Auth + Storage)
**Navegação:** React Navigation
**Build:** Expo (EAS Build ou local via Gradle) · web via `expo export -p web`
**Testes:** Jest + React Native Testing Library
**Web:** https://robconceicao.github.io/InventExpert/

---

## Stack e Dependências Relevantes

```
react-native + expo
typescript
supabase-js
@react-navigation/native
expo-document-picker     ← leitura de arquivos .xls, .prc, .txt (picker sempre `*/*`)
expo-file-system/legacy  ← readAsStringAsync (SDK 54 removeu do import raiz)
expo-sharing / expo-print ← exportação PDF
xlsx (SheetJS)           ← parse de arquivos .xls/.xlsx
expo-speech              ← TTS (usar ttsService, não speak() direto)
```

---

## Estrutura de Arquivos — Módulos Principais

### Avaliação (módulo principal, maior complexidade) — overhaul v2.1 (2026-07)

```
src/
├── services/
│   └── InventoryEvaluationService.ts   ← motor de score (bloco por área, k por perfil, exclusão líder)
│
├── config/
│   └── inventoryEvalConfig.ts          ← pesos, qualityDecayK, LIMITES_BLOCO_FARMACIA (fallback=migration)
│
├── repositories/
│   ├── limitesBlocoRepository.ts       ← Supabase limites_bloco_area
│   └── secaoLookupRepository.ts        ← Supabase secao_lookup
│
├── utils/
│   ├── prcParser.ts                    ← parser .prc 83/84 chars
│   ├── catalogoLookup.ts               ← cadastro.txt + invent_DSP.old
│   ├── inventExpReports.ts             ← Markdown/WhatsApp (alerta, seções, RAIO-X, nota, direção)
│   ├── inventExpReportHtml.ts          ← HTML/PDF fiel ao texto
│   ├── inventoryImportParsers.ts       ← PRODUÇÃO_SEÇÃO + match matrícula/nome + bloco%
│   ├── inventExpUtils.ts               ← normalizarNomeArea()
│   ├── parsers.ts                      ← parseInventoryCheckersCsv() (+ matrícula)
│   ├── fileFormat.ts                   ← detecção por magic bytes + encoding (puro, testável)
│   ├── spreadsheetReader.ts            ← bytes → workbook → CSV `;` (puro, testável)
│   ├── fileImport.ts                   ← leitura arquivos (IO: expo-file-system/legacy + web)
│   ├── excelParser.ts                  ← pickAndParseExcel() (picker + JSON)
│   └── export.ts                       ← CSV/texto/PDF (sharePdfFromHtml)
│
├── components/
│   └── CheckerFeedbackReport.tsx       ← card visual (alerta + seções)
│
├── screens/
│   ├── InventExpImportScreen.tsx       ← import multi-.prc + avaliação + export
│   └── LeaderEvaluationDashboard.tsx   ← ranking / simulações (incl. ATACADO)
│
└── types/
    └── index.ts                        ← tipos + helpers dual-field (buildViolacaoBloco, etc.)
```

> Fluxo de importação/orquestração vive em `InventExpImportScreen` (hooks inventExp
> não foram extraídos na v2.1). Services legados AvaliacaoHistorico/CheckerDB não
> fazem parte do path atual.

### Banco de Dados (Supabase)

```
supabase/
├── schema_v2.sql                              ← schema principal
├── functions.sql                              ← views e functions de score
├── migration_campos_adicionais.sql            ← campos extras (codigo_loja, segmento)
├── migration_limites_bloco_area.sql           ← limites de bloco por área
├── migration_limites_bloco_area_patch1.sql    ← upsert seed + alias OTC + RLS
├── migration_secao_lookup.sql                 ← lookup seção código → nome
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

### Leitura de arquivos — formato pelo conteúdo, nunca pela extensão

O Android entrega quase tudo como `application/octet-stream` e o nome copiado
para o cache pode vir sem extensão. Por isso:

- **Picker sempre `type: "*/*"`.** Lista de MIME deixa o arquivo cinza e
  impossível de selecionar — foi o que quebrou o import da Avaliação.
- **Formato decidido por magic bytes** em `fileFormat.ts`:
  `PK\x03\x04` = XLSX · `D0CF11E0` = XLS · BOF `09 00/02/04/08` = BIFF cru ·
  `<html>/<table>/MIME-Version` = HTML/MHTML (export "Excel" do Crystal
  Reports é isso) · resto = texto.
- **Encoding decidido pelo conteúdo:** UTF-8 quando válido, senão
  windows-1252 — sem esse fallback "SEÇÃO" chega como "SE?ÃO" e
  `normalizarNomeArea()` não acha a área.
- **HTML/CSV abrem com `raw: true`** no SheetJS, para "395,33" e "1,73%"
  chegarem ao parser em pt-BR em vez de virarem `395.33`/`1.73`.
- Divergência entre extensão e conteúdo = `console.warn`, nunca falha silenciosa.

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

**Baseline (2026-08):** **206 testes / 18 suites** · `tsc --noEmit` = 0 erros.

Arquivos de teste relevantes:
```
src/services/__tests__/InventoryEvaluationService.test.ts  ← motor, líder, violações, dual-field
src/utils/__tests__/prcParser.integration.test.ts          ← parser .prc + catalogoLookup + normalizarNomeArea
src/utils/__tests__/relatorioOutput.test.ts                ← Everaldo / Elen / Tania + alerta OTC ≤5%
src/utils/__tests__/parseInventoryCheckersCsv.test.ts
src/utils/__tests__/fileFormat.test.ts                     ← magic bytes, extensão, UTF-8 vs cp1252, MHTML
src/utils/__tests__/spreadsheetReader.test.ts              ← XLS/XLSX/HTML do Crystal Reports → CSV `;`
src/services/__tests__/AuditoriaAtribuicaoService.test.ts
src/services/__tests__/AuditoriaReconciliacaoService.test.ts
```

**Antes de encerrar qualquer task:** rodar `tsc --noEmit` e confirmar
que todos os testes passam.

---

## Build e Release

```bash
# Type check + testes (antes de qualquer build)
npx tsc --noEmit && npm test

# APK de release, assinado com a credencial de produção
npx eas-cli build --platform android --profile production

# APK de teste interno (mesmo binário, credencial de preview)
npx eas-cli build --platform android --profile preview
```

Os dois perfis geram **APK** — `buildType: "apk"` está declarado em cada um
no `eas.json`. Sem essa chave o EAS entrega **AAB**, que não instala direto
no aparelho; foi o que já causou confusão aqui.

Não existe pasta `android/` no repositório: o projeto é managed workflow.
Build local só depois de `npx expo prebuild -p android`, e aí o APK sai em
`android/app/build/outputs/apk/release/app-release.apk`.

**Sempre incrementar `versionCode` no `app.json` antes de gerar release** —
`eas.json` usa `appVersionSource: "local"`, então o EAS não incrementa
sozinho e um build com `versionCode` repetido é recusado na publicação.

---

## Decisões Arquiteturais Registradas

| Decisão | Justificativa |
|---------|---------------|
| RLS core via `is_staff_reader/writer()` + `app_profiles` | Security Advisor “Always True”; sem multi-tenant `user_id` nas tabelas core — ver `docs/SECURITY_RLS.md` |
| `listar_escala`/`gerar_escala` sem EXECUTE para anon/PUBLIC | SECURITY DEFINER só para `authenticated` + `service_role` |
| Limites em Supabase + fallback local = seed migration | Offline e remoto alinhados; FRENTE DE CAIXA 90% |
| Ausência de registro = warn + sem penalidade (nunca default 20%) | Não punir área desconhecida silenciosamente |
| normalizarNomeArea() no parser, não na tabela | Nomes completos na tabela são mais legíveis |
| "Perfil Operacional" removido do relatório | Baseado em histórico: incoerente com classificação do evento atual |
| Alerta formal se crítica OU limite ≤ 5% | Visibilidade para OTC e áreas ANVISA |
| Aviso de avanço preso ao preenchimento do avanço anterior | O anterior é a prova de que a operação chegou ali; 22h00 é inicial (0%) e nunca avisa |
| Voz do aviso com tela apagada = som da notificação | Sem player de áudio no projeto; TTS só toca com o app aberto — ver `docs/AVISO_VOZ_ELEVENLABS.md` |
| catalogoLookup prefere invent_DSP sobre cadastro.txt | invent_DSP tem EAN real e classificação legal |
| qualityDecayK por perfil de operação | Farmácia mais rigorosa que supermercado/atacado |
| Modalidade canônica FREE (+ aliases FREE_LANCE/FREELANCE) | Um valor canônico; parse tolerante |
| Filtro P&B do scanner via WebView + canvas (`scanFilter.ts`) | Nem `expo-image-manipulator` nem o plugin de scanner expõem operação de cor; canal de tinta = `min(R,G,B)` elimina o matiz de caneta colorida |
| Algoritmo do filtro guardado como string, não como função | Hermes descarta o corpo em `Function.prototype.toString()`; a string é injetada no WebView **e** avaliada nos testes — fonte única |
| Formato do arquivo por magic bytes, não por extensão/MIME | Android manda `octet-stream` e o cache do picker pode perder o nome; extensão só serve para mensagem e `console.warn` |
| Picker sempre `type: "*/*"` | Filtro de MIME deixava .xls/.prc/.txt cinza e inselecionáveis no Android |
| IO separado da conversão (`fileImport` vs `spreadsheetReader`/`fileFormat`) | O miolo (bytes → planilha → CSV) roda no Jest sem mock de React Native |
| `readAsStringAsync` sempre de `expo-file-system/legacy` | No SDK 54 o import raiz **lança em runtime** — foi a causa de "Não foi possível ler a planilha" |

---

## O que NÃO fazer

- ❌ Não chamar `speak()` com objeto de opções — usar `ttsService.speak()`
- ❌ Não exibir "Perfil Operacional" no relatório individual
- ❌ Não retornar Qualidade = 100 quando há violação de bloco (assertion presente)
- ❌ Não penalizar bloco em operações que não sejam FARMÁCIA
- ❌ Não usar linguagem de vínculo empregatício no relatório FREE
- ❌ Não processar apenas um .prc — sempre acumular todos os arquivos selecionados
- ❌ Não filtrar o DocumentPicker por MIME — usar `type: "*/*"` e validar pelo conteúdo
- ❌ Não decidir "é planilha ou texto" pela extensão — usar `detectarFormato()`
- ❌ Não importar `readAsStringAsync` de `expo-file-system` (só de `/legacy`)
- ❌ Não editar migrations já aplicadas — criar patch migrations novas
- ❌ Não recriar policies `USING (true)` / `WITH CHECK (true)` nas tabelas core
- ❌ Não conceder `EXECUTE` de `gerar_escala`/`listar_escala` a `anon` ou `PUBLIC`
