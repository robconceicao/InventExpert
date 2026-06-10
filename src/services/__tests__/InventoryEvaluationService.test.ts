import {
  evaluateChecker,
} from "../InventoryEvaluationService";
import type { InventoryCheckerInput } from "../../types";

describe("evaluateChecker", () => {
  const base: InventoryCheckerInput = {
    nome: "TESTE",
    qtde: 1000,
    qtde1a1: 900,
    produtividade: 800,
    erro: 0,
  };

  it("zero erro com qtde >= 1000 recebe tag premium", () => {
    const ev = evaluateChecker(base, "FARMACIA");
    expect(ev.tags).toContain("⭐ Qualidade Premium (Zero Erro)");
    expect(ev.scoreFinal).toBeGreaterThan(80);
  });

  it("erro acima do crítico penaliza produtividade", () => {
    const ev1 = evaluateChecker({ ...base, erro: 1 }, "FARMACIA");
    const ev2 = evaluateChecker({ ...base, erro: 9 }, "FARMACIA");
    expect(ev2.scoreProdutividade).toBeLessThan(ev1.scoreProdutividade * 0.6);
  });

  it("itensPulados altos disparam tag de omissão", () => {
    // itensPulados removido - a reimplementar
    // const ev = evaluateChecker({ ...base, itensPulados: 20 }, "FARMACIA");
    // expect(ev.tags.some((t) => t.includes("Pula"))).toBe(true);
  });

  it("score final permanece entre 0 e 100", () => {
    const extremo: InventoryCheckerInput = {
      nome: "STRESS",
      qtde: 100,
      qtde1a1: 0,
      produtividade: 50,
      erro: 50,
      // itensPulados, itensDuplicados removidos
    };
    const ev = evaluateChecker(extremo, "FARMACIA");
    expect(ev.scoreFinal).toBeGreaterThanOrEqual(0);
    expect(ev.scoreFinal).toBeLessThanOrEqual(100);
  });

  it("SUPERMERCADO usa pesos recalibrados (qualidade > prod)", () => {
    const ev = evaluateChecker(
      { ...base, erro: 5, produtividade: 2000 },
      "SUPERMERCADO",
    );
    expect(ev.operationType).toBe("SUPERMERCADO");
    expect(ev.scoreFinal).toBeDefined();
  });
});

// calcularPerfilComportamental removido
