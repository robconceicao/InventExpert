import {
  MENSAGEM_ERRO_REDE,
  isNetworkAuthError,
  translateAuthError,
  translateThrownAuthError,
} from "../authErrorMessage";

/**
 * SPEC 0005. Cada teste é um caso extremo da seção 7, levantado lendo o
 * `AuthScreen` da main — não deduzido.
 */
describe("authErrorMessage", () => {
  it("traduz as tres formas de falha de rede", () => {
    // A lista da tela cobria só "network error", que é justamente a forma que o
    // app não produz: o RN manda "Network request failed" e o browser
    // "Failed to fetch". As duas chegavam ao usuário em inglês cru.
    expect(translateAuthError("Network request failed")).toBe(MENSAGEM_ERRO_REDE);
    expect(translateAuthError("TypeError: Failed to fetch")).toBe(MENSAGEM_ERRO_REDE);
    expect(translateAuthError("network error")).toBe(MENSAGEM_ERRO_REDE);
  });

  it("erro lancado recebe a mesma frase do erro retornado", () => {
    // Para quem está na tela, `{ error }` e `throw` são o mesmo evento.
    expect(translateThrownAuthError(new Error("Network request failed"))).toBe(
      translateAuthError("Network request failed"),
    );
  });

  it("traducoes existentes seguem com o mesmo texto", () => {
    expect(translateAuthError("Email not confirmed")).toBe(
      "E-mail não confirmado. Verifique seu spam.",
    );
    expect(translateAuthError("Invalid login credentials")).toBe(
      "E-mail ou senha inválidos.",
    );
    expect(translateAuthError("User already registered")).toBe(
      "E-mail já cadastrado. Tente entrar ou recupere a senha.",
    );
    expect(translateAuthError("Email rate limit exceeded")).toBe(
      "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.",
    );
    expect(translateAuthError("Too many requests")).toBe(
      "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.",
    );
  });

  it("mensagem desconhecida volta inalterada", () => {
    // Engolir o original tiraria a única pista num erro que ninguém previu.
    expect(translateAuthError("Database trigger raised exception X99")).toBe(
      "Database trigger raised exception X99",
    );
  });

  it("catch vazio nunca exibe undefined", () => {
    for (const vazio of [undefined, null, "", "   "]) {
      expect(translateThrownAuthError(vazio)).toBe(MENSAGEM_ERRO_REDE);
    }
  });

  it("erro que nao e Error vira texto antes de traduzir", () => {
    expect(translateThrownAuthError("Network request failed")).toBe(MENSAGEM_ERRO_REDE);
    expect(translateThrownAuthError({ toString: () => "Failed to fetch" })).toBe(
      MENSAGEM_ERRO_REDE,
    );
    // Objeto sem mensagem útil não pode virar "[object Object]" na tela...
    // ...mas também não é rede: volta como veio, para não mentir sobre a causa.
    expect(translateThrownAuthError(42)).toBe("42");
  });

  it("casa ignorando caixa", () => {
    expect(translateAuthError("NETWORK REQUEST FAILED")).toBe(MENSAGEM_ERRO_REDE);
    expect(translateAuthError("INVALID LOGIN CREDENTIALS")).toBe(
      "E-mail ou senha inválidos.",
    );
  });

  it("a frase de rede nomeia as duas causas possiveis", () => {
    // O caso real foi o Supabase fora do ar com a internet do usuário boa.
    expect(MENSAGEM_ERRO_REDE).toMatch(/internet/i);
    expect(MENSAGEM_ERRO_REDE).toMatch(/servidor/i);
  });

  it("isNetworkAuthError separa rede de credencial", () => {
    expect(isNetworkAuthError("Network request failed")).toBe(true);
    expect(isNetworkAuthError("connection timed out")).toBe(true);
    expect(isNetworkAuthError("Invalid login credentials")).toBe(false);
  });
});
