/**
 * scannerPdfHtml.ts
 *
 * Monta o HTML que o expo-print transforma no PDF do lote escaneado.
 *
 * Miolo puro, sem IO e sem React Native, para caber no Jest do projeto
 * (`testMatch` só casa `**\/__tests__/**\/*.test.ts`) — a mesma separação já
 * usada em `fileImport` vs `spreadsheetReader`/`fileFormat`.
 *
 * Motivo de existir: o HTML vivia como template literal dentro de
 * `handleSharePdf`, com `@page { size: A4 portrait }` fixo. Folha deitada
 * (2480 × 1741 px, o relatório do Crystal impresso em paisagem) entrava numa
 * página em pé com 210 mm de largura e ~148 mm de altura, ancorada no topo:
 * metade de baixo da página em branco, que o usuário lê como "uma folha em
 * branco depois de cada folha".
 */

import { SCAN_FILTER_CSS } from "./scanFilter";

export type OrientacaoPagina = "retrato" | "paisagem";

/**
 * Uma folha já lida e pronta para virar página.
 *
 * `largura`/`altura` vêm de graça do `ImageManipulator`. Ausentes = a folha caiu
 * no fallback de leitura crua do arquivo; nesse caso ela não vota na orientação
 * do documento, mas continua sendo renderizada normalmente.
 */
export interface PaginaScan {
  base64: string;
  largura?: number;
  altura?: number;
}

export interface ResultadoPdfHtml {
  html: string;
  orientacao: OrientacaoPagina;
  /** Caixa da página em pontos — vai direto para o `printToFileAsync`. */
  width: number;
  height: number;
}

export interface OpcoesPdfHtml {
  /** Aplica o filtro P&B em CSS como segunda camada do modo documento. */
  modoDocumento: boolean;
  /** Força a orientação; ausente = decidida pelas dimensões das folhas. */
  orientacao?: OrientacaoPagina;
}

/** A4 a 72 dpi — o mesmo par de pontos que o Scanner sempre usou. */
export const A4 = {
  retrato: { width: 595, height: 842, larguraMm: 210, alturaMm: 297 },
  paisagem: { width: 842, height: 595, larguraMm: 297, alturaMm: 210 },
} as const;

/**
 * Orientação de uma folha. Quadrado conta como retrato — não há ganho em virar a
 * página. `null` quando falta dimensão: essa folha não participa da votação.
 */
export function orientacaoDaImagem(
  largura?: number,
  altura?: number,
): OrientacaoPagina | null {
  if (
    typeof largura !== "number" ||
    typeof altura !== "number" ||
    !Number.isFinite(largura) ||
    !Number.isFinite(altura) ||
    largura <= 0 ||
    altura <= 0
  ) {
    return null;
  }
  return largura > altura ? "paisagem" : "retrato";
}

/**
 * Orientação do documento inteiro, por maioria das folhas medidas.
 *
 * É do documento e não de cada página porque misturar tamanhos de página num
 * único PDF exigiria `@page` nomeadas, e no Android o tamanho físico vem do
 * `PrintAttributes` que o expo-print monta a partir de `width`/`height` — a
 * regra CSS nomeada não chega ao MediaBox. Folha da orientação minoritária sai
 * inteira e centralizada, com margem branca dos dois lados.
 *
 * Empate ou lote sem nenhuma dimensão → retrato (o formato de sempre).
 */
export function decidirOrientacao(paginas: PaginaScan[]): OrientacaoPagina {
  let paisagem = 0;
  let retrato = 0;
  for (const pagina of paginas) {
    const orientacao = orientacaoDaImagem(pagina.largura, pagina.altura);
    if (orientacao === "paisagem") paisagem += 1;
    else if (orientacao === "retrato") retrato += 1;
  }
  return paisagem > retrato ? "paisagem" : "retrato";
}

/** Monta o HTML do lote e a caixa de página que combina com ele. */
export function buildScannerPdfHtml(
  paginas: PaginaScan[],
  opcoes: OpcoesPdfHtml,
): ResultadoPdfHtml {
  const validas = paginas.filter(
    (pagina) => typeof pagina.base64 === "string" && pagina.base64.length > 0,
  );
  const orientacao = opcoes.orientacao ?? decidirOrientacao(validas);
  const medidas = A4[orientacao];

  /*
   * Segunda camada do modo documento. O filtro de pixels já entrega branco e
   * preto puros — grayscale/contraste sobre 0 e 255 não mexe nesses extremos —,
   * então aplicar aqui é inofensivo quando ele funcionou e salva a saída quando
   * o WebView falhou no aparelho.
   */
  const imgFilter = opcoes.modoDocumento
    ? `filter:${SCAN_FILTER_CSS};-webkit-filter:${SCAN_FILTER_CSS};`
    : "";

  const pagesHtml = validas
    .map((pagina, idx) => {
      // Quebra ANTES da página (exceto a 1ª). Nunca `page-break-after` no último
      // bloco — é ele que gera a página em branco extra no fim, no WebKit.
      const pageBreak =
        idx > 0
          ? "page-break-before:always;break-before:page;"
          : "page-break-before:auto;break-before:auto;";
      return `<div class="page" style="${pageBreak}">
  <img src="data:image/jpeg;base64,${pagina.base64}" alt="pagina-${idx + 1}" />
</div>`;
    })
    .join("\n");

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  @page { size: A4 ${orientacao === "paisagem" ? "landscape" : "portrait"}; margin: 0; }
  html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    background: #fff;
  }
  /*
   * Altura explícita 1mm menor que a página: com altura definida, o
   * arredondamento sub-pixel do Chromium empurraria o bloco para uma segunda
   * página em branco. A folga come 0,3% da folha e elimina o risco.
   */
  .page {
    width: 100%;
    height: ${medidas.alturaMm - 1}mm;
    margin: 0;
    padding: 0;
    overflow: hidden;
    page-break-inside: avoid;
    break-inside: avoid;
    box-sizing: border-box;
  }
  /*
   * A caixa do <img> é a página inteira e quem cuida da proporção é o
   * object-fit: contain — a folha enche a dimensão que trava primeiro e a folga
   * da outra fica dividida pelo object-position central. Isso mantém a folha da
   * orientação minoritária inteira e centralizada (em vez de jogar toda a sobra
   * para baixo, que era o que parecia "uma folha em branco embaixo") e blinda a
   * proporção contra o arredondamento da rasterização na hora de imprimir.
   */
  .page img {
    display: block;
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    border: 0;
    object-fit: contain;
    object-position: center center;
    ${imgFilter}
  }
</style>
</head>
<body>${pagesHtml}</body>
</html>`;

  return {
    html,
    orientacao,
    width: medidas.width,
    height: medidas.height,
  };
}
