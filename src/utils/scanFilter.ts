/**
 * Filtro "folha escaneada": converte a foto da folha em preto e branco neutro.
 *
 * Problema que resolve: o plugin de scanner devolve a imagem colorida, então
 * preenchimento feito com caneta azul/vermelha/verde continua aparecendo
 * colorido no PDF. Um scanner de verdade em modo documento entrega papel
 * branco e tinta preta, seja qual for a cor da caneta.
 *
 * O algoritmo roda dentro de um WebView (canvas 2D) porque nem o
 * expo-image-manipulator nem o plugin de scanner expõem operações de cor.
 * Por isso ele vive aqui como **fonte em string**: o Hermes descarta o corpo
 * das funções em Function.prototype.toString(), então não há como serializar
 * uma função TS em runtime. Os testes avaliam esta mesma string via
 * `new Function`, garantindo que o testado é exatamente o que roda no aparelho.
 */

export interface ScanFilterConfig {
  /** Lado maior da imagem processada, em px (A4 a ~240dpi). */
  maxDimensao: number;
  /** Raio da janela do limiar adaptativo, como fração do lado maior. */
  janelaRelativa: number;
  /** Quanto o limiar fica abaixo da média local (0–1). Maior = mais tinta. */
  agressividade: number;
  /** Largura da rampa suave em torno do limiar (níveis 0–255). */
  suavizacao: number;
  /** Acima desta fração do branco do papel, force branco puro (mata sombra). */
  pisoPapel: number;
  /** Abaixo desta fração do branco do papel, force preto puro (tinta forte). */
  tetoTinta: number;
  /** Qualidade do JPEG de saída (0–1). */
  qualidade: number;
}

export const SCAN_FILTER_PADRAO: ScanFilterConfig = {
  maxDimensao: 2000,
  janelaRelativa: 0.02,
  agressividade: 0.14,
  suavizacao: 10,
  pisoPapel: 0.86,
  tetoTinta: 0.45,
  qualidade: 0.9,
};

/**
 * Fallback em CSS aplicado no HTML do PDF.
 *
 * Vale mesmo quando o filtro de pixels funcionou: a saída dele já é branco/preto
 * puro, e grayscale + contraste sobre 0/255 não altera esses extremos. Se o
 * WebView falhar no aparelho, este filtro sozinho já tira a cor da caneta.
 */
export const SCAN_FILTER_CSS = "grayscale(1) brightness(1.06) contrast(2.4)";

/**
 * Núcleo do filtro, em JS puro (ES5-safe para rodar em qualquer WebView).
 * Recebe o RGBA do canvas e o reescreve in-place em tons neutros.
 */
export const SCAN_FILTER_ALGORITMO = `
function aplicarFiltroDocumento(data, width, height, config) {
  var total = width * height;
  if (total === 0) return data;

  // 1) Canal de tinta = min(R,G,B). Descarta o matiz: caneta azul, vermelha ou
  //    verde fica tão escura quanto caneta preta, enquanto papel (R≈G≈B) passa
  //    praticamente igual ao cinza. É isso que elimina a cor residual.
  var tinta = new Uint8Array(total);
  var histograma = new Uint32Array(256);
  for (var i = 0, p = 0; i < total; i++, p += 4) {
    var r = data[p], g = data[p + 1], b = data[p + 2];
    var m = r < g ? r : g;
    if (b < m) m = b;
    tinta[i] = m;
    histograma[m]++;
  }

  // 2) Branco do papel = percentil 90 (robusto a folha suja ou mal iluminada).
  var alvo = Math.floor(total * 0.9);
  var acumulado = 0;
  var branco = 255;
  for (var nivel = 0; nivel < 256; nivel++) {
    acumulado += histograma[nivel];
    if (acumulado >= alvo) { branco = nivel; break; }
  }
  if (branco < 32) branco = 32;

  // 3) Imagem integral: média local em O(1) por pixel.
  var iw = width + 1;
  var integral = new Uint32Array(iw * (height + 1));
  for (var y = 0; y < height; y++) {
    var linha = 0;
    for (var x = 0; x < width; x++) {
      linha += tinta[y * width + x];
      integral[(y + 1) * iw + (x + 1)] = integral[y * iw + (x + 1)] + linha;
    }
  }

  var raio = Math.round(Math.max(width, height) * config.janelaRelativa);
  if (raio < 8) raio = 8;
  var k = config.agressividade;
  var rampa = config.suavizacao > 1 ? config.suavizacao : 1;
  var piso = branco * config.pisoPapel;
  var teto = branco * config.tetoTinta;

  for (var yy = 0; yy < height; yy++) {
    var y0 = yy - raio; if (y0 < 0) y0 = 0;
    var y1 = yy + raio; if (y1 > height - 1) y1 = height - 1;
    for (var xx = 0; xx < width; xx++) {
      var v = tinta[yy * width + xx];
      var saida;
      if (v >= piso) {
        // Papel: branco puro. Mata sombra suave, granulado e fundo amarelado.
        saida = 255;
      } else if (v <= teto) {
        // Tinta escura em termos absolutos — nunca vira fundo, mesmo dentro de
        // áreas grandes preenchidas (onde a média local também é escura).
        saida = 0;
      } else {
        var x0 = xx - raio; if (x0 < 0) x0 = 0;
        var x1 = xx + raio; if (x1 > width - 1) x1 = width - 1;
        var area = (x1 - x0 + 1) * (y1 - y0 + 1);
        var soma = integral[(y1 + 1) * iw + (x1 + 1)]
          - integral[y0 * iw + (x1 + 1)]
          - integral[(y1 + 1) * iw + x0]
          + integral[y0 * iw + x0];
        var limiar = (soma / area) * (1 - k);
        if (v >= limiar + rampa) {
          saida = 255;
        } else if (v <= limiar - rampa) {
          saida = 0;
        } else {
          // Rampa suave: bordas de letra sem serrilhado (scanner real não é 1-bit)
          saida = Math.round(((v - (limiar - rampa)) / (2 * rampa)) * 255);
        }
      }
      var q = (yy * width + xx) * 4;
      data[q] = saida;
      data[q + 1] = saida;
      data[q + 2] = saida;
      data[q + 3] = 255;
    }
  }
  return data;
}
`;

/** Mensagem devolvida pelo WebView do filtro. */
export type ScanFilterMensagem =
  | { id: string; ok: true; base64: string }
  | { id: string; ok: false; erro: string };

/** Interpreta o payload do onMessage sem deixar exceção escapar. */
export function parseScanFilterMensagem(raw: string): ScanFilterMensagem | null {
  try {
    const parsed = JSON.parse(raw) as Partial<ScanFilterMensagem>;
    if (!parsed || typeof parsed.id !== "string") return null;
    if (parsed.ok === true && typeof parsed.base64 === "string") {
      return { id: parsed.id, ok: true, base64: parsed.base64 };
    }
    return {
      id: parsed.id,
      ok: false,
      erro: typeof (parsed as { erro?: string }).erro === "string"
        ? (parsed as { erro: string }).erro
        : "Falha desconhecida no filtro.",
    };
  } catch {
    return null;
  }
}

/** Extrai o base64 de um data URI (ou devolve a string se já for base64). */
export function base64DeDataUri(dataUri: string): string {
  const virgula = dataUri.indexOf(",");
  return virgula >= 0 ? dataUri.slice(virgula + 1) : dataUri;
}

/**
 * Base64 só tem A-Z a-z 0-9 + / = — nenhum caractere que quebre aspas duplas.
 * Ainda assim validamos antes de injetar como código no WebView.
 */
export function base64Seguro(base64: string): boolean {
  return base64.length > 0 && /^[A-Za-z0-9+/=\s]+$/.test(base64);
}

/** Documento do WebView que executa o filtro. */
export function buildScanFilterHtml(
  config: ScanFilterConfig = SCAN_FILTER_PADRAO,
): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;background:#fff">
<script>
var CONFIG = ${JSON.stringify(config)};
${SCAN_FILTER_ALGORITMO}
function responder(payload) {
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify(payload));
  }
}
function filtrar(id, base64) {
  try {
    var img = new Image();
    img.onload = function () {
      try {
        var w = img.width, h = img.height;
        var maior = w > h ? w : h;
        if (maior > CONFIG.maxDimensao) {
          var escala = CONFIG.maxDimensao / maior;
          w = Math.round(w * escala);
          h = Math.round(h * escala);
        }
        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        var imageData = ctx.getImageData(0, 0, w, h);
        aplicarFiltroDocumento(imageData.data, w, h, CONFIG);
        ctx.putImageData(imageData, 0, 0);
        var saida = canvas.toDataURL('image/jpeg', CONFIG.qualidade);
        responder({ id: id, ok: true, base64: saida.slice(saida.indexOf(',') + 1) });
      } catch (e) {
        responder({ id: id, ok: false, erro: 'Falha ao processar: ' + e });
      }
    };
    img.onerror = function () {
      responder({ id: id, ok: false, erro: 'Imagem inválida.' });
    };
    img.src = 'data:image/jpeg;base64,' + base64;
  } catch (e) {
    responder({ id: id, ok: false, erro: 'Falha inesperada: ' + e });
  }
}
window.__filtrarFolha = filtrar;
responder({ id: '__pronto__', ok: true, base64: '' });
</script>
</body>
</html>`;
}
