import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CheckerDBRecord, CheckerExperienceLevel, AttendanceData } from "../types";
import cadfunSeed from "../config/cadfun_seed.json";

const CHECKER_DB_KEY = "inventexpert:checkers_db";
const HISTORY_KEY = "inventexpert:attendance:history";
const SEEDED_FLAG_KEY = "inventexpert:cadfun_seeded_v1";

// Helper to convert base level to number of inventories
export function levelToBaseInventories(level: CheckerExperienceLevel): number {
  switch (level) {
    case "novato":
      return 0;
    case "junior":
      return 3;
    case "pleno":
      return 11;
    case "senior":
      return 31;
    case "expert":
      return 51;
    default:
      return 11;
  }
}

// Helper to convert total inventories to level
export function totalInventoriesToLevel(total: number): CheckerExperienceLevel {
  if (total < 3) return "novato";
  if (total <= 10) return "junior";
  if (total <= 30) return "pleno";
  if (total <= 50) return "senior";
  return "expert";
}

export async function getCheckersDB(): Promise<CheckerDBRecord[]> {
  try {
    const stored = await AsyncStorage.getItem(CHECKER_DB_KEY);
    let currentDb: CheckerDBRecord[] = [];
    if (stored) {
      currentDb = JSON.parse(stored) as CheckerDBRecord[];
    }

    // Check if we need to seed or merge CADFUN checkers
    const alreadySeeded = await AsyncStorage.getItem(SEEDED_FLAG_KEY);
    if (!alreadySeeded) {
      const seed = cadfunSeed as CheckerDBRecord[];
      const mergedMap = new Map<string, CheckerDBRecord>();

      // Load seed checkers first
      for (const item of seed) {
        mergedMap.set(item.nome.toLowerCase().trim(), item);
      }

      // Merge with current DB records
      for (const item of currentDb) {
        mergedMap.set(item.nome.toLowerCase().trim(), item);
      }

      const mergedList = Array.from(mergedMap.values());
      await AsyncStorage.setItem(CHECKER_DB_KEY, JSON.stringify(mergedList));
      await AsyncStorage.setItem(SEEDED_FLAG_KEY, "true");
      return mergedList;
    }

    return currentDb;
  } catch (error) {
    console.warn("Failed to load checkers DB", error);
  }
  return [];
}


export async function saveCheckerToDB(nome: string, level: CheckerExperienceLevel): Promise<void> {
  const db = await getCheckersDB();
  const index = db.findIndex((c) => c.nome.toLowerCase() === nome.toLowerCase());
  const base = levelToBaseInventories(level);

  if (index >= 0) {
    db[index].inventarios_base = base;
  } else {
    db.push({
      nome,
      inventarios_base: base,
      data_registro: new Date().toISOString(),
    });
  }

  await AsyncStorage.setItem(CHECKER_DB_KEY, JSON.stringify(db));
}

export async function removeCheckerFromDB(nome: string): Promise<void> {
  const db = await getCheckersDB();
  const updated = db.filter((c) => c.nome.toLowerCase() !== nome.toLowerCase());
  await AsyncStorage.setItem(CHECKER_DB_KEY, JSON.stringify(updated));
}

export async function getCheckersAttendanceCount(): Promise<Record<string, number>> {
  try {
    const storedHistory = await AsyncStorage.getItem(HISTORY_KEY);
    const history = storedHistory
      ? (JSON.parse(storedHistory) as { attendance: AttendanceData }[])
      : [];
    
    const counts: Record<string, number> = {};
    for (const item of history) {
      for (const col of item.attendance.colaboradores) {
        if (col.status === "PRESENTE") {
          const key = col.nome.toLowerCase().trim();
          counts[key] = (counts[key] || 0) + 1;
        }
      }
    }
    return counts;
  } catch (error) {
    console.warn("Failed to load attendance history", error);
    return {};
  }
}

export async function getCheckerCurrentLevel(nome: string): Promise<CheckerExperienceLevel> {
  const [db, attendanceCounts] = await Promise.all([
    getCheckersDB(),
    getCheckersAttendanceCount(),
  ]);

  const key = nome.toLowerCase().trim();
  const record = db.find((c) => c.nome.toLowerCase().trim() === key);
  
  const baseInventories = record ? record.inventarios_base : 0;
  const attendanceCount = attendanceCounts[key] || 0;
  
  const total = baseInventories + attendanceCount;
  
  // Se o conferente não está no DB e não tem presença, assumir pleno como padrão para não prejudicar
  if (!record && attendanceCount === 0) {
    return "pleno";
  }

  return totalInventoriesToLevel(total);
}

export async function getAllCheckersProgress() {
  const [db, attendanceCounts] = await Promise.all([
    getCheckersDB(),
    getCheckersAttendanceCount(),
  ]);

  const allNames = new Set([
    ...db.map(c => c.nome),
    ...Object.keys(attendanceCounts).map(k => k), // Will map lowercase keys, needs proper casing later
  ]);

  // To preserve original casing, we'll try to find it in DB first
  const results = [];
  const processedKeys = new Set<string>();

  for (const record of db) {
    const key = record.nome.toLowerCase().trim();
    processedKeys.add(key);
    const presences = attendanceCounts[key] || 0;
    const total = record.inventarios_base + presences;
    results.push({
      nome: record.nome,
      base: record.inventarios_base,
      presencas: presences,
      total,
      nivel: totalInventoriesToLevel(total),
      registrado: true,
    });
  }

  // Now add people who only exist in attendance
  try {
    const storedHistory = await AsyncStorage.getItem(HISTORY_KEY);
    const history = storedHistory
      ? (JSON.parse(storedHistory) as { attendance: AttendanceData }[])
      : [];
    
    for (const item of history) {
      for (const col of item.attendance.colaboradores) {
        if (col.status === "PRESENTE") {
          const key = col.nome.toLowerCase().trim();
          if (!processedKeys.has(key)) {
            processedKeys.add(key);
            const presences = attendanceCounts[key] || 0;
            results.push({
              nome: col.nome,
              base: 0,
              presencas: presences,
              total: presences,
              nivel: totalInventoriesToLevel(presences),
              registrado: false,
            });
          }
        }
      }
    }
  } catch (error) {
    // ignore
  }

  return results.sort((a, b) => b.total - a.total);
}
