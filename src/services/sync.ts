import AsyncStorage from '@react-native-async-storage/async-storage';

import { isSupabaseConfigured, supabase } from '@/src/services/supabase';

const QUEUE_KEY = 'inventexpert:sync:queue';

type SyncType = 'reportA' | 'reportB' | 'attendance';

type SyncItem = {
  id: string;
  type: SyncType;
  payload: Record<string, unknown>;
  userId: string | null;
  createdAt: string;
};

const tableForType: Record<SyncType, string> = {
  reportA: 'report_a',
  reportB: 'report_b',
  attendance: 'attendance',
};

const readQueue = async (): Promise<SyncItem[]> => {
  const stored = await AsyncStorage.getItem(QUEUE_KEY);
  if (!stored) {
    return [];
  }
  try {
    return JSON.parse(stored) as SyncItem[];
  } catch {
    return [];
  }
};

const writeQueue = async (queue: SyncItem[]) => {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
};

export const enqueueSyncItem = async (type: SyncType, payload: Record<string, unknown>) => {
  let userId: string | null = null;
  if (supabase) {
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  }
  const queue = await readQueue();
  const item: SyncItem = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    payload,
    userId,
    createdAt: new Date().toISOString(),
  };
  queue.push(item);
  await writeQueue(queue);
};

export const syncQueue = async () => {
  if (!isSupabaseConfigured || !supabase) {
    return { status: 'skipped' as const };
  }
  const queue = await readQueue();
  if (queue.length === 0) {
    return { status: 'empty' as const };
  }

  const remaining: SyncItem[] = [];
  for (const item of queue) {
    if (!item.userId) {
      remaining.push(item);
      continue;
    }
    const table = tableForType[item.type];
    const { error } = await supabase.from(table).insert({
      payload: item.payload,
      user_id: item.userId,
      created_at: item.createdAt,
    });
    if (error) {
      remaining.push(item);
    }
  }

  await writeQueue(remaining);
  return { status: remaining.length === 0 ? 'synced' : 'partial', remaining: remaining.length };
};
