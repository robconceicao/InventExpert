import {
  decodeBase64,
  decodificarQuotedPrintable,
  decodificarTexto,
  descreverFormato,
  detectarFormato,
  ehUtf8Valido,
  extrairExtensao,
  extrairHtmlDeMhtml,
} from "../fileFormat";

const bytes = (...valores: number[]) => Uint8Array.from(valores);

const deTexto = (texto: string) =>
  Uint8Array.from(texto.split("").map((c) => c.charCodeAt(0) & 0xff));

const paraBase64 = (dados: Uint8Array) =>
  Buffer.from(dados).toString("base64");

describe("extrairExtensao", () => {
  it("lê a extensão do nome simples, em minúsculas", () => {
    expect(extrairExtensao("PRODUÇÃO.XLS")).toBe("xls");
    expect(extrairExtensao("PROD_SEÇÃO.xlsx")).toBe("xlsx");
  });

  it("lê a extensão de uma URI de cache com nome percent-encoded", () => {
    const uri =
      "file:///data/user/0/com.inventexpert/cache/DocumentPicker/PROD_SE%C3%87%C3%83O.xlsx";
    expect(extrairExtensao(uri)).toBe("xlsx");
  });

  it("ignora query string e fragmento", () => {
    expect(extrairExtensao("https://x.com/a/PRODUCAO.xls?token=abc#topo")).toBe("xls");
  });

  it("não confunde ponto de data com extensão real", () => {
    expect(extrairExtensao("invent_DSP_06.08.2026.old")).toBe("old");
  });

  it("devolve vazio para content:// sem extensão", () => {
    expect(extrairExtensao("content://com.android.providers.downloads/documents/1234")).toBe("");
  });

  it("não pega o ponto do diretório quando o arquivo não tem extensão", () => {
    expect(extrairExtensao("/cache/com.inventexpert.app/DocumentPicker/arquivo")).toBe("");
  });

  it("devolve vazio para entrada vazia ou só ponto", () => {
    expect(extrairExtensao("")).toBe("");
    expect(extrairExtensao("arquivo.")).toBe("");
    expect(extrairExtensao(".gitignore")).toBe("");
  });
});

describe("decodeBase64", () => {
  it("decodifica ida e volta", () => {
    const original = deTexto("NOME;PRODUTIVIDADE;ERRO");
    expect(decodeBase64(paraBase64(original))).toEqual(original);
  });

  it("ignora quebras de linha e padding", () => {
    const b64 = paraBase64(deTexto("abcdefghij"));
    const quebrado = b64.slice(0, 4) + "\n" + b64.slice(4);
    expect(decodificarTexto(decodeBase64(quebrado))).toBe("abcdefghij");
  });

  it("respeita o limite de bytes (sniff sem decodificar o arquivo todo)", () => {
    const grande = deTexto("A".repeat(10000));
    expect(decodeBase64(paraBase64(grande), 16)).toHaveLength(16);
  });
});

describe("detectarFormato", () => {
  it("reconhece XLSX pelo cabeçalho ZIP", () => {
    expect(detectarFormato(bytes(0x50, 0x4b, 0x03, 0x04, 0x14, 0x00))).toBe("XLSX");
  });

  it("reconhece XLS 97-2003 pelo cabeçalho CFB", () => {
    expect(
      detectarFormato(bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00)),
    ).toBe("XLS");
  });

  it("reconhece BIFF cru (BOF 0x0009 / 0x0809)", () => {
    expect(detectarFormato(bytes(0x09, 0x00, 0x04, 0x00))).toBe("XLS");
    expect(detectarFormato(bytes(0x09, 0x08, 0x10, 0x00))).toBe("XLS");
  });

  it("reconhece tabela HTML salva como .xls (Crystal Reports)", () => {
    const html = "<html><head><meta charset=windows-1252></head><body><table><tr><td>1</td></tr></table></body></html>";
    expect(detectarFormato(deTexto(html))).toBe("HTML");
  });

  it("reconhece HTML mesmo sem <html>, começando pela tabela", () => {
    expect(detectarFormato(deTexto("<table border=1><tr><td>X</td></tr></table>"))).toBe("HTML");
  });

  it("reconhece MHTML multipart", () => {
    const mhtml = [
      "MIME-Version: 1.0",
      'Content-Type: multipart/related; boundary="----=_Part_1"',
      "",
      "------=_Part_1",
    ].join("\r\n");
    expect(detectarFormato(deTexto(mhtml))).toBe("HTML");
  });

  it("reconhece SpreadsheetML 2003", () => {
    const xml =
      '<?xml version="1.0"?>\r\n<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet">';
    expect(detectarFormato(deTexto(xml))).toBe("XML");
  });

  it("trata CSV como texto", () => {
    const csv = "NOME DO CONFERENTE;PRODUTIVIDADE;QTDE. VOLUMES\nANA;802,26;5549";
    expect(detectarFormato(deTexto(csv))).toBe("TEXTO");
  });

  it("trata linha de .prc como texto", () => {
    const prc =
      "000001000123000045202608060931120000012345678PPI000101000000000012345000010";
    expect(detectarFormato(deTexto(prc))).toBe("TEXTO");
  });

  it("trata arquivo vazio como texto", () => {
    expect(detectarFormato(new Uint8Array(0))).toBe("TEXTO");
  });
});

describe("decodificarTexto", () => {
  it("decodifica UTF-8 com acento", () => {
    const utf8 = Uint8Array.from(Buffer.from("MEDICAMENTOS · SEÇÃO", "utf8"));
    expect(decodificarTexto(utf8)).toBe("MEDICAMENTOS · SEÇÃO");
  });

  it("remove BOM UTF-8", () => {
    const comBom = Uint8Array.from(Buffer.from("﻿NOME;ERRO", "utf8"));
    expect(decodificarTexto(comBom)).toBe("NOME;ERRO");
  });

  it("cai para windows-1252 quando os bytes não são UTF-8 válido", () => {
    const latin1 = Uint8Array.from(Buffer.from("SEÇÃO DE AVARIAS", "latin1"));
    expect(ehUtf8Valido(latin1)).toBe(false);
    expect(decodificarTexto(latin1)).toBe("SEÇÃO DE AVARIAS");
  });

  it("mapeia os bytes 0x80-0x9F próprios do windows-1252", () => {
    // 0x93 e 0x94 são aspas curvas no cp1252 (controle no latin-1 puro)
    expect(decodificarTexto(bytes(0x93, 0x41, 0x94))).toBe("“A”");
  });

  it("decodifica UTF-16 LE com BOM (exportação 'Texto Unicode' do Excel)", () => {
    const utf16 = Uint8Array.from(Buffer.from("﻿ÁREA", "utf16le"));
    expect(decodificarTexto(utf16)).toBe("ÁREA");
  });

  it("devolve vazio para arquivo vazio", () => {
    expect(decodificarTexto(new Uint8Array(0))).toBe("");
  });
});

describe("MHTML", () => {
  it("decodifica quoted-printable e emenda a quebra de continuação", () => {
    // `=` no fim da linha é soft line break: junta sem separador nenhum
    expect(decodificarQuotedPrintable("SE=C7=C3O DE AVA=\r\nRIAS")).toBe(
      "SEÇÃO DE AVARIAS",
    );
  });

  it("extrai a parte HTML de um MHTML", () => {
    const mhtml = [
      "MIME-Version: 1.0",
      'Content-Type: multipart/related; boundary="----=_Part_1"',
      "",
      "------=_Part_1",
      "Content-Type: text/html; charset=windows-1252",
      "Content-Transfer-Encoding: quoted-printable",
      "",
      "<table><tr><td>SE=C7=C3O</td></tr></table>",
      "------=_Part_1--",
    ].join("\r\n");

    const html = extrairHtmlDeMhtml(mhtml);
    expect(html).toContain("<table>");
    expect(html).toContain("SEÇÃO");
  });

  it("devolve null quando o arquivo já é HTML puro", () => {
    expect(extrairHtmlDeMhtml("<html><table></table></html>")).toBeNull();
  });
});

describe("descreverFormato", () => {
  it("dá nome legível para a mensagem de erro", () => {
    expect(descreverFormato("XLS")).toBe("planilha XLS");
    expect(descreverFormato("HTML")).toContain("Crystal Reports");
    expect(descreverFormato("TEXTO")).toBe("arquivo de texto");
  });
});
