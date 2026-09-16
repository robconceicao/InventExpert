import { mensagemDeLinkInvalido, parseRecoveryLink } from "../recoveryLink";

const BASE = "https://robconceicao.github.io/InventExpert/";

describe("parseRecoveryLink", () => {
  // E1 — o caminho feliz: é isto que o Supabase manda no link do e-mail.
  it("lê os dois tokens de um fragmento de recuperação", () => {
    const url = `${BASE}#access_token=abc123&refresh_token=def456&type=recovery&expires_in=3600`;
    expect(parseRecoveryLink(url)).toEqual({
      tipo: "recuperacao",
      accessToken: "abc123",
      refreshToken: "def456",
    });
  });

  it("aceita o fragmento sozinho, com ou sem #", () => {
    const frag = "access_token=a&refresh_token=b&type=recovery";
    expect(parseRecoveryLink(`#${frag}`)).toMatchObject({ tipo: "recuperacao" });
    expect(parseRecoveryLink(frag)).toMatchObject({ tipo: "recuperacao" });
  });

  // E2 — link vencido ou já usado. O Supabase não manda token nenhum aqui.
  it("reconhece link expirado pelo error_code do fragmento", () => {
    const url = `${BASE}#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`;
    const link = parseRecoveryLink(url);
    expect(link.tipo).toBe("erro");
    if (link.tipo !== "erro") throw new Error("esperado erro");
    expect(link.codigo).toBe("otp_expired");
    expect(mensagemDeLinkInvalido(link)).toMatch(/expirou/i);
  });

  it("trata erro sem error_code, só com error", () => {
    const link = parseRecoveryLink(`${BASE}#error=server_error`);
    expect(link.tipo).toBe("erro");
  });

  // E3 — a pessoa digitou o endereço do app. Não pode virar tela de senha.
  it("URL sem fragmento devolve ausente", () => {
    expect(parseRecoveryLink(BASE)).toEqual({ tipo: "ausente" });
    expect(parseRecoveryLink(`${BASE}#`)).toEqual({ tipo: "ausente" });
  });

  // E7 — confirmação de cadastro é outro fluxo, com outra tela.
  it("type=signup não é tratado como recuperação", () => {
    const url = `${BASE}#access_token=a&refresh_token=b&type=signup`;
    expect(parseRecoveryLink(url)).toEqual({ tipo: "ausente" });
  });

  it("recuperação sem um dos tokens não abre formulário", () => {
    expect(
      parseRecoveryLink(`${BASE}#access_token=a&type=recovery`),
    ).toEqual({ tipo: "ausente" });
    expect(
      parseRecoveryLink(`${BASE}#refresh_token=b&type=recovery`),
    ).toEqual({ tipo: "ausente" });
  });

  // Quem chama está escolhendo qual tela renderizar: uma exceção aqui deixaria
  // o app sem tela nenhuma.
  it.each([[undefined], [null], [""], ["   "], [42], [{}], [[]]])(
    "entrada inválida nunca lança: %p",
    (entrada) => {
      expect(() => parseRecoveryLink(entrada)).not.toThrow();
      expect(parseRecoveryLink(entrada)).toEqual({ tipo: "ausente" });
    },
  );
});
