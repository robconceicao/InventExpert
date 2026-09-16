/**
 * Lê o que o Supabase põe no link de recuperação de senha.
 *
 * O token viaja no **fragmento** (`#access_token=…`), não na query string, e
 * isso é de propósito: fragmento não é enviado ao servidor, então o token não
 * aparece em log de acesso nem vaza pelo `Referer`. Em compensação, só o
 * cliente pode lê-lo — daí este módulo.
 *
 * Puro de propósito: recebe string e devolve dado, sem tocar em `window` nem em
 * `Linking`. É o que permite testá-lo no Jest deste projeto, que roda em
 * `testEnvironment: node`, sem React Native montado.
 */

export type RecoveryLink =
  | { tipo: "recuperacao"; accessToken: string; refreshToken: string }
  /** O Supabase devolve a falha no próprio fragmento quando o link não presta. */
  | { tipo: "erro"; codigo: string; descricao: string }
  /** Sem fragmento, ou com `type` que não é `recovery`: não é para esta tela. */
  | { tipo: "ausente" };

const AUSENTE: RecoveryLink = { tipo: "ausente" };

/**
 * Aceita a URL inteira, só o fragmento, com ou sem `#`.
 *
 * Nunca lança: quem chama está decidindo qual tela mostrar, e uma exceção aí
 * deixaria o app sem tela nenhuma. Entrada que não entendemos é `ausente`, que
 * leva ao login — o comportamento de antes desta entrega.
 */
export function parseRecoveryLink(url: unknown): RecoveryLink {
  if (typeof url !== "string" || !url.trim()) return AUSENTE;

  const corte = url.indexOf("#");
  const fragmento = corte >= 0 ? url.slice(corte + 1) : url;
  if (!fragmento) return AUSENTE;

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(fragmento);
  } catch {
    return AUSENTE;
  }

  // O erro vem antes do `type`: link expirado traz `error` e nenhum token, e
  // quem chegou aqui precisa saber disso em vez de ver "link não reconhecido".
  const erro = params.get("error") ?? params.get("error_code");
  if (erro) {
    return {
      tipo: "erro",
      codigo: params.get("error_code") ?? params.get("error") ?? "",
      descricao: params.get("error_description") ?? "",
    };
  }

  // `type=signup` é o link de confirmação de cadastro, tratado em outro lugar.
  if (params.get("type") !== "recovery") return AUSENTE;

  const accessToken = params.get("access_token") ?? "";
  const refreshToken = params.get("refresh_token") ?? "";
  // Sem os dois não há como estabelecer sessão; melhor cair no login do que
  // abrir um formulário de senha que não teria como gravar.
  if (!accessToken || !refreshToken) return AUSENTE;

  return { tipo: "recuperacao", accessToken, refreshToken };
}

/** Mensagem para o caso de link que não serve mais. */
export function mensagemDeLinkInvalido(link: {
  codigo: string;
  descricao: string;
}): string {
  const codigo = link.codigo.toLowerCase();
  if (codigo.includes("expired") || link.descricao.toLowerCase().includes("expired")) {
    return "Este link expirou. Peça a recuperação de novo para receber um link novo.";
  }
  return "Este link não é mais válido. Peça a recuperação de novo para receber um link novo.";
}
