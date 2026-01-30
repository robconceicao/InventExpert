import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { createClient } from '@supabase/supabase-js';

const extra = Constants.expoConfig?.extra ?? {};
const supabaseUrl =
  extra.supabaseUrl ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey =
  extra.supabaseAnonKey ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storage: AsyncStorage,
        detectSessionInUrl: false,
      },
    })
  : null;
