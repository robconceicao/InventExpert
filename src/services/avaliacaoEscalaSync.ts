import type {
  InventoryCheckerEvaluation,
  ProdutividadeInput,
} from "../types";
import { normalizeNomeKey } from "../utils/nomeMatching";

/**
 * Converte avaliações processadas em registros do módulo Escala.
 * Requer mapa nome normalizado → colaborador_id (ex.: do CADFUN/Supabase).
 */
export function evaluationsToProdutividadeInputs(
  evaluations: InventoryCheckerEvaluation[],
  colaboradorIdsPorNome: Record<string, string>,
  dataInventario?: string,
): ProdutividadeInput[] {
  const data = dataInventario ?? new Date().toISOString().slice(0, 10);
  const out: ProdutividadeInput[] = [];

  for (const ev of evaluations) {
    const key = normalizeNomeKey(ev.input.nome);
    const colaborador_id = colaboradorIdsPorNome[key];
    if (!colaborador_id) continue;

    out.push({
      colaborador_id,
      data_inventario: data,
      qtde: ev.input.qtde,
      qtde1a1: ev.input.qtde1a1,
      produtividade_ph: ev.input.produtividade,
      erro: ev.input.erro,
      operacao_tipo: ev.operationType,
      score_final: ev.scoreFinal,
      nivel: ev.nivel,
    });
  }

  return out;
}
