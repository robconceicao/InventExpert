export const INVENTORY_PROFILES = {
  FARMACIA: {
    weights: { quality: 0.55, productivity: 0.20, adherence: 0.15, volume: 0.10 },
    targets: {
      /**
       * Meta de produtividade de referência (fallback quando total de peças não é informado).
       * Quando totalPecasLoja > 0, a meta é calculada dinamicamente:
       *   metaDinamica = totalPecasLoja / numConferentes / duracaoPadrao
       */
      productivity: 800,
      maxBlockLimit: 20,
      erroTolerancia: 0.35,
      erroCritico: 0.8,
    },
    alerts: { criticalBlockLimit: 50 },
    /**
     * Fator de decaimento da curva de qualidade (k).
     * Fórmula: scoreQualidade = 100 * e^(-k * pctErro)
     * Farmácia: alta sensibilidade a erros (medicamentos = risco de saúde)
     * k=1.5 → 1% erro ≈ 78 pts | 2% erro ≈ 50 pts | 5% erro ≈ 5 pts
     */
    qualityDecayRate: 1.5,
    /**
     * Duração padrão da operação em horas.
     * Usada para:
     *   1) Calcular fatorTempo: fatorTempo = duracaoPadrao / duracaoRealInventario
     *   2) Calcular a meta dinâmica de produtividade (items/h) quando total de peças é informado:
     *      metaDinamica = totalPecasLoja / numConferentes / duracaoPadrao
     *   Assim, a meta de produtividade sempre equivale ao mínimo individual esperado.
     */
    duracaoPadrao: 5,
  },
  SUPERMERCADO: {
    weights: { quality: 0.45, productivity: 0.35, adherence: 0.10, volume: 0.10 },
    targets: {
      productivity: 1200,
      maxBlockLimit: 50,
      erroTolerancia: 1.0,
      erroCritico: 2.0,
    },
    alerts: { criticalBlockLimit: 80 },
    /**
     * Supermercado: tolerância maior (produtos embalados, menor risco unitário)
     * k=0.8 → 1% erro ≈ 92 pts | 2% erro ≈ 85 pts | 5% erro ≈ 67 pts
     */
    qualityDecayRate: 0.8,
    /** Duração padrão: 8 horas */
    duracaoPadrao: 8,
  },
  LOJA_GERAL: {
    weights: { quality: 0.5, productivity: 0.25, adherence: 0.15, volume: 0.10 },
    targets: {
      productivity: 1000,
      maxBlockLimit: 35,
      erroTolerancia: 0.8,
      erroCritico: 1.5,
    },
    alerts: { criticalBlockLimit: 65 },
    /**
     * Loja geral: sensibilidade intermediária
     * k=1.1 → 1% erro ≈ 89 pts | 2% erro ≈ 80 pts | 5% erro ≈ 58 pts
     */
    qualityDecayRate: 1.1,
    /** Duração padrão: 6 horas */
    duracaoPadrao: 6,
  },
} as const;

export type InventoryOperationType = keyof typeof INVENTORY_PROFILES;
