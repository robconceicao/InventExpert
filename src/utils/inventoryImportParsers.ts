import { LIMITES_BLOCO_FARMACIA } from "../config/inventoryEvalConfig";
import { parseInventoryCheckersCsv } from "./parsers";

/**
 * Normaliza o nome da área vindo de arquivos externos (PRC ou CSV)
 * e aplica o de-para obrigatório. Dispara warning se a área não
 * estiver mapeada nas regras de limite de bloco.
 */
export function normalizarNomeArea(areaNome: string): string {
  if (!areaNome) return "";
  let nome = areaNome.trim().toUpperCase();

  // De-para obrigatório
  if (nome === "F CAIXA") {
    nome = "FRENTE DE CAIXA";
  } else if (nome === "GELADEIRAS CAIXA") {
    nome = "GELADEIRAS FRENTE CAIXA";
  }

  // Validação contra a tabela de limites
  const areasMapeadas = Object.keys(LIMITES_BLOCO_FARMACIA).map(k => k.toUpperCase());
  if (!areasMapeadas.includes(nome) && nome !== "GERAL") {
    console.warn(`[Aviso] Área não mapeada na tabela de limites: ${nome}`);
  }

  return nome;
}

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
