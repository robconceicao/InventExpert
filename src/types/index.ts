export interface ReportA {
  lojaNum: string;
  lojaNome: string;
  enderecoLoja?: string;
  qtdColaboradores: number | "";
  lider: string;
  hrChegada: string;
  inicioContagemEstoque: string;
  terminoContagemEstoque: string;
  inicioContagemLoja: string;
  terminoContagemLoja: string;
  inicioDivergencia: string;
  terminoDivergencia: string;
  terminoInventario: string;
  avanco22h: number | "";
  avanco00h: number | "";
  avanco01h: number | "";
  avanco03h: number | "";
  avanco04h: number | "";
  avancoExtraHora: string; // opcional: incluir novo horário
  avancoExtraValor: number | "";
  envioArquivo1: string;
  envioArquivo2: string;
  envioArquivo3: string;
  avalEstoque: number | "";
  avalLoja: number | "";
  acuracidade: number | "";
  percentualAuditoria: number | "";
  ph: number | "";
  satisfacao: number | string;
  contagemAntecipada: boolean | null;
}

export interface ReportB {
  cliente: string;
  lojaNum: string;
  data: string;
  pivProgramado: number | "";
  pivRealizado: number | "";
  chegadaEquipe: string;
  inicioDeposito: string;
  terminoDeposito: string;
  inicioLoja: string;
  terminoLoja: string;
  inicioAuditoriaCliente: string;
  terminoAuditoriaCliente: string;
  inicioControlados: string;
  inicioDivergencia: string;
  terminoDivergencia: string;
  inicioNaoContados: string;
  terminoNaoContados: string;
  qtdAlterados: number | "";
  qtdNaoContados: number | "";
  qtdEncontradosNaoContados: number | "";
  totalPecas: number | "";
  valorFinanceiro: number | "";
  envioArquivo1: string;
  envioArquivo2: string;
  envioArquivo3: string;
  avalPrepDeposito: number | "";
  avalPrepLoja: number | "";
  acuracidadeCliente: number | "";
  acuracidadeTerceirizada: number | "";
  satisfacao: number | string;
  responsavel: string;
  suporteSolicitado: boolean | null;
  terminoInventario: string;
}

export interface AttendanceCollaborator {
  id: string;
  nome: string;
  numero?: number; // número da escala (ex: 1, 2, 3)
  ehBkp?: boolean; // true se veio de linha "BKP NOME"
  status: "PRESENTE" | "AUSENTE" | "NAO_DEFINIDO";
  substituto?: string;
}

export interface AttendanceData {
  data: string;
  loja: string;
  enderecoLoja: string;
  colaboradores: AttendanceCollaborator[];
}

// ========== INVENTEXP - AVALIAÇÃO DE CONFERENTES ==========

export type InventoryOperationType = "FARMACIA" | "SUPERMERCADO" | "LOJA_GERAL";

export interface InventoryCheckerInput {
  nome: string;
  qtde: number;
  qtde1a1: number;
  produtividade: number;
  erro: number;
}

export type InventoryScoreLevel = "EXCELENTE" | "BOM" | "ATENCAO" | "CRITICO";

export interface InventoryCheckerEvaluation {
  input: InventoryCheckerInput;
  operationType: InventoryOperationType;
  pctErro: number;
  pctBloco: number;
  scoreQualidade: number;
  scoreProdutividade: number;
  scoreAderencia: number;
  scoreFinal: number;
  nivel: InventoryScoreLevel;
  nivelColor: string;
  tags: string[];
}
