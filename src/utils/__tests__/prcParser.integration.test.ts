import { parsePrcFile, PRC_MIN_LINE_LENGTH } from "../prcParser";

// Linha válida: PI + area(6) + barcode(13) + qty(4) + matricula(6) + outros(52) = 83 chars
const VALID_LINE =
  "PI" + "003029" + "0000000000000" + "0001" + "000001" + "2".repeat(52);

const PRC_AMOSTRA_83 = [VALID_LINE, VALID_LINE, VALID_LINE, VALID_LINE].join("\n");

describe("parsePrcFile", () => {
  it("retorna array vazio para conteúdo vazio", () => {
    expect(parsePrcFile("")).toHaveLength(0);
  });

  it("ignora linhas com menos de 83 caracteres", () => {
    const curta = "PI003029" + "0".repeat(10); // < 83 chars
    expect(parsePrcFile(curta)).toHaveLength(0);
  });

  it("ignora linhas sem prefixo PI", () => {
    const semPrefix = "XX003029" + "0".repeat(75); // 83 chars, sem PI
    expect(parsePrcFile(semPrefix)).toHaveLength(0);
  });

  it("parseia 4 linhas válidas do PRC_AMOSTRA_83", () => {
    const result = parsePrcFile(PRC_AMOSTRA_83);
    expect(result).toHaveLength(4);
  });

  it("extrai area_codigo corretamente", () => {
    const result = parsePrcFile(PRC_AMOSTRA_83);
    expect(result[0]!.area_codigo).toBe("003029");
  });

  it("extrai quantidade corretamente", () => {
    const result = parsePrcFile(PRC_AMOSTRA_83);
    expect(result[0]!.quantidade).toBe(1);
  });

  it("extrai matricula corretamente", () => {
    const result = parsePrcFile(PRC_AMOSTRA_83);
    expect(result[0]!.matricula).toBe("000001");
  });

  it("acumula contagens de múltiplos arquivos corretamente", () => {
    const arquivo1 = parsePrcFile(PRC_AMOSTRA_83); // 4 linhas, seção 003029
    const arquivo2 = parsePrcFile(PRC_AMOSTRA_83); // simular 2º dispositivo
    const acumulado = [...arquivo1, ...arquivo2];

    expect(acumulado).toHaveLength(8);
    const secoes = [...new Set(acumulado.map(c => c.area_codigo))];
    expect(secoes).toContain("003029");
  });

  it(`linha de exatamente ${PRC_MIN_LINE_LENGTH} chars é aceita`, () => {
    const linha83 = VALID_LINE;
    expect(linha83).toHaveLength(PRC_MIN_LINE_LENGTH);
    expect(parsePrcFile(linha83)).toHaveLength(1);
  });
});
