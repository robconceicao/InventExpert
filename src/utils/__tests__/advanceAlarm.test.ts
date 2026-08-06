import {
  AVANCOS_MONITORADOS,
  avancosComAviso,
  avisoLiberado,
  buscarAvancoPorLabel,
  campoPreenchido,
  horarioDoAviso,
  isAdvanceAt100,
  type ReportComAvancos,
} from "../advanceAlarmRules";

describe("isAdvanceAt100", () => {
  it("detecta 100 e acima", () => {
    expect(isAdvanceAt100("100")).toBe(true);
    expect(isAdvanceAt100("100%")).toBe(true);
    expect(isAdvanceAt100("100,0")).toBe(true);
    expect(isAdvanceAt100("101")).toBe(true);
  });

  it("não dispara abaixo de 100", () => {
    expect(isAdvanceAt100("99")).toBe(false);
    expect(isAdvanceAt100("99,9")).toBe(false);
    expect(isAdvanceAt100("")).toBe(false);
    expect(isAdvanceAt100(undefined)).toBe(false);
  });

  it("encerra se qualquer avanço totalizar 100%", () => {
    expect(isAdvanceAt100("50", "70", "100", "90")).toBe(true);
    expect(isAdvanceAt100("50", "70", "80")).toBe(false);
  });
});

describe("campoPreenchido", () => {
  it("aceita 0 e 0% — são percentuais válidos", () => {
    expect(campoPreenchido("0")).toBe(true);
    expect(campoPreenchido("0%")).toBe(true);
    expect(campoPreenchido("35,5")).toBe(true);
  });

  it("recusa vazio, espaços e ausente", () => {
    expect(campoPreenchido("")).toBe(false);
    expect(campoPreenchido("   ")).toBe(false);
    expect(campoPreenchido(undefined)).toBe(false);
    expect(campoPreenchido(null)).toBe(false);
  });
});

describe("avanços monitorados", () => {
  it("o avanço inicial das 22h00 nunca avisa", () => {
    expect(AVANCOS_MONITORADOS.map((a) => a.label)).toEqual([
      "00h00",
      "01h00",
      "03h00",
      "04h00",
    ]);
    expect(buscarAvancoPorLabel("22h00")).toBeNull();
  });

  it("cada avanço aponta para o anterior da cadeia", () => {
    expect(AVANCOS_MONITORADOS.map((a) => [a.campo, a.campoAnterior])).toEqual([
      ["avanco00h", "avanco22h"],
      ["avanco01h", "avanco00h"],
      ["avanco03h", "avanco01h"],
      ["avanco04h", "avanco03h"],
    ]);
  });

  it("horarioDoAviso é 15 min antes, virando a hora e o dia", () => {
    expect(horarioDoAviso({ hour: 0, minute: 0 })).toEqual({ hour: 23, minute: 45 });
    expect(horarioDoAviso({ hour: 1, minute: 0 })).toEqual({ hour: 0, minute: 45 });
    expect(horarioDoAviso({ hour: 3, minute: 0 })).toEqual({ hour: 2, minute: 45 });
    expect(horarioDoAviso({ hour: 4, minute: 0 })).toEqual({ hour: 3, minute: 45 });
  });
});

describe("avisoLiberado", () => {
  const avanco00h = buscarAvancoPorLabel("00h00")!;

  it("bloqueia enquanto o avanço anterior estiver vazio", () => {
    expect(avisoLiberado(avanco00h, { avanco22h: "", avanco00h: "" })).toBe(false);
    expect(avisoLiberado(avanco00h, { avanco22h: "   " })).toBe(false);
  });

  it("libera quando o avanço anterior foi preenchido", () => {
    expect(avisoLiberado(avanco00h, { avanco22h: "0%", avanco00h: "" })).toBe(true);
  });

  it("bloqueia se o próprio avanço já foi lançado (não é mais o próximo)", () => {
    expect(avisoLiberado(avanco00h, { avanco22h: "0%", avanco00h: "18" })).toBe(
      false,
    );
  });

  it("sem report não libera nada", () => {
    expect(avisoLiberado(avanco00h, null)).toBe(false);
    expect(avisoLiberado(avanco00h, undefined)).toBe(false);
  });
});

describe("avancosComAviso — cadeia ao longo do inventário", () => {
  const labels = (r: ReportComAvancos) => avancosComAviso(r).map((a) => a.label);

  it("formulário em branco não avisa nada", () => {
    expect(labels({})).toEqual([]);
  });

  it("com o avanço inicial lançado, só o das 00h00 avisa", () => {
    expect(labels({ avanco22h: "0%" })).toEqual(["00h00"]);
  });

  it("a cada avanço lançado, o aviso anda para o próximo", () => {
    expect(labels({ avanco22h: "0%", avanco00h: "22" })).toEqual(["01h00"]);
    expect(labels({ avanco22h: "0%", avanco00h: "22", avanco01h: "48" })).toEqual([
      "03h00",
    ]);
    expect(
      labels({
        avanco22h: "0%",
        avanco00h: "22",
        avanco01h: "48",
        avanco03h: "81",
      }),
    ).toEqual(["04h00"]);
  });

  it("com todos os avanços lançados, não há mais aviso", () => {
    expect(
      labels({
        avanco22h: "0%",
        avanco00h: "22",
        avanco01h: "48",
        avanco03h: "81",
        avanco04h: "97",
      }),
    ).toEqual([]);
  });

  it("buraco na cadeia não libera avanço adiante", () => {
    // 00h00 preenchido sem o 22h00: o aviso das 00h00 não faz sentido e o das
    // 01h00 segue valendo, porque o anterior dele (00h00) está preenchido
    expect(labels({ avanco00h: "22" })).toEqual(["01h00"]);
  });
});
