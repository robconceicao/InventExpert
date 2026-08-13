/**
 * Reconhecimento de arquivo pelo CONTEÚDO — nunca pela extensão.
 *
 * Motivo: os arquivos do inventário chegam por WhatsApp, e-mail, cartão SD e
 * pastas do coletor. O provedor do Android entrega quase sempre
 * `application/octet-stream` e, quando o picker copia para o cache, o nome pode
 * vir sem extensão. Decidir "é planilha ou é texto" pela extensão faz um
 * PRODUÇÃO.xls válido ser lido como texto (vira lixo binário) e um .prc ser
 * lido como planilha (falha na abertura).
 *
 * Aqui a decisão é tomada pelos magic bytes / assinatura do conteúdo, do mesmo
 * jeito que o `file(1)` faz. Módulo puro: sem React Native, sem expo — para
 * poder ser testado direto no Jest.
 */

export type FormatoArquivo =
  /** OOXML (.xlsx / .xlsm) — contêiner ZIP */
  | "XLSX"
  /** BIFF / CFB — Excel 97-2003 (.xls) e BIFF2-5 antigos */
  | "XLS"
  /** Tabela HTML (ou MHTML) salva com extensão .xls — export do Crystal Reports */
  | "HTML"
  /** SpreadsheetML 2003 (XML do Excel) */
  | "XML"
  /** CSV, TXT, PRC, OLD — qualquer coisa que seja texto */
  | "TEXTO";

/** Quantos bytes bastam para identificar a assinatura de um arquivo. */
export const BYTES_DE_DETECCAO = 4096;

const TABELA_BASE64 = (() => {
  const alfabeto =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const tabela = new Int16Array(256).fill(-1);
  for (let i = 0; i < alfabeto.length; i += 1) {
    tabela[alfabeto.charCodeAt(i)] = i;
  }
  tabela["-".charCodeAt(0)] = 62; // base64url
  tabela["_".charCodeAt(0)] = 63;
  return tabela;
})();

/**
 * Decodifica base64 (tolerante a quebras de linha, padding e base64url).
 *
 * @param maxBytes limite de bytes a produzir — usar `BYTES_DE_DETECCAO` quando
 *   só se quer a assinatura, para não decodificar 6 MB à toa.
 */
export function decodeBase64(
  base64: string,
  maxBytes: number = Number.POSITIVE_INFINITY,
): Uint8Array {
  const limite = Math.max(0, maxBytes);
  if (limite === 0 || base64.length === 0) return new Uint8Array(0);

  const capacidade = Math.min(Math.ceil((base64.length * 3) / 4) + 3, limite);
  const saida = new Uint8Array(capacidade);

  let escritos = 0;
  let acumulador = 0;
  let bits = 0;

  for (let i = 0; i < base64.length && escritos < limite; i += 1) {
    const codigo = base64.charCodeAt(i);
    const valor = codigo < 256 ? TABELA_BASE64[codigo] : -1;
    if (valor < 0) continue; // espaço, \n, '=' ou lixo: ignora

    acumulador = (acumulador << 6) | valor;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      saida[escritos] = (acumulador >> bits) & 0xff;
      escritos += 1;
    }
  }

  return saida.subarray(0, escritos);
}

/** Converte bytes em string 1:1 (latin-1 puro) — usado para farejar assinatura. */
export function bytesParaLatin1(bytes: Uint8Array): string {
  const PEDACO = 8192;
  let texto = "";
  for (let i = 0; i < bytes.length; i += PEDACO) {
    const fatia = bytes.subarray(i, i + PEDACO);
    texto += String.fromCharCode.apply(
      null,
      Array.prototype.slice.call(fatia) as number[],
    );
  }
  return texto;
}

/** Bytes 0x80–0x9F do windows-1252 que não existem no latin-1 puro. */
const CP1252_ALTO: Record<number, number> = {
  0x80: 0x20ac, 0x82: 0x201a, 0x83: 0x0192, 0x84: 0x201e, 0x85: 0x2026,
  0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02c6, 0x89: 0x2030, 0x8a: 0x0160,
  0x8b: 0x2039, 0x8c: 0x0152, 0x8e: 0x017d, 0x91: 0x2018, 0x92: 0x2019,
  0x93: 0x201c, 0x94: 0x201d, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014,
  0x98: 0x02dc, 0x99: 0x2122, 0x9a: 0x0161, 0x9b: 0x203a, 0x9c: 0x0153,
  0x9e: 0x017e, 0x9f: 0x0178,
};

function decodificarCp1252(bytes: Uint8Array): string {
  const PEDACO = 8192;
  const partes: string[] = [];
  const buffer: number[] = [];
  for (let i = 0; i < bytes.length; i += 1) {
    const b = bytes[i];
    buffer.push(b >= 0x80 && b <= 0x9f ? (CP1252_ALTO[b] ?? b) : b);
    if (buffer.length >= PEDACO) {
      partes.push(String.fromCharCode.apply(null, buffer));
      buffer.length = 0;
    }
  }
  if (buffer.length) partes.push(String.fromCharCode.apply(null, buffer));
  return partes.join("");
}

/** Verifica se a sequência de bytes é UTF-8 bem formado. */
export function ehUtf8Valido(bytes: Uint8Array): boolean {
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i];
    if (b < 0x80) {
      i += 1;
      continue;
    }

    let continuacoes: number;
    let minimo: number;
    let ponto: number;

    if (b >= 0xc2 && b <= 0xdf) {
      continuacoes = 1;
      minimo = 0x80;
      ponto = b & 0x1f;
    } else if (b >= 0xe0 && b <= 0xef) {
      continuacoes = 2;
      minimo = 0x800;
      ponto = b & 0x0f;
    } else if (b >= 0xf0 && b <= 0xf4) {
      continuacoes = 3;
      minimo = 0x10000;
      ponto = b & 0x07;
    } else {
      return false; // 0x80-0xC1 e 0xF5-0xFF nunca iniciam sequência
    }

    if (i + continuacoes >= bytes.length) return false; // sequência truncada

    for (let j = 1; j <= continuacoes; j += 1) {
      const seguinte = bytes[i + j];
      if ((seguinte & 0xc0) !== 0x80) return false;
      ponto = (ponto << 6) | (seguinte & 0x3f);
    }

    if (ponto < minimo) return false; // overlong
    if (ponto > 0x10ffff) return false;
    if (ponto >= 0xd800 && ponto <= 0xdfff) return false; // surrogate

    i += continuacoes + 1;
  }
  return true;
}

function decodificarUtf8(bytes: Uint8Array): string {
  const PEDACO = 8192;
  const partes: string[] = [];
  const buffer: number[] = [];

  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i];
    let ponto: number;

    if (b < 0x80) {
      ponto = b;
      i += 1;
    } else if (b < 0xe0) {
      ponto = ((b & 0x1f) << 6) | (bytes[i + 1] & 0x3f);
      i += 2;
    } else if (b < 0xf0) {
      ponto =
        ((b & 0x0f) << 12) |
        ((bytes[i + 1] & 0x3f) << 6) |
        (bytes[i + 2] & 0x3f);
      i += 3;
    } else {
      ponto =
        ((b & 0x07) << 18) |
        ((bytes[i + 1] & 0x3f) << 12) |
        ((bytes[i + 2] & 0x3f) << 6) |
        (bytes[i + 3] & 0x3f);
      i += 4;
    }

    if (ponto > 0xffff) {
      const resto = ponto - 0x10000;
      buffer.push(0xd800 + (resto >> 10), 0xdc00 + (resto & 0x3ff));
    } else {
      buffer.push(ponto);
    }

    if (buffer.length >= PEDACO) {
      partes.push(String.fromCharCode.apply(null, buffer));
      buffer.length = 0;
    }
  }

  if (buffer.length) partes.push(String.fromCharCode.apply(null, buffer));
  return partes.join("");
}

/**
 * Decodifica texto sem depender de o arquivo declarar o encoding.
 *
 * Tenta UTF-8 (é o formato dos CSV modernos); se os bytes não forem UTF-8
 * válido, cai para windows-1252 — que é o encoding do `cadastro.txt`, do
 * `invent_DSP.old` e dos exports do Crystal Reports. Sem esse fallback,
 * "SEÇÃO" chega como "SE?ÃO" e `normalizarNomeArea()` não encontra a área.
 */
export function decodificarTexto(bytes: Uint8Array): string {
  if (bytes.length === 0) return "";

  // BOM UTF-8
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return decodificarUtf8(bytes.subarray(3));
  }
  // BOM UTF-16 LE / BE — raro, mas o Excel exporta assim em "Texto Unicode"
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return decodificarUtf16(bytes.subarray(2), true);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return decodificarUtf16(bytes.subarray(2), false);

  return ehUtf8Valido(bytes) ? decodificarUtf8(bytes) : decodificarCp1252(bytes);
}

function decodificarUtf16(bytes: Uint8Array, littleEndian: boolean): string {
  const PEDACO = 8192;
  const partes: string[] = [];
  const buffer: number[] = [];
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    buffer.push(
      littleEndian
        ? bytes[i] | (bytes[i + 1] << 8)
        : (bytes[i] << 8) | bytes[i + 1],
    );
    if (buffer.length >= PEDACO) {
      partes.push(String.fromCharCode.apply(null, buffer));
      buffer.length = 0;
    }
  }
  if (buffer.length) partes.push(String.fromCharCode.apply(null, buffer));
  return partes.join("");
}

/**
 * Extensão em minúsculas, a partir do nome do arquivo OU da URI.
 *
 * Trata URI percent-encoded (`PROD_SE%C3%87%C3%83O.xlsx`), query string
 * (`?token=...`), fragmento e `content://` sem extensão (retorna "").
 * Só serve para mensagens e desempate — a decisão real é por conteúdo.
 */
export function extrairExtensao(nomeOuUri: string): string {
  if (!nomeOuUri) return "";

  const semQuery = nomeOuUri.split("?")[0].split("#")[0];
  let decodificado = semQuery;
  try {
    decodificado = decodeURIComponent(semQuery);
  } catch {
    // percent-encoding inválido: segue com o texto cru
  }

  const base = decodificado.split(/[\\/]/).pop() ?? "";
  const ponto = base.lastIndexOf(".");
  if (ponto <= 0 || ponto === base.length - 1) return "";

  const extensao = base.slice(ponto + 1).toLowerCase();
  // "06.08.2026" ou pastas com ponto não são extensão
  if (extensao.length > 10 || /[\s\\/]/.test(extensao)) return "";
  return extensao;
}

/**
 * Identifica o formato pelos primeiros bytes do arquivo.
 *
 * Basta passar `BYTES_DE_DETECCAO` bytes; o resto do arquivo é irrelevante.
 */
export function detectarFormato(bytes: Uint8Array): FormatoArquivo {
  if (bytes.length === 0) return "TEXTO";

  // ZIP (PK\x03\x04) — xlsx/xlsm/ods
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    return "XLSX";
  }
  // Compound File Binary (D0 CF 11 E0 A1 B1 1A E1) — xls 97-2003
  if (
    bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0 &&
    bytes[4] === 0xa1 && bytes[5] === 0xb1 && bytes[6] === 0x1a && bytes[7] === 0xe1
  ) {
    return "XLS";
  }
  // BIFF2/3/4/5 cru: registro BOF 0x0009 / 0x0209 / 0x0409 / 0x0809
  if (
    bytes[0] === 0x09 &&
    (bytes[1] === 0x00 || bytes[1] === 0x02 || bytes[1] === 0x04 || bytes[1] === 0x08)
  ) {
    return "XLS";
  }

  const inicio = bytesParaLatin1(bytes.subarray(0, BYTES_DE_DETECCAO))
    .replace(/^﻿/, "")
    .trimStart();
  const minusculo = inicio.toLowerCase();

  // MHTML: o "Excel" do Crystal Reports costuma ser multipart com HTML dentro
  if (/^mime-version\s*:/i.test(inicio) || minusculo.includes("content-type: multipart/related")) {
    return "HTML";
  }

  if (minusculo.startsWith("<?xml")) {
    return minusculo.includes("spreadsheet") || minusculo.includes("<workbook")
      ? "XML"
      : minusculo.includes("<table") || minusculo.includes("<html")
        ? "HTML"
        : "XML";
  }

  if (
    minusculo.startsWith("<!doctype html") ||
    minusculo.startsWith("<html") ||
    minusculo.startsWith("<table") ||
    /<table[\s>]/.test(minusculo) ||
    /<html[\s>]/.test(minusculo)
  ) {
    return "HTML";
  }

  return "TEXTO";
}

/** Decodifica quoted-printable (`=E7`, `=\n` de continuação). */
export function decodificarQuotedPrintable(texto: string): string {
  return texto
    .replace(/=(?:\r\n|\n|\r)/g, "")
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex: string) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
}

/**
 * Extrai a parte HTML de um arquivo MHTML (multipart/related).
 *
 * Retorna `null` quando o texto não é MHTML — aí ele já é o HTML final.
 */
export function extrairHtmlDeMhtml(texto: string): string | null {
  const ehMhtml =
    /^﻿?\s*mime-version\s*:/i.test(texto) ||
    /content-type:\s*multipart\/related/i.test(texto);
  if (!ehMhtml) return null;

  const limite = texto.match(/boundary\s*=\s*"?([^"\r\n;]+)"?/i)?.[1];
  const partes = limite
    ? texto.split(new RegExp(`--${limite.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`))
    : [texto];

  for (const parte of partes) {
    if (!/content-type:\s*text\/html/i.test(parte)) continue;

    const separador = parte.search(/\r\n\r\n|\n\n/);
    const corpo = separador >= 0 ? parte.slice(separador).replace(/^\s+/, "") : parte;
    const cabecalho = separador >= 0 ? parte.slice(0, separador) : "";

    return /content-transfer-encoding:\s*quoted-printable/i.test(cabecalho)
      ? decodificarQuotedPrintable(corpo)
      : corpo;
  }

  return null;
}

/** Rótulo do formato para mensagens de erro ao usuário. */
export function descreverFormato(formato: FormatoArquivo): string {
  switch (formato) {
    case "XLSX":
      return "planilha XLSX";
    case "XLS":
      return "planilha XLS";
    case "HTML":
      return "tabela HTML (export do Crystal Reports)";
    case "XML":
      return "planilha XML";
    default:
      return "arquivo de texto";
  }
}
