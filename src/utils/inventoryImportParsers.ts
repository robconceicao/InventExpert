// @ts-nocheck
import { parseInventoryCheckersCsv } from "./parsers";
import { normalizarNomeArea } from "./inventExpUtils";
export { normalizarNomeArea };

/**
 * Auto-detecta totais a partir do arquivo bruto de produtividade.
 * Extrai total de peças e duração, sem depender de input manual.
 */
export function extractProductivityTotals(csvText: string): { totalPecas: number; duracaoHoras: number } {
  let totalPecas = 0;
  let duracaoHoras = 0;

  const lines = csvText.split(/[\r\n]+/).map(l => l.trim()).filter(l => l.length > 0);
  
  // Tentar encontrar uma linha de totais explícita (ex: "TOTAL;5000;...;10,5")
  const totalLine = lines.find(l => /^"?(total|soma|resumo)"?/i.test(l));
  
  if (totalLine) {
    const sep = totalLine.includes(";") ? ";" : (totalLine.includes("\t") ? "\t" : ",");
    const parts = totalLine.split(sep).map(s => s.replace(/^"|"$/g, "").trim());
    
    // Heurística: procurar números nas colunas
    const nums = parts.map(p => parseFloat(p.replace(/\./g, "").replace(",", "."))).filter(n => !isNaN(n));
    if (nums.length >= 2) {
      const sorted = [...nums].sort((a,b) => b - a);
      totalPecas = sorted[0]; // Maior número é o total de peças
      // Horas costuma ser um float pequeno
      duracaoHoras = nums.find(n => n < 100 && n > 0 && n !== totalPecas) || 0; 
    }
  }

  // Fallback seguro: se não encontrou linha de total ou heurística falhou
  if (totalPecas === 0) {
    const checkers = parseInventoryCheckersCsv(csvText);
    totalPecas = checkers.reduce((s, c) => s + c.qtde, 0);
    
    if (duracaoHoras === 0 && checkers.length > 0) {
      let maxDuration = 0;
      for (const c of checkers) {
        if (c.produtividade > 0) {
          const dur = c.qtde / c.produtividade;
          if (dur > maxDuration) maxDuration = dur;
        }
      }
      duracaoHoras = Math.round(maxDuration * 100) / 100;
    }
  }

  return { totalPecas, duracaoHoras };
}

export const parseProducaoSecaoCsv = (text: string): import("../types").SectionAccuracyRecord[] => {
  const lines = text
    .split(/[\r\n]+/)
    .map(l => l.trim())
    .filter(l => l.length > 0);
  if (lines.length < 2) return [];

  const sep = text.includes("\t") ? /\t/ : text.includes(";") ? /;/ : /,/;
  const result: import("../types").SectionAccuracyRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(sep).map(c => c.replace(/^"|"$/g, "").trim());
    if (cells.length < 9) continue;

    const area = normalizarNomeArea(cells[0] || "");
    if (!area) continue;

    const nome = cells[1] || "";
    const matricula = cells[2] || "";
    const secoes_contadas = parseInt(cells[3], 10) || 0;
    const qtd_c1 = parseInt(cells[4], 10) || 0;
    const ajuste_a1 = parseInt(cells[5], 10) || 0;
    const ajuste_a2 = parseInt(cells[6], 10) || 0;
    const ajuste_a3 = parseInt(cells[7], 10) || 0;
    const qtd_final = parseInt(cells[8], 10) || 0;

    result.push({
      area_nome: area,
      nome,
      matricula,
      secoes_contadas,
      qtd_c1,
      ajuste_a1,
      ajuste_a2,
      ajuste_a3,
      qtd_final,
      bloco_pct: 0,
      limite_bloco: 0,
      violacao_bloco: false,
      area_critica: false,
    });
  }

  return result;
};
