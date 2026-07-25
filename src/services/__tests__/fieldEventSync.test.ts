import {
  extractEventDateFromPayload,
  extractLojaFromPayload,
  unwrapEventBody,
} from "../fieldEventSync";

describe("fieldEventSync helpers", () => {
  it("extractLojaFromPayload — attendance.loja", () => {
    expect(
      extractLojaFromPayload("attendance", {
        attendance: { loja: "DSP 42", data: "2026-07-16" },
      }),
    ).toBe("DSP 42");
  });

  it("extractLojaFromPayload — report lojaNum + lojaNome", () => {
    expect(
      extractLojaFromPayload("reportA", {
        report: { lojaNum: "123", lojaNome: "Centro" },
      }),
    ).toBe("123 Centro");
  });

  it("extractEventDateFromPayload — ISO e BR", () => {
    expect(
      extractEventDateFromPayload("attendance", {
        attendance: { data: "2026-07-16" },
      }),
    ).toBe("2026-07-16");
    expect(
      extractEventDateFromPayload("attendance", {
        attendance: { data: "16/07/2026" },
      }),
    ).toBe("2026-07-16");
  });

  it("extractEventDateFromPayload — fallback _queuedAt", () => {
    expect(
      extractEventDateFromPayload("reportA", {
        report: { lojaNome: "X" },
        _queuedAt: "2026-01-02T10:00:00.000Z",
      }),
    ).toBe("2026-01-02");
  });

  it("unwrapEventBody", () => {
    expect(
      unwrapEventBody("attendance", { attendance: { loja: "A" } }),
    ).toEqual({ loja: "A" });
    expect(unwrapEventBody("reportA", { report: { lider: "B" } })).toEqual({
      lider: "B",
    });
  });
});
