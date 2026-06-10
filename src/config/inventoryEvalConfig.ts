export const INVENTORY_PROFILES = {
  FARMACIA: {
    weights: { quality: 0.55, productivity: 0.25, adherence: 0.2 },
    targets: {
      productivity: 800,
      maxBlockLimit: 20,
      erroTolerancia: 0.35,
      erroCritico: 0.8,
    },
    alerts: { criticalBlockLimit: 50 },
  },
  SUPERMERCADO: {
    weights: { quality: 0.45, productivity: 0.4, adherence: 0.15 },
    targets: {
      productivity: 1200,
      maxBlockLimit: 50,
      erroTolerancia: 1.0,
      erroCritico: 2.0,
    },
    alerts: { criticalBlockLimit: 80 },
  },
  HIPERMERCADO: {
    weights: { quality: 0.45, productivity: 0.4, adherence: 0.15 },
    targets: {
      productivity: 1200,
      maxBlockLimit: 50,
      erroTolerancia: 1.0,
      erroCritico: 2.0,
    },
    alerts: { criticalBlockLimit: 80 },
  },
  LOJA_GERAL: {
    weights: { quality: 0.5, productivity: 0.3, adherence: 0.2 },
    targets: {
      productivity: 1000,
      maxBlockLimit: 35,
      erroTolerancia: 0.8,
      erroCritico: 1.5,
    },
    alerts: { criticalBlockLimit: 65 },
  },
  ATACADO: {
    weights: { quality: 0.45, productivity: 0.4, adherence: 0.15 },
    targets: {
      productivity: 1500,
      maxBlockLimit: 100,
      erroTolerancia: 1.5,
      erroCritico: 3.0,
    },
    alerts: { criticalBlockLimit: 100 },
  },
} as const;

import type { ViolacaoBloco, InventoryOperationType } from "../types";

export interface RegraBlocoArea {
  limite: number;
  critica: boolean;
}

export const LIMITES_BLOCO_FARMACIA: Record<string, RegraBlocoArea> = {
  "MEDICAMENTOS": { limite: 0, critica: true },
  "PSICOTRÓPICOS": { limite: 0, critica: true },
  "ANTIBIÓTICOS": { limite: 0, critica: true },
  "GELADEIRAS MEDICAMENTOS": { limite: 0, critica: true },
  "SALA DE APLICAÇÃO": { limite: 0, critica: true },
  "MEDICAMENTOS CARTELADOS": { limite: 30, critica: false },
  "OTC / MIP (CAIXA)": { limite: 5, critica: false },
  "ESTOQUE FRENTE DE CAIXA": { limite: 90, critica: false },
  "FRENTE DE CAIXA": { limite: 15, critica: false },
  "GELADEIRAS FRENTE CAIXA": { limite: 15, critica: false },
};

export function getViolacoesBloco(
  secoes: { area: string; pctBloco: number }[],
  operationType: InventoryOperationType
): ViolacaoBloco[] {
  if (operationType !== "FARMACIA") {
    return [];
  }

  const violacoes: ViolacaoBloco[] = [];

  for (const sec of secoes) {
    const areaUpper = sec.area.toUpperCase();
    let regra = LIMITES_BLOCO_FARMACIA[areaUpper];

    if (!regra) {
      console.warn(`[InventoryEval] Área sem entrada na tabela de limites: "${sec.area}"`);
      regra = { limite: 20, critica: false };
    }

    if (sec.pctBloco > regra.limite) {
      violacoes.push({
        area: sec.area,
        pctBloco: sec.pctBloco,
        limitePermitido: regra.limite,
        critica: regra.critica,
      });
    }
  }

  return violacoes;
}
