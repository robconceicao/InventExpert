import { parseInventoryCheckersCsv } from "../parsers";

describe("parseInventoryCheckersCsv", () => {
  it("formato RProtmv com separador ponto-e-vírgula", () => {
    const input = `Capa;Matrícula;Nome do Colaborador;Qtde;1a. Coleta;Ult. Coleta;Horas;Produtividade;Erro (Qtde);% (Erro/Qtd)
0001;12345;AMANDA DE OLIVEIRA;752;01/01/2026;01/01/2026;1,9;395,33;13;1,73%`;
    const result = parseInventoryCheckersCsv(input);
    expect(result).toHaveLength(1);
    expect(result[0].qtde).toBe(752);
    expect(result[0].produtividade).toBeCloseTo(395.33);
    expect(result[0].erro).toBe(13);
  });

  it("erro como % converte para quantidade absoluta", () => {
    const input = `Nome;Qtde;1a1;Produtividade;Erro
JOÃO;1000;800;500;2%`;
    const result = parseInventoryCheckersCsv(input);
    expect(result[0].erro).toBe(20);
  });

  it("linha de total ignorada", () => {
    const input = `Nome;Qtde;Erro;Produtividade;1a1
AMANDA;500;10;400;100
TOTAL;5000;100;400;0`;
    const result = parseInventoryCheckersCsv(input);
    expect(result).toHaveLength(1);
  });

  it("qtde1a1 zero explícito é respeitado", () => {
    const input = `Nome;Qtde;1a1;Produtividade;Erro
CAROLINE;800;0;400;5`;
    const result = parseInventoryCheckersCsv(input);
    expect(result[0].qtde1a1).toBe(0);
  });
});
