import { supabase } from '../services/supabase';
import { InventoryOperationType } from '../types';

export interface SecaoLookup {
  codigo_secao: string;
  nome_area: string;
  tipo_operacao: string;
}

export async function getSecaoLookup(tipoOperacao: InventoryOperationType): Promise<SecaoLookup[]> {
  if (!supabase) {
    console.warn(`[secaoLookupRepository] Client do Supabase não inicializado.`);
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('secao_lookup')
      .select('codigo_secao, nome_area, tipo_operacao')
      .eq('tipo_operacao', tipoOperacao);

    if (error) {
      console.warn(`[secaoLookupRepository] Erro ao buscar secao_lookup para ${tipoOperacao}: ${error.message}`);
      return [];
    }

    return data || [];
  } catch (err: any) {
    console.warn(`[secaoLookupRepository] Exception ao buscar secao_lookup para ${tipoOperacao}: ${err.message}`);
    return [];
  }
}
