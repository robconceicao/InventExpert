import type { ContagemDetalhada } from "../types";

export const PRC_MIN_LINE_LENGTH = 83;

export function parsePrcFile(content: string): ContagemDetalhada[] {
  return content
    .split(/\r?\n/)
    .filter(line => line.length >= PRC_MIN_LINE_LENGTH && line.startsWith("PI"))
    .map(line => ({
      area_codigo: line.slice(2, 8).trim(),
      barcode: line.slice(8, 21).trim(),
      quantidade: parseInt(line.slice(21, 25), 10) || 1,
      matricula: line.slice(25, 31).trim(),
    }));
}
