export interface ReportA {
  lojaNum: string;
  lojaNome: string;
  enderecoLoja?: string;
  qtdColaboradores: string;
  lider: string;
  hrChegada: string;
  inicioContagemEstoque: string;
  terminoContagemEstoque: string;
  inicioContagemLoja: string;
  terminoContagemLoja: string;
  inicioDivergencia: string;
  terminoDivergencia: string;
  terminoInventario: string;
  avanco22h: string;
  avanco00h: string;
  avanco01h: string;
  avanco03h: string;
  avanco04h: string;
  avancoExtraHora: string; // opcional: incluir novo horário
  avancoExtraValor: string;
  envioArquivo1: string;
  envioArquivo2: string;
  envioArquivo3: string;
  avalEstoque: string;
  avalLoja: string;
  acuracidade: string;
  percentualAuditoria: string;
  ph: string;
  satisfacao: string;
  contagemAntecipada: boolean | null;
}

// ---------------------------------------------------------------------------
// REPORT B — Farmácias
// ---------------------------------------------------------------------------
export interface ReportBFarmacias {
  lojaNum: string;
  lojaNome: string;
  data: string;
  pivProgramado: string;
  pivRealizado: string;
  chegadaEquipe: string;
  inicioDeposito: string;
  terminoDeposito: string;
  inicioLoja: string;
  terminoLoja: string;
  inicioAuditoriaCliente: string;
  terminoAuditoriaCliente: string;
  inicioControlados: string;
  terminoControlados: string;
  inicioDivergencia: string;
  terminoDivergencia: string;
  qtdAlterados: string;
  inicioNaoContados: string;
  terminoNaoContados: string;
  qtdNaoContados: string;
  qtdEncontradosNaoContados: string;
  inicioRecontCliente: string;
  terminoRecontCliente: string;
  qtdItensRecontCliente: string;
  qtdAltRecontCliente: string;
  envioArquivo1: string;
  envioArquivo2: string;
  envioArquivo3: string;
  totalPecas: string;
  valorTotal: string;
  avalPrepDeposito: string;
  avalPrepLoja: string;
  satisfacao: string;
  responsavel: string;
  acuracidadeCliente: string;
  acuracidadeTerceirizada: string;
  suporteSolicitado: boolean | null;
  phCalculado: string;
  terminoInventario: string;
}

// ---------------------------------------------------------------------------
// REPORT B — Mercados (menos Atacado e Hipermercados)
// ---------------------------------------------------------------------------
export interface ReportBMercados {
  lojaNome: string;
  lojaNum: string;
  data: string;
  pivProgramado: string;
  pivRealizado: string;
  chegadaEquipe: string;
  inicioDeposito: string;
  terminoDeposito: string;
  inicioLoja: string;
  terminoLoja: string;
  inicioAuditoriaCliente: string;
  terminoAuditoriaCliente: string;
  inicioDivergencia: string;
  terminoDivergencia: string;
  qtdAlterados: string;
  inicioNaoContados: string;
  qtdNaoContados: string;
  qtdEncontradosNaoContados: string;
  terminoNaoContados: string;
  totalPecas: string;
  valorTotal: string;
  avalPrepDeposito: string;
  avalPrepLoja: string;
  satisfacao: string;
  responsavel: string;
  acuracidadeCliente: string;
  acuracidadeTerceirizada: string;
  suporteSolicitado: boolean | null;
  terminoInventario: string;
}

// ---------------------------------------------------------------------------
// REPORT B — Outros Estabelecimentos em Geral
// ---------------------------------------------------------------------------
export interface ReportBOutros {
  lojaNum: string;
  lojaNome: string;
  data: string;
  responsavel: string;
  qtdPessoas: string;
  chegadaEquipe: string;
  inicioDeposito: string;
  terminoDeposito: string;
  inicioLoja: string;
  terminoLoja: string;
  inicioAuditoriaCliente: string;
  terminoAuditoriaCliente: string;
  inicioDivergencia: string;
  terminoDivergencia: string;
  totalPecas: string;
  valorTotal: string;
  pctInv: string;
  avalEstoque: string;
  avalLoja: string;
  terminoInventario: string;
}

// Union para uso genérico
export type ReportBMode = "farmacias" | "mercados" | "outros";
export type ReportB = ReportBFarmacias | ReportBMercados | ReportBOutros;

// Mantido para compatibilidade com imports existentes no parsers.ts
export interface ReportC { _removed: true; }
export interface ReportD { _removed: true; }

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

export type CheckerExperienceLevel = "novato" | "junior" | "pleno" | "senior" | "expert";

export interface CheckerDBRecord {
  nome: string;
  inventarios_base: number;
  data_registro: string;
}

export type InventoryOperationType = "FARMACIA" | "SUPERMERCADO" | "LOJA_GERAL";

export interface InventoryCheckerInput {
  nome: string;
  qtde: number;
  qtde1a1: number;
  produtividade: number;
  erro: number;
  experiencia?: CheckerExperienceLevel;
  itensPulados?: number;
  itensDuplicados?: number;
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
  minimoEsperado?: number;
  icv?: number;
  pontosVolume?: number;
  bonusVolume?: number;
  penalidadeVolume?: number;
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
