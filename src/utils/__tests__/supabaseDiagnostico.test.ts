import {
  diagnosticarSupabase,
  hostDaUrl,
  refDaChave,
  refDoHost,
} from "../supabaseDiagnostico";

/** Monta um JWT com o payload dado (assinatura irrelevante para o diagnóstico). */
const jwt = (payload: object) => {
  const b64url = (o: object) =>
    Buffer.from(JSON.stringify(o)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url(payload)}.assinatura`;
};

const NOVO = "knxwuxxpbrbmhgdatgoe";
const ANTIGO = "maoduppsngdwupokxtqr";

describe("hostDaUrl", () => {
  it.each([
    [`https://${NOVO}.supabase.co`, `${NOVO}.supabase.co`],
    [`https://${NOVO}.supabase.co/`, `${NOVO}.supabase.co`],
    [`https://${NOVO}.supabase.co/rest/v1?x=1`, `${NOVO}.supabase.co`],
    ["http://localhost:54321", "localhost:54321"],
    ["  HTTPS://API.EXEMPLO.COM.BR  ", "api.exemplo.com.br"],
  ])("E2: %p → %p", (url, host) => {
    expect(hostDaUrl(url)).toBe(host);
  });

  it.each(["", "knxw.supabase.co", "não é url"])("sem esquema://host devolve null: %p", (url) => {
    expect(hostDaUrl(url)).toBeNull();
  });
});

describe("refDoHost", () => {
  it("lê o ref de *.supabase.co", () => {
    expect(refDoHost(`${NOVO}.supabase.co`)).toBe(NOVO);
  });
  it("E5: domínio próprio não tem ref", () => {
    expect(refDoHost("api.exemplo.com.br")).toBeNull();
    expect(refDoHost(null)).toBeNull();
  });
});

describe("refDaChave", () => {
  it("lê o claim ref do JWT", () => {
    expect(refDaChave(jwt({ iss: "supabase", ref: NOVO, role: "anon" }))).toBe(NOVO);
  });

  it("lê a anon key real do projeto antigo (removida no #32)", () => {
    const chaveAntiga =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hb2R1cHBzbmdkd3Vwb2t4dHFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4OTExMjksImV4cCI6MjA5NDQ2NzEyOX0.GAY3EF9XBJ_H-2dyLh8O4E1u3nXpJ8IfzL8TuvDkPk4";
    expect(refDaChave(chaveAntiga)).toBe(ANTIGO);
  });

  it.each([
    "sb_publishable_abc123",
    "",
    "a.b.c",
    `x.${Buffer.from("não é json").toString("base64")}.y`,
    jwt({ role: "anon" }),
  ])("E4: chave sem ref devolve null: %p", (chave) => {
    expect(refDaChave(chave)).toBeNull();
  });
});

describe("diagnosticarSupabase", () => {
  it("URL e chave do mesmo projeto não divergem", () => {
    const d = diagnosticarSupabase(`https://${NOVO}.supabase.co`, jwt({ ref: NOVO }));
    expect(d).toEqual({ host: `${NOVO}.supabase.co`, refUrl: NOVO, refChave: NOVO, divergente: false });
  });

  it("E3: URL nova com chave antiga diverge e nomeia os dois", () => {
    const d = diagnosticarSupabase(`https://${NOVO}.supabase.co`, jwt({ ref: ANTIGO }));
    expect(d.divergente).toBe(true);
    expect(d.refUrl).toBe(NOVO);
    expect(d.refChave).toBe(ANTIGO);
  });

  it("E1: build sem credenciais não tem host nem aviso", () => {
    expect(diagnosticarSupabase("", "")).toEqual({
      host: null,
      refUrl: null,
      refChave: null,
      divergente: false,
    });
  });

  it("E4/E5: sem um dos refs não há como divergir", () => {
    expect(diagnosticarSupabase("https://api.exemplo.com.br", jwt({ ref: NOVO })).divergente).toBe(false);
    expect(diagnosticarSupabase(`https://${NOVO}.supabase.co`, "sb_publishable_x").divergente).toBe(false);
  });
});
