# SPEC 0005 — Login sem rede diz o que aconteceu

- **Estado:** APROVADA
- **Autor:** Roberto
- **Data:** 2026-09-06
- **Entrega relacionada:** achado ao fechar os PRs #19 e #20, que atacavam este bug e foram encerrados sem merge

---

## 1. Objetivo

O líder que tenta entrar no app sem internet — ou com o Supabase fora do ar — recebe
uma frase em português dizendo o que houve e o que fazer. Hoje, no melhor caso vê texto
cru em inglês; no pior, o botão simplesmente não faz nada.

## 2. Escopo

- [ ] `src/utils/authErrorMessage.ts` — tradutor puro, testável fora do React Native
- [ ] Lista de falha de rede cobrindo as três formas reais (E1)
- [ ] `catch` nos três fluxos do `AuthScreen`: entrar, cadastrar, recuperar senha (E2)
- [ ] `AuthScreen` passa a consumir o módulo; a closure local sai
- [ ] Suíte `src/utils/__tests__/authErrorMessage.test.ts`

### Não-escopo

- **`src/services/tadeuLicense.ts`.** É o segundo ponto de login e também não traduz
  nada, mas seu erro é um `throw` com protocolo próprio (`TADEU_LICENSE_DENIED:`)
  consumido por outra tela. Mexer ali é outra entrega — ver Q1.
- **Retentar automaticamente** quando a rede volta. Outra conversa, com estado.
- **Detectar conectividade** com `@react-native-community/netinfo`. O app já depende
  dele, mas "tem interface de rede" não é "o servidor respondeu" — e o caso que
  originou isto foi o Supabase inacessível **com** internet funcionando.
- **Mudar o layout da tela de login** ou trocar `Alert` por outro componente.

## 3. Decisões de arquitetura

| # | Decisão | Justificativa | Alternativa descartada |
|---|---------|---------------|------------------------|
| D1 | Tradutor em módulo puro, não closure dentro do componente | Hoje vive dentro do `AuthScreen` e não tem como ser testado sem montar RN — o Jest aqui roda em `testEnvironment: node`. Mesma separação de `fileFormat`/`csvMatriz` | Manter na tela e testar com react-native-testing-library — carrega o ambiente inteiro para exercitar uma função de string |
| D2 | Casamento por substring, em lista, contra a mensagem em minúsculas | A mesma falha chega com texto diferente por plataforma e por versão do supabase-js; lista é o que se estende sem reescrever condição | `switch` por código de erro — o supabase-js não expõe código estável para falha de transporte |
| D3 | Exceção lançada recebe a **mesma** frase do erro retornado | Para quem está na tela, erro retornado e exceção são o mesmo evento: não entrou. A origem técnica não muda o que a pessoa precisa fazer | Mensagem genérica de "erro inesperado" no `catch` — devolveria ao silêncio de hoje, com outra roupa |
| D4 | A frase distingue "sua internet" de "servidor fora do ar" | O caso real foi o Supabase inacessível com a internet do usuário funcionando. "Verifique sua conexão" manda a pessoa procurar defeito onde não há | "Erro de conexão. Verifique sua internet." — é o texto atual, e foi ele que falhou |

## 4. Restrições

- As traduções que já existem (`email not confirmed`, `invalid login credentials`,
  `user already registered`, `rate limit`) continuam com o **mesmo texto**: são frases
  que o usuário já conhece.
- Mensagem desconhecida continua sendo exibida como veio. Engolir o texto original
  tiraria a única pista em erro novo.
- Nenhuma mudança de layout, e o `Alert` continua sendo o canal.

## 5. Interfaces e contratos de dados

```typescript
/** Texto único de falha de transporte — mesma frase para erro retornado e lançado. */
export const MENSAGEM_ERRO_REDE: string;

/** true quando a mensagem indica falha de transporte, em qualquer das formas de E1. */
export function isNetworkAuthError(message: string): boolean;

/** Erro RETORNADO pelo supabase-js. Mensagem desconhecida volta inalterada. */
export function translateAuthError(message: string): string;

/** Erro LANÇADO (rede, DNS, JSON inválido). `unknown` porque `catch` não tipa. */
export function translateThrownAuthError(error: unknown): string;
```

## 6. Dependências

| Dependência | Estado | No escopo? |
|-------------|--------|------------|
| `src/screens/AuthScreen.tsx` | JÁ EXISTE — a closure sai daqui | Sim |
| Implementação de referência do PR #19 (branch `claude/new-session-aeg02x`) | JÁ EXISTE, fechada sem merge | Serve de base |

## 7. Casos extremos

Levantados lendo o código da `main`, não imaginados.

| # | Caso | Hoje | Comportamento esperado |
|---|------|------|------------------------|
| E1 | `"Network request failed"` (Android/RN) e `"Failed to fetch"` (browser) | **Passam direto**: a lista da `main` só tem `"network error"`, que não casa com nenhuma das duas. O usuário vê inglês cru | Ambas viram `MENSAGEM_ERRO_REDE` |
| E2 | supabase-js **lança** em vez de retornar erro | Os três fluxos são `try`/`finally` **sem `catch`** (`AuthScreen.tsx:49/56, 88/104, 114/125`). A exceção escapa, o `finally` desliga o spinner e **nada aparece** | `catch` traduz e exibe |
| E3 | Erro de credencial, e-mail não confirmado, rate limit | Já traduzidos | Texto idêntico ao de hoje |
| E4 | Mensagem desconhecida | Exibida como veio | Igual — não engolir |
| E5 | `catch` recebe `undefined`, `null` ou string vazia | Não ocorre hoje (não há `catch`) | Cai em `MENSAGEM_ERRO_REDE`; nunca exibir "undefined" |
| E6 | Erro que não é `Error` (string, objeto) | Idem | Convertido para texto antes de traduzir |
| E7 | Mensagem em caixa alta (`"NETWORK REQUEST FAILED"`) | Não casaria | Casa: comparação em minúsculas |

**E2 é o mais grave.** Silêncio total é pior que inglês: a pessoa aperta "Entrar", o
spinner some e ela não sabe se errou a senha, se o app travou, ou se deve tentar de novo.

## 8. Questões em aberto

| # | Pergunta | Dono | Estado |
|---|----------|------|--------|
| Q1 | `tadeuLicense.ts` é o segundo ponto de login e também não traduz. Entra agora ou vira issue? | Roberto | RESOLVIDA — vira issue; o módulo já nasce reutilizável para quando ela for feita |
| Q2 | A frase deve nomear "InventExpert" e mandar avisar o responsável, como no PR #19? | Roberto | RESOLVIDA — sim; há teste travando que a frase cite internet **e** servidor |

## 9. Critérios de aceitação

- [ ] `npm run check` termina verde
- [ ] `grep -n "translateAuthError" src/screens/AuthScreen.tsx` mostra apenas o **import** e os usos — nenhuma definição local
- [ ] Os três fluxos do `AuthScreen` têm `catch`: `grep -c "} catch" src/screens/AuthScreen.tsx` = 3
- [ ] Testes em `src/utils/__tests__/authErrorMessage.test.ts`, um por caso da seção 7:
  - [ ] E1 → `traduz as tres formas de falha de rede`
  - [ ] E2 → `erro lancado recebe a mesma frase do erro retornado`
  - [ ] E3 → `traducoes existentes seguem com o mesmo texto`
  - [ ] E4 → `mensagem desconhecida volta inalterada`
  - [ ] E5 → `catch vazio nunca exibe undefined`
  - [ ] E6 → `erro que nao e Error vira texto antes de traduzir`
  - [ ] E7 → `casa ignorando caixa`
- [ ] Nenhum arquivo fora desta lista foi tocado: `src/utils/authErrorMessage.ts`,
      `src/utils/__tests__/authErrorMessage.test.ts`, `src/screens/AuthScreen.tsx`,
      `specs/0005-erro-de-rede-no-login.md`, `CLAUDE.md`

## 10. Registro de realimentação

| Data | Achado | Classificação | O que foi feito |
|------|--------|---------------|-----------------|
| 2026-09-06 | Ao fechar os #19/#20 afirmei que a `main` "não trata Network request failed". Errado: ela **tem** `translateAuthError` (`AuthScreen.tsx:29`), com lista de rede incompleta. A conclusão (usuário vê inglês) estava certa; o motivo, não. Meu `grep` buscou o termo errado | LACUNA DE SPEC | Corrigido em E1. Ler o código antes de escrever a spec também revelou E2, que nenhum dos dois PRs fechados descrevia como silêncio total |
| 2026-09-06 | Spec aprovada; Q1 e Q2 fechadas nas propostas | — | Estado RASCUNHO → APROVADA |
| 2026-09-06 | E6 precisou de uma decisão que a spec não previa: `translateThrownAuthError(42)` não é rede nem mensagem conhecida | LACUNA DE SPEC | Volta como `"42"`, seguindo a restrição de não engolir o original. Cair na frase de rede mentiria sobre a causa; só erro **sem** mensagem cai nela |
| 2026-09-06 | Critérios da seção 9 verificados: `translateAuthError` no `AuthScreen` só em import e usos (linhas 17/44/89/114), `grep -c "} catch"` = 3, `npm run check` verde com 478 testes | — | Nove testes, um por caso extremo mais dois de contorno |
