import { parseInventoryCheckersCsv } from "./parsers";
import { normalizarNomeArea } from "./inventExpUtils";
import type {
  ContagemDetalhada,
  SectionAccuracyRecord,
} from "../types";
import type { LimiteBlocoRow } from "../config/inventoryEvalConfig";
import { LIMITE_BLOCO_SEM_LIMITE } from "../config/inventoryEvalConfig";

export { normalizarNomeArea };

// ---------------------------------------------------------------------------
// Matrícula / nome matching
// ---------------------------------------------------------------------------

/** Extrai só dígitos da matrícula/CPF. */
export function digitsOnly(value?: string | null): string {
  return (value || "").replace(/\D/g, "");
}

/**
 * Compara matrículas tolerando zeros à esquerda e formatação.
 * Ex.: "041712954830" ≡ "41712954830"
 */
export function matriculasIguais(
  a?: string | null,
  b?: string | null,
): boolean {
  const da = digitsOnly(a);
  const db = digitsOnly(b);
  if (!da || !db) return false;
  if (da === db) return true;
  const na = da.replace(/^0+/, "") || "0";
  const nb = db.replace(/^0+/, "") || "0";
  return na === nb;
}

export function normalizeNomePessoa(nome?: string | null): string {
  return (nome || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

export function nomesIguais(a?: string | null, b?: string | null): boolean {
  const na = normalizeNomePessoa(a);
  const nb = normalizeNomePessoa(b);
  if (!na || !nb) return false;
  return na === nb || na.startsWith(nb) || nb.startsWith(na);
}

// ---------------------------------------------------------------------------
// Totais de produtividade
// ---------------------------------------------------------------------------

/**
 * Auto-detecta totais a partir do arquivo bruto de produtividade.
 * Extrai total de peças e duração, sem depender de input manual.
 */
export function extractProductivityTotals(csvText: string): {
  totalPecas: number;
  duracaoHoras: number;
} {
  let totalPecas = 0;
  let duracaoHoras = 0;

  const lines = csvText
    .split(/[\r\n]+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const totalLine = lines.find((l) => /^"?(total|soma|resumo)"?/i.test(l));

  if (totalLine) {
    const sep = totalLine.includes(";")
      ? ";"
      : totalLine.includes("\t")
        ? "\t"
        : ",";
    const parts = totalLine
      .split(sep)
      .map((s) => s.replace(/^"|"$/g, "").trim());

    const nums = parts
      .map((p) => parseFloat(p.replace(/\./g, "").replace(",", ".")))
      .filter((n) => !isNaN(n));
    if (nums.length >= 2) {
      const sorted = [...nums].sort((a, b) => b - a);
      totalPecas = sorted[0];
      duracaoHoras =
        nums.find((n) => n < 100 && n > 0 && n !== totalPecas) || 0;
    }
  }

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

// ---------------------------------------------------------------------------
// PRODUÇÃO_SEÇÃO
// ---------------------------------------------------------------------------

/**
 * Parse de PRODUÇÃO_SEÇÃO (CSV/XLS convertido).
 * Aplica normalizarNomeArea em todo nome de área.
 * Preenche campos canônicos + aliases legados (area / area_nome).
 */
export function parseProducaoSecaoCsv(text: string): SectionAccuracyRecord[] {
  const lines = text
    .split(/[\r\n]+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return [];

  const sep = text.includes("\t") ? /\t/ : text.includes(";") ? /;/ : /,/;
  const result: SectionAccuracyRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i]
      .split(sep)
      .map((c) => c.replace(/^"|"$/g, "").trim());
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

    const ajusteAbs = Math.abs(ajuste_a1) + Math.abs(ajuste_a2) + Math.abs(ajuste_a3);
    const acuracidade =
      qtd_c1 > 0 ? Math.max(0, (1 - ajusteAbs / qtd_c1) * 100) : 100;

    result.push({
      // canônico
      area_nome: area,
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
      matricula,
      nome,
      // aliases / métricas
      area,
      totalC1: qtd_c1,
      totalItens: qtd_final || qtd_c1,
      ajusteAbsoluto: ajusteAbs,
      ajusteLiquido: ajuste_a1 + ajuste_a2 + ajuste_a3,
      acuracidade,
      pctBloco: 0,
      colaboradores: nome ? [nome] : [],
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Enriquecimento .prc × seções × limites
// ---------------------------------------------------------------------------

/** Filtra contagens de um conferente (matrícula, com fallback por nome). */
export function filtrarContagensDoConferente(
  contagens: ContagemDetalhada[],
  matricula?: string,
  nome?: string,
): ContagemDetalhada[] {
  if (matricula) {
    const byMat = contagens.filter((c) => matriculasIguais(c.matricula, matricula));
    if (byMat.length > 0) return byMat;
  }
  if (nome) {
    return contagens.filter((c) => nomesIguais(c.nome, nome));
  }
  return [];
}

/** Filtra seções PRODUÇÃO_SEÇÃO de um conferente. */
export function filtrarSecoesDoConferente(
  secoes: SectionAccuracyRecord[],
  matricula?: string,
  nome?: string,
): SectionAccuracyRecord[] {
  if (matricula) {
    const byMat = secoes.filter((s) => matriculasIguais(s.matricula, matricula));
    if (byMat.length > 0) return byMat;
  }
  if (nome) {
    return secoes.filter(
      (s) => nomesIguais(s.nome, nome) ||
        (s.colaboradores || []).some((c) => nomesIguais(c, nome)),
    );
  }
  return [];
}

/**
 * Enriquece seções com % bloco das contagens .prc e limites canônicos.
 * Garante area/area_nome normalizados.
 */
export function enriquecerSecoesComBloco(
  secoes: SectionAccuracyRecord[],
  contagens: ContagemDetalhada[],
  limites: LimiteBlocoRow[],
): SectionAccuracyRecord[] {
  return secoes.map((s) => {
    const area = normalizarNomeArea(s.area_nome || s.area || "");
    const daArea = contagens.filter(
      (c) => normalizarNomeArea(c.area_nome || "") === area,
    );

    let bloco_pct = s.bloco_pct ?? s.pctBloco ?? 0;
    if (daArea.length > 0) {
      const total = daArea.reduce((a, c) => a + c.quantidade, 0);
      const bloco = daArea
        .filter((c) => c.is_bloco)
        .reduce((a, c) => a + c.quantidade, 0);
      bloco_pct = total > 0 ? (bloco / total) * 100 : 0;
    }

    const lim = limites.find(
      (l) => l.nome_area.toUpperCase() === area.toUpperCase(),
    );
    const limite_bloco =
      lim && lim.limite_pct < LIMITE_BLOCO_SEM_LIMITE
        ? lim.limite_pct
        : (s.limite_bloco ?? 0);
    const area_critica = lim?.area_critica ?? s.area_critica ?? false;
    const violacao_bloco =
      lim && lim.limite_pct < LIMITE_BLOCO_SEM_LIMITE
        ? bloco_pct > lim.limite_pct
        : false;

    return {
      ...s,
      area,
      area_nome: area,
      bloco_pct,
      pctBloco: bloco_pct,
      limite_bloco,
      area_critica,
      violacao_bloco,
    };
  });
}

/**
 * Resolve area_nome de cada contagem via mapa secao_lookup (codigo → nome).
 * Aplica normalizarNomeArea. Fallback: area_codigo.
 */
export function resolverAreasNasContagens(
  contagens: ContagemDetalhada[],
  secaoMap: Map<string, string>,
): ContagemDetalhada[] {
  return contagens.map((c) => {
    const raw =
      secaoMap.get(c.area_codigo) ||
      secaoMap.get(c.area_codigo.replace(/^0+/, "")) ||
      c.area_nome ||
      c.area_codigo;
    return {
      ...c,
      area_nome: normalizarNomeArea(raw || ""),
    };
  });
}
