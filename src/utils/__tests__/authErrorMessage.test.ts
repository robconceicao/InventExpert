import {
  ehErroDeRede,
  translateAuthError,
  translateThrownAuthError,
} from "../authErrorMessage";

/** Detecta texto que passou sem tradução — o defeito que este módulo existe para impedir. */
const pareceIngles = (texto: string) =>
  /\b(network|failed|fetch|error|request|timeout|refused|not found)\b/i.test(texto);

describe("translateAuthError — falha de rede", () => {
  // Cada plataforma tem a sua grafia; todas chegavam cruas ao líder porque a
  // tela só cobria "network error".
  const grafias = [
    "Network request failed", // React Native — o do print do aparelho
    "network error",
    "TypeError: Failed to fetch",
    "Load failed",
    "fetch failed",
    "The request timed out",
    "connect ECONNREFUSED 127.0.0.1:443",
    "getaddrinfo ENOTFOUND xyz.supabase.co",
  ];

  it.each(grafias)("reconhece %p como falha de rede", (bruto) => {
    expect(ehErroDeRede(bruto)).toBe(true);
  });

  it.each(grafias)("traduz %p sem deixar inglês na tela", (bruto) => {
    const traduzido = translateAuthError(bruto);
    expect(traduzido).not.toBe(bruto);
    expect(pareceIngles(traduzido)).toBe(false);
  });

  it("cita internet e servidor, porque a causa pode ser qualquer um dos dois", () => {
    const msg = translateAuthError("Network request failed");
    expect(msg).toMatch(/internet/i);
    expect(msg).toMatch(/servidor/i);
  });

  it("não confunde credencial inválida com problema de rede", () => {
    expect(ehErroDeRede("Invalid login credentials")).toBe(false);
  });
});

describe("translateAuthError — demais casos", () => {
  it.each([
    ["Email not confirmed", /spam/i],
    ["Invalid login credentials", /senha inválidos/i],
    ["User already registered", /já cadastrado/i],
    ["Email rate limit exceeded", /aguarde/i],
    ["Too many requests", /aguarde/i],
  ])("traduz %p", (bruto, esperado) => {
    expect(translateAuthError(bruto)).toMatch(esperado);
  });

  it("devolve intacto o que não conhece, para não esconder erro novo", () => {
    const desconhecido = "Erro inesperado do provedor";
    expect(translateAuthError(desconhecido)).toBe(desconhecido);
  });

  it("é indiferente à caixa do texto", () => {
    expect(translateAuthError("INVALID LOGIN CREDENTIALS")).toMatch(
      /senha inválidos/i,
    );
  });
});

describe("translateThrownAuthError", () => {
  it("lê a mensagem de um Error", () => {
    const msg = translateThrownAuthError(new Error("Network request failed"));
    expect(pareceIngles(msg)).toBe(false);
    expect(msg).toMatch(/servidor/i);
  });

  it("aceita throw de string", () => {
    expect(translateThrownAuthError("Invalid login credentials")).toMatch(
      /senha inválidos/i,
    );
  });

  // Um throw sem valor não pode virar "undefined" na tela.
  it.each([[undefined], [null], [""], ["   "], [{}], [42]])(
    "devolve frase útil para %p",
    (valor) => {
      const msg = translateThrownAuthError(valor);
      expect(msg.trim()).not.toBe("");
      expect(msg).not.toMatch(/undefined|null|\[object/i);
    },
  );
});
