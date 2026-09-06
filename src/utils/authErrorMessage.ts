/**
 * Traduz o erro do Supabase Auth para a frase que o líder lê na tela.
 *
 * Fora da tela porque falha de rede tem muitas grafias e cada uma que escapa
 * chega ao usuário em inglês: aqui o conjunto fica travado por teste, sem
 * precisar montar React Native.
 */

/** Grafias de "o fetch não teve com quem falar", por plataforma e motor. */
const PADROES_DE_REDE = [
  "network error", //          navegador
  "network request failed", // React Native (Android/iOS)
  "failed to fetch", //        Chrome/Edge
  "load failed", //            Safari/WebKit
  "fetch failed", //           undici (Node 18+)
  "timeout", //                estouro de tempo
  "timed out",
  "econnrefused", //           servidor no ar mas recusando
  "enotfound", //              DNS não resolve — projeto pausado ou ref errado
];

/**
 * Falha de rede não distingue aparelho offline de servidor fora do ar, então a
 * frase precisa cobrir as duas: verificar a internet resolve a primeira, e
 * quem cuida do projeto reconhece a segunda pela menção ao servidor.
 */
const MENSAGEM_DE_REDE =
  "Não foi possível falar com o servidor. Verifique sua internet e tente novamente; " +
  "se o problema persistir, o serviço pode estar fora do ar.";

export function ehErroDeRede(message: string): boolean {
  const msg = message.toLowerCase();
  return PADROES_DE_REDE.some((padrao) => msg.includes(padrao));
}

/** Traduz a mensagem de erro. Texto desconhecido volta como veio. */
export function translateAuthError(message: string): string {
  const msg = message.toLowerCase();

  if (msg.includes("email not confirmed"))
    return "E-mail não confirmado. Verifique seu spam.";
  if (msg.includes("invalid login credentials"))
    return "E-mail ou senha inválidos.";
  if (msg.includes("user already registered"))
    return "E-mail já cadastrado. Tente entrar ou recupere a senha.";
  if (msg.includes("rate limit") || msg.includes("too many requests"))
    return "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.";
  if (ehErroDeRede(msg)) return MENSAGEM_DE_REDE;

  return message;
}

/**
 * Traduz o que vier de um `catch`.
 *
 * O bloco recebe `unknown`: o cliente pode lançar Error, string, ou rejeitar
 * sem valor. Sem isto, `e.message` de um throw não-Error vira "undefined" na
 * tela.
 */
export function translateThrownAuthError(erro: unknown): string {
  if (erro instanceof Error) return translateAuthError(erro.message);
  if (typeof erro === "string" && erro.trim()) return translateAuthError(erro);
  return MENSAGEM_DE_REDE;
}
