import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import Constants from 'expo-constants';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const extra = Constants.expoConfig?.extra ?? {};
const supabaseUrl =
  extra.supabaseUrl ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey =
  extra.supabaseAnonKey ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/**
 * Explica por que uma chamada ao Supabase falhou por rede.
 *
 * "Network request failed" não separa aparelho offline de servidor fora do
 * ar — e as duas situações pedem ações opostas do usuário. Este diagnóstico
 * pergunta ao NetInfo se há link e, havendo, bate no /auth/v1/health para
 * saber se quem não responde é o servidor.
 */
export async function diagnosticarFalhaDeRede(): Promise<string> {
  const estado = await NetInfo.fetch();
  if (estado.isConnected === false) {
    return 'Sem conexão. Ative o Wi-Fi ou os dados móveis e tente novamente.';
  }

  // Aparelho com link: descobrir se o servidor está de pé.
  const controle = new AbortController();
  const limite = setTimeout(() => controle.abort(), 8000);
  try {
    await fetch(`${supabaseUrl}/auth/v1/health`, {
      method: 'GET',
      signal: controle.signal,
    });
    return 'Falha temporária ao falar com o servidor. Tente novamente.';
  } catch {
    return 'O servidor não respondeu. Verifique se o projeto Supabase está ativo — no plano free ele é pausado após dias sem uso e precisa ser reativado no painel.';
  } finally {
    clearTimeout(limite);
  }
}

// Use localStorage on web, AsyncStorage on native
const storageAdapter = Platform.OS === 'web'
  ? {
      getItem: (key: string) => {
        if (typeof window !== 'undefined') {
          return Promise.resolve(window.localStorage.getItem(key));
        }
        return Promise.resolve(null);
      },
      setItem: (key: string, value: string) => {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, value);
        }
        return Promise.resolve();
      },
      removeItem: (key: string) => {
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(key);
        }
        return Promise.resolve();
      },
    }
  : AsyncStorage;

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storage: storageAdapter,
        detectSessionInUrl: false,
      },
    })
  : null;
