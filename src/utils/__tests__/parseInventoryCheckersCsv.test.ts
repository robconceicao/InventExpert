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

/**
 * SPEC 0004 — o fatiamento passou a ser do `csvMatriz`. Cada caso aqui é uma
 * divergência medida entre o parser local que existia neste arquivo e o
 * unificado, rodando os dois lado a lado antes da troca.
 */
describe("parseInventoryCheckersCsv — parser de CSV unificado", () => {
  const CAB = "Nome;Qtde;1a1;Produtividade;Erro";

  it("aspa escapada sobrevive ao parser de produtividade", () => {
    // Antes: `""` era engolido e "CAIXA ""GRANDE""" virava CAIXA GRANDE.
    const [r] = parseInventoryCheckersCsv(`${CAB}\n"JOAO ""JOTA"" SILVA";500;100;400;5`);
    expect(r.nome).toBe('JOAO "JOTA" SILVA');
  });

  it("descrição com quebra de linha não vira conferente fantasma", () => {
    // Antes: a quebra dentro das aspas partia a linha em duas, e a segunda
    // metade só não virava conferente porque caía no `qtde <= 0`.
    const r = parseInventoryCheckersCsv(`${CAB}\n"MARIA\nSANTOS";500;100;400;5`);
    expect(r).toHaveLength(1);
    expect(r[0].nome).toBe("MARIA\nSANTOS");
  });

  it("linha em branco antes do cabeçalho não atrapalha", () => {
    const [r] = parseInventoryCheckersCsv(`Relatorio de Producao\n\n\n${CAB}\nANA;800;200;500;4`);
    expect(r.nome).toBe("ANA");
    expect(r.qtde).toBe(800);
  });

  it("separador do documento vence linha destoante", () => {
    // Antes o separador era decidido linha a linha: a linha com vírgula era
    // fatiada por vírgula, mesmo num arquivo separado por ponto-e-vírgula.
    const r = parseInventoryCheckersCsv(`${CAB}\nANA;800;200;500;4\nB,C,D,E,F`);
    expect(r).toHaveLength(1);
    expect(r[0].nome).toBe("ANA");
  });

  it("cabeçalho depois de 25 linhas de título do Crystal ainda é achado", () => {
    // O limite de 30 conta linhas com conteúdo; as vazias que o csvParaMatriz
    // preserva não podem consumir a cota (D2).
    const ruido = Array.from({ length: 25 }, (_, i) => `Filtro ${i}\n`).join("");
    const [r] = parseInventoryCheckersCsv(`${ruido}\n\n${CAB}\nANA;800;200;500;4`);
    expect(r?.nome).toBe("ANA");
  });

  it("arquivo curto demais devolve vazio", () => {
    expect(parseInventoryCheckersCsv("")).toEqual([]);
    expect(parseInventoryCheckersCsv(CAB)).toEqual([]);
    expect(parseInventoryCheckersCsv("\n\n\n")).toEqual([]);
  });
});
