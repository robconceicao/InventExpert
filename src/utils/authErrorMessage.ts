/**
 * Tradução das mensagens de erro de autenticação do Supabase.
 *
 * Vive fora da tela por dois motivos. O primeiro é poder ser testado sem montar
 * o React Native — o Jest aqui roda em `testEnvironment: node`, sem mock de RN,
 * a mesma razão que separou `fileFormat` de `fileImport`. O segundo é servir
 * mais de um ponto de login: hoje o `AuthScreen`, amanhã a licença Tadeu Apps.
 *
 * A falha de rede chega com texto diferente conforme a plataforma e a versão do
 * supabase-js: "Network request failed" no Android/RN, "Failed to fetch" no
 * browser, "network error" em algumas versões. A lista da tela cobria só a
 * terceira — justamente a que o app não produz — e as outras duas chegavam ao
 * usuário em inglês cru. Por isso lista de substrings, e não `switch` por código:
 * o supabase-js não expõe código estável para falha de transporte.
 */

/** Formas conhecidas de falha de transporte. Estender é acrescentar uma linha. */
const REDE = [
  "network request failed",
  "failed to fetch",
  "network error",
  "load failed",
  "fetch failed",
  "timeout",
  "timed out",
];

/**
 * Frase única para qualquer falha de transporte.
 *
 * Nomeia as duas causas possíveis de propósito: o caso que originou isto foi o
 * Supabase inacessível com a internet do usuário funcionando, e o texto
 * anterior — "Verifique sua internet" — mandava procurar defeito onde não havia.
 */
export const MENSAGEM_ERRO_REDE =
  "Não foi possível falar com o servidor. Verifique sua internet; se ela estiver " +
  "funcionando, o servidor do InventExpert pode estar fora do ar — avise o responsável.";

/** true quando a mensagem indica falha de transporte, em qualquer das formas. */
export function isNetworkAuthError(message: string): boolean {
  const msg = message.toLowerCase();
  return REDE.some((termo) => msg.includes(termo));
}

/**
 * Traduz o erro RETORNADO pelo supabase-js.
 *
 * Mensagem desconhecida volta inalterada: engolir o texto original tiraria a
 * única pista disponível quando aparecer um erro que ninguém previu.
 */
export function translateAuthError(message: string): string {
  const msg = message.toLowerCase();
  if (isNetworkAuthError(msg)) return MENSAGEM_ERRO_REDE;
  if (msg.includes("email not confirmed"))
    return "E-mail não confirmado. Verifique seu spam.";
  if (msg.includes("invalid login credentials"))
    return "E-mail ou senha inválidos.";
  if (msg.includes("user already registered"))
    return "E-mail já cadastrado. Tente entrar ou recupere a senha.";
  if (msg.includes("rate limit") || msg.includes("too many requests"))
    return "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.";
  return message;
}

/**
 * Traduz o erro LANÇADO — rede, DNS, JSON inválido.
 *
 * Recebe `unknown` porque `catch` não tipa. Para quem está na tela, exceção e
 * erro retornado são o mesmo evento: não entrou. Por isso a mesma frase, e não
 * um "erro inesperado" genérico — que devolveria ao silêncio de hoje com outra
 * roupa. Erro sem mensagem também cai na frase de rede: é o caso em que o
 * `fetch` morreu antes de produzir texto.
 */
export function translateThrownAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (!message.trim()) return MENSAGEM_ERRO_REDE;
  return translateAuthError(message);
}
