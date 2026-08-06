/**
 * Publica resultados de evaluateChecker na tabela `produtividade`
 * (alimenta escala / vw_produtividade_consolidada).
 *
 * Idempotente por (colaborador_id, data_inventario, inventario_ref)
 * quando a migration_produtividade_idempotent.sql estiver aplicada;
 * fallback client-side: select + update/insert.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  InventoryCheckerEvaluation,
  InventoryOperationType,
  ProdutividadeInput,
} from "../types";
import { digitsOnly, normalizeNomePessoa, nomesIguais } from "../utils/inventoryImportParsers";

export interface PublishProdutividadeParams {
  evaluations: InventoryCheckerEvaluation[];
  /** YYYY-MM-DD */
  dataInventario: string;
  /**
   * Chave de evento (loja, nº inventário…). Obrigatório para re-publish seguro.
   * Ex.: "LOJA-123" ou "inventexp-2026-07-16"
   */
  inventarioRef: string;
  operationType: InventoryOperationType;
}

export interface PublishProdutividadeResult {
  publicados: number;
  atualizados: number;
  inseridos: number;
  naoEncontrados: string[];
  erros: string[];
}

function mapOperacaoTipo(
  t: InventoryOperationType,
): "FARMACIA" | "SUPERMERCADO" | "LOJA_GERAL" {
  if (t === "FARMACIA") return "FARMACIA";
  if (t === "LOJA_GERAL") return "LOJA_GERAL";
  // HIPERMERCADO / ATACADO / SUPERMERCADO → SUPERMERCADO no CHECK do schema
  return "SUPERMERCADO";
}

function horasEstimadas(ev: InventoryCheckerEvaluation): number | undefined {
  const qtde = ev.input.qtde;
  const ph = ev.input.produtividade;
  if (qtde > 0 && ph > 0) {
    return Math.round((qtde / ph) * 100) / 100;
  }
  return undefined;
}

function toPayload(
  colaboradorId: string,
  ev: InventoryCheckerEvaluation,
  params: PublishProdutividadeParams,
): ProdutividadeInput {
  return {
    colaborador_id: colaboradorId,
    inventario_ref: params.inventarioRef.trim() || "",
    data_inventario: params.dataInventario,
    qtde: Math.max(0, Math.round(ev.input.qtde)),
    qtde1a1: Math.max(0, Math.round(ev.input.qtde1a1)),
    produtividade_ph: Math.max(0, ev.input.produtividade),
    erro: Math.max(0, Math.round(ev.input.erro)),
    horas_estimadas: horasEstimadas(ev),
    operacao_tipo: mapOperacaoTipo(params.operationType),
    score_final: ev.scoreFinal,
    nivel: ev.nivel,
  };
}

interface ColabRow {
  id: string;
  matricula: string | null;
  nome: string;
  ativo: boolean;
}

function matchColaborador(
  ev: InventoryCheckerEvaluation,
  colabs: ColabRow[],
): ColabRow | null {
  const mat = digitsOnly(ev.input.matricula || ev.matricula || "");
  if (mat) {
    const byMat = colabs.find((c) => {
      const cm = digitsOnly(c.matricula);
      if (!cm) return false;
      if (cm === mat) return true;
      const a = cm.replace(/^0+/, "") || "0";
      const b = mat.replace(/^0+/, "") || "0";
      return a === b;
    });
    if (byMat) return byMat;
  }

  const nome = normalizeNomePessoa(ev.input.nome || ev.nome || "");
  if (!nome) return null;

  const exact = colabs.filter((c) => normalizeNomePessoa(c.nome) === nome);
  if (exact.length === 1) return exact[0];

  const fuzzy = colabs.filter((c) => nomesIguais(c.nome, nome));
  if (fuzzy.length === 1) return fuzzy[0];

  return null;
}

export class ProdutividadePublishService {
  constructor(private readonly db: SupabaseClient) {}

  async publicar(
    params: PublishProdutividadeParams,
  ): Promise<PublishProdutividadeResult> {
    const result: PublishProdutividadeResult = {
      publicados: 0,
      atualizados: 0,
      inseridos: 0,
      naoEncontrados: [],
      erros: [],
    };

    if (!params.evaluations.length) {
      result.erros.push("Nenhuma avaliação para publicar.");
      return result;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(params.dataInventario)) {
      result.erros.push("Data do inventário inválida (use YYYY-MM-DD).");
      return result;
    }
    const ref = (params.inventarioRef || "").trim();
    if (!ref) {
      result.erros.push(
        "Informe a referência do inventário (loja / código do evento) para publicação idempotente.",
      );
      return result;
    }

    const { data: colabs, error: colabErr } = await this.db
      .from("colaboradores")
      .select("id, matricula, nome, ativo")
      .eq("ativo", true);

    if (colabErr) {
      result.erros.push(`Erro ao carregar colaboradores: ${colabErr.message}`);
      return result;
    }

    const lista = (colabs || []) as ColabRow[];

    for (const ev of params.evaluations) {
      const colab = matchColaborador(ev, lista);
      if (!colab) {
        result.naoEncontrados.push(ev.input.nome || ev.nome || "?");
        continue;
      }

      const payload = toPayload(colab.id, ev, {
        ...params,
        inventarioRef: ref,
      });

      try {
        const { data: existing, error: findErr } = await this.db
          .from("produtividade")
          .select("id")
          .eq("colaborador_id", payload.colaborador_id)
          .eq("data_inventario", payload.data_inventario)
          .eq("inventario_ref", payload.inventario_ref ?? "")
          .maybeSingle();

        if (findErr) throw new Error(findErr.message);

        if (existing?.id) {
          const { error: upErr } = await this.db
            .from("produtividade")
            .update({
              qtde: payload.qtde,
              qtde1a1: payload.qtde1a1,
              produtividade_ph: payload.produtividade_ph,
              erro: payload.erro,
              horas_estimadas: payload.horas_estimadas,
              operacao_tipo: payload.operacao_tipo,
              score_final: payload.score_final,
              nivel: payload.nivel,
            })
            .eq("id", existing.id);
          if (upErr) throw new Error(upErr.message);
          result.atualizados += 1;
        } else {
          const { error: insErr } = await this.db
            .from("produtividade")
            .insert(payload);
          if (insErr) {
            // Race / unique: tenta update
            if (insErr.code === "23505" || /duplicate|unique/i.test(insErr.message)) {
              const { error: up2 } = await this.db
                .from("produtividade")
                .update({
                  qtde: payload.qtde,
                  qtde1a1: payload.qtde1a1,
                  produtividade_ph: payload.produtividade_ph,
                  erro: payload.erro,
                  horas_estimadas: payload.horas_estimadas,
                  operacao_tipo: payload.operacao_tipo,
                  score_final: payload.score_final,
                  nivel: payload.nivel,
                })
                .eq("colaborador_id", payload.colaborador_id)
                .eq("data_inventario", payload.data_inventario)
                .eq("inventario_ref", payload.inventario_ref ?? "");
              if (up2) throw new Error(up2.message);
              result.atualizados += 1;
            } else {
              throw new Error(insErr.message);
            }
          } else {
            result.inseridos += 1;
          }
        }
        result.publicados += 1;
      } catch (e) {
        const nome = ev.input.nome || "?";
        result.erros.push(
          `${nome}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }

    return result;
  }
}
