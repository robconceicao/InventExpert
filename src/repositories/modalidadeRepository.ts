import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase';
import type { ModalidadeContratoCanonico } from '../types';

/**
 * Modalidade de contratação por conferente.
 *
 * Por que isto existe
 * -------------------
 * O relatório individual muda de linguagem conforme o vínculo. Quem presta
 * serviço sem contrato não pode receber um documento que fale em medida
 * disciplinar, Código de Conduta ou convocação — termos que sugerem
 * subordinação onde ela não existe.
 *
 * O relatório de produtividade do sistema não traz essa informação, e o gerador
 * de relatório caía em 'CLT' por omissão. A marcação é feita pelo líder na tela
 * de Avaliação e guardada aqui.
 *
 * Supabase é a fonte de verdade, para que o mesmo conferente não saia como CLT
 * numa loja e como prestador em outra. O AsyncStorage é cache: mantém a tela
 * funcionando offline e evita rede a cada importação. Quando os dois divergem,
 * o Supabase vence.
 *
 * Ausência de marcação é representada por `null` — nunca por um valor padrão.
 * Um default reintroduziria em silêncio o problema que este módulo resolve.
 */

const CACHE_KEY = '@inventexpert:modalidades';

export interface ModalidadeConferente {
  matricula: string;
  nome: string;
  modalidade: ModalidadeContratoCanonico | null;
}

// ---------------------------------------------------------------------------
// Cache local
// ---------------------------------------------------------------------------

async function lerCache(): Promise<Record<string, ModalidadeContratoCanonico>> {
  try {
    const bruto = await AsyncStorage.getItem(CACHE_KEY);
    return bruto ? JSON.parse(bruto) : {};
  } catch (err) {
    console.warn('[modalidadeRepository] Falha ao ler cache local:', err);
    return {};
  }
}

async function gravarCache(mapa: Record<string, ModalidadeContratoCanonico>): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(mapa));
  } catch (err) {
    console.warn('[modalidadeRepository] Falha ao gravar cache local:', err);
  }
}

/** Matrícula só com dígitos: o relatório e o cadastro nem sempre concordam. */
function chave(matricula: string): string {
  return (matricula || '').replace(/\D/g, '') || (matricula || '').trim();
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

/**
 * Busca a modalidade já conhecida das matrículas informadas.
 *
 * Devolve só quem tem marcação. Quem não aparecer no resultado é conferente
 * novo, e a tela deve exigir a escolha antes de deixar processar.
 *
 * Sem Supabase configurado ou sem rede, responde pelo cache — a marcação de
 * ontem continua valendo, e o líder consegue trabalhar na loja.
 */
export async function getModalidades(
  matriculas: string[],
): Promise<Map<string, ModalidadeContratoCanonico>> {
  const chaves = matriculas.map(chave).filter(Boolean);
  const resultado = new Map<string, ModalidadeContratoCanonico>();

  const cache = await lerCache();
  for (const k of chaves) {
    if (cache[k]) resultado.set(k, cache[k]);
  }

  if (!supabase || chaves.length === 0) return resultado;

  try {
    const { data, error } = await supabase
      .from('colaboradores')
      .select('matricula, modalidade')
      .in('matricula', chaves)
      .not('modalidade', 'is', null);

    if (error) {
      console.warn('[modalidadeRepository] Supabase indisponível, usando cache:', error.message);
      return resultado;
    }

    const atualizado = { ...cache };
    for (const linha of data ?? []) {
      const k = chave(linha.matricula as string);
      const m = linha.modalidade as ModalidadeContratoCanonico;
      if (!k || !m) continue;
      resultado.set(k, m);
      atualizado[k] = m;
    }
    await gravarCache(atualizado);
  } catch (err: any) {
    console.warn('[modalidadeRepository] Exception ao buscar modalidades:', err?.message);
  }

  return resultado;
}

// ---------------------------------------------------------------------------
// Escrita
// ---------------------------------------------------------------------------

/**
 * Grava as marcações feitas pelo líder.
 *
 * O cache é escrito primeiro e sempre: a avaliação em andamento não pode ficar
 * refém da rede. O Supabase é atualizado em seguida, e a falha dele é reportada
 * — a tela avisa que a marcação valeu só neste aparelho, em vez de fingir que
 * sincronizou.
 *
 * @returns `true` quando a gravação remota também foi bem-sucedida.
 */
export async function salvarModalidades(
  itens: ModalidadeConferente[],
  autor?: string,
): Promise<boolean> {
  const validos = itens.filter((i) => i.modalidade && chave(i.matricula));

  const cache = await lerCache();
  for (const i of validos) {
    cache[chave(i.matricula)] = i.modalidade!;
  }
  await gravarCache(cache);

  if (!supabase || validos.length === 0) return false;

  try {
    for (const i of validos) {
      const { error } = await supabase.rpc('definir_modalidade_colaborador', {
        p_matricula: chave(i.matricula),
        p_nome: i.nome,
        p_modalidade: i.modalidade,
        p_por: autor ?? null,
      });
      if (error) {
        console.warn(
          `[modalidadeRepository] Falha ao gravar ${i.nome}: ${error.message}`,
        );
        return false;
      }
    }
    return true;
  } catch (err: any) {
    console.warn('[modalidadeRepository] Exception ao gravar modalidades:', err?.message);
    return false;
  }
}

/** Limpa o cache local. Útil quando a marcação de um aparelho ficou errada. */
export async function limparCacheModalidades(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CACHE_KEY);
  } catch (err) {
    console.warn('[modalidadeRepository] Falha ao limpar cache:', err);
  }
}
