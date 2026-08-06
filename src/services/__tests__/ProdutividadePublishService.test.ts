import { digitsOnly, normalizeNomePessoa, nomesIguais } from "../../utils/inventoryImportParsers";

/**
 * Testes das regras de match usadas na publicação (sem Supabase).
 * A service completa depende de cliente real; aqui validamos helpers estáveis.
 */
describe("ProdutividadePublish match helpers", () => {
  it("digitsOnly e zeros à esquerda", () => {
    expect(digitsOnly("041.712.954-83")).toBe("04171295483");
    const a = digitsOnly("04171295483").replace(/^0+/, "");
    const b = digitsOnly("4171295483").replace(/^0+/, "");
    expect(a).toBe(b);
  });

  it("nomesIguais tolera acento e prefixo", () => {
    expect(nomesIguais("José Silva", "JOSE SILVA")).toBe(true);
    expect(nomesIguais("ANA CLAUDIA SILVA", "ANA CLAUDIA")).toBe(true);
    expect(nomesIguais("PEDRO", "PAULO")).toBe(false);
  });

  it("normalizeNomePessoa colapsa espaços", () => {
    expect(normalizeNomePessoa("  Ana   Maria  ")).toBe("ANA MARIA");
  });
});
