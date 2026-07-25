import {
  formatTimeInputH,
  formatTimeNowH,
  normalizeTimeToH,
  timeToMinutesH,
} from "../timeFormat";

describe("timeFormat 19h00", () => {
  it("formatTimeNowH usa h como separador", () => {
    const d = new Date(2026, 4, 7, 19, 0, 0);
    expect(formatTimeNowH(d)).toBe("19h00");
    expect(formatTimeNowH(d)).not.toContain(":");
  });

  it("formatTimeInputH digita para 19h00", () => {
    expect(formatTimeInputH("1")).toBe("1");
    expect(formatTimeInputH("19")).toBe("19");
    expect(formatTimeInputH("190")).toBe("19h0");
    expect(formatTimeInputH("1900")).toBe("19h00");
    expect(formatTimeInputH("19:00")).toBe("19h00");
    expect(formatTimeInputH("19h00")).toBe("19h00");
  });

  it("normalizeTimeToH converte 19:00 → 19h00", () => {
    expect(normalizeTimeToH("19:00")).toBe("19h00");
    expect(normalizeTimeToH("19h00")).toBe("19h00");
    expect(normalizeTimeToH("")).toBe("");
  });

  it("timeToMinutesH aceita ambos formatos", () => {
    expect(timeToMinutesH("22:00")).toBe(timeToMinutesH("22h00"));
    expect(timeToMinutesH("00h00")).toBeGreaterThan(timeToMinutesH("22h00"));
  });
});
