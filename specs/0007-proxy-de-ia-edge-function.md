# SPEC 0007 — Chaves de IA saem do app para uma Edge Function

- **Estado:** APROVADA
- **Autor:** Roberto
- **Data:** 2026-09-30
- **Entrega relacionada:** levantamento de agentes de 30/09/2026 (seção 1.5) — quatro
  chaves de IA embutidas no bundle e `.env` rastreado no repositório público até `15a1440`

---

## 1. Objetivo

O líder continua apagando a escrita de uma folha escaneada e pedindo a análise da equipe
pelo app, mas nenhuma chave de provedor de IA existe mais dentro do APK ou do bundle web,
e o nome dos conferentes não sai do aparelho para o provedor.

## 2. Escopo

- [ ] Edge Function `ia-proxy` em `supabase/functions/ia-proxy/`, com duas ações:
      `apagar_escrita` (imagem → HTML) e `analisar_equipe` (ranking → texto)
- [ ] **Um único provedor: Anthropic** (Q1). Saem do app as chamadas a Gemini, Groq,
      OpenAI, DeepSeek e OCR.space
- [ ] Toda a lógica decidível sem rede em `logica.ts` (puro, sem API do Deno), testada no Jest;
      `index.ts` só faz IO: ler requisição, chamar RPC, chamar a Anthropic, gravar uso
- [ ] Autorização pelo mesmo critério do RLS: `is_staff_reader()` e `is_staff_writer()`,
      chamados por RPC com o JWT do usuário (D2)
- [ ] Limite diário por usuário e ação, contado na tabela nova `ia_uso` (migration nova)
- [ ] HTML devolvido pelo modelo sanitizado e com CSP antes de voltar ao app (D7)
- [ ] **Pseudonimização** (Q2): na `analisar_equipe`, o nome de cada conferente vira um
      código `C01..Cnn` no aparelho antes do envio e volta ao texto só no aparelho (D11)
- [ ] Cliente `src/services/iaProxy.ts`; `handwritingEraser.ts` vira wrapper fino dele
      mantendo a assinatura de `eraseHandwriting()` (D8)
- [ ] `src/services/deepseek.ts` sai e dá lugar a `src/services/analiseEquipe.ts`; a tela
      passa a entregar as linhas do ranking separadas, não o texto pronto (D11)
- [ ] Remoção de `@env` do projeto: `react-native-dotenv` sai do `babel.config.js` e do
      `package.json`; o módulo `@env` sai de `src/types/env.d.ts` (D3)
- [ ] Teste de regressão que falha se `@env` ou literal com formato de chave voltar a `src/`

### Não-escopo

- **Revogar as chaves antigas.** Pré-requisito feito pelo Roberto nos painéis de Google AI
  Studio, DeepSeek, Groq e OpenAI, antes do merge. Nenhum agente toca em chave.
- **Reescrever o histórico do git** para apagar o `.env` antigo. Chave revogada no histórico
  não tem valor; reescrever histórico de repositório público quebra forks e PRs.
- **Mudar o conteúdo dos prompts.** O texto atual migra para o servidor. A única frase nova é a
  instrução de citar os conferentes pelo código (E17).
- **Cadeia de provedores de reserva.** Com um só provedor, a resiliência é nova tentativa
  (E6), não troca de fornecedor. Se a Anthropic ficar fora do ar, os dois recursos ficam
  indisponíveis com mensagem clara, e o resto do app continua funcionando.
- **`ScannerScreen.tsx`.** Não muda.
- **`api_cleaner/` e `EXPO_PUBLIC_FORM_CLEANER_URL`.** Serviço Python separado, sem chave de IA.
- **Licenciamento (`tadeuLicense.ts`)** e isolamento de dados por loja no RLS.
- **Workflow de CI.** É a SPEC 0008.
- **Rotina de limpeza da `ia_uso`.** A retenção fica decidida (Q6), a execução não.

## 3. Decisões de arquitetura

| # | Decisão | Justificativa | Alternativa descartada |
|---|---------|---------------|------------------------|
| D1 | Uma função `ia-proxy` com campo `acao` | Um único ponto de autenticação, limite, log e CORS | Uma função por recurso: duplica auth e limite, e o segundo diverge do primeiro |
| D2 | Autorização por RPC a `is_staff_reader()`/`is_staff_writer()` com o JWT do usuário | Mesma regra que o RLS já aplica, inclusive ao usuário legado sem `app_profiles` (`SECURITY_RLS.md`) | Reimplementar papel dentro da função: duas regras para a mesma pergunta |
| D3 | A chave só existe como secret `ANTHROPIC_API_KEY` da Edge Function; `@env` e `react-native-dotenv` removidos | Sem o módulo `@env` declarado, um import novo quebra o `tsc` em vez de vazar em silêncio | `EXPO_PUBLIC_*` (público por definição); variável da EAS (vai para o build se o app a lê) |
| D4 | Chave no header `x-api-key`, URL fixa `https://api.anthropic.com/v1/messages`, header `anthropic-version: 2023-06-01` | A chave nunca aparece em URL, corpo ou log | Montar URL ou corpo com a chave |
| D5 | Limite de uso na tabela `ia_uso`, escrita só pelo `service_role` dentro da função | Limite no cliente é contornável por quem tem o JWT | Contador em AsyncStorage |
| D6 | `logica.ts` puro no Jest; `index.ts` (Deno) excluído do `tsc` do app | `npm run check` continua sendo o único comando de baseline (ADR 0002); o Jest roda em Node, não em Deno | `deno test` como segunda suíte fora do `check` |
| D7 | HTML do modelo passa por `sanitizarHtml()` e recebe `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">` | O HTML vai direto para `Print.printToFileAsync`, que renderiza num WebView; saída de modelo é entrada não confiável | Confiar no prompt ("retorne só HTML") |
| D8 | `eraseHandwriting()` mantém assinatura e retorno (`engine`, `model`) | `ScannerScreen` não muda, e o diff fica revisável | Trocar a API pública do serviço junto com o transporte |
| D9 | Erro ao cliente nunca carrega corpo cru do provedor: só código, mensagem pt-BR fixa e a lista de tentativas (modelo e status) | Corpo de erro pode ecoar prompt, dados enviados ou detalhe de conta | Repassar `errText` como hoje |
| D10 | Log da função registra só ação, modelo, status e duração | Imagem, HTML e ranking contêm dado pessoal (LGPD art. 6º, III) | Log de depuração com payload |
| D11 | Pseudonimização **no aparelho**, por **posição no ranking**, com a tela entregando `{ nome, resumo }[]` | Nome não sai do aparelho, nem para a nossa função; um código por linha mantém distintos dois conferentes com o mesmo nome (o projeto já corrigiu bug de homônimo em `d63e19a`) | Trocar nome por código no texto pronto (homônimos colapsam num código só); pseudonimizar no servidor (o nome já teria saído do aparelho) |
| D12 | Um único provedor (Anthropic) | Decisão do Roberto (Q1): menos terceiros recebendo foto de formulário e dados da equipe; um segredo para rotacionar | Manter cadeia com Gemini de reserva |

## 4. Restrições

- P1–P5 do projeto: sem "Perfil Operacional"; TTS só via `ttsService.speak()`; NativeWind v2;
  migration sempre em arquivo novo; commit antes de cada etapa de agente e um commit por fase.
- Nenhuma chave, token ou valor de secret em arquivo do repositório, em teste, em log ou
  na conversa com agente. Teste usa valor falso óbvio (`"chave-falsa-teste"`).
- A foto da folha em `apagar_escrita` continua indo para a Anthropic, e uma folha preenchida
  pode conter nome ou assinatura. É inerente ao recurso; a pseudonimização vale só para o
  ranking. O HTML devolvido não guarda a escrita manual (é o próprio objetivo do recurso).
- A migration nova entra na ordem de aplicação do `docs/SUPABASE_ESTADO.md`, depois de
  `security_advisor_cleanup` (depende de `auth.users` e do padrão de RLS de lá).
- Duração: tentativas e esperas cabem em `LIMITES.orcamentoTotalMs` (110 s), abaixo dos 150 s
  de parede e dos 150 s de espera por resposta da Edge Function no plano Free (400 s de parede
  nos pagos). Fonte: <https://supabase.com/docs/guides/functions/limits>, consultada em 30/09/2026.
- CPU: no máximo 2 s de CPU por requisição (espera de rede não conta) e 256 MB de memória.
  A função não decodifica nem processa a imagem: valida só o tamanho do base64 e o repassa.
  A sanitização roda sobre o HTML devolvido, que tem dezenas de KB, não sobre a imagem.
- Web: a análise da equipe roda no GitHub Pages; o scanner continua desabilitado no browser
  (`ScannerScreen.web.tsx`).
- `npm run check` continua o único comando de verificação.

## 5. Interfaces e contratos de dados

```typescript
// supabase/functions/ia-proxy/logica.ts — puro: sem Deno, sem fetch, sem supabase-js

export type Orientacao = 'retrato' | 'paisagem';

export type IaRequisicao =
  | { acao: 'apagar_escrita'; imagemBase64: string; mimeType: 'image/jpeg' | 'image/png'; orientacao: Orientacao }
  | { acao: 'analisar_equipe'; tipoOperacao: string; ranking: string };
  // `ranking` já chega pseudonimizado: só códigos C01..Cnn, nenhum nome (D11).

export type IaErroCodigo =
  | 'REQUISICAO_INVALIDA'  // 400
  | 'SEM_SESSAO'           // 401
  | 'SEM_PERMISSAO'        // 403
  | 'PAYLOAD_GRANDE'       // 413
  | 'LIMITE_DIARIO'        // 429
  | 'IA_INDISPONIVEL'      // 502 — a Anthropic não respondeu com sucesso depois das tentativas
  | 'NAO_CONFIGURADO'      // 503 — secret ausente, ou a Anthropic recusou a chave (401/403)
  | 'REDE';                // só no cliente: o invoke nem chegou à função

export type Tentativa = { modelo: string; status: number | 'timeout' | 'rede' | 'resposta_invalida' };

export type IaResposta =
  | { ok: true; acao: 'apagar_escrita'; html: string; modelo: string }
  | { ok: true; acao: 'analisar_equipe'; texto: string; modelo: string }
  | { ok: false; codigo: IaErroCodigo; mensagem: string; tentativas?: Tentativa[] };
  // `tentativas` ausente = a Anthropic não foi chamada (erro decidido antes).

export const MODELOS = {
  apagar_escrita: 'claude-sonnet-5-5',            // Q5: fidelidade de layout
  analisar_equipe: 'claude-haiku-4-5-20251001',   // Q5: texto curto, custo menor
} as const;

export const LIMITES: {
  imagemBase64MaxChars: 7_000_000;          // ~5 MB; o scanner manda JPEG a 50%
  rankingMaxChars: 20_000;
  usosDiarios: { apagar_escrita: 60; analisar_equipe: 20 };          // Q3, revistos após 30 dias de ia_uso
  timeoutPorChamadaMs: 45_000;
  esperasEntreTentativasMs: readonly [1_000, 3_000];                 // até 3 chamadas no total
  orcamentoTotalMs: 110_000;
};

export function validarRequisicao(corpo: unknown):
  | { ok: true; req: IaRequisicao }
  | { ok: false; codigo: 'REQUISICAO_INVALIDA' | 'PAYLOAD_GRANDE'; mensagem: string };

export function autorizar(
  acao: IaRequisicao['acao'],
  ctx: { temSessao: boolean; staffReader: boolean; staffWriter: boolean; usosHoje: number },
): { ok: true } | { ok: false; codigo: 'SEM_SESSAO' | 'SEM_PERMISSAO' | 'LIMITE_DIARIO' };
// apagar_escrita exige staffReader (todo staff, inclusive OPERADOR); analisar_equipe exige
// staffWriter (LIDER/ADMIN), porque expõe o ranking (Q4). Usuário legado sem app_profiles
// passa nos dois, como no RLS.

export function chaveConfigurada(env: Readonly<Record<string, string | undefined>>): boolean;
// true só se ANTHROPIC_API_KEY existir e não for vazia. Nunca devolve nem registra o valor.

export function montarChamada(req: IaRequisicao, chave: string):
  { url: 'https://api.anthropic.com/v1/messages'; headers: Record<string, string>; body: string };
// headers: x-api-key, anthropic-version, content-type. A chave aparece só em headers (D4).
// apagar_escrita: bloco { type: 'image', source: { type: 'base64', media_type, data } } + texto.
// analisar_equipe: `system` + mensagem do usuário.

export function deveRepetir(status: number | 'timeout' | 'rede'): boolean;
// true para 429, 500, 502, 503, 529, 'timeout', 'rede'; false para 400, 401, 403, 404, 413.

export async function executarComRepeticao(
  chamar: (sinal: AbortSignal) => Promise<{ status: number; corpo: unknown }>,
  interpretar: (corpo: unknown) => string | null,     // null = resposta inválida
  esperar: (ms: number) => Promise<void>,
  agora: () => number,
  modelo: string,
): Promise<{ ok: true; saida: string } | { ok: false; codigo: 'IA_INDISPONIVEL' | 'NAO_CONFIGURADO'; tentativas: Tentativa[] }>;
// 401/403 da Anthropic ⇒ NAO_CONFIGURADO sem repetir (chave revogada ou errada).

export function limparHtml(bruto: string): string | null;   // tira cercas ```html; null se não houver <html
export function sanitizarHtml(html: string): string;         // D7
export function promptApagarEscrita(o: Orientacao): string;   // texto atual de handwritingEraser.ts
export function promptAnaliseEquipe(tipoOperacao: string, ranking: string): { sistema: string; usuario: string };
// Texto atual de deepseek.ts + "Refira-se a cada conferente só pelo código (C01, C02...) exatamente como recebido."
export function mensagemPorCodigo(c: IaErroCodigo): string;   // pt-BR, sem detalhe técnico
export function cabecalhosCors(origem: string | null): Record<string, string>;
// Origem https://robconceicao.github.io recebe Allow-Origin; sem Origin (app nativo) não precisa; outra origem não recebe.
```

```typescript
// src/services/iaProxy.ts — cliente

export type Transporte = (req: IaRequisicao) => Promise<{ status: number; corpo: unknown }>;
// Lança em falha de rede. A implementação real usa supabase.functions.invoke e lê o corpo
// de FunctionsHttpError via error.context.json(); o resto do módulo é testável com transporte falso.

export type LinhaRanking = { nome: string; resumo: string };
// `resumo` = "Score 87 (BOM) | Qtd Contada: 1520 | Erros: 3 (0,20%) | Prod/h: 410 | Bloco: 2,1%",
// montado pela tela sem o nome.

export type AnaliseEquipeResult =
  | { success: true; text: string; modelo: string }
  | { success: false; error: string };

export function pseudonimizarRanking(linhas: LinhaRanking[]): { texto: string; mapa: ReadonlyMap<string, string> };
// Linha i (0-based) vira "C{i+1, 2 dígitos}: {resumo}"; mapa C01 → nome.
// Nome repetido no ranking: o mapa guarda "NOME (Nº posição)" para cada ocorrência.

export function restaurarNomes(texto: string, mapa: ReadonlyMap<string, string>): string;
// Troca \bC\d{2}\b (maiúscula ou minúscula) pelo valor do mapa; código fora do mapa fica como está.

export function criarClienteIa(t: Transporte): {
  apagarEscrita(imagemBase64: string, mimeType: 'image/jpeg' | 'image/png', o: Orientacao): Promise<EraserResult>;
  analisarEquipe(tipoOperacao: string, linhas: LinhaRanking[]): Promise<AnaliseEquipeResult>;
};

// Contrato preservado (D8):
// EraserResult = { success: true; html; engine: 'Anthropic'; model } | { success: false; error }
```

```typescript
// src/services/analiseEquipe.ts — substitui deepseek.ts
export function analyzeTeamPerformance(operationType: string, linhas: LinhaRanking[]): Promise<AnaliseEquipeResult>;

// src/screens/LeaderEvaluationDashboard.tsx — muda só:
//   1. import de analiseEquipe no lugar de deepseek
//   2. monta `linhas` ({ nome: ev.input.nome, resumo }) em vez de `rankingText`
//   3. selo "DEEPSEEK" passa a "ANTHROPIC"
```

```sql
-- supabase/migration_ia_uso.sql (nova)
CREATE TABLE IF NOT EXISTS public.ia_uso (
  id         bigserial PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  acao       text NOT NULL CHECK (acao IN ('apagar_escrita', 'analisar_equipe')),
  modelo     text,                 -- NULL quando a Anthropic não foi chamada
  sucesso    boolean NOT NULL,
  criado_em  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ia_uso_user_dia ON public.ia_uso (user_id, acao, criado_em);
ALTER TABLE public.ia_uso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ia_uso FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.ia_uso FROM anon, authenticated, PUBLIC;
-- Sem policy: só o service_role (dentro da Edge Function) lê e grava.
```

`usosHoje` = linhas da `ia_uso` do usuário e da ação com `criado_em` nas últimas 24 h.
Conta requisição com e sem sucesso que chegou a chamar a Anthropic: o custo existe nos dois
casos. Requisição barrada antes (E1–E5) não grava linha.

## 6. Dependências

| Dependência | Estado | No escopo? |
|-------------|--------|------------|
| Chaves antigas revogadas em Google AI Studio, DeepSeek, Groq e OpenAI | A FAZER (Roberto) | Não — pré-requisito do merge |
| Chave da Anthropic num workspace só do InventExpert, com limite de gasto e prazo de expiração | A FAZER (Roberto) | Não — feito no Console |
| Secret `ANTHROPIC_API_KEY` no painel (Edge Functions → Secrets) do projeto `knxwuxxpbrbmhgdatgoe` | A CRIAR (Roberto) | Não — feito pelo painel, nunca por agente |
| `is_staff_reader()`/`is_staff_writer()` com EXECUTE para `authenticated` | JÁ EXISTE (`harden` + `cleanup`) | — |
| Tabela `ia_uso` | A CRIAR | Sim |
| Pasta `supabase/functions/` | A CRIAR | Sim |
| Supabase CLI (instalada: 2.115.0) | JÁ EXISTE | — |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` no ambiente da função | JÁ EXISTE (injetados pela Supabase) | — |
| Limites da Edge Function: 150 s de parede (Free), 2 s de CPU, 256 MB | CONFIRMADO em 30/09/2026 ([docs](https://supabase.com/docs/guides/functions/limits)) | — |
| SPEC 0008 (CI) | Independente | Não |

## 7. Casos extremos

| # | Caso | Comportamento esperado |
|---|------|------------------------|
| E1 | Requisição sem JWT ou com JWT expirado | 401 `SEM_SESSAO`; Anthropic não chamada; nenhuma linha na `ia_uso` |
| E2 | Operador (staff leitor) pede `analisar_equipe` | 403 `SEM_PERMISSAO` (Q4) |
| E3 | Usuário já no limite diário da ação | 429 `LIMITE_DIARIO` antes de chamar a Anthropic |
| E4 | `imagemBase64` acima de `LIMITES.imagemBase64MaxChars` ou `ranking` acima de `rankingMaxChars` | 413 `PAYLOAD_GRANDE`; Anthropic não chamada |
| E5 | Secret `ANTHROPIC_API_KEY` ausente ou vazio | 503 `NAO_CONFIGURADO`, mensagem "recurso de IA não configurado no servidor"; o app não trava |
| E6 | Anthropic devolve 429, 5xx ou 529 (sobrecarga) e depois responde | Repete após 1 s e depois 3 s, dentro do orçamento; 200 na tentativa que der certo; uma linha na `ia_uso` |
| E7 | Anthropic falha nas 3 tentativas | 502 `IA_INDISPONIVEL` com `tentativas`; nenhum corpo cru da Anthropic na resposta (D9) |
| E8 | Montagem da chamada | Chave só em `x-api-key`; `url` e `body` não contêm a chave (D4) |
| E9 | Modelo devolve HTML dentro de cercas ```` ```html ```` | Cercas removidas; resposta sem `<html` conta como `resposta_invalida` e entra na repetição |
| E10 | HTML com `<script>`, `<iframe>`, `onload=`, `javascript:`, `<img src="https://...">`, `<link href="https://...">` | Tudo removido; CSP injetada no `<head>` (cria `<head>` se faltar) |
| E11 | Anthropic não responde | Aborta em `timeoutPorChamadaMs`, registra `timeout`, repete; não inicia tentativa se o orçamento restante for menor que o timeout |
| E12 | Folha deitada | Prompt pede "A4 landscape"; em pé pede "A4 portrait" (comportamento atual preservado) |
| E13 | Celular sem internet | Transporte lança; cliente devolve `{ success: false, error }` com a frase de rede em pt-BR, sem stack |
| E14 | Corpo inválido: `acao` desconhecida, `orientacao` fora do enum, `mimeType` diferente de jpeg/png, JSON quebrado | 400 `REQUISICAO_INVALIDA` |
| E15 | Requisição do GitHub Pages; requisição de outra origem; preflight `OPTIONS` | Pages recebe `Access-Control-Allow-Origin`; outra origem não; `OPTIONS` responde 204 sem exigir JWT |
| E16 | Alguém reintroduz `import … from '@env'` ou cola literal `AIza…`/`sk-…`/`gsk_…`/`sk-ant-…` em `src/` | Teste de regressão falha; `tsc` falha no `@env` por falta de declaração |
| E17 | Ranking com nomes de conferentes | O corpo enviado pelo transporte não contém nenhum dos nomes; o texto devolvido ao líder volta com os nomes |
| E18 | Dois conferentes com o mesmo nome no ranking | Recebem códigos diferentes; na volta aparecem como "NOME (Nº posição)", distintos |
| E19 | Modelo escreve o código em minúscula ("c03") ou cita código que não existe ("C99") | "c03" é restaurado; "C99" fica como está |
| E20 | Anthropic devolve 401 ou 403 (chave revogada ou errada) | 503 `NAO_CONFIGURADO` sem repetir; log registra só o status |
| E21 | `ScannerScreen` consome o resultado | `engine` e `model` continuam preenchidos no sucesso; `error` continua string no fracasso |

## 8. Questões em aberto

| # | Pergunta | Dono | Estado |
|---|----------|------|--------|
| Q1 | Quais provedores ficam? | Roberto | RESPONDIDA 2026-09-30: **somente Anthropic** (D12) |
| Q2 | Pseudonimizar os nomes enviados em `analisar_equipe`? | Roberto | RESPONDIDA 2026-09-30: **sim** (D11) |
| Q3 | Limites diários por usuário | Roberto | RESPONDIDA 2026-09-30: **60** `apagar_escrita` e **20** `analisar_equipe` por 24 h, revistos após 30 dias de `ia_uso` |
| Q4 | Quem pode usar cada ação? | Roberto | RESPONDIDA 2026-09-30: `apagar_escrita` para todo staff (`is_staff_reader`); `analisar_equipe` só `is_staff_writer` |
| Q5 | Modelo por ação | Roberto | RESPONDIDA 2026-09-30: `claude-sonnet-5-5` em `apagar_escrita`; `claude-haiku-4-5-20251001` em `analisar_equipe`. Preço a conferir no Console antes do deploy |
| Q6 | Retenção da `ia_uso` | Roberto | RESPONDIDA 2026-09-30: **90 dias**; limpeza automática fora desta entrega |
| Q7 | Remover `src/services/geminiVision.ts`? | Roberto | RESPONDIDA 2026-09-30: **remover** nesta entrega |

## 9. Critérios de aceitação

- [ ] `npm run check` termina sem erro (tsc = 0 erros, suíte inteira verde)
- [ ] Testes novos em `src/services/__tests__/iaProxyLogica.test.ts`:
  - [ ] E1 → `sem sessão devolve SEM_SESSAO`
  - [ ] E2 → `staff sem escrita não analisa equipe`
  - [ ] E3 → `limite diário atingido barra antes da Anthropic`
  - [ ] E4 → `payload acima do limite devolve PAYLOAD_GRANDE`
  - [ ] E5 → `sem ANTHROPIC_API_KEY a chave não está configurada`
  - [ ] E6 → `429 e 529 repetem com espera e a segunda resposta vale`
  - [ ] E7 → `três falhas devolvem IA_INDISPONIVEL só com as tentativas`
  - [ ] E8 → `chave vai em x-api-key e nunca na url nem no corpo`
  - [ ] E9 → `cercas de markdown saem e texto sem html é resposta inválida`
  - [ ] E10 → `sanitização remove script, iframe, eventos, javascript e url externa e injeta CSP`
  - [ ] E11 → `timeout aborta a chamada e respeita o orçamento total`
  - [ ] E12 → `prompt de paisagem pede A4 landscape`
  - [ ] E14 → `corpo inválido devolve REQUISICAO_INVALIDA`
  - [ ] E15 → `cors libera o GitHub Pages e nega outra origem`
  - [ ] E20 → `401 da Anthropic vira NAO_CONFIGURADO sem repetir`
- [ ] Testes novos em `src/services/__tests__/iaProxyCliente.test.ts`:
  - [ ] E13 → `falha de rede vira mensagem em português`
  - [ ] E17 → `corpo enviado não contém nenhum nome e a resposta volta com os nomes`
  - [ ] E18 → `homônimos recebem códigos distintos e voltam com a posição`
  - [ ] E19 → `código minúsculo é restaurado e código inexistente fica como está`
  - [ ] E21 → `eraseHandwriting mantém engine e model no sucesso`
- [ ] Teste novo em `src/services/__tests__/semChaveNoCliente.test.ts`:
  - [ ] E16 → `nenhum arquivo de src importa @env nem contém literal com formato de chave`
- [ ] `rg -n "@env|react-native-dotenv|api\.deepseek|generativelanguage|api\.groq|api\.openai|ocr\.space" src babel.config.js package.json`
      não encontra nada
- [ ] Depois de `npx expo export -p android` e de `npx expo export -p web`, nenhum arquivo em
      `dist/` casa `AIza[0-9A-Za-z_-]{30}|sk-[A-Za-z0-9]{20,}|gsk_[A-Za-z0-9]{20,}|sk-ant-`
- [ ] Revisão de segurança (prompt do `seguranca-defensiva`) sem achado BLOQUEANTE, com registro
      em `docs/registros/`
- [ ] Implantação feita pelo Roberto, nesta ordem: chaves antigas revogadas → migration
      `migration_ia_uso.sql` aplicada e registrada no `docs/SUPABASE_ESTADO.md` → secret
      `ANTHROPIC_API_KEY` criado no painel → `supabase functions deploy ia-proxy --project-ref knxwuxxpbrbmhgdatgoe`
- [ ] Teste manual no aparelho: apagar escrita de uma folha em pé e de uma deitada gera o PDF;
      análise da equipe responde no app e na web com os nomes reais; os logs da função no
      painel não mostram base64, HTML, nome de conferente nem código C01..Cnn junto de nome
- [ ] `CLAUDE.md` atualizado: decisões D3, D5, D7, D11 e D12 na tabela de decisões e a linha
      "não colocar chave em `@env`/`EXPO_PUBLIC_*`" em "O que NÃO fazer"
- [ ] Nenhum arquivo fora desta lista foi tocado:
  - novos: `supabase/functions/ia-proxy/index.ts`, `supabase/functions/ia-proxy/logica.ts`,
    `supabase/migration_ia_uso.sql`, `src/services/iaProxy.ts`, `src/services/analiseEquipe.ts`,
    `src/services/__tests__/iaProxyLogica.test.ts`, `src/services/__tests__/iaProxyCliente.test.ts`,
    `src/services/__tests__/semChaveNoCliente.test.ts`
  - editados: `src/services/handwritingEraser.ts`, `src/screens/LeaderEvaluationDashboard.tsx`
    (só os três pontos da seção 5), `src/types/env.d.ts`, `babel.config.js`, `package.json`,
    `package-lock.json`, `tsconfig.json` (excluir `supabase/functions/**/index.ts`),
    `.env.example` (saem as quatro chaves de IA), `docs/SUPABASE_ESTADO.md`, `CLAUDE.md`
  - removidos: `src/services/deepseek.ts`, `src/services/geminiVision.ts`

## 10. Registro de realimentação

| Data | Achado | Classificação | O que foi feito |
|------|--------|---------------|-----------------|
| | | BUG DE CÓDIGO / LACUNA DE SPEC | |

## Histórico

| Data | Mudança | Por quem | Estado |
|------|---------|----------|--------|
| 2026-09-30 | Spec escrita a partir do levantamento de agentes; Q1–Q7 abertas | Claude Code (sessão principal) | RASCUNHO |
| 2026-09-30 | Q1 = somente Anthropic; Q2 = pseudonimizar. Cadeia de provedores vira repetição (E6, E7, E20); tela passa linhas do ranking (D11, E17–E19); `deepseek.ts` dá lugar a `analiseEquipe.ts` | Roberto / Claude Code | RASCUNHO |
| 2026-09-30 | Q3–Q7 respondidas com as recomendações: limites 60/20, `apagar_escrita` para todo staff e `analisar_equipe` só escrita, Sonnet 5.5 / Haiku 4.5, retenção de 90 dias, `geminiVision.ts` removido. Limites da Edge Function confirmados na documentação (150 s, 2 s de CPU, 256 MB). Nada aberto; falta só a aprovação do Roberto | Roberto / Claude Code | RASCUNHO |
| 2026-09-30 | Spec aprovada; Q1–Q7 fechadas e limites da Edge Function confirmados | Roberto | RASCUNHO → APROVADA |
