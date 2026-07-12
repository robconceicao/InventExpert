import {
  evaluateChecker,
  calcularPerfilComportamental,
  detectarViolacoesBloco,
  isLeaderExcluded,
} from "../InventoryEvaluationService";
import {
  getLimitesBlocoFallback,
  getViolacoesBloco,
  lookupLimiteBlocoArea,
} from "../../config/inventoryEvalConfig";
import type { ContagemDetalhada, InventoryCheckerInput, ViolacaoBloco } from "../../types";
import { buildViolacaoBloco } from "../../types";

describe("evaluateChecker", () => {
  const base: InventoryCheckerInput = {
    nome: "TESTE",
    qtde: 1000,
    qtde1a1: 900,
    produtividade: 800,
    erro: 0,
  };

  it("zero erro com qtde >= 1000 recebe tag premium", () => {
    const ev = evaluateChecker(base, "FARMACIA")!;
    expect(ev.tags).toContain("⭐ Qualidade Premium (Zero Erro)");
    expect(ev.scoreFinal).toBeGreaterThan(80);
  });

  it("erro acima do crítico penaliza produtividade", () => {
    const ev1 = evaluateChecker({ ...base, erro: 1 }, "FARMACIA")!;
    const ev2 = evaluateChecker({ ...base, erro: 9 }, "FARMACIA")!;
    expect(ev2.scoreProdutividade).toBeLessThan(ev1.scoreProdutividade * 0.6);
  });

  it("itensPulados altos disparam tag de omissão", () => {
    const ev = evaluateChecker({ ...base, itensPulados: 20 }, "FARMACIA")!;
    expect(ev.tags.some((t) => t.includes("Pula"))).toBe(true);
  });

  it("score final permanece entre 0 e 100", () => {
    const extremo: InventoryCheckerInput = {
      nome: "STRESS",
      qtde: 100,
      qtde1a1: 0,
      produtividade: 50,
      erro: 50,
      itensPulados: 50,
      itensDuplicados: 50,
    };
    const ev = evaluateChecker(extremo, "FARMACIA")!;
    expect(ev.scoreFinal).toBeGreaterThanOrEqual(0);
    expect(ev.scoreFinal).toBeLessThanOrEqual(100);
  });

  it("SUPERMERCADO usa pesos recalibrados (qualidade > prod)", () => {
    const ev = evaluateChecker(
      { ...base, erro: 5, produtividade: 2000 },
      "SUPERMERCADO",
    )!;
    expect(ev.operationType).toBe("SUPERMERCADO");
    expect(ev.scoreFinal).toBeDefined();
  });

  it("qualidade < 100 quando há violação de bloco (assertion)", () => {
    const violacoes: ViolacaoBloco[] = [
      buildViolacaoBloco({
        area_nome: "MEDICAMENTOS",
        real_pct: 10,
        limite_pct: 0,
        area_critica: true,
      }),
    ];
    const ev = evaluateChecker(base, "FARMACIA", 0, 5, 1, violacoes)!;
    expect(ev.scoreQualidade).toBeLessThan(100);
    expect(ev.violacoes?.length).toBeGreaterThan(0);
  });

  it("operação não-farmácia não gera penalidade de bloco por seções", () => {
    const secoes = [
      { area: "MEDICAMENTOS", pctBloco: 50, bloco_pct: 50 },
    ];
    const ev = evaluateChecker(
      base,
      "SUPERMERCADO",
      0,
      5,
      1,
      undefined,
      secoes,
    )!;
    expect(ev.violacoes ?? []).toHaveLength(0);
  });

  it("exclui líder por role e retorna null", () => {
    const ev = evaluateChecker(
      { ...base, nome: "JOAO SILVA", role: "LIDER" },
      "FARMACIA",
    );
    expect(ev).toBeNull();
  });

  it("exclui líder por leaderName (Acompanhamento)", () => {
    const ev = evaluateChecker(
      { ...base, nome: "Maria Lideranca" },
      "FARMACIA",
      0,
      5,
      1,
      undefined,
      [],
      undefined,
      "Maria Lideranca",
    );
    expect(ev).toBeNull();
  });
});

describe("calcularPerfilComportamental", () => {
  it("threshold de omissão relativo ao volume", () => {
    expect(calcularPerfilComportamental(20, 0, 1000)).toBe("PULA_ITENS");
    expect(calcularPerfilComportamental(5, 0, 1000)).toBe("EQUILIBRADO");
  });
});

describe("detectarViolacoesBloco", () => {
  it("detecta bloco acima do limite a partir de contagens", () => {
    const contagens: ContagemDetalhada[] = [
      {
        matricula: "123",
        area_codigo: "000001",
        area_nome: "G 1",
        produto_codigo: "1",
        produto_nome: "P",
        produto_ean: "",
        produto_classe: "",
        quantidade: 50,
        is_bloco: true,
        data_hora: new Date(),
      },
      {
        matricula: "123",
        area_codigo: "000001",
        area_nome: "G 1",
        produto_codigo: "2",
        produto_nome: "P2",
        produto_ean: "",
        produto_classe: "",
        quantidade: 50,
        is_bloco: false,
        data_hora: new Date(),
      },
    ];
    // 50% bloco em G 1 (limite 15%)
    const v = detectarViolacoesBloco(
      "123",
      contagens,
      getLimitesBlocoFallback("FARMACIA"),
      "FARMACIA",
    );
    expect(v).toHaveLength(1);
    expect(v[0].area_nome).toBe("G 1");
    expect(v[0].area).toBe("G 1"); // dual-field
    expect(v[0].real_pct).toBe(50);
  });

  it("retorna [] para SUPERMERCADO", () => {
    const contagens: ContagemDetalhada[] = [
      {
        matricula: "123",
        area_codigo: "000001",
        area_nome: "MEDICAMENTOS",
        produto_codigo: "1",
        produto_nome: "P",
        produto_ean: "",
        produto_classe: "",
        quantidade: 100,
        is_bloco: true,
        data_hora: new Date(),
      },
    ];
    const v = detectarViolacoesBloco(
      "123",
      contagens,
      getLimitesBlocoFallback("FARMACIA"),
      "SUPERMERCADO",
    );
    expect(v).toHaveLength(0);
  });
});

describe("isLeaderExcluded", () => {
  it("detecta role LÍDER com acento", () => {
    expect(
      isLeaderExcluded({
        nome: "Fulano",
        role: "LÍDER",
        qtde: 1,
        qtde1a1: 1,
        produtividade: 1,
        erro: 0,
      }),
    ).toBe(true);
  });
});

describe("getViolacoesBloco / limites canônicos", () => {
  it("FRENTE DE CAIXA tem limite 90% (migration)", () => {
    const regra = lookupLimiteBlocoArea("FRENTE DE CAIXA");
    expect(regra?.limite).toBe(90);
  });

  it("área desconhecida: warn + sem penalidade (não aplica default 20%)", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const v = getViolacoesBloco(
      [{ area: "AREA_INEXISTENTE_XYZ", pctBloco: 99 }],
      "FARMACIA",
    );
    expect(v).toHaveLength(0);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("buildViolacaoBloco preenche canônico e legado (dual-field)", () => {
    const v = buildViolacaoBloco({
      area_nome: "G 1",
      real_pct: 40,
      limite_pct: 15,
      area_critica: false,
    });
    expect(v.area_nome).toBe("G 1");
    expect(v.area).toBe("G 1");
    expect(v.real_pct).toBe(40);
    expect(v.pctBloco).toBe(40);
    expect(v.limite_pct).toBe(15);
    expect(v.limitePermitido).toBe(15);
    expect(v.critica).toBe(false);
    expect(v.area_critica).toBe(false);
  });
});
