import { isAdvanceAt100 } from "../advanceAlarmRules";

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
