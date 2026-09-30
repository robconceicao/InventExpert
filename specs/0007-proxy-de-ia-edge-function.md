# SPEC 0007 — Chaves de IA saem do app para uma Edge Function

- **Estado:** RASCUNHO
- **Autor:** Roberto
- **Data:** 2026-09-30
- **Entrega relacionada:** levantamento de agentes de 30/09/2026 (seção 1.5) — quatro
  chaves de IA embutidas no bundle e `.env` rastreado no repositório público até `15a1440`

---

## 1. Objetivo

O líder continua apagando a escrita de uma folha escaneada e pedindo a análise da equipe
pelo app, mas nenhuma chave de provedor de IA existe mais dentro do APK ou do bundle web:
quem extrair o app não consegue gastar a conta nem ler as chaves.

## 2. Escopo

- [ ] Edge Function `ia-proxy` em `supabase/functions/ia-proxy/`, com duas ações:
      `apagar_escrita` (imagem → HTML) e `analisar_equipe` (ranking → texto)
- [ ] Toda a lógica decidível sem rede em `logica.ts` (puro, sem API do Deno), testada no Jest;
      `index.ts` só faz IO: ler requisição, chamar RPC, chamar provedor, gravar uso
- [ ] Autorização pelo mesmo critério do RLS: `is_staff_reader()` e `is_staff_writer()`,
      chamados por RPC com o JWT do usuário (D2)
- [ ] Limite diário por usuário e ação, contado na tabela nova `ia_uso` (migration nova)
- [ ] HTML devolvido pelo modelo sanitizado e com CSP antes de voltar ao app (D7)
- [ ] Cliente `src/services/iaProxy.ts`; `handwritingEraser.ts` e `deepseek.ts` passam a ser
      wrappers finos dele, **mantendo as assinaturas exportadas** usadas pelas telas (D8)
- [ ] Remoção de `@env` do projeto: `react-native-dotenv` sai do `babel.config.js` e do
      `package.json`; o módulo `@env` sai de `src/types/env.d.ts` (D3)
- [ ] Teste de regressão que falha se `@env` ou literal com formato de chave voltar a `src/`
- [ ] Provedores e modelos conforme Q1/Q5

### Não-escopo

- **Revogar as chaves antigas.** Pré-requisito feito pelo Roberto nos painéis dos
  provedores, antes do merge. Nenhum agente toca em chave.
- **Reescrever o histórico do git** para apagar o `.env` antigo. Chave revogada no histórico
  não tem valor; reescrever histórico de repositório público quebra forks e PRs.
- **Mudar os prompts.** O texto dos prompts atuais migra igual para o servidor; ajuste de
  qualidade é outra entrega.
- **Telas.** `ScannerScreen.tsx` não muda. `LeaderEvaluationDashboard.tsx` muda só o selo
  "DEEPSEEK", que passa a mostrar o provedor devolvido.
- **`api_cleaner/` e `EXPO_PUBLIC_FORM_CLEANER_URL`.** Serviço Python separado, sem chave de IA.
- **Licenciamento (`tadeuLicense.ts`)** e isolamento de dados por loja no RLS.
- **Workflow de CI.** É a SPEC 0008.
- **Rotina de limpeza da `ia_uso`.** A retenção fica decidida (Q6), a execução não.

## 3. Decisões de arquitetura

| # | Decisão | Justificativa | Alternativa descartada |
|---|---------|---------------|------------------------|
| D1 | Uma função `ia-proxy` com campo `acao` | Um único ponto de autenticação, limite, log e CORS | Uma função por recurso: duplica auth e limite, e o segundo diverge do primeiro |
| D2 | Autorização por RPC a `is_staff_reader()`/`is_staff_writer()` com o JWT do usuário | Mesma regra que o RLS já aplica, inclusive ao usuário legado sem `app_profiles` (`SECURITY_RLS.md`) | Reimplementar papel dentro da função: duas regras para a mesma pergunta |
| D3 | Chaves só como secrets da Edge Function; `@env` e `react-native-dotenv` removidos | Sem o módulo `@env` declarado, um import novo quebra o `tsc` em vez de vazar em silêncio | `EXPO_PUBLIC_*` (público por definição); variável da EAS (vai para o build se o app a lê) |
| D4 | Chave do Gemini no header `x-goog-api-key`, nunca na URL | URL com `?key=` aparece em log de erro e de proxy | Manter o query string atual |
| D5 | Limite de uso na tabela `ia_uso`, escrita só pelo `service_role` dentro da função | Limite no cliente é contornável por quem tem o JWT | Contador em AsyncStorage |
| D6 | `logica.ts` puro no Jest; `index.ts` (Deno) excluído do `tsc` do app | `npm run check` continua sendo o único comando de baseline (ADR 0002); o Jest roda em Node, não em Deno | `deno test` como segunda suíte fora do `check` |
| D7 | HTML do modelo passa por `sanitizarHtml()` e recebe `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">` | O HTML vai direto para `Print.printToFileAsync`, que renderiza num WebView; saída de modelo é entrada não confiável | Confiar no prompt ("retorne só HTML") |
| D8 | `eraseHandwriting()` e `analyzeTeamPerformance()` mantêm assinatura e forma de retorno; `DeepSeekResult` ganha `provedor` | As telas não mudam, e o diff fica revisável | Trocar a API pública dos serviços junto com o transporte |
| D9 | Erro ao cliente nunca carrega corpo cru do provedor: só código, mensagem pt-BR fixa e a lista de tentativas (provedor, modelo, status) | Corpo de erro pode ecoar prompt, dados enviados ou detalhe de conta | Repassar `errText` como hoje |
| D10 | Log da função registra só ação, provedor, modelo, status e duração | Imagem, HTML e ranking contêm dado pessoal (LGPD art. 6º, III) | Log de depuração com payload |

## 4. Restrições

- P1–P5 do projeto: sem "Perfil Operacional"; TTS só via `ttsService.speak()`; NativeWind v2;
  migration sempre em arquivo novo; commit antes de cada etapa de agente e um commit por fase.
- Nenhuma chave, token ou valor de secret em arquivo do repositório, em teste, em log ou
  na conversa com agente. Teste usa valor falso óbvio (`"chave-falsa-teste"`).
- A migration nova entra na ordem de aplicação do `docs/SUPABASE_ESTADO.md`, depois de
  `security_advisor_cleanup` (depende de `auth.users` e do padrão de RLS de lá).
- Duração: a cadeia de provedores inteira cabe em `LIMITES.orcamentoTotalMs` (110 s), abaixo
  do limite de parede da Edge Function no plano Free (150 s — confirmar na documentação da
  Supabase antes de aprovar).
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

export type IaErroCodigo =
  | 'REQUISICAO_INVALIDA'  // 400
  | 'SEM_SESSAO'           // 401
  | 'SEM_PERMISSAO'        // 403
  | 'PAYLOAD_GRANDE'       // 413
  | 'LIMITE_DIARIO'        // 429
  | 'PROVEDORES_FALHARAM'  // 502
  | 'NAO_CONFIGURADO'      // 503
  | 'REDE';                // só no cliente: o invoke nem chegou à função

export type Tentativa = { provedor: string; modelo: string; status: number | 'timeout' | 'rede' | 'resposta_invalida' };

export type IaResposta =
  | { ok: true; acao: 'apagar_escrita'; html: string; provedor: string; modelo: string }
  | { ok: true; acao: 'analisar_equipe'; texto: string; provedor: string; modelo: string }
  | { ok: false; codigo: IaErroCodigo; mensagem: string; tentativas?: Tentativa[] };
  // `tentativas` ausente = nenhum provedor foi chamado (erro decidido antes).

export interface Provedor {
  nome: 'anthropic' | 'gemini' | 'groq' | 'openai' | 'deepseek';   // lista final conforme Q1
  modelo: string;
  secret: string;                  // NOME do secret (ex.: 'ANTHROPIC_API_KEY'), nunca o valor
  suporta: ReadonlyArray<'imagem' | 'texto'>;
}

export const LIMITES: {
  imagemBase64MaxChars: 7_000_000;         // ~5 MB; o scanner manda JPEG a 50%
  rankingMaxChars: 20_000;
  usosDiarios: { apagar_escrita: number; analisar_equipe: number };  // Q3
  timeoutPorChamadaMs: 45_000;
  orcamentoTotalMs: 110_000;
};

export function validarRequisicao(corpo: unknown):
  | { ok: true; req: IaRequisicao }
  | { ok: false; codigo: 'REQUISICAO_INVALIDA' | 'PAYLOAD_GRANDE'; mensagem: string };

export function autorizar(
  acao: IaRequisicao['acao'],
  ctx: { temSessao: boolean; staffReader: boolean; staffWriter: boolean; usosHoje: number },
): { ok: true } | { ok: false; codigo: 'SEM_SESSAO' | 'SEM_PERMISSAO' | 'LIMITE_DIARIO' };
// apagar_escrita exige staffReader; analisar_equipe exige staffWriter (Q4).

export function provedoresDisponiveis(
  acao: IaRequisicao['acao'],
  env: Readonly<Record<string, string | undefined>>,   // só lê presença; vazio conta como ausente
): Provedor[];                                        // [] ⇒ NAO_CONFIGURADO

export function montarChamada(p: Provedor, req: IaRequisicao, chave: string):
  { url: string; headers: Record<string, string>; body: string };
// A chave aparece só em `headers`; `url` nunca contém a chave (D4).

export async function executarCadeia(
  provedores: Provedor[],
  chamar: (p: Provedor, sinal: AbortSignal) => Promise<{ status: number; corpo: unknown }>,
  interpretar: (p: Provedor, corpo: unknown) => string | null,   // null = resposta inválida
  agora: () => number,
): Promise<{ ok: true; saida: string; provedor: Provedor } | { ok: false; tentativas: Tentativa[] }>;

export function limparHtml(bruto: string): string | null;   // tira cercas ```html; null se não houver <html
export function sanitizarHtml(html: string): string;         // D7
export function promptApagarEscrita(o: Orientacao): string;   // texto atual de handwritingEraser.ts
export function promptAnaliseEquipe(tipoOperacao: string, ranking: string): { sistema: string; usuario: string };
export function mensagemPorCodigo(c: IaErroCodigo): string;   // pt-BR, sem detalhe técnico
export function cabecalhosCors(origem: string | null): Record<string, string>;
// Origem https://robconceicao.github.io recebe Allow-Origin; sem Origin (app nativo) não precisa; outra origem não recebe.
```

```typescript
// src/services/iaProxy.ts — cliente

export type Transporte = (req: IaRequisicao) => Promise<{ status: number; corpo: unknown }>;
// Lança em falha de rede. A implementação real usa supabase.functions.invoke e lê o corpo
// de FunctionsHttpError via error.context.json(); o resto do módulo é testável com transporte falso.

export function criarClienteIa(t: Transporte): {
  apagarEscrita(imagemBase64: string, mimeType: 'image/jpeg' | 'image/png', o: Orientacao): Promise<EraserResult>;
  analisarEquipe(tipoOperacao: string, ranking: string): Promise<DeepSeekResult>;
};

// Contratos preservados (D8):
// EraserResult  = { success: true; html; engine; model } | { success: false; error }
// DeepSeekResult = { success: true; text; provedor } | { success: false; error }

// Se Q2 = sim:
export function pseudonimizarRanking(nomes: string[], texto: string): { texto: string; mapa: ReadonlyMap<string, string> };
// "C01".."Cnn" no lugar de cada nome, na ordem do ranking.
export function restaurarNomes(texto: string, mapa: ReadonlyMap<string, string>): string;
```

```sql
-- supabase/migration_ia_uso.sql (nova)
CREATE TABLE IF NOT EXISTS public.ia_uso (
  id         bigserial PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  acao       text NOT NULL CHECK (acao IN ('apagar_escrita', 'analisar_equipe')),
  provedor   text,                 -- NULL quando nenhum provedor foi chamado
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
Conta tentativa com e sem sucesso: o custo no provedor existe nos dois casos.

## 6. Dependências

| Dependência | Estado | No escopo? |
|-------------|--------|------------|
| Chaves antigas revogadas em Google AI Studio, DeepSeek, Groq e OpenAI | A FAZER (Roberto) | Não — pré-requisito do merge |
| Secrets no painel (Edge Functions → Secrets), só os provedores decididos em Q1 | A CRIAR (Roberto) | Não — feito pelo painel, nunca por agente |
| `is_staff_reader()`/`is_staff_writer()` com EXECUTE para `authenticated` | JÁ EXISTE (`harden` + `cleanup`) | — |
| Tabela `ia_uso` | A CRIAR | Sim |
| Pasta `supabase/functions/` | A CRIAR | Sim |
| Supabase CLI (instalada: 2.115.0) | JÁ EXISTE | — |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` no ambiente da função | JÁ EXISTE (injetados pela Supabase) | — |
| Limite de duração da Edge Function no plano atual | A CONFIRMAR | Sim — antes de aprovar |
| SPEC 0008 (CI) | Independente | Não |

## 7. Casos extremos

| # | Caso | Comportamento esperado |
|---|------|------------------------|
| E1 | Requisição sem JWT ou com JWT expirado | 401 `SEM_SESSAO`; nenhum provedor chamado; nenhuma linha na `ia_uso` |
| E2 | Operador (staff leitor) pede `analisar_equipe` | 403 `SEM_PERMISSAO` (Q4) |
| E3 | Usuário já no limite diário da ação | 429 `LIMITE_DIARIO` antes de chamar provedor |
| E4 | `imagemBase64` acima de `LIMITES.imagemBase64MaxChars` ou `ranking` acima de `rankingMaxChars` | 413 `PAYLOAD_GRANDE`; nenhum provedor chamado |
| E5 | Nenhum secret de provedor configurado para a ação | 503 `NAO_CONFIGURADO`, mensagem "recurso de IA não configurado no servidor"; o app não trava |
| E6 | Primeiro provedor devolve 429/500; o segundo responde | 200 com o segundo; `ia_uso` grava uma linha com `provedor` do segundo |
| E7 | Todos os provedores falham | 502 `PROVEDORES_FALHARAM` com `tentativas`; nenhum corpo cru de provedor na resposta (D9) |
| E8 | Montagem da chamada ao Gemini | Chave em `x-goog-api-key`; `url` não contém a chave (D4) |
| E9 | Modelo devolve HTML dentro de cercas ```` ```html ```` | Cercas removidas; resposta sem `<html` conta como `resposta_invalida` e a cadeia segue |
| E10 | HTML com `<script>`, `<iframe>`, `onload=`, `javascript:`, `<img src="https://...">`, `<link href="https://...">` | Tudo removido; CSP injetada no `<head>` (cria `<head>` se faltar) |
| E11 | Provedor não responde | Aborta em `timeoutPorChamadaMs`, registra `timeout`, segue; não inicia chamada se o orçamento restante for menor que o timeout |
| E12 | Folha deitada | Prompt pede "A4 landscape"; em pé pede "A4 portrait" (comportamento atual preservado) |
| E13 | Celular sem internet | Transporte lança; cliente devolve `{ success: false, error }` com a frase de rede em pt-BR, sem stack |
| E14 | Corpo inválido: `acao` desconhecida, `orientacao` fora do enum, `mimeType` diferente de jpeg/png, JSON quebrado | 400 `REQUISICAO_INVALIDA` |
| E15 | Requisição do GitHub Pages; requisição de outra origem; preflight `OPTIONS` | Pages recebe `Access-Control-Allow-Origin`; outra origem não; `OPTIONS` responde 204 sem exigir JWT |
| E16 | Alguém reintroduz `import … from '@env'` ou cola literal `AIza…`/`sk-…`/`gsk_…` em `src/` | Teste de regressão falha; `tsc` falha no `@env` por falta de declaração |
| E17 | (se Q2 = sim) Ranking com nomes de conferentes | Texto enviado não contém nenhum nome; texto devolvido ao líder volta com os nomes |
| E18 | `ScannerScreen` consome o resultado | `engine` e `model` continuam preenchidos no sucesso; `error` continua string no fracasso |

## 8. Questões em aberto

| # | Pergunta | Dono | Estado |
|---|----------|------|--------|
| Q1 | Quais provedores ficam, e em que ordem? Hoje são quatro mais o OCR.space com a chave pública de demonstração `helloworld`, que recebe a foto da folha. **Recomendação:** Anthropic (chave recém-criada) como primeiro e Gemini como reserva, para as duas ações; sair Groq, OpenAI, DeepSeek e OCR.space. Menos terceiros recebendo foto de formulário e dados da equipe, e menos segredos para rotacionar. Verificar também se `llama-3.2-11b-vision-preview` (Groq) e `gemini-1.5-*` ainda estão disponíveis — há sinal de que foram descontinuados | Roberto | ABERTA |
| Q2 | Pseudonimizar os nomes enviados em `analisar_equipe`? **Recomendação:** sim. O modelo não precisa do nome para analisar números (LGPD art. 6º, III), e o envio para provedor estrangeiro é transferência internacional (art. 33) | Roberto | ABERTA |
| Q3 | Limites diários por usuário: **recomendação** 60 `apagar_escrita` e 20 `analisar_equipe`, revistos após 30 dias de `ia_uso` | Roberto | ABERTA |
| Q4 | Quem pode `apagar_escrita`? **Recomendação:** todo staff (`is_staff_reader`); `analisar_equipe` só `is_staff_writer`, porque expõe o ranking | Roberto | ABERTA |
| Q5 | Modelo da Anthropic por ação. **Recomendação:** `claude-sonnet-5-5` para `apagar_escrita` (fidelidade de layout) e `claude-haiku-4-5-20251001` para `analisar_equipe` (texto curto, custo menor). Confirmar preço no Console antes | Roberto | ABERTA |
| Q6 | Retenção da `ia_uso`. **Recomendação:** 90 dias (só `user_id`, ação e horário) | Roberto | ABERTA |
| Q7 | `src/services/geminiVision.ts` não é importado por nenhum arquivo. Remover nesta entrega? **Recomendação:** sim, senão sobra um arquivo com a lógica antiga de chave no cliente | Roberto | ABERTA |

## 9. Critérios de aceitação

- [ ] `npm run check` termina sem erro (tsc = 0 erros, suíte inteira verde)
- [ ] Testes novos em `src/services/__tests__/iaProxyLogica.test.ts`:
  - [ ] E1 → `sem sessão devolve SEM_SESSAO`
  - [ ] E2 → `staff sem escrita não analisa equipe`
  - [ ] E3 → `limite diário atingido barra antes do provedor`
  - [ ] E4 → `payload acima do limite devolve PAYLOAD_GRANDE`
  - [ ] E5 → `sem secret nenhum devolve lista vazia de provedores`
  - [ ] E6 → `falha do primeiro provedor passa ao segundo`
  - [ ] E7 → `todos falhando devolvem só as tentativas, sem corpo do provedor`
  - [ ] E8 → `chave do gemini vai no header e nunca na url`
  - [ ] E9 → `cercas de markdown saem e texto sem html é resposta inválida`
  - [ ] E10 → `sanitização remove script, iframe, eventos, javascript e url externa e injeta CSP`
  - [ ] E11 → `timeout aborta a chamada e respeita o orçamento total`
  - [ ] E12 → `prompt de paisagem pede A4 landscape`
  - [ ] E14 → `corpo inválido devolve REQUISICAO_INVALIDA`
  - [ ] E15 → `cors libera o GitHub Pages e nega outra origem`
- [ ] Testes novos em `src/services/__tests__/iaProxyCliente.test.ts`:
  - [ ] E13 → `falha de rede vira mensagem em português`
  - [ ] E17 → `ranking enviado sem nomes e resposta com nomes restaurados` (se Q2 = sim)
  - [ ] E18 → `eraseHandwriting mantém engine e model no sucesso`
- [ ] Teste novo em `src/services/__tests__/semChaveNoCliente.test.ts`:
  - [ ] E16 → `nenhum arquivo de src importa @env nem contém literal com formato de chave`
- [ ] `rg -n "@env|react-native-dotenv" src babel.config.js package.json` não encontra nada
- [ ] Depois de `npx expo export -p android` e de `npx expo export -p web`, nenhum arquivo em
      `dist/` casa `AIza[0-9A-Za-z_-]{30}|sk-[A-Za-z0-9]{20,}|gsk_[A-Za-z0-9]{20,}|sk-ant-`
- [ ] Revisão de segurança (prompt do `seguranca-defensiva`) sem achado BLOQUEANTE, com registro
      em `docs/registros/`
- [ ] Implantação feita pelo Roberto, nesta ordem: chaves antigas revogadas → migration
      `migration_ia_uso.sql` aplicada e registrada no `docs/SUPABASE_ESTADO.md` → secrets
      criados no painel → `supabase functions deploy ia-proxy --project-ref knxwuxxpbrbmhgdatgoe`
- [ ] Teste manual no aparelho: apagar escrita de uma folha em pé e de uma deitada gera o PDF;
      análise da equipe responde no app e na web; os logs da função no painel não mostram
      base64, HTML nem nome de conferente
- [ ] `CLAUDE.md` atualizado: decisões D3/D5/D7 na tabela de decisões e as linhas "não colocar
      chave em `@env`/`EXPO_PUBLIC_*`" em "O que NÃO fazer"
- [ ] Nenhum arquivo fora desta lista foi tocado:
  - novos: `supabase/functions/ia-proxy/index.ts`, `supabase/functions/ia-proxy/logica.ts`,
    `supabase/migration_ia_uso.sql`, `src/services/iaProxy.ts`,
    `src/services/__tests__/iaProxyLogica.test.ts`, `src/services/__tests__/iaProxyCliente.test.ts`,
    `src/services/__tests__/semChaveNoCliente.test.ts`
  - editados: `src/services/handwritingEraser.ts`, `src/services/deepseek.ts`,
    `src/screens/LeaderEvaluationDashboard.tsx` (só o selo), `src/types/env.d.ts`,
    `babel.config.js`, `package.json`, `package-lock.json`, `tsconfig.json` (excluir
    `supabase/functions/**/index.ts`), `.env.example`, `docs/SUPABASE_ESTADO.md`, `CLAUDE.md`
  - removido: `src/services/geminiVision.ts` (se Q7 = sim)

## 10. Registro de realimentação

| Data | Achado | Classificação | O que foi feito |
|------|--------|---------------|-----------------|
| | | BUG DE CÓDIGO / LACUNA DE SPEC | |

## Histórico

| Data | Mudança | Por quem | Estado |
|------|---------|----------|--------|
| 2026-09-30 | Spec escrita a partir do levantamento de agentes; Q1–Q7 abertas | Claude Code (sessão principal) | RASCUNHO |
