import { buildAgentesIndex, parseAcuracidadeXlsMatrix } from "../auditoriaParsers";

/**
 * O ACURACIDADE chega por `pickSheetAsMatrix()`, que lê com `raw: true` para
 * preservar o pt-BR — é o mesmo motivo pelo qual `avaliacaoV3Parsers` tem o
 * `parseNumeroBr`. Este parser usava `parseFloat` cru: "1.234,00" virava 1.234
 * e "395,33" virava 395, com a quantidade truncada em silêncio.
 */
describe("parseAcuracidadeXlsMatrix", () => {
  /** Cabeçalho e linhas como o Crystal exporta em HTML/CSV, em pt-BR. */
  const matrizBr = (linhas: unknown[][]): unknown[][] => [
    ["Relatório de Acuracidade", null, null, null, null, null],
    ["Filtro: Loja 2601", null, null, null, null, null],
    ["SEÇÃO", "COD. BARRAS", "DESCRIÇÃO", "C1", "FINAL", "AJST"],
    ...linhas,
  ];

  it("lê milhar e decimal em pt-BR sem truncar", () => {
    const [r] = parseAcuracidadeXlsMatrix(
      matrizBr([["2301", "7896000001", "DIPIRONA 500MG", "1.234,00", "1.230,00", "-4,00"]]),
    );
    expect(r.c1).toBe(1234);
    expect(r.final).toBe(1230);
    expect(r.ajst).toBe(-4);
  });

  it("preserva a casa decimal que o parseFloat cru descartava", () => {
    const [r] = parseAcuracidadeXlsMatrix(
      matrizBr([["2302", "7896000002", "AMOXICILINA", "395,33", "396,83", "1,50"]]),
    );
    expect(r.c1).toBeCloseTo(395.33, 2);
    expect(r.ajst).toBeCloseTo(1.5, 2);
  });

  it("continua aceitando célula numérica do .xls binário", () => {
    const [r] = parseAcuracidadeXlsMatrix(
      matrizBr([["2303", "7896000003", "PARACETAMOL", 40, 38, -2]]),
    );
    expect(r.c1).toBe(40);
    expect(r.ajst).toBe(-2);
  });

  it("célula vazia vale zero, não NaN", () => {
    const [r] = parseAcuracidadeXlsMatrix(
      matrizBr([["2304", "7896000004", "SORO", "", null, undefined]]),
    );
    expect(r.c1).toBe(0);
    expect(r.final).toBe(0);
    expect(r.ajst).toBe(0);
  });

  it("ignora a linha de total e as vazias", () => {
    const linhas = parseAcuracidadeXlsMatrix(
      matrizBr([
        ["2301", "7896000001", "DIPIRONA", "10,00", "10,00", "0,00"],
        [],
        ["TOTAL GERAL", "", "", "10,00", "10,00", "0,00"],
      ]),
    );
    expect(linhas).toHaveLength(1);
    expect(linhas[0].secao).toBe("2301");
  });

  it("reclama quando o cabeçalho não existe", () => {
    expect(() => parseAcuracidadeXlsMatrix([["a", "b"]])).toThrow(/ACURACIDADE/);
  });
});

describe("buildAgentesIndex", () => {
  it("indexa CadFun.txt por CPF e por código", () => {
    const idx = buildAgentesIndex("29291408875|AMARILDO DA SILVA|001234|29291408875|CONFERENTE");
    expect(idx.get("29291408875")?.nome).toBe("AMARILDO DA SILVA");
    expect(idx.get("001234")?.cpf).toBe("29291408875");
  });

  it("indexa agentes.txt posicional por código", () => {
    const idx = buildAgentesIndex("001234AMARILDO DA SILVA       ");
    expect(idx.get("001234")?.nome).toBe("AMARILDO DA SILVA");
  });
});
