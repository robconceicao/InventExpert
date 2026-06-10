import { supabase } from '../services/supabase';
import { InventoryOperationType } from '../types';

export interface LimiteBloco {
  tipo_operacao: string;
  nome_area: string;
  limite_pct: number;
  area_critica: boolean;
}

export async function getLimitesBlocoArea(tipoOperacao: InventoryOperationType): Promise<LimiteBloco[]> {
  if (!supabase) {
    console.warn(`[limitesBlocoRepository] Client do Supabase não inicializado.`);
    return [];
  }
  
  try {
    const { data, error } = await supabase
      .from('limites_bloco_area')
      .select('tipo_operacao, nome_area, limite_pct, area_critica')
      .eq('tipo_operacao', tipoOperacao);

    if (error) {
      console.warn(`[limitesBlocoRepository] Erro ao buscar limites de bloco para ${tipoOperacao}: ${error.message}`);
      return [];
    }

    return data || [];
  } catch (err: any) {
    console.warn(`[limitesBlocoRepository] Exception ao buscar limites de bloco para ${tipoOperacao}: ${err.message}`);
    return [];
  }
}
