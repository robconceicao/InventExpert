import * as XLSX from "xlsx";

import { parseInventoryCheckersCsv } from "../parsers";
import {
  abrirComoWorkbook,
  arquivoParaTextoTabular,
  ErroLeituraArquivo,
  identificarArquivo,
} from "../spreadsheetReader";

/** Monta o `ArquivoLido` do jeito que `fileImport` monta depois de ler a URI. */
function arquivoDe(bytes: Uint8Array) {
  const base64 = Buffer.from(bytes).toString("base64");
  return identificarArquivo(base64, (limite) =>
    limite === undefined ? bytes : bytes.subarray(0, limite),
  );
}

function arquivoDeTexto(texto: string, encoding: BufferEncoding = "utf8") {
  return arquivoDe(Uint8Array.from(Buffer.from(texto, encoding)));
}

function planilhaDeExemplo(bookType: XLSX.BookType): Uint8Array {
  const aba = XLSX.utils.aoa_to_sheet([
    ["NOME DO CONFERENTE", "PRODUTIVIDADE", "% ERRO"],
    ["ANA CLAUDIA SILVA", "802,26", "0,23%"],
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, aba, "Plan1");
  return new Uint8Array(XLSX.write(workbook, { bookType, type: "array" }));
}

describe("identificarArquivo", () => {
  it("reconhece um XLSX real gerado pelo SheetJS", () => {
    expect(arquivoDe(planilhaDeExemplo("xlsx")).formato).toBe("XLSX");
  });

  it("reconhece um XLS 97-2003 real", () => {
    expect(arquivoDe(planilhaDeExemplo("xls")).formato).toBe("XLS");
  });
});

describe("arquivoParaTextoTabular", () => {
  it("converte XLSX em CSV com ponto e vírgula", () => {
    const csv = arquivoParaTextoTabular(arquivoDe(planilhaDeExemplo("xlsx")), "PRODUÇÃO.xlsx");
    expect(csv).toContain("NOME DO CONFERENTE;PRODUTIVIDADE;% ERRO");
    expect(csv).toContain("ANA CLAUDIA SILVA;802,26;0,23%");
  });

  it("converte XLS 97-2003 em CSV com ponto e vírgula", () => {
    const csv = arquivoParaTextoTabular(arquivoDe(planilhaDeExemplo("xls")), "PRODUÇÃO.xls");
    expect(csv).toContain("ANA CLAUDIA SILVA;802,26;0,23%");
  });

  it("abre tabela HTML salva como .xls (export do Crystal Reports)", () => {
    const html =
      "<html><body><table>" +
      "<tr><td>NOME DO CONFERENTE</td><td>% ERRO</td></tr>" +
      "<tr><td>ELEN CRISTINA</td><td>1,73%</td></tr>" +
      "</table></body></html>";
    const arquivo = arquivoDeTexto(html);

    expect(arquivo.formato).toBe("HTML");
    const csv = arquivoParaTextoTabular(arquivo, "PRODUÇÃO.xls");
    expect(csv).toContain("NOME DO CONFERENTE;% ERRO");
    expect(csv).toContain("ELEN CRISTINA;1,73%");
  });

  it("preserva acentos de HTML em windows-1252 (SEÇÃO não vira SE?ÃO)", () => {
    const html = "<table><tr><td>SEÇÃO</td><td>MEDICAMENTOS OTC</td></tr></table>";
    const csv = arquivoParaTextoTabular(arquivoDeTexto(html, "latin1"), "PROD_SEÇÃO.xls");
    expect(csv).toContain("SEÇÃO;MEDICAMENTOS OTC");
  });

  it("abre MHTML multipart com quoted-printable", () => {
    const mhtml = [
      "MIME-Version: 1.0",
      'Content-Type: multipart/related; boundary="----=_Part_1"',
      "",
      "------=_Part_1",
      "Content-Type: text/html; charset=windows-1252",
      "Content-Transfer-Encoding: quoted-printable",
      "",
      "<table><tr><td>AVARIAS E VENCIDOS</td><td>3,10%</td></tr></table>",
      "------=_Part_1--",
    ].join("\r\n");

    const csv = arquivoParaTextoTabular(arquivoDeTexto(mhtml), "BLOCO.xls");
    expect(csv).toContain("AVARIAS E VENCIDOS;3,10%");
  });

  it("devolve o texto cru quando o arquivo é CSV", () => {
    const csv = "NOME;PRODUTIVIDADE\nANA;802,26";
    expect(arquivoParaTextoTabular(arquivoDeTexto(csv), "PRODUÇÃO.csv")).toBe(csv);
  });

  it("devolve o texto cru de um .prc, sem tentar abrir como planilha", () => {
    const linha =
      "000001000123000045202608060931120000012345678PPI000101000000000012345000010";
    expect(arquivoParaTextoTabular(arquivoDeTexto(linha), "0001.prc")).toBe(linha);
  });

  it("lê o texto de .prc em windows-1252 sem corromper acento", () => {
    const linha = "PI SEÇÃO 000010";
    expect(arquivoParaTextoTabular(arquivoDeTexto(linha, "latin1"), "0001.prc")).toBe(linha);
  });

  it("reclama com nome do arquivo quando está vazio", () => {
    expect(() => arquivoParaTextoTabular(arquivoDe(new Uint8Array(0)), "PRODUÇÃO.xls")).toThrow(
      ErroLeituraArquivo,
    );
    expect(() => arquivoParaTextoTabular(arquivoDe(new Uint8Array(0)), "PRODUÇÃO.xls")).toThrow(
      /PRODUÇÃO\.xls/,
    );
  });
});

describe("PRODUÇÃO exportado como tabela HTML → avaliação", () => {
  /** Export "Excel" do Crystal Reports: HTML com extensão .xls, em cp1252. */
  const producaoHtml = [
    "<html><body><table>",
    "<tr><td>Capa</td><td>Matrícula</td><td>Nome do Colaborador</td><td>Qtde</td>",
    "<td>Horas</td><td>Produtividade</td><td>Erro (Qtde)</td><td>% (Erro/Qtd)</td></tr>",
    "<tr><td>0001</td><td>12345</td><td>AMANDA DE OLIVEIRA</td><td>752</td>",
    "<td>1,9</td><td>395,33</td><td>13</td><td>1,73%</td></tr>",
    "</table></body></html>",
  ].join("");

  it("chega ao parser com os números em pt-BR intactos", () => {
    const csv = arquivoParaTextoTabular(
      arquivoDeTexto(producaoHtml, "latin1"),
      "PRODUÇÃO.xls",
    );
    expect(csv).toContain("395,33");
    expect(csv).toContain("1,73%");

    const [conferente] = parseInventoryCheckersCsv(csv);
    expect(conferente.nome).toBe("AMANDA DE OLIVEIRA");
    expect(conferente.qtde).toBe(752);
    expect(conferente.produtividade).toBeCloseTo(395.33);
    expect(conferente.erro).toBe(13);
  });
});

describe("abrirComoWorkbook", () => {
  it("erra com mensagem nomeando o arquivo quando o binário está corrompido", () => {
    // Cabeçalho de XLSX (ZIP) sem conteúdo de ZIP válido depois
    const corrompido = Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x01, 0x02, 0x03]);
    expect(() => abrirComoWorkbook(arquivoDe(corrompido), "ACURACIDADE.xls")).toThrow(
      /ACURACIDADE\.xls/,
    );
  });

  it("abre CSV como workbook (o picker aceita CSV como planilha)", () => {
    const workbook = abrirComoWorkbook(arquivoDeTexto("NOME;ERRO\nANA;13"), "lista.csv");
    expect(workbook.SheetNames.length).toBeGreaterThan(0);
  });
});
