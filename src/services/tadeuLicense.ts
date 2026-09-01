import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

export type TadeuPlanSlug = 'free' | 'pro' | 'premium' | 'legacy';

export type LicensedFeature = {
  key: string;
  limitValue: number | null;
  limitUnit: string | null;
};

export type TadeuLicense = {
  ok: boolean;
  license: 'active';
  application: string;
  plan: TadeuPlanSlug;
  features: LicensedFeature[];
  expiresAt: string | null;
  recheckAfterSeconds: number;
  checkedAt: string;
  offline?: boolean;
};

const APP_SLUG = 'inventexpert';
const CACHE_KEY = '@inventexpert:tadeu-license-cache';
const MAX_OFFLINE_MS = 24 * 60 * 60 * 1000;

const tadeuAppsUrl = (
  process.env.EXPO_PUBLIC_TADEU_APPS_URL ||
  'https://tadeu-apps-core-test2.vercel.app'
).replace(/\/$/, '');

// Estes valores são públicos por definição (URL + publishable key).
// Variáveis de ambiente continuam tendo prioridade para facilitar futuras rotações.
const tadeuSupabaseUrl =
  process.env.EXPO_PUBLIC_TADEU_APPS_SUPABASE_URL ||
  'https://chpcviinqqdjfsczvrvf.supabase.co';
const tadeuSupabaseAnonKey =
  process.env.EXPO_PUBLIC_TADEU_APPS_SUPABASE_ANON_KEY ||
  'sb_publishable_HGw-TdmBFPq4Lg8VvO_AOA_LygQWV01';

export const isTadeuLicenseConfigured = Boolean(
  tadeuAppsUrl && tadeuSupabaseUrl && tadeuSupabaseAnonKey,
);

const storageAdapter = Platform.OS === 'web'
  ? {
      getItem: async (key: string) =>
        typeof window !== 'undefined' ? window.localStorage.getItem(key) : null,
      setItem: async (key: string, value: string) => {
        if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
      },
      removeItem: async (key: string) => {
        if (typeof window !== 'undefined') window.localStorage.removeItem(key);
      },
    }
  : AsyncStorage;

let licenseAuthClient: SupabaseClient | null = null;

export function getTadeuLicenseAuthClient() {
  if (!isTadeuLicenseConfigured) return null;
  if (!licenseAuthClient) {
    licenseAuthClient = createClient(tadeuSupabaseUrl, tadeuSupabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storage: storageAdapter,
        storageKey: 'inventexpert-tadeu-apps-auth',
      },
    });
  }
  return licenseAuthClient;
}

export async function signInTadeuApps(email: string, password: string) {
  const client = getTadeuLicenseAuthClient();
  if (!client) throw new Error('Licenciamento Tadeu Apps não configurado neste build.');

  const { data, error } = await client.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw error;
  return data.session;
}

export async function signOutTadeuApps() {
  const client = getTadeuLicenseAuthClient();
  if (client) await client.auth.signOut();
  await AsyncStorage.removeItem(CACHE_KEY);
}

async function readCachedLicense(): Promise<TadeuLicense | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TadeuLicense;
    const checkedAt = new Date(parsed.checkedAt).getTime();
    if (!Number.isFinite(checkedAt) || Date.now() - checkedAt > MAX_OFFLINE_MS) return null;
    if (parsed.expiresAt && new Date(parsed.expiresAt).getTime() <= Date.now()) return null;
    return { ...parsed, offline: true };
  } catch {
    return null;
  }
}

async function cacheLicense(license: TadeuLicense) {
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(license));
}

export async function fetchTadeuLicense(): Promise<TadeuLicense> {
  const client = getTadeuLicenseAuthClient();
  if (!client) throw new Error('Licenciamento Tadeu Apps não configurado neste build.');

  const { data: sessionData } = await client.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error('TADEU_AUTH_REQUIRED');

  try {
    const response = await fetch(`${tadeuAppsUrl}/api/apps/${APP_SLUG}/license`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await response.json();

    if (!response.ok || payload?.license !== 'active') {
      await AsyncStorage.removeItem(CACHE_KEY);
      const reason = typeof payload?.reason === 'string' ? payload.reason : 'license_denied';
      throw new Error(`TADEU_LICENSE_DENIED:${reason}`);
    }

    const license: TadeuLicense = {
      ok: true,
      license: 'active',
      application: payload.application,
      plan: payload.plan,
      features: Array.isArray(payload.features) ? payload.features : [],
      expiresAt: payload.expiresAt ?? null,
      recheckAfterSeconds: payload.recheckAfterSeconds ?? 86400,
      checkedAt: new Date().toISOString(),
      offline: false,
    };

    await cacheLicense(license);
    return license;
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.startsWith('TADEU_LICENSE_DENIED:')) throw error;

    const cached = await readCachedLicense();
    if (cached) return cached;
    throw error;
  }
}

export function hasLicensedFeature(license: TadeuLicense | null, key: string) {
  if (!license) return false;
  if (license.plan === 'legacy') return true;
  return license.features.some((feature) => feature.key === key);
}

export function getLicensedLimit(license: TadeuLicense | null, key: string) {
  if (!license) return null;
  const feature = license.features.find((item) => item.key === key);
  if (!feature || feature.limitValue == null) return null;
  return { value: feature.limitValue, unit: feature.limitUnit };
}
