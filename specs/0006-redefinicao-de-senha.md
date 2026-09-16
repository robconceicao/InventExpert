# SPEC 0006 — Redefinir a senha pelo link do e-mail

- **Estado:** RASCUNHO
- **Autor:** Roberto
- **Data:** 2026-09-16
- **Entrega relacionada:** incidente de 16/09 — líder sem acesso por 5 dias; a senha teve de ser reescrita no banco à mão

---

## 1. Objetivo

O líder que esquece a senha clica no link do e-mail, define uma senha nova e entra no
app. Hoje o e-mail chega, o link abre — e não há onde digitar a senha, então a
recuperação nunca se completa.

## 2. Escopo

- [ ] Tela de redefinição no app, alcançável pela URL do link do e-mail
- [ ] Leitura do token de recuperação vindo no fragmento da URL (E1, E7)
- [ ] Formulário: senha nova + confirmação, com a mesma regra do cadastro (E4, E5)
- [ ] Gravação via `supabase.auth.updateUser({ password })`
- [ ] `src/utils/recoveryLink.ts` — parse do fragmento, puro e testável
- [ ] `src/utils/passwordPolicy.ts` — regra de senha única, consumida pelo cadastro e
      pela redefinição (D4)
- [ ] Correção do texto de instrução do cadastro, que hoje contradiz a validação (E5)
- [ ] Suítes `recoveryLink.test.ts` e `passwordPolicy.test.ts`

### Não-escopo

- **Deep link `inventexpert://` para o app nativo.** O link do e-mail abre no navegador
  de qualquer forma; a web pública é o mesmo app e resolve os dois casos. Configurar
  `intent-filter` no Android e Universal Links no iOS é entrega própria — ver Q2.
- **Trocar a senha estando logado** ("alterar minha senha" dentro do app). Fluxo
  diferente: exige a senha atual e não usa token de recuperação.
- **Mudar `detectSessionInUrl` para `true`** no cliente Supabase. Afetaria todo fluxo de
  auth do app para resolver uma tela — ver D3.
- **Unificar com `docs/confirm-email.html`.** Aquela página trata confirmação de
  cadastro, outro `type`. Mexer nela agora mistura dois fluxos — ver Q1.
- **Política de senha nova** (força mínima, histórico, expiração). A regra continua a
  do cadastro, nem mais nem menos rígida.
- **Autenticação por link mágico** (magic link) como substituto da senha.

## 3. Decisões de arquitetura

| # | Decisão | Justificativa | Alternativa descartada |
|---|---------|---------------|------------------------|
| D1 | A redefinição é **uma tela do app**, não uma página HTML avulsa | O `CLAUDE.md` fixa que não há segundo produto web: a URL pública é o export Expo deste repositório. Página solta duplicaria validação de senha e tradução de erro em JavaScript sem teste | Uma `redefinir-senha.html` ao lado da `confirm-email.html` — mais rápida de escrever, mas nasce fora do `npm run check` e diverge do app na primeira mudança de regra |
| D2 | O token é lido do **fragmento** (`#access_token=…`), não da query string | É onde o Supabase o coloca, e de propósito: fragmento não é enviado ao servidor, então o token não aparece em log de acesso nem no `Referer` | Pedir ao Supabase que use query string — exporia o token no log do GitHub Pages |
| D3 | A tela chama `setSession()` explicitamente; `detectSessionInUrl` continua `false` | Ler a URL sozinho é comportamento global do cliente e afeta todos os fluxos; aqui só uma tela precisa disso, e ela sabe quando | `detectSessionInUrl: true` — resolveria sem código, mas muda o comportamento de login, cadastro e refresh de uma vez |
| D4 | Regra de senha extraída para `passwordPolicy.ts`, consumida pelas duas telas | Duas telas gravando senha com regras diferentes é como o usuário acaba com senha que uma aceita e a outra recusa. Hoje já há divergência entre o texto e a validação (E5) | Copiar a `validatePassword` para a tela nova — garante a divergência em vez de evitá-la |
| D5 | Sessão de recuperação é encerrada (`signOut`) após gravar a senha | O token de recuperação vale como sessão; deixá-la viva faria o app entrar sem a pessoa digitar a senha nova, e ninguém confirmaria que ela foi anotada | Redirecionar direto para a tela logada — conveniente, mas a pessoa sai sem saber se decorou a senha |
| D6 | Erro traduzido pelo `authErrorMessage.ts` que já existe | É o módulo da SPEC 0005, já cobre rede e as mensagens do GoTrue. `updateUser` devolve erro no mesmo formato | Mensagens próprias na tela nova — recria o problema que a 0005 fechou |

## 4. Restrições

- **Sem token válido, a tela não mostra formulário.** Uma tela de "defina sua senha"
  aberta sem credencial convida engano.
- **A senha nova nunca aparece em log**, nem em `console.log` de depuração.
- **Funciona no navegador do celular**, que é onde o link do e-mail abre. É o caminho
  real do usuário — testar só no desktop não vale.
- **O link é de uso único e expira** (padrão do Supabase, 1 hora). A tela não tenta
  contornar isso; explica e oferece pedir outro.
- **Sem dependência nova no `package.json`.** Tudo com o que já existe.
- A tela é alcançável **sem estar logado** — é o ponto: quem chega ali não consegue
  entrar.

## 5. Interfaces e contratos de dados

```typescript
// src/utils/recoveryLink.ts

/** O que vem no fragmento do link do e-mail, já separado. */
export type RecoveryLink =
  | { tipo: "recuperacao"; accessToken: string; refreshToken: string }
  // O Supabase devolve o erro no próprio fragmento quando o link não presta.
  | { tipo: "erro"; codigo: string; descricao: string }
  // Sem fragmento, ou com `type` diferente de `recovery`: não é para esta tela.
  | { tipo: "ausente" };

/**
 * Lê o fragmento da URL. Aceita a URL inteira ou só o fragmento, com ou sem `#`.
 * Nunca lança: entrada inválida devolve `{ tipo: "ausente" }`.
 */
export function parseRecoveryLink(url: string): RecoveryLink;

// src/utils/passwordPolicy.ts

/** Por que a senha foi recusada. `null` = aceita. */
export type FalhaDeSenha = "curta" | "longa" | "sem_letra" | "sem_numero";

export function validarSenha(senha: string): FalhaDeSenha | null;

/** Frase para a tela. Fonte única do texto — o do cadastro hoje mente (E5). */
export function mensagemDeSenha(falha: FalhaDeSenha): string;

/** A regra em uma frase, para instruir antes do erro. */
export const REGRA_DE_SENHA: string;
```

## 6. Dependências

| Dependência | Estado | No escopo? |
|-------------|--------|------------|
| `supabase.auth.updateUser()` | JÁ EXISTE (supabase-js) | — |
| `supabase.auth.setSession()` | JÁ EXISTE (supabase-js) | — |
| `authErrorMessage.ts` (SPEC 0005) | JÁ EXISTE na `main` | não |
| Redirect URL `https://robconceicao.github.io/InventExpert/**` no Supabase | JÁ EXISTE (`docs/WEB_PUBLICA.md`) | não |
| `redirectTo` no `resetPasswordForEmail` apontando para a rota nova | A CRIAR | **sim** |
| Rota/navegação até a tela nova sem sessão | A CRIAR | **sim** |
| Workflow Deploy GitHub Pages publicando a rota | JÁ EXISTE | não |

## 7. Casos extremos

| # | Caso | Comportamento esperado |
|---|------|------------------------|
| E1 | Fragmento com `type=recovery` e os dois tokens | Estabelece sessão e mostra o formulário |
| E2 | Link expirado ou já usado — Supabase manda `error=access_denied&error_code=otp_expired` no fragmento | Não mostra formulário; explica que o link venceu e oferece pedir outro |
| E3 | URL aberta sem fragmento nenhum (a pessoa digitou o endereço) | Não mostra formulário; manda para a tela de login |
| E4 | As duas senhas digitadas não coincidem | Recusa antes de chamar o servidor, dizendo qual é o problema |
| E5 | Senha com 7 caracteres | Recusa por "curta". **Hoje o cadastro instrui "máximo de 8 caracteres" e exige símbolo, enquanto `validatePassword` exige mínimo 8 e nenhum símbolo** — o texto passa a vir de `REGRA_DE_SENHA` |
| E6 | Senha nova igual à atual | O GoTrue recusa com "New password should be different…"; a frase chega traduzida, não em inglês |
| E7 | `type=signup` no fragmento (link de confirmação de cadastro, não de recuperação) | `parseRecoveryLink` devolve `ausente`; a tela não assume que é recuperação |
| E8 | Rede cai entre abrir a tela e salvar | Frase da SPEC 0005 (rede), e o formulário continua preenchido para tentar de novo |
| E9 | Senha com 73 caracteres | Recusa por "longa" — acima de 72 o bcrypt trunca silenciosamente, e a pessoa não conseguiria entrar com o que digitou |

## 8. Questões em aberto

| # | Pergunta | Dono | Estado |
|---|----------|------|--------|
| Q1 | A `docs/confirm-email.html` deve ser absorvida pelo app também? No incidente ela apareceu servindo a tela de login em vez do próprio conteúdo — comportamento não explicado | Roberto | ABERTA |
| Q2 | Vale configurar deep link `inventexpert://` para o link do e-mail abrir o app no celular em vez do navegador? | Roberto | ABERTA |
| Q3 | Depois de redefinir, a pessoa volta para a tela de login do app web ou recebe instrução de abrir o app instalado? Muda conforme Q2 | Roberto | ABERTA |
| Q4 | O limite de e-mails do plano free (poucos por hora) precisa de aviso na tela quando o envio for recusado por cota? | Roberto | ABERTA |

## 9. Critérios de aceitação

- [ ] `npm run check` termina sem erro (tsc = 0 erros, suíte inteira verde)
- [ ] Testes novos em `src/utils/__tests__/recoveryLink.test.ts`:
  - [ ] E1 → `lê os dois tokens de um fragmento de recuperação`
  - [ ] E2 → `reconhece link expirado pelo error_code do fragmento`
  - [ ] E3 → `URL sem fragmento devolve ausente`
  - [ ] E7 → `type=signup não é tratado como recuperação`
  - [ ] `entrada inválida nunca lança`
- [ ] Testes novos em `src/utils/__tests__/passwordPolicy.test.ts`:
  - [ ] E5 → `senha de 7 caracteres é recusada por curta`
  - [ ] E9 → `senha de 73 caracteres é recusada por longa`
  - [ ] `senha sem número é recusada`
  - [ ] `a regra exibida corresponde ao que a validação aceita`
- [ ] O texto de instrução do cadastro vem de `REGRA_DE_SENHA` — não há string de regra
      escrita à mão em `AuthScreen.tsx`
- [ ] Verificação manual no navegador do celular: pedir recuperação, abrir o link,
      definir senha, entrar no app com ela
- [ ] Arquivos tocados, e só estes: `src/utils/recoveryLink.ts`,
      `src/utils/passwordPolicy.ts`, as duas suítes novas, a tela nova,
      `src/screens/AuthScreen.tsx`, `src/navigation/RootNavigator.tsx`

## 10. Registro de realimentação

| Data | Achado | Classificação | O que foi feito |
|------|--------|---------------|-----------------|
| | | BUG DE CÓDIGO / LACUNA DE SPEC | |
