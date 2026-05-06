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
  valorTotal: number | "";
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
  phCalculado?: number | "";
  terminoInventario: string;
}

export interface ReportC {
  inventario_ref: string; // ex: "12/12/2023"
  cliente: string;
  filial: string;
  lider: string;
  qtdEquipe: number | "";
  qtdFaltas: number | "";
  inicioContagemGeral: string;
  fimContagemGeral: string;
  pctInventario: number | "";
  naoContadosInicio: string;
  naoContadosTotal: number | "";
  naoContadosFim: string;
  div1Inicio: string;
  div1Controlados: number | "";
  div1Negativos: number | "";
  div1Positivos: number | "";
  div1Total: number | "";
  div1Fim: string;
  div2Inicio: string;
  div2Negativos: number | "";
  div2Positivos: number | "";
  div2Total: number | "";
  div2Fim: string;
}

export interface ReportD {
  loja: string;
  lojaNum: string;
  lider: string;
  qtdPessoas: number | "";
  qtdPecas: number | "";
  pctInv: number | "";
  chegada: string;
  inicioContagemEstoque: string;
  terminoContagemEstoque: string;
  inicioContagemLoja: string;
  terminoContagemLoja: string;
  inicioAuditoria: string;
  terminoAuditoria: string;
  inicioDivergencia: string;
  terminoDivergencia: string;
  avalEstoque: number | "";
  avalLoja: number | "";
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

// =============================================================================
// BACKEND MODULES — Motor de Escalas
// =============================================================================

// ---------------------------------------------------------------------------
// CLIENTES
// ---------------------------------------------------------------------------
export interface Cliente {
  id: string;
  nome: string;
  cidade: string;
  estado: string;
  endereco?: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export type ClienteInput = Omit<Cliente, 'id' | 'created_at' | 'updated_at'>;

// ---------------------------------------------------------------------------
// COLABORADORES
// ---------------------------------------------------------------------------
export type ColaboradorFuncao = 'LIDER' | 'CONFERENTE';

export interface Colaborador {
  id: string;
  matricula?: string;
  nome: string;
  funcao: ColaboradorFuncao;
  cidade: string;
  estado: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export type ColaboradorInput = Omit<Colaborador, 'id' | 'created_at' | 'updated_at'>;

// ---------------------------------------------------------------------------
// HISTÓRICO DE PRODUTIVIDADE
// ---------------------------------------------------------------------------
export interface Produtividade {
  id: string;
  colaborador_id: string;
  inventario_ref?: string;
  data_inventario: string;        // ISO date string
  qtde: number;
  qtde1a1: number;
  produtividade_ph: number;       // itens/hora
  erro: number;
  horas_estimadas?: number;
  operacao_tipo?: InventoryOperationType;
  score_final?: number;
  nivel?: InventoryScoreLevel;
  created_at: string;
}

export type ProdutividadeInput = Omit<Produtividade, 'id' | 'created_at'>;

// ---------------------------------------------------------------------------
// INVENTÁRIOS
// ---------------------------------------------------------------------------
export type InventarioStatus = 'AGENDADO' | 'EM_ANDAMENTO' | 'CONCLUIDO' | 'CANCELADO';

export interface Inventario {
  id: string;
  cliente_id: string;
  data: string;                   // ISO date string
  hora_inicio?: string;
  tipo_operacao: InventoryOperationType;
  headcount: number;
  status: InventarioStatus;
  observacoes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Joins opcionais
  clientes?: Pick<Cliente, 'id' | 'nome' | 'cidade' | 'estado'>;
}

export type InventarioInput = Omit<Inventario, 'id' | 'created_at' | 'updated_at' | 'clientes'>;

// ---------------------------------------------------------------------------
// ESCALA
// ---------------------------------------------------------------------------
export type EscalaPapel = 'LIDER' | 'CONFERENTE' | 'RESERVA';

export interface EscalaItem {
  id: string;
  inventario_id: string;
  colaborador_id: string;
  papel: EscalaPapel;
  score_final?: number;
  gerado_em: string;
  confirmado: boolean;
  observacoes?: string;
  // Joins opcionais
  colaboradores?: Pick<Colaborador, 'id' | 'nome' | 'funcao' | 'cidade' | 'matricula'>;
}

// ---------------------------------------------------------------------------
// VIEWS
// ---------------------------------------------------------------------------
export interface ProdutividadeConsolidada {
  colaborador_id: string;
  nome: string;
  funcao: ColaboradorFuncao;
  cidade: string;
  ativo: boolean;
  total_inventarios: number;
  produtividade_media: number;
  erro_medio_pct: number;
  score_base: number;
  ultimo_inventario?: string;
}

// ---------------------------------------------------------------------------
// RESPOSTAS DE RPC
// ---------------------------------------------------------------------------
export interface GerarEscalaResult {
  sucesso: boolean;
  inventario_id: string;
  data: string;
  cliente: string;
  headcount: number;
  total_escalados: number;
  avisos: string[];
}

export interface ListarEscalaRow {
  escala_id: string;
  papel: EscalaPapel;
  score_final: number;
  confirmado: boolean;
  colaborador_id: string;
  nome: string;
  funcao: ColaboradorFuncao;
  cidade: string;
  matricula?: string;
}

/** Resposta padronizada para operações de CRUD em todos os módulos */
export interface ICrudResult<T = void> {
  sucesso: boolean;
  dados?: T;
  erro?: string;
}

// ---------------------------------------------------------------------------
// ERROS DE NEGÓCIO
// ---------------------------------------------------------------------------
export class EscalaInsuficienteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EscalaInsuficienteError';
  }
}
