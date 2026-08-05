import {
  base64DeDataUri,
  base64Seguro,
  buildScanFilterHtml,
  parseScanFilterMensagem,
  SCAN_FILTER_ALGORITMO,
  SCAN_FILTER_CSS,
  SCAN_FILTER_PADRAO,
  type ScanFilterConfig,
} from "../scanFilter";

/**
 * Avalia a MESMA string injetada no WebView. Se o algoritmo quebrar em
 * produção, quebra aqui — não há cópia paralela para sair de sincronia.
 */
const aplicarFiltroDocumento = new Function(
  "data",
  "width",
  "height",
  "config",
  `${SCAN_FILTER_ALGORITMO}\nreturn aplicarFiltroDocumento(data, width, height, config);`,
) as (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  config: ScanFilterConfig,
) => Uint8ClampedArray;

interface Pixel {
  r: number;
  g: number;
  b: number;
}

const PAPEL: Pixel = { r: 250, g: 249, b: 245 };

/** Monta um RGBA de papel e deixa pintar regiões. */
function novaImagem(
  width: number,
  height: number,
  fundo: Pixel = PAPEL,
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = fundo.r;
    data[i * 4 + 1] = fundo.g;
    data[i * 4 + 2] = fundo.b;
    data[i * 4 + 3] = 255;
  }
  return data;
}

function pintarRetangulo(
  data: Uint8ClampedArray,
  width: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  cor: Pixel,
): void {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const p = (y * width + x) * 4;
      data[p] = cor.r;
      data[p + 1] = cor.g;
      data[p + 2] = cor.b;
    }
  }
}

function pixelEm(
  data: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
): Pixel {
  const p = (y * width + x) * 4;
  return { r: data[p], g: data[p + 1], b: data[p + 2] };
}

/** Um pixel é neutro quando R = G = B (nenhum matiz sobrou). */
function ehNeutro(px: Pixel): boolean {
  return px.r === px.g && px.g === px.b;
}

function todosNeutros(data: Uint8ClampedArray): boolean {
  for (let p = 0; p < data.length; p += 4) {
    if (data[p] !== data[p + 1] || data[p + 1] !== data[p + 2]) return false;
  }
  return true;
}

describe("scanFilter — algoritmo de documento", () => {
  const W = 120;
  const H = 120;

  it("caneta azul vira tinta escura e neutra, sem resíduo de cor", () => {
    const data = novaImagem(W, H);
    // traço de caneta esferográfica azul
    pintarRetangulo(data, W, 40, 50, 80, 56, { r: 30, g: 55, b: 160 });

    aplicarFiltroDocumento(data, W, H, SCAN_FILTER_PADRAO);

    const traco = pixelEm(data, W, 60, 53);
    expect(ehNeutro(traco)).toBe(true);
    expect(traco.r).toBeLessThan(60);
    expect(todosNeutros(data)).toBe(true);
  });

  it("caneta vermelha também escurece — luma sozinha deixaria clara", () => {
    const data = novaImagem(W, H);
    pintarRetangulo(data, W, 30, 60, 90, 66, { r: 200, g: 30, b: 40 });

    aplicarFiltroDocumento(data, W, H, SCAN_FILTER_PADRAO);

    const traco = pixelEm(data, W, 60, 63);
    expect(ehNeutro(traco)).toBe(true);
    expect(traco.r).toBeLessThan(60);
  });

  it("caneta verde e marca-texto amarelo perdem o matiz", () => {
    const data = novaImagem(W, H);
    pintarRetangulo(data, W, 20, 30, 100, 36, { r: 20, g: 140, b: 60 });
    pintarRetangulo(data, W, 20, 80, 100, 90, { r: 250, g: 240, b: 60 });

    aplicarFiltroDocumento(data, W, H, SCAN_FILTER_PADRAO);

    expect(ehNeutro(pixelEm(data, W, 60, 33))).toBe(true);
    expect(pixelEm(data, W, 60, 33).r).toBeLessThan(60);
    // o amarelo pode virar branco ou cinza, mas nunca continuar amarelo
    expect(ehNeutro(pixelEm(data, W, 60, 85))).toBe(true);
    expect(todosNeutros(data)).toBe(true);
  });

  it("papel limpo vira branco puro (sem fundo acinzentado)", () => {
    const data = novaImagem(W, H);
    aplicarFiltroDocumento(data, W, H, SCAN_FILTER_PADRAO);
    expect(pixelEm(data, W, 10, 10)).toEqual({ r: 255, g: 255, b: 255 });
    expect(pixelEm(data, W, 119, 119)).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("sombra da captura não vira mancha cinza no PDF", () => {
    const data = novaImagem(W, H);
    // gradiente de iluminação: canto direito bem mais escuro
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const queda = Math.round((x / W) * 90);
        const p = (y * W + x) * 4;
        data[p] = PAPEL.r - queda;
        data[p + 1] = PAPEL.g - queda;
        data[p + 2] = PAPEL.b - queda;
      }
    }
    pintarRetangulo(data, W, 100, 50, 110, 56, { r: 20, g: 20, b: 25 });

    aplicarFiltroDocumento(data, W, H, SCAN_FILTER_PADRAO);

    // papel na região sombreada continua branco
    expect(pixelEm(data, W, 105, 20).r).toBe(255);
    // e o texto dentro da sombra continua legível (preto)
    expect(pixelEm(data, W, 105, 53).r).toBeLessThan(60);
  });

  it("área grande totalmente preenchida continua preta (não inverte)", () => {
    const data = novaImagem(W, H);
    pintarRetangulo(data, W, 20, 20, 100, 100, { r: 25, g: 25, b: 30 });

    aplicarFiltroDocumento(data, W, H, SCAN_FILTER_PADRAO);

    // o centro do bloco é o caso em que limiar adaptativo puro falharia
    expect(pixelEm(data, W, 60, 60).r).toBe(0);
    expect(pixelEm(data, W, 5, 5).r).toBe(255);
  });

  it("é idempotente: refiltrar uma folha já em P&B não degrada", () => {
    const data = novaImagem(W, H);
    pintarRetangulo(data, W, 40, 50, 80, 56, { r: 30, g: 55, b: 160 });

    aplicarFiltroDocumento(data, W, H, SCAN_FILTER_PADRAO);
    const primeira = Uint8ClampedArray.from(data);
    aplicarFiltroDocumento(data, W, H, SCAN_FILTER_PADRAO);

    expect(Array.from(data)).toEqual(Array.from(primeira));
  });

  it("imagem vazia não quebra", () => {
    expect(() =>
      aplicarFiltroDocumento(new Uint8ClampedArray(0), 0, 0, SCAN_FILTER_PADRAO),
    ).not.toThrow();
  });
});

describe("scanFilter — ponte com o WebView", () => {
  it("o HTML embute o algoritmo, a config e o gatilho", () => {
    const html = buildScanFilterHtml();
    expect(html).toContain("aplicarFiltroDocumento");
    expect(html).toContain("window.__filtrarFolha");
    expect(html).toContain(`"maxDimensao":${SCAN_FILTER_PADRAO.maxDimensao}`);
    expect(html).toContain("__pronto__");
  });

  it("parseScanFilterMensagem entende sucesso, falha e lixo", () => {
    expect(
      parseScanFilterMensagem(JSON.stringify({ id: "f1", ok: true, base64: "AAA" })),
    ).toEqual({ id: "f1", ok: true, base64: "AAA" });

    expect(
      parseScanFilterMensagem(JSON.stringify({ id: "f2", ok: false, erro: "x" })),
    ).toEqual({ id: "f2", ok: false, erro: "x" });

    expect(parseScanFilterMensagem("não é json")).toBeNull();
    expect(parseScanFilterMensagem(JSON.stringify({ ok: true }))).toBeNull();
  });

  it("base64Seguro barra payload que escaparia da string injetada", () => {
    expect(base64Seguro("QUJD/+abc=")).toBe(true);
    expect(base64Seguro('QUJD");alert(1);//')).toBe(false);
    expect(base64Seguro("")).toBe(false);
  });

  it("base64DeDataUri aceita data URI e base64 cru", () => {
    expect(base64DeDataUri("data:image/jpeg;base64,QUJD")).toBe("QUJD");
    expect(base64DeDataUri("QUJD")).toBe("QUJD");
  });

  it("o filtro CSS de fallback remove a cor", () => {
    expect(SCAN_FILTER_CSS).toContain("grayscale(1)");
  });
});
