import {
  canAccessManagement,
  canGenerateEscala,
  parseAppRole,
  roleAtLeast,
} from "../authzRules";

describe("authz", () => {
  it("parseAppRole normaliza aliases", () => {
    expect(parseAppRole("admin")).toBe("ADMIN");
    expect(parseAppRole("LÍDER")).toBe("LIDER");
    expect(parseAppRole("operator")).toBe("OPERADOR");
    expect(parseAppRole("nope")).toBeNull();
  });

  it("roleAtLeast: null (legado) não restringe", () => {
    expect(roleAtLeast(null, "ADMIN")).toBe(true);
    expect(roleAtLeast("OPERADOR", "LIDER")).toBe(false);
    expect(roleAtLeast("LIDER", "LIDER")).toBe(true);
    expect(roleAtLeast("ADMIN", "LIDER")).toBe(true);
  });

  it("canAccessManagement / canGenerateEscala", () => {
    expect(canAccessManagement(null)).toBe(true);
    expect(canAccessManagement("OPERADOR")).toBe(false);
    expect(canAccessManagement("LIDER")).toBe(true);
    expect(canGenerateEscala("OPERADOR")).toBe(false);
    expect(canGenerateEscala("ADMIN")).toBe(true);
  });
});
