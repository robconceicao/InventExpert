/**
 * Espelha campos dos relatórios de acompanhamento (A–F) no ReportG (Resumo Final).
 * Só sobrescreve campos do G quando a origem tem valor não vazio.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  ReportA,
  ReportB,
  ReportC,
  ReportD,
  ReportE,
  ReportF,
  ReportG,
} from "../types";

export const REPORT_G_STORAGE_KEY = "inventexpert:reportG:resumo";

const isFilled = (v: unknown): boolean => {
  if (v === null || v === undefined) return false;
  if (typeof v === "boolean") return true;
  return String(v).trim().length > 0;
};

/** Mescla patch em base: só aplica chaves com valor preenchido na origem. */
export function mergeReportGPatch(
  base: Partial<ReportG>,
  patch: Partial<ReportG>,
): Partial<ReportG> {
  const next: Partial<ReportG> = { ...base };
  (Object.keys(patch) as (keyof ReportG)[]).forEach((key) => {
    const val = patch[key];
    if (isFilled(val)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (next as any)[key] = val;
    }
  });
  return next;
}

export function mapReportAToG(r: ReportA): Partial<ReportG> {
  return {
    lojaNum: r.lojaNum,
    lojaNome: r.lojaNome,
    chegadaEquipe: r.hrChegada,
    inicioDeposito: r.inicioContagemEstoque,
    terminoDeposito: r.terminoContagemEstoque,
    inicioLoja: r.inicioContagemLoja,
    terminoLoja: r.terminoContagemLoja,
    inicioDivergencia: r.inicioDivergencia,
    terminoDivergencia: r.terminoDivergencia,
    envioArquivo1: r.envioArquivo1,
    envioArquivo2: r.envioArquivo2,
    envioArquivo3: r.envioArquivo3,
    avalPrepDeposito: r.avalEstoque,
    avalPrepLoja: r.avalLoja,
    satisfacao: r.satisfacao,
    responsavel: r.lider,
    acuracidadeCliente: r.acuracidade,
    phCalculado: r.ph,
    terminoInventario: r.terminoInventario,
  };
}

export function mapReportBToG(r: ReportB): Partial<ReportG> {
  return {
    lojaNome: r.cliente,
    lojaNum: r.filial,
    responsavel: r.lider,
    pivRealizado: r.qtdEquipe,
    inicioDeposito: r.inicioContagemGeral,
    terminoDeposito: r.fimContagemGeral,
    inicioLoja: r.inicioContagemGeral,
    terminoLoja: r.fimContagemGeral,
    inicioControlados: r.div1Inicio && r.div1Controlados ? r.div1Inicio : "",
    inicioDivergencia: r.div1Inicio || r.div2Inicio,
    terminoDivergencia: r.div2Fim || r.div1Fim,
    qtdAlterados: r.div1Total || r.div2Total,
    qtdNaoContados: r.naoContadosTotal,
  };
}

export function mapReportCToG(r: ReportC): Partial<ReportG> {
  return {
    lojaNum: r.lojaNum,
    lojaNome: r.lojaNome,
    data: r.data,
    pivProgramado: r.pivProgramado,
    pivRealizado: r.pivRealizado,
    chegadaEquipe: r.chegadaEquipe,
    inicioDeposito: r.inicioDeposito,
    terminoDeposito: r.terminoDeposito,
    inicioLoja: r.inicioLoja,
    terminoLoja: r.terminoLoja,
    inicioControlados: r.inicioControlados,
    inicioDivergencia: r.inicioDivergencia,
    terminoDivergencia: r.terminoDivergencia,
    qtdAlterados: r.qtdAlterados,
    qtdNaoContados: r.qtdNaoContados,
    qtdEncontradosNaoContados: r.qtdEncontradosNaoContados,
    envioArquivo1: r.envioArquivo1,
    envioArquivo2: r.envioArquivo2,
    envioArquivo3: r.envioArquivo3,
    totalPecas: r.totalPecas,
    valorTotal: r.valorTotal,
    avalPrepDeposito: r.avalPrepDeposito,
    avalPrepLoja: r.avalPrepLoja,
    satisfacao: r.satisfacao,
    responsavel: r.responsavel,
    acuracidadeCliente: r.acuracidadeCliente,
    acuracidadeTerceirizada: r.acuracidadeTerceirizada,
    suporteSolicitado: r.suporteSolicitado,
    phCalculado: r.phCalculado,
    terminoInventario: r.terminoInventario,
  };
}

export function mapReportDToG(r: ReportD): Partial<ReportG> {
  return {
    lojaNum: r.lojaNum,
    lojaNome: r.lojaNome,
    data: r.data,
    pivProgramado: r.pivProgramado,
    pivRealizado: r.pivRealizado,
    chegadaEquipe: r.chegadaEquipe,
    inicioDeposito: r.inicioDeposito,
    terminoDeposito: r.terminoDeposito,
    inicioLoja: r.inicioLoja,
    terminoLoja: r.terminoLoja,
    inicioDivergencia: r.inicioDivergencia,
    terminoDivergencia: r.terminoDivergencia,
    qtdAlterados: r.qtdAlterados,
    qtdNaoContados: r.qtdNaoContados,
    qtdEncontradosNaoContados: r.qtdEncontradosNaoContados,
    totalPecas: r.totalPecas,
    valorTotal: r.valorTotal,
    avalPrepDeposito: r.avalPrepDeposito,
    avalPrepLoja: r.avalPrepLoja,
    satisfacao: r.satisfacao,
    responsavel: r.responsavel,
    acuracidadeCliente: r.acuracidadeCliente,
    acuracidadeTerceirizada: r.acuracidadeTerceirizada,
    suporteSolicitado: r.suporteSolicitado,
    terminoInventario: r.terminoInventario,
  };
}

export function mapReportEToG(r: ReportE): Partial<ReportG> {
  return {
    lojaNum: r.lojaNum,
    lojaNome: r.lojaNome,
    data: r.data,
    responsavel: r.responsavel,
    pivRealizado: r.qtdPessoas,
    chegadaEquipe: r.chegadaEquipe,
    inicioDeposito: r.inicioDeposito,
    terminoDeposito: r.terminoDeposito,
    inicioLoja: r.inicioLoja,
    terminoLoja: r.terminoLoja,
    inicioDivergencia: r.inicioDivergencia,
    terminoDivergencia: r.terminoDivergencia,
    totalPecas: r.totalPecas,
    valorTotal: r.valorTotal,
    avalPrepDeposito: r.avalEstoque,
    avalPrepLoja: r.avalLoja,
    terminoInventario: r.terminoInventario,
  };
}

export function mapReportFToG(r: ReportF): Partial<ReportG> {
  return {
    lojaNum: r.lojaNum,
    lojaNome: r.lojaNome,
    responsavel: r.lider,
    pivRealizado: r.qtdPessoas,
    chegadaEquipe: r.chegadaEquipe,
    inicioDeposito: r.inicioContagemEstoque,
    terminoDeposito: r.terminoContagemEstoque,
    inicioLoja: r.inicioContagemLoja,
    terminoLoja: r.terminoContagemLoja,
    inicioDivergencia: r.inicioDivergencia,
    terminoDivergencia: r.terminoDivergencia,
    totalPecas: r.qtdPecas,
    valorTotal: r.valorTotal,
    avalPrepDeposito: r.avalEstoque,
    avalPrepLoja: r.avalLoja,
    terminoInventario: r.terminoInventario,
  };
}

/** Persiste o espelhamento no AsyncStorage do ReportG. */
export async function applyMirrorToReportG(
  patch: Partial<ReportG>,
): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(REPORT_G_STORAGE_KEY);
    const current: Partial<ReportG> = raw ? JSON.parse(raw) : {};
    const merged = mergeReportGPatch(current, patch);
    await AsyncStorage.setItem(REPORT_G_STORAGE_KEY, JSON.stringify(merged));
  } catch (err) {
    console.warn("[mirrorToReportG] falha ao espelhar:", err);
  }
}
