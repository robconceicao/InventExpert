import type { EvaluationConfig } from "../types";

/**
 * Configuração calibrada para Farmácia (InventExpress)
 * Política: 1a1 obrigatório. Bloco apenas em setores específicos com anuência do líder.
 * Duração média inventário: 10h
 * Meta e tolerância: calculadas dinamicamente do time
 */
export const FARMACIA_CONFIG: EvaluationConfig = {
  tipoOperacao: "farmacia",
  duracaoInventario_horas: 10,
  metaProdutividade_itensH: "auto",
  pesos: {
    qualidade: 0.6,
    produtividade: 0.25,
    metodo: 0.15,
  },
  limites: {
    erro: {
      excelente: 0.5,
      bom: 1.5,
      atencao: 3.0,
      critico: 5.0,
    },
    bloco: {
      aceitavel: 20,
      maximo: 40,
      critico: 50,
    },
  },
  classificacao: {
    excelente: 85,
    bom: 70,
    atencao: 50,
  },
  bonificacoes: {
    excelenciaCombinada: 5,
    zeroErros: 3,
    altoVolumeQualidade: 2,
    maximoBonificacao: 10,
  },
  penalidades: {
    blocoExcessivoFarmacia: 10,
    produtividadeSuspeita: 5,
    erroCritico: 15,
    maximoPenalidade: 25,
  },
};
