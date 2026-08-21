import {
  A4,
  buildScannerPdfHtml,
  decidirOrientacao,
  orientacaoDaImagem,
  type PaginaScan,
} from "../scannerPdfHtml";
import { SCAN_FILTER_CSS } from "../scanFilter";

/** Dimensões reais do lote que originou o bug (relatório do Crystal deitado). */
const DEITADA = { largura: 2480, altura: 1741 };
/** A4 em pé a 300 dpi. */
const EM_PE = { largura: 2480, altura: 3508 };

const folha = (dims: { largura: number; altura: number } | null = null): PaginaScan =>
  dims ? { base64: "AAAA", ...dims } : { base64: "AAAA" };

const lote = (
  quantidade: number,
  dims: { largura: number; altura: number } | null,
): PaginaScan[] => Array.from({ length: quantidade }, () => folha(dims));

describe("orientacaoDaImagem", () => {
  it("classifica deitada, em pé e quadrada", () => {
    expect(orientacaoDaImagem(2480, 1741)).toBe("paisagem");
    expect(orientacaoDaImagem(2480, 3508)).toBe("retrato");
    // Quadrado não ganha nada virando a página
    expect(orientacaoDaImagem(2000, 2000)).toBe("retrato");
  });

  it("devolve null quando não há dimensão utilizável", () => {
    expect(orientacaoDaImagem(undefined, undefined)).toBeNull();
    expect(orientacaoDaImagem(2480, undefined)).toBeNull();
    expect(orientacaoDaImagem(0, 100)).toBeNull();
    expect(orientacaoDaImagem(Number.NaN, 100)).toBeNull();
  });
});

describe("decidirOrientacao", () => {
  it("segue a maioria do lote", () => {
    expect(decidirOrientacao([...lote(3, DEITADA), folha(EM_PE)])).toBe("paisagem");
    expect(decidirOrientacao([...lote(3, EM_PE), folha(DEITADA)])).toBe("retrato");
  });

  it("empate cai em retrato", () => {
    expect(decidirOrientacao([...lote(2, DEITADA), ...lote(2, EM_PE)])).toBe("retrato");
  });

  it("lote sem nenhuma dimensão cai em retrato", () => {
    expect(decidirOrientacao(lote(4, null))).toBe("retrato");
    expect(decidirOrientacao([])).toBe("retrato");
  });

  it("só quem tem dimensão vota", () => {
    // Uma folha medida e deitada; as outras vieram do fallback de leitura crua
    expect(decidirOrientacao([folha(DEITADA), ...lote(3, null)])).toBe("paisagem");
  });
});

describe("buildScannerPdfHtml — orientação da página", () => {
  it("lote deitado sai em A4 paisagem, no CSS e na caixa da página", () => {
    const resultado = buildScannerPdfHtml(lote(16, DEITADA), { modoDocumento: true });

    expect(resultado.orientacao).toBe("paisagem");
    expect(resultado.width).toBe(842);
    expect(resultado.height).toBe(595);
    expect(resultado.html).toContain("@page { size: A4 landscape; margin: 0; }");
    // Altura da página menos 1mm de folga contra o arredondamento do Chromium
    expect(resultado.html).toContain(`height: ${A4.paisagem.alturaMm - 1}mm;`);
  });

  it("lote em pé continua em A4 retrato (regressão)", () => {
    const resultado = buildScannerPdfHtml(lote(16, EM_PE), { modoDocumento: true });

    expect(resultado.orientacao).toBe("retrato");
    expect(resultado.width).toBe(595);
    expect(resultado.height).toBe(842);
    expect(resultado.html).toContain("@page { size: A4 portrait; margin: 0; }");
    expect(resultado.html).toContain(`height: ${A4.retrato.alturaMm - 1}mm;`);
  });

  it("a opção orientacao vence a votação", () => {
    const resultado = buildScannerPdfHtml(lote(4, DEITADA), {
      modoDocumento: false,
      orientacao: "retrato",
    });

    expect(resultado.orientacao).toBe("retrato");
    expect(resultado.width).toBe(595);
    expect(resultado.html).toContain("size: A4 portrait");
  });

  it("nunca ancora a folha no topo — a sobra fica centralizada", () => {
    for (const dims of [DEITADA, EM_PE]) {
      const { html } = buildScannerPdfHtml(lote(2, dims), { modoDocumento: false });
      expect(html).not.toContain("object-position: top");
      expect(html).toContain("object-fit: contain;");
      expect(html).toContain("object-position: center center;");
    }
  });
});

describe("buildScannerPdfHtml — páginas", () => {
  it("uma folha = uma página, com N-1 quebras", () => {
    const { html } = buildScannerPdfHtml(lote(16, DEITADA), { modoDocumento: true });

    expect(html.match(/class="page"/g)).toHaveLength(16);
    expect(html.match(/page-break-before:always/g)).toHaveLength(15);
  });

  it("folha única não leva quebra de página", () => {
    const { html } = buildScannerPdfHtml([folha(DEITADA)], { modoDocumento: true });

    expect(html.match(/class="page"/g)).toHaveLength(1);
    expect(html).not.toContain("page-break-before:always");
  });

  it("nunca usa page-break-after (era ele que gerava a página em branco no fim)", () => {
    const { html } = buildScannerPdfHtml(lote(3, DEITADA), { modoDocumento: true });
    expect(html).not.toContain("page-break-after");
  });

  it("descarta folha sem base64 e mantém a ordem recebida", () => {
    const { html } = buildScannerPdfHtml(
      [
        { base64: "PRIMEIRA", ...DEITADA },
        { base64: "", ...DEITADA },
        { base64: "SEGUNDA", ...DEITADA },
      ],
      { modoDocumento: false },
    );

    expect(html.match(/class="page"/g)).toHaveLength(2);
    expect(html.indexOf("PRIMEIRA")).toBeLessThan(html.indexOf("SEGUNDA"));
    expect(html).toContain('alt="pagina-1"');
    expect(html).toContain('alt="pagina-2"');
    expect(html).not.toContain('alt="pagina-3"');
  });

  it("lista vazia não quebra e sai sem páginas", () => {
    const resultado = buildScannerPdfHtml([], { modoDocumento: true });

    expect(resultado.orientacao).toBe("retrato");
    expect(resultado.html).not.toContain('class="page"');
    expect(resultado.html).toContain("<body></body>");
  });
});

describe("buildScannerPdfHtml — modo documento", () => {
  it("injeta o filtro P&B em CSS quando ligado", () => {
    const { html } = buildScannerPdfHtml(lote(2, DEITADA), { modoDocumento: true });

    expect(html).toContain(`filter:${SCAN_FILTER_CSS};`);
    expect(html).toContain(`-webkit-filter:${SCAN_FILTER_CSS};`);
  });

  it("omite o filtro quando desligado", () => {
    const { html } = buildScannerPdfHtml(lote(2, DEITADA), { modoDocumento: false });

    expect(html).not.toContain("grayscale(1)");
    expect(html).not.toContain("-webkit-filter:");
  });
});
