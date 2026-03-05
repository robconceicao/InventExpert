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
} as const;

export type InventoryOperationType = keyof typeof INVENTORY_PROFILES;

