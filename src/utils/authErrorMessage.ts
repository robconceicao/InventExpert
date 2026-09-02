/**
 * Tradução das mensagens de erro de autenticação do Supabase.
 *
 * Fica fora da tela para poder ser testado sem montar o React Native e para
 * servir aos dois pontos de login (InventExpert e licença Tadeu Apps).
 *
 * Falha de rede aparece com três textos diferentes conforme a plataforma
 * ("Network request failed" no Android/RN, "Failed to fetch" no browser,
 * "network error" em algumas versões do supabase-js). Sem os três, o líder
 * recebia o texto cru em inglês — foi o que apareceu na tela de login quando o
 * projeto Supabase configurado no build ficou inacessível.
 */
const REDE = [
  'network request failed',
  'failed to fetch',
  'network error',
  'load failed',
  'fetch failed',
  'timeout',
  'timed out',
];

export const MENSAGEM_ERRO_REDE =
  'Não foi possível falar com o servidor. Verifique sua internet; se ela estiver ' +
  'funcionando, o servidor do InventExpert pode estar fora do ar — avise o responsável.';

export function isNetworkAuthError(message: string): boolean {
  const msg = message.toLowerCase();
  return REDE.some((termo) => msg.includes(termo));
}

export function translateAuthError(message: string): string {
  const msg = message.toLowerCase();
  if (isNetworkAuthError(msg)) return MENSAGEM_ERRO_REDE;
  if (msg.includes('email not confirmed'))
    return 'E-mail não confirmado. Verifique seu spam.';
  if (msg.includes('invalid login credentials'))
    return 'E-mail ou senha inválidos.';
  if (msg.includes('user already registered'))
    return 'E-mail já cadastrado. Tente entrar ou recupere a senha.';
  if (msg.includes('rate limit') || msg.includes('too many requests'))
    return 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.';
  return message;
}

/** Erro capturado em `catch` (rede, DNS, JSON inválido) vira a mesma frase. */
export function translateThrownAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (!message) return MENSAGEM_ERRO_REDE;
  return translateAuthError(message);
}
