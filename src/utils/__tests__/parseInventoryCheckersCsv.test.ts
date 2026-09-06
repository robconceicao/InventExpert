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
  /**
   * O ramo heurístico do Crystal (o que atende os arquivos reais) só aplicava
   * `Math.max(0, ...)`. `erro` e `qtde1a1` são subconjuntos de `qtde`, e sem o
   * teto o motor v3 publicava acuracidade negativa na ficha do conferente.
   */
  it("ramo Crystal limita erro e 1a1 ao total contado", () => {
    const input = `Capa;Matrícula;Nome do Colaborador;Qtde;1a. Coleta;Ult. Coleta;Horas;Produtividade;Erro (Qtde);% (Erro/Qtd);Vlr (C1);Vlr (AJST);x;1a1
0001;12345;AMANDA DE OLIVEIRA;752;01/01/2026;01/01/2026;1,9;395,33;9999;1,73%;1000,00;10,00;0;5000`;
    const [r] = parseInventoryCheckersCsv(input);
    expect(r.qtde).toBe(752);
    expect(r.erro).toBe(752);
    expect(r.qtde1a1).toBe(752);
  });

  it("ramo Crystal preserva erro e 1a1 dentro do total", () => {
    const input = `Capa;Matrícula;Nome do Colaborador;Qtde;1a. Coleta;Ult. Coleta;Horas;Produtividade;Erro (Qtde);% (Erro/Qtd);Vlr (C1);Vlr (AJST);x;1a1
0001;12345;AMANDA DE OLIVEIRA;752;01/01/2026;01/01/2026;1,9;395,33;13;1,73%;1000,00;10,00;0;600`;
    const [r] = parseInventoryCheckersCsv(input);
    expect(r.erro).toBe(13);
    expect(r.qtde1a1).toBe(600);
  });
});
