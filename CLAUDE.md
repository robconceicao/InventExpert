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

### Avaliação (módulo principal, maior complexidade) — v3 (2026-08)

**v3 acrescenta três eixos que o v2.1 não tinha como medir**, porque dependem do
cruzamento entre o `.prc`, o `PROD_SEÇÃO.xlsx` e o `ACURACIDADE.xls`:
mapa Seção→Área→Conferente, atribuição de divergência por SEÇÃO+EAN e
atribuição de produtos não contados. O motor v2.1 continua ativo e é a
referência das regras de bloco da farmácia.

```
src/
├── services/
│   ├── AreaMappingService.ts        ← Seção → Área física → Conferente
│   ├── ErroAtribuicaoService.ts     ← divergência do ACURACIDADE → CPF que bipou
│   ├── NaoContadoService.ts         ← não contado → área/responsável (ALTA/MÉDIA/BAIXA)
│   └── AvaliacaoV3Service.ts        ← nota de 4 eixos + separação da auditoria dirigida
└── config/
    └── inventoryEvalConfig.ts       ← AVALIACAO_V3 (pesos, penalidades, seções de auditoria)
```

### Avaliação — entradas da tela (v3)

```
src/utils/avaliacaoV3Parsers.ts   ← PROD_SEÇÃO, ACURACIDADE, NAO CONTADOS, DOBRO,
                                    BLOCO, auditoria dirigida, custo/família, CONTROLADOS
src/utils/inventExpReportV3.ts    ← ficha individual (texto + HTML/PDF)
src/utils/avaliacaoConsolidadaXlsx.ts ← planilha do líder (8 abas)
src/utils/excelParser.ts          ← pickSheetAsMatrix() lê .xls/.xlsx/.csv como matriz
src/utils/fileFormat.ts           ← decide o formato pelos magic bytes, não pela extensão
```

Relatórios do Crystal saem com título e filtros antes do cabeçalho e colunas
espalhadas por dezenas de posições vazias — **ler sempre como matriz**, nunca em
modo objeto. Cada parser localiza a própria linha de cabeçalho pelos rótulos.

`pickSheetAsMatrix()` decide texto-vs-planilha pelos bytes: o mesmo relatório
sai ora como .xls binário, ora como tabela HTML com extensão .xls, e o Android
entrega o arquivo sem extensão no cache do picker. Formato TEXTO vai para
`csvParaMatriz()`; o resto vai para o SheetJS.

No NAO CONTADOS o cabeçalho e os dados saem desalinhados por uma coluna: a
descrição fica à esquerda do rótulo e o preço à direita. Procurar **perto** do
índice do cabeçalho, nunca nele nem na "maior célula de texto" — o nome do
departamento é mais longo que a descrição do produto e vencia.

### Avaliação — base v2.1 (2026-07)

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

> **Estado aplicado:** ver [`docs/SUPABASE_ESTADO.md`](docs/SUPABASE_ESTADO.md).
> Até 08/08/2026 nenhuma migration havia sido aplicada no projeto — os
> repositories caíam em fallback local sem avisar. A ordem de dependência **não**
> é a alfabética: `harden` vem antes de `cleanup`.

```
supabase/
├── schema_v2.sql                              ← schema principal
├── functions.sql                              ← views e functions de score
├── migration_campos_adicionais.sql            ← campos extras (codigo_loja, segmento)
├── migration_limites_bloco_area.sql           ← limites de bloco por área
├── migration_limites_bloco_area_patch1.sql    ← upsert seed + alias OTC + RLS
├── migration_secao_lookup.sql                 ← lookup seção código → nome
├── migration_colaboradores_modalidade.sql      ← modalidade de contratação + RPC
├── migration_attendance_stats_field_events.sql ← presença em field_events + kinds H/I/J
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

A modalidade é marcada pelo líder ao anexar o `RProInv_Produtividade`
(`ModalidadeContratoModal`) e guardada em `colaboradores.modalidade` no Supabase,
com cache em AsyncStorage (`modalidadeRepository`). **Nulo = não conferido**, e a
tela bloqueia o processamento enquanto houver pendência — um default silencioso
faria o prestador receber relatório com linguagem de vínculo.

- **CLT:** linguagem formal, pode mencionar "medida disciplinar" e "CLT".
  Mostra posição no ranking. Bloco de DIRECIONAMENTO.
- **INTERMITENTE:** mencionar impacto em convocações futuras. Mantém ranking.
- **FREE:** nunca usar "colaborador", "funcionário", "medida disciplinar",
  "Código de Conduta" ou "convocação". Usar "prestador de serviço".
  **Sem posição no ranking** e o bloco vira **CONSTATAÇÕES**, com as frases em
  forma de registro do que foi observado, nunca de instrução de como executar o
  serviço. Rodapé diferente (ver `inventExpReports.ts`).

Duas fichas passam por essa regra: o relatório v2.1 (`inventExpReports.ts`) e a
ficha v3 com áreas e não contados (`inventExpReportV3.ts`). Na v3 o prestador
também não recebe ociosidade nem comparação com a mediana — controle de jornada
e comparação com o time são indícios de subordinação.

`relatorioModalidade.test.ts` e `relatorioV3Modalidade.test.ts` travam os termos
proibidos em cada uma.

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
| `PROD_SEÇÃO.xlsx` | XLSX (Crystal Reports) | Área física × conferente × nº de seções × Qtd C1/A1/A2/A3/FINAL — **única fonte da área física** |
| `RELATORIOS/ACURACIDADE.xls` | XLS (Crystal Reports) | Por SEÇÃO + EAN: C1, A1/A2/A3, FINAL, AJST(QTD) — base da atribuição de erro |
| `RELATORIOS/NAO CONTADOS.xls` | XLS (Crystal Reports) | Produtos com saldo em sistema e sem coleta |
| `RELATORIOS/DOBRO.xls` | XLS (Crystal Reports) | Bipadas repetidas — indicador de método, não erro de quantidade |
| `RELATORIOS/BLOCO.xls` | XLS (Crystal Reports) | Seção + CPF + EAN na mesma linha — **conferência independente** da seção e da regra de bloco |
| Auditoria dirigida (folha assinada) | Papel / foto | Produtos recuperados na seção 9999 — transcrever manualmente |
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

Layout conferido contra 38.588 registros reais do inventário DPSP L2601.

```
[00-05] Código evento    [32-42] Matrícula / CPF (11d)
[06-11] Código coletor   [43]    Flag de origem (' ', 'P', 'X') — NÃO indica bloco
[12-17] Seq. sessão      [44-58] Endereço: '0000000' + 'PI' + 6d
[18-25] Data YYYYMMDD    [59-73] Código produto / EAN (15d, zero-padded)
[26-31] Hora HHMMSS      [74-82] Quantidade (9d, 3 casas decimais implícitas)
```

**Três regras que só valem a partir da v3:**

- **Seção = últimos 4 dígitos** do número após `PI`, não os 6. Conferido contra
  `RELATORIOS/BLOCO.xls`, que publica a seção de 4 dígitos ao lado do CPF.
- **Quantidade = 9 dígitos ÷ 1000** (`000014000` = 14). Ler 6 dígitos funcionava
  por acidente até 999 e truncava a partir de 1.000.
- **`is_bloco` = quantidade > 1**, nunca `flag === 'X'`. A regra da flag cobria
  0,9% do que o sistema classifica como bloco; a da quantidade cobre 99,7%.

Endereços com letra ou dígito extra (`PI0G0233`, `PI0022Z`, `000000000PI0003`)
vêm de digitação manual no coletor — normalizar pelos últimos 4 dígitos e
sinalizar em `endereco_fora_padrao`. Foram 0,43% dos registros no L2601.
**O prefixo `PI` desloca junto**: procurar `PI` dentro da janela 44–58, nunca
numa posição fixa, ou justamente as bipadas com problema são descartadas.

Variante 84 chars (campo interno 44-51 com 8d em vez de 7d): offset +1
a partir da posição 44. Detectar por `linha.length`.
Ignorar linhas sem prefixo `PI` nas posições corretas.

**Relógio de coletor:** 30% das bipadas do L2601 vieram com data de 2022. Volume,
sequência e intervalos continuam válidos; a hora absoluta, não. Medir tempo de
trabalho com `horasPorJanelaDiaria()` (soma das janelas de cada data), nunca da
primeira à última bipada.

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

**Baseline v3 + entregáveis (2026-08):** **358 testes / 26 suites** ·
`tsc --noEmit` = 0 erros.

Suites novas da v3:
```
src/utils/__tests__/prcParser.layout.test.ts      ← layout de 83 posições, bloco, relógio
src/services/__tests__/AvaliacaoV3.test.ts        ← área, atribuição, não contados, nota
src/utils/__tests__/avaliacaoV3Parsers.test.ts    ← matrizes do Crystal, custo, auditoria dirigida, DOBRO, BLOCO
```

`AuditoriaAtribuicaoService.test.ts` ganhou regressão amarrando a seção do
`prcParser` à do ACURACIDADE: com 6 dígitos o cruzamento nunca casava e
`erro_real` saía zero para todos.

Arquivos de teste relevantes:
```
src/services/__tests__/InventoryEvaluationService.test.ts  ← motor, líder, violações, dual-field
src/utils/__tests__/prcParser.integration.test.ts          ← parser .prc + catalogoLookup + normalizarNomeArea
src/utils/__tests__/relatorioOutput.test.ts                ← Everaldo / Elen / Tania + alerta OTC ≤5%
src/utils/__tests__/parseInventoryCheckersCsv.test.ts
src/utils/__tests__/fileFormat.test.ts                     ← magic bytes, extensão, UTF-8 vs cp1252, MHTML
src/utils/__tests__/spreadsheetReader.test.ts              ← XLS/XLSX/HTML do Crystal Reports → CSV `;`
src/utils/__tests__/blocoPorAreaSemSecaoLookup.test.ts      ← bloco% por área com secao_lookup vazia
src/utils/__tests__/avaliacaoConsolidadaXlsx.test.ts        ← as 8 abas da planilha do líder
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
| Mapa Seção→Área do evento por cima do `secao_lookup` | A tabela é opcional e vive vazia; sem o mapa do PROD_SEÇÃO o bloco% por área caía no valor da planilha e a violação sumia — ver `docs/SUPABASE_ESTADO.md` |
| "Perfil Operacional" removido do relatório | Baseado em histórico: incoerente com classificação do evento atual |
| Alerta formal se crítica OU limite ≤ 5% | Visibilidade para OTC e áreas ANVISA |
| Aviso de avanço preso ao preenchimento do avanço anterior | O anterior é a prova de que a operação chegou ali; 22h00 é inicial (0%) e nunca avisa |
| Voz do aviso com tela apagada = som da notificação | Sem player de áudio no projeto; TTS só toca com o app aberto — ver `docs/AVISO_VOZ_ELEVENLABS.md` |
| ID do canal Android carrega o nome do som (`alarms_aviso_avanco`) | Canal é imutável: `setNotificationChannelAsync` no mesmo ID não troca o som e não dá erro. O canal `alarms` nasceu antes da voz gravada e por isso o aviso saía mudo |
| catalogoLookup prefere invent_DSP sobre cadastro.txt | invent_DSP tem EAN real e classificação legal |
| `is_bloco` pela quantidade, não pela flag do `.prc` | Regra da flag cobre 0,9% do que o sistema classifica como bloco; a da quantidade cobre 99,7% (conferido contra BLOCO.xls) |
| Seção = últimos 4 dígitos do endereço `PInnnnnn` | Os 6 dígitos não batem com `secao_lookup` nem com `limites_bloco_area` |
| Área física derivada de PROD_SEÇÃO + recorte de blocos | Não existe tabela Seção→Área; o recorte fechou 68 de 72 combinações no L2601 |
| Divergência atribuída por SEÇÃO+EAN contra o `.prc` | Único par que liga o ACURACIDADE ao CPF de quem contou; 56 de 56 com dono único |
| Não contado localizado por marca → departamento → família | O departamento ocupa trecho contínuo da loja; cobre o caso em que nenhum item da marca foi bipado. Vínculo por rótulo, então nunca chega a ALTA |
| Descrição do NAO CONTADOS pelo índice do cabeçalho, não pela maior célula | O nome do departamento é mais longo que a descrição do produto e vencia: 4 dos 18 itens do L2601 saíam como "COMPLEMENTOS VITAMINICOS" |
| Só o não contado RECUPERADO na auditoria penaliza | O item estava na prateleira e ninguém bipou: falha provada. O que permaneceu perdido pode ser erro de saldo do cliente — fica no relatório, sem dono e sem penalidade |
| Matrícula da folha de auditoria dirigida não atribui culpa | É quem registrou a auditoria (líder/auditor), não quem deixou de bipar — no L2601, os 10 itens com a mesma pessoa na seção 9999 |
| Não contado só pesa na nota com confiança ALTA | MÉDIA e BAIXA não sustentam conversa de avaliação; servem para dirigir recontagem |
| Auditoria dirigida (seção 9999) fora da produtividade | Quem executa a auditoria era penalizado no ranking por trabalho que não é contagem |
| Mediana da equipe como referência de produtividade | Menos sensível a extremos que a média e que a meta fixa do perfil |
| Horas medidas por soma de janelas diárias | Relógio de coletor fora de data destrói a diferença entre primeira e última bipada |
| Um único PROD_SEÇÃO alimenta v2.1 e v3 | `parseProdSecaoMatrix` + `prodSecaoParaSecoes`; o usuário anexa uma vez só |
| Planilhas do Crystal lidas como matriz | Cabeçalho e dados saem desalinhados; modo objeto do SheetJS é inutilizável |
| Match de EAN com sufixo de 8+ dígitos | Regra herdada do módulo Auditoria; cobre prefixo do arquivo final e EAN-13 vs EAN-14 |
| Identidade resolvida por agentes.txt/CadFun | O coletor grava CPF, o relatório grava matrícula, o ProInv usa código de 6 dígitos |
| Modalidade nula bloqueia a avaliação | Default 'CLT' fazia prestador receber relatório com termos de vínculo; o bloqueio é a única garantia contra esquecimento |
| Entregáveis valem para os dois motores | O v3 exige três arquivos; sem eles quem responde é o v2.1, e o líder continua precisando entregar a ficha de cada conferente |
| Ficha individual e consolidado do líder são documentos distintos | A ficha é lida junto com o conferente; a planilha expõe o ranking inteiro — ver `docs/PROCEDIMENTO_AVALIACAO.md` |
| Lote de fichas via Storage Access Framework no Android | Escolher a pasta uma vez é o único caminho em que "baixar a ficha de cada conferente" não vira uma janela de compartilhamento por pessoa |
| Modalidade no Supabase, não só local | O mesmo conferente não pode sair como CLT numa loja e prestador em outra |
| FREE sem ranking e sem instrução de trabalho | Comparar com a equipe e orientar como executar são indícios de subordinação |
| Auditoria e Avaliação seguem com serviços separados | Respondem perguntas diferentes: contestar total cobrado vs. calcular nota |
| Ordem dos conferentes no mapa desempata por matrícula | Sem desempate o recorte muda entre execuções; avaliação precisa ser reproduzível |
| Presença consolidada em `field_events`, não na tabela `attendance` | O app já gravava lá; a view `attendance_stats` é que apontava para a tabela órfã e devolvia vazio sem erro |
| `chk_field_events_kind` espelha `FIELD_EVENT_KINDS` | Tela de relatório nova exige estender os dois; senão o upsert falha e o relatório some sem aviso |
| `conferirBloco()` a cada inventário | BLOCO.xls é a única fonte com seção+CPF+EAN juntos; detecta mudança de layout do coletor antes de contaminar a avaliação (L2601: 99,7% de cobertura, 0 CPF divergente) |
| DOBRO conta bipada repetida, não erro | O sistema consolida a duplicidade; o número mede método de marcação, não acuracidade |
| CPF e nome do BLOCO localizados por posição relativa | O cabeçalho do relatório traz linha pontilhada no lugar do rótulo dessas duas colunas |
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
- ❌ Não trocar o som do aviso mantendo o nome do arquivo — o ID do canal não muda e o Android ignora o som novo
- ❌ Não exibir "Perfil Operacional" no relatório individual
- ❌ Não retornar Qualidade = 100 quando há violação de bloco (assertion presente)
- ❌ Não penalizar bloco em operações que não sejam FARMÁCIA
- ❌ Não usar linguagem de vínculo empregatício no relatório FREE
- ❌ Não assumir modalidade por default — nulo significa "não conferido" e bloqueia
- ❌ Não mostrar posição no ranking nem instrução de trabalho no relatório FREE
- ❌ Não processar apenas um .prc — sempre acumular todos os arquivos selecionados
- ❌ Não usar a flag da posição 43 do `.prc` para decidir bloco
- ❌ Não guardar a seção com 6 dígitos — são sempre os últimos 4
- ❌ Não medir horas trabalhadas da primeira à última bipada quando houver mais de uma data
- ❌ Não atribuir não contado a um conferente sem declarar o nível de confiança
- ❌ Não penalizar ninguém por produto que permaneceu não encontrado — só o recuperado na auditoria
- ❌ Não usar a matrícula da folha de auditoria dirigida para atribuir responsabilidade
- ❌ Não publicar avaliação sem rodar `conferirReconciliacao()` contra Erro (Qtde)
- ❌ Não entregar a planilha consolidada ao conferente — ela traz o ranking da equipe
- ❌ Não usar BOM em download binário na web (corrompe XLSX e PDF)
- ❌ Não ler planilha do Crystal com `sheet_to_json` em modo objeto — usar `pickSheetAsMatrix()`
- ❌ Não confiar em índice fixo de coluna no NAO CONTADOS (cabeçalho e dados desalinham)
- ❌ Não exigir `PI` numa posição fixa do `.prc` — o endereço digitado à mão desloca o campo
- ❌ Não filtrar o DocumentPicker por MIME — usar `type: "*/*"` e validar pelo conteúdo
- ❌ Não decidir "é planilha ou texto" pela extensão — usar `detectarFormato()`
- ❌ Não importar `readAsStringAsync` de `expo-file-system` (só de `/legacy`)
- ❌ Não editar migrations já aplicadas — criar patch migrations novas
- ❌ Não recriar policies `USING (true)` / `WITH CHECK (true)` nas tabelas core
- ❌ Não conceder `EXECUTE` de `gerar_escala`/`listar_escala` a `anon` ou `PUBLIC`
