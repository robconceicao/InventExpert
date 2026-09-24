import {
  REGRA_DE_SENHA,
  SENHA_MAX,
  SENHA_MIN,
  mensagemDeSenha,
  validarSenha,
} from "../passwordPolicy";

describe("validarSenha", () => {
  it("aceita senha dentro da regra", () => {
    expect(validarSenha("Inventario9")).toBeNull();
  });

  // E5 — a senha da conta do incidente tinha 7 caracteres, porque o texto da
  // tela ainda anunciava a regra antiga ("máximo de 8").
  it("senha de 7 caracteres é recusada por curta", () => {
    expect(validarSenha("Rtc456$")).toBe("curta");
    expect(validarSenha("a1b2c3d")).toBe("curta");
  });

  it("aceita exatamente o mínimo", () => {
    expect(validarSenha("abcdefg1")).toBeNull();
  });

  // E9 — acima de 72 o bcrypt trunca calado, e a senha gravada não seria a
  // digitada.
  it("senha de 73 caracteres é recusada por longa", () => {
    const longa = "a1" + "x".repeat(71);
    expect(longa.length).toBe(73);
    expect(validarSenha(longa)).toBe("longa");
  });

  it("aceita exatamente o máximo", () => {
    const limite = "a1" + "x".repeat(SENHA_MAX - 2);
    expect(limite.length).toBe(SENHA_MAX);
    expect(validarSenha(limite)).toBeNull();
  });

  it("senha sem número é recusada", () => {
    expect(validarSenha("apenasletras")).toBe("sem_numero");
  });

  it("senha sem letra é recusada", () => {
    expect(validarSenha("12345678")).toBe("sem_letra");
  });

  // O símbolo aparecia no texto do cadastro como obrigatório, mas nunca foi
  // exigido pela validação. Quem já tem senha sem símbolo continua entrando.
  it("não exige símbolo", () => {
    expect(validarSenha("Inventario9")).toBeNull();
  });
});

describe("mensagemDeSenha", () => {
  it.each(["curta", "longa", "sem_letra", "sem_numero"] as const)(
    "tem frase para %p",
    (falha) => {
      const msg = mensagemDeSenha(falha);
      expect(msg.trim()).not.toBe("");
      expect(msg).toMatch(/senha/i);
    },
  );
});

describe("REGRA_DE_SENHA", () => {
  // O defeito que motivou este módulo foi o texto prometer uma regra e o código
  // aplicar outra. Este teste amarra os dois.
  it("a regra exibida corresponde ao que a validação aceita", () => {
    expect(REGRA_DE_SENHA).toContain(String(SENHA_MIN));
    expect(REGRA_DE_SENHA).toMatch(/mínimo/i);
    expect(REGRA_DE_SENHA).toMatch(/letra/i);
    expect(REGRA_DE_SENHA).toMatch(/número/i);
    // Não pode prometer máximo de 8 — foi exatamente o texto errado de antes.
    expect(REGRA_DE_SENHA).not.toMatch(/máximo de 8/i);
  });

  it("uma senha que satisfaz a regra descrita é aceita", () => {
    const exemplo = "a".repeat(SENHA_MIN - 1) + "1";
    expect(exemplo.length).toBe(SENHA_MIN);
    expect(validarSenha(exemplo)).toBeNull();
  });
});
