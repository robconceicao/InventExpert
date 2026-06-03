import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  AvaliacaoHistoricoRecord,
  EvolucaoConferente,
  EvolucaoPeriodo,
  EvolucaoPeriodoResumo,
  InventoryCheckerEvaluation,
  InventoryOperationType,
} from "../types";
import { normalizeNomeKey } from "../utils/nomeMatching";

const STORAGE_KEY = "@inventexpert/avaliacao_historico_v1";
const MAX_RECORDS = 5000;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

async function loadAll(): Promise<AvaliacaoHistoricoRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AvaliacaoHistoricoRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveAll(records: AvaliacaoHistoricoRecord[]): Promise<void> {
  const trimmed = records.slice(-MAX_RECORDS);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

export async function salvarHistoricoAvaliacao(
  evaluations: InventoryCheckerEvaluation[],
  operationType: InventoryOperationType,
  dataInventario?: string,
): Promise<number> {
  const data = dataInventario ?? todayIso();
  const existing = await loadAll();
  const novos: AvaliacaoHistoricoRecord[] = evaluations.map((ev) => ({
    id: `${data}-${normalizeNomeKey(ev.input.nome)}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    nome: ev.input.nome,
    matricula: ev.input.matricula,
    dataInventario: data,
    operationType,
    scoreFinal: ev.scoreFinal,
    nivel: ev.nivel,
    pctErro: ev.pctErro,
    produtividade: ev.input.produtividade,
    itensPulados: ev.input.itensPulados ?? 0,
    itensDuplicados: ev.input.itensDuplicados ?? 0,
    perfilComportamental: ev.perfilComportamental,
  }));
  await saveAll([...existing, ...novos]);
  return novos.length;
}

export async function listarNomesHistorico(): Promise<string[]> {
  const all = await loadAll();
  const nomes = new Set(all.map((r) => r.nome));
  return [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function groupPeriodo(
  records: AvaliacaoHistoricoRecord[],
  periodo: EvolucaoPeriodo,
): EvolucaoPeriodoResumo[] {
  const map = new Map<string, AvaliacaoHistoricoRecord[]>();

  for (const r of records) {
    const d = new Date(r.dataInventario + "T12:00:00");
    let key: string;
    if (periodo === "DIARIO") {
      key = r.dataInventario;
    } else if (periodo === "MENSAL") {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    } else {
      const day = d.getDate();
      const half = day <= 15 ? "1" : "2";
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-Q${half}`;
    }
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, rows]) => {
      const n = rows.length;
      const label =
        periodo === "DIARIO"
          ? key.split("-").reverse().join("/")
          : periodo === "MENSAL"
            ? key.replace("-", "/")
            : key.replace("-Q", "ªQ ");
      return {
        label,
        scoreMedio: Math.round(rows.reduce((s, x) => s + x.scoreFinal, 0) / n),
        erroMedio: Math.round((rows.reduce((s, x) => s + x.pctErro, 0) / n) * 100) / 100,
        prodMedia: Math.round(rows.reduce((s, x) => s + x.produtividade, 0) / n),
        totalInventarios: n,
      };
    });
}

export async function getEvolucaoConferente(
  nome: string,
  periodo: EvolucaoPeriodo,
): Promise<EvolucaoConferente | null> {
  const key = normalizeNomeKey(nome);
  const all = await loadAll().then((rows) =>
    rows.filter((r) => normalizeNomeKey(r.nome) === key),
  );
  if (all.length === 0) return null;

  const periodos = groupPeriodo(all, periodo);
  const first = periodos[0]?.scoreMedio ?? 0;
  const last = periodos[periodos.length - 1]?.scoreMedio ?? 0;
  const variacaoScore = last - first;
  let tendencia: EvolucaoConferente["tendencia"] = "ESTAVEL";
  if (variacaoScore >= 3) tendencia = "MELHORA";
  else if (variacaoScore <= -3) tendencia = "PIORA";

  return {
    nome: all[all.length - 1].nome,
    periodos,
    tendencia,
    variacaoScore,
  };
}

export async function getEvolucaoEquipe(
  periodo: EvolucaoPeriodo,
): Promise<
  Array<{
    nome: string;
    scoreAtual: number;
    scoreAnterior: number | null;
    tendencia: EvolucaoConferente["tendencia"];
    perfil?: string;
  }>
> {
  const all = await loadAll();
  const byNome = new Map<string, AvaliacaoHistoricoRecord[]>();
  for (const r of all) {
    const k = normalizeNomeKey(r.nome);
    if (!byNome.has(k)) byNome.set(k, []);
    byNome.get(k)!.push(r);
  }

  const result: Array<{
    nome: string;
    scoreAtual: number;
    scoreAnterior: number | null;
    tendencia: EvolucaoConferente["tendencia"];
    perfil?: string;
  }> = [];

  for (const rows of byNome.values()) {
    const evo = groupPeriodo(rows, periodo);
    if (evo.length === 0) continue;
    const atual = evo[evo.length - 1].scoreMedio;
    const anterior = evo.length > 1 ? evo[evo.length - 2].scoreMedio : null;
    let tendencia: EvolucaoConferente["tendencia"] = "ESTAVEL";
    if (anterior !== null) {
      const diff = atual - anterior;
      if (diff >= 3) tendencia = "MELHORA";
      else if (diff <= -3) tendencia = "PIORA";
    }
    const last = rows[rows.length - 1];
    result.push({
      nome: last.nome,
      scoreAtual: atual,
      scoreAnterior: anterior,
      tendencia,
      perfil: last.perfilComportamental,
    });
  }

  return result.sort((a, b) => b.scoreAtual - a.scoreAtual);
}
