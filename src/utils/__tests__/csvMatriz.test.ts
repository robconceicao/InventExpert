import { csvParaMatriz, detectarSeparador } from "../csvMatriz";

describe("detectarSeparador", () => {
  /**
   * O defeito: `texto.includes('\t')` olhava o documento inteiro, então uma
   * tabulação perdida em UMA descrição fatiava o arquivo todo por tabulação.
   */
  it("uma tabulação isolada não sequestra um arquivo por ponto-e-vírgula", () => {
    const linhas = ["SEÇÃO;EAN;DESCRIÇÃO;C1"];
    for (let i = 0; i < 40; i += 1) linhas.push(`230${i};789600000${i};DIPIRONA;10`);
    linhas.push("2399;7896000099;PARACETAMOL\tGOTAS;5"); // a tabulação perdida
    expect(detectarSeparador(linhas.join("\n"))).toBe(";");
  });

  it("reconhece TSV de verdade", () => {
    const tsv = ["a\tb\tc", "1\t2\t3", "4\t5\t6"].join("\n");
    expect(detectarSeparador(tsv)).toBe("\t");
  });

  it("reconhece CSV por vírgula", () => {
    expect(detectarSeparador("a,b,c\n1,2,3\n4,5,6")).toBe(",");
  });

  it("vírgula decimal não vence o ponto-e-vírgula que separa as colunas", () => {
    const br = ["NOME;QTDE;VALOR", "DIPIRONA;1,5;395,33", "AMOXICILINA;2,0;1.234,56"].join("\n");
    expect(detectarSeparador(br)).toBe(";");
  });

  it("ignora separador que só aparece dentro de aspas", () => {
    const csv = ['NOME;QTDE', '"DIPIRONA; 500MG";10', '"AMOXICILINA; 250MG";20'].join("\n");
    expect(detectarSeparador(csv)).toBe(";");
  });
});

describe("csvParaMatriz", () => {
  /** O segundo defeito: aspas não eram respeitadas ao fatiar. */
  it("não parte campo entre aspas que contém o separador", () => {
    const m = csvParaMatriz('EAN,DESCRICAO,QTDE\n789,"AMOXICILINA 500MG, 21 CPS",10');
    expect(m[1]).toEqual(["789", "AMOXICILINA 500MG, 21 CPS", "10"]);
  });

  it('aspas duplas escapadas viram uma aspa literal', () => {
    const m = csvParaMatriz('A;B\n1;"CAIXA ""GRANDE"""');
    expect(m[1]).toEqual(["1", 'CAIXA "GRANDE"']);
  });

  it("quebra de linha dentro de aspas não cria linha nova", () => {
    const m = csvParaMatriz('A;B\n1;"PRIMEIRA\nSEGUNDA"');
    expect(m).toHaveLength(2);
    expect(m[1][1]).toBe("PRIMEIRA\nSEGUNDA");
  });

  it("aceita CRLF", () => {
    expect(csvParaMatriz("a;b\r\nc;d")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("preserva linha em branco no meio — os parsers acham o cabeçalho por índice", () => {
    const m = csvParaMatriz("titulo\n\nSEÇÃO;C1\n2301;10");
    expect(m).toHaveLength(4);
    expect(m[1]).toEqual([""]);
    expect(m[2]).toEqual(["SEÇÃO", "C1"]);
  });

  it("quebra final não gera linha fantasma", () => {
    expect(csvParaMatriz("a;b\nc;d\n")).toHaveLength(2);
  });

  it("texto vazio devolve matriz vazia, para a tela poder dizer que está vazio", () => {
    expect(csvParaMatriz("")).toEqual([]);
  });

  it("célula continua vindo sem espaço em volta", () => {
    expect(csvParaMatriz("  a  ;  b  ")).toEqual([["a", "b"]]);
  });

  it("respeita separador informado pelo chamador", () => {
    expect(csvParaMatriz("a,b;c", ",")).toEqual([["a", "b;c"]]);
  });

  it("arquivo de uma coluna só continua sendo uma coluna", () => {
    expect(csvParaMatriz("LINHA UM\nLINHA DOIS")).toEqual([["LINHA UM"], ["LINHA DOIS"]]);
  });
});
