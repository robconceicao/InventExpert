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

export interface ReportC {
    inventario_ref: string;
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

// =============================================================================
// INVENTEXP — AVALIAÇÃO DE CONFERENTES (contrato v2.1)
// -----------------------------------------------------------------------------
// Convenção de nomes:
//   • Canônico (preferido em código novo / Supabase): snake_case
//     area_nome, real_pct, limite_pct, area_critica, bloco_pct, ...
//   • Legado (compat testes/UI antigos): camelCase
//     area, pctBloco, limitePermitido, critica, modalidadeContrato, ...
//
// Ao PRODUZIR ViolacaoBloco, preferir `buildViolacaoBloco()` (preenche os dois lados).
// Ao LER, usar helpers getViolacaoArea / getViolacaoRealPct / etc.
// Modalidade canônica: CLT | INTERMITENTE | FREE  (FREE_LANCE/FREELANCE = alias de FREE)
// =============================================================================

export type InventoryOperationType =
  | 'FARMACIA'
  | 'SUPERMERCADO'
  | 'HIPERMERCADO'
  | 'LOJA_GERAL'
  | 'ATACADO';

export type PerfilComportamental =
  | 'PULA_ITENS'
  | 'FANTASMA'
  | 'DESATENTO_GERAL'
  | 'EQUILIBRADO';

/** Valores canônicos de modalidade contratual. */
export type ModalidadeContratoCanonico = 'CLT' | 'INTERMITENTE' | 'FREE';

/**
 * Modalidade aceita na entrada (parse/CSV/testes).
 * Preferir `ModalidadeContratoCanonico` em código novo.
 * `FREE_LANCE` e `FREELANCE` são aliases legados de `FREE`.
 */
export type ModalidadeContrato =
  | ModalidadeContratoCanonico
  | 'FREE_LANCE'
  | 'FREELANCE';

/**
 * Violação de limite de bloco por área.
 * Campos canônicos (snake) e aliases legados (camel) coexistem de propósito.
 */
export interface ViolacaoBloco {
  // --- canônico (preferido) ---
  area_nome?: string;
  real_pct?: number;
  limite_pct?: number;
  area_critica?: boolean;
  /** real_pct / limite_pct; Infinity quando limite_pct === 0 */
  excesso_fator?: number;

  // --- aliases legados ---
  /** @deprecated use area_nome */
  area?: string;
  /** @deprecated use real_pct */
  pctBloco?: number;
  /** @deprecated use limite_pct */
  limitePermitido?: number;
  /** @deprecated use area_critica */
  critica?: boolean;
}

/** Erro localizado por área/produto (RAIO-X). */
export interface ErroAreaDetalhe {
  area_nome: string;
  tipo_erro: 'EXECUCAO' | 'OMISSAO' | 'DUPLICACAO' | 'AJUSTE_SECAO';
  ajuste_qtd: number;
  produto_codigo?: string;
  produto_nome?: string;
}

/**
 * Acurácia por área (seção SUAS SEÇÕES).
 * Canônico alinhado a PRODUÇÃO_SEÇÃO + limites; aliases legados para testes/relatórios.
 */
export interface SectionAccuracyRecord {
  // --- canônico ---
  area_nome?: string;
  secoes_contadas?: number;
  qtd_c1?: number;
  ajuste_a1?: number;
  ajuste_a2?: number;
  ajuste_a3?: number;
  qtd_final?: number;
  bloco_pct?: number;
  limite_bloco?: number;
  violacao_bloco?: boolean;
  area_critica?: boolean;
  /** Conferente dono da linha (PRODUÇÃO_SEÇÃO) */
  matricula?: string;
  nome?: string;

  // --- objeto de violação (quando calculado) ---
  violacaoBloco?: ViolacaoBloco | null;

  // --- aliases legados / métricas derivadas ---
  /** @deprecated use area_nome */
  area?: string;
  totalItens?: number;
  /** alias de qtd_c1 em fixtures */
  totalC1?: number;
  erros?: number;
  ajusteAbsoluto?: number;
  ajusteLiquido?: number;
  pctErro?: number;
  /** @deprecated use bloco_pct */
  pctBloco?: number;
  acuracidade?: number;
  colaboradores?: string[];
}

/**
 * Entrada bruta para avaliação de um conferente.
 * Campos principais (qtde, qtde1a1, produtividade, erro) alimentam o motor atual.
 * Campos v2 (pctErro, sectionAccuracy, contagensDetalhadas) enriquecem RAIO-X.
 */
export interface InventoryCheckerInput {
  nome: string;
  matricula?: string;
  experiencia?: string;
  /** Preferido na UI/testes atuais */
  modalidadeContrato?: ModalidadeContrato;
  /** Alias v2 de modalidadeContrato */
  modalidade?: ModalidadeContrato;

  qtde: number;
  qtde1a1: number;
  produtividade: number;
  erro: number;
  itensPulados?: number;
  itensDuplicados?: number;
  erroSecao?: number;
  /** LIDER / LÍDER — excluído da avaliação */
  role?: string;

  // --- aliases / campos derivados (v2) ---
  totalPecas?: number;
  ritmoMedio?: number;
  pctErro?: number;
  pctBloco?: number;
  errosExecucao?: number;
  omissoes?: number;
  duplicacoes?: number;
  icsi?: number;
  sectionAccuracy?: SectionAccuracyRecord[];
  contagensDetalhadas?: ContagemDetalhada[];
}

export type InventoryScoreLevel = 'EXCELENTE' | 'BOM' | 'ATENCAO' | 'CRITICO';

/**
 * Resultado da avaliação.
 * Bloco principal = contrato usado por evaluateChecker / UI.
 * Campos opcionais v2 (classificacao, violacoesBloco, scoreICV) para evolução.
 */
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
  secoes?: SectionAccuracyRecord[];
  perfil?: PerfilComportamental;
  /** Preferido pelo motor atual */
  violacoes?: ViolacaoBloco[];

  // --- espelho v2 / relatórios ---
  matricula?: string;
  nome?: string;
  modalidade?: ModalidadeContrato;
  /** Reservado; 3 pilares ativos na v2.1 (ICV não implementado) */
  scoreICV?: number;
  classificacao?: 'CRÍTICO' | 'REGULAR' | 'BOM' | 'EXCELENTE';
  /** Alias de violacoes */
  violacoesBloco?: ViolacaoBloco[];
  errosAreaDetalhe?: ErroAreaDetalhe[];
  rankingPos?: number;
}

// ---------------------------------------------------------------------------
// Helpers de normalização (leitura/escrita dual de campos)
// ---------------------------------------------------------------------------

/** Normaliza modalidade para o valor canônico. FREE_LANCE/FREELANCE → FREE. */
export function normalizeModalidade(
  m?: ModalidadeContrato | string | null,
): ModalidadeContratoCanonico {
  if (!m) return 'CLT';
  const u = String(m).trim().toUpperCase();
  if (u === 'FREE' || u === 'FREE_LANCE' || u === 'FREELANCE' || u === 'FREE LANCE') {
    return 'FREE';
  }
  if (u === 'INTERMITENTE') return 'INTERMITENTE';
  return 'CLT';
}

export function isModalidadeFree(m?: ModalidadeContrato | string | null): boolean {
  return normalizeModalidade(m) === 'FREE';
}

export function getViolacaoArea(v: ViolacaoBloco): string {
  return (v.area_nome ?? v.area ?? '').trim();
}

export function getViolacaoRealPct(v: ViolacaoBloco): number {
  return v.real_pct ?? v.pctBloco ?? 0;
}

export function getViolacaoLimitePct(v: ViolacaoBloco): number {
  return v.limite_pct ?? v.limitePermitido ?? 0;
}

export function getViolacaoCritica(v: ViolacaoBloco): boolean {
  return v.area_critica ?? v.critica ?? false;
}

export function getViolacaoExcessoFator(v: ViolacaoBloco): number {
  if (v.excesso_fator != null && Number.isFinite(v.excesso_fator)) return v.excesso_fator;
  if (v.excesso_fator === Infinity) return Infinity;
  const limite = getViolacaoLimitePct(v);
  const real = getViolacaoRealPct(v);
  if (limite <= 0) return real > 0 ? Infinity : 0;
  return real / limite;
}

/**
 * Constrói ViolacaoBloco preenchendo canônico + aliases legados
 * (compatível com motor, relatórios e testes).
 */
export function buildViolacaoBloco(args: {
  area_nome: string;
  real_pct: number;
  limite_pct: number;
  area_critica: boolean;
  excesso_fator?: number;
}): ViolacaoBloco {
  const excesso =
    args.excesso_fator ??
    (args.limite_pct > 0
      ? args.real_pct / args.limite_pct
      : args.real_pct > 0
        ? Infinity
        : 0);

  return {
    // canônico
    area_nome: args.area_nome,
    real_pct: args.real_pct,
    limite_pct: args.limite_pct,
    area_critica: args.area_critica,
    excesso_fator: excesso,
    // aliases legados
    area: args.area_nome,
    pctBloco: args.real_pct,
    limitePermitido: args.limite_pct,
    critica: args.area_critica,
  };
}

/** Nome de área a partir de SectionAccuracyRecord (canônico ou legado). */
export function getSectionAreaNome(s: SectionAccuracyRecord): string {
  return (s.area_nome ?? s.area ?? '').trim();
}

/** % de bloco da seção (canônico ou legado). */
export function getSectionBlocoPct(s: SectionAccuracyRecord): number {
  return s.bloco_pct ?? s.pctBloco ?? 0;
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

// ---------------------------------------------------------------------------
// PRC — Contagem detalhada por conferente/seção (linha resolvida do .prc)
// ---------------------------------------------------------------------------
/**
 * Uma bip/linha de contagem após parse + lookup.
 * Campos principais são obrigatórios no contrato v2.1 (prcParser sempre preenche).
 * `nome` e `barcode` permanecem opcionais (legado/auditoria).
 */
export interface ContagemDetalhada {
  matricula: string;
  /** Código numérico 6 dígitos do .prc */
  area_codigo: string;
  /** Resolvido via secao_lookup + normalizarNomeArea ('' até resolver) */
  area_nome: string;
  /** Código interno stripped (sem zeros à esquerda) */
  produto_codigo: string;
  /** cadastro.txt ou invent_DSP.old ('' até resolver) */
  produto_nome: string;
  /** EAN real do invent_DSP ('' se indisponível) */
  produto_ean: string;
  /** Classificação legal: 'A2', 'C1', '-B2'... ou '' */
  produto_classe: string;
  quantidade: number;
  /** true quando flag = 'X' no .prc */
  is_bloco: boolean;
  data_hora: Date;
  /** Nome do conferente (quando enriquecido) */
  nome?: string;
  /** @deprecated preferir produto_codigo / produto_ean */
  barcode?: string;
}


export interface AuditoriaAcuracidadeRow {
  secao: string;
  ean: string;
  descricao: string;
  c1: number;
  a1: number;
  a2: number;
  a3: number;
  final: number;
  ajst: number;
}

export interface AuditoriaAgenteInfo {
  codigo: string;
  nome: string;
  cpf: string;
}

export interface AuditoriaSecaoDivergente {
  secao: string;
  ean: string;
  descricao: string;
  erro_secao: number;
  ajst?: number;
  quem_contou_matricula?: string;
}

/** Divergência física (AJST ≠ 0) em produto/seção contados pelo próprio conferente. */
export interface DivergenciaProdutoSetor {
  secao: string;
  ean: string;
  descricao: string;
  c1: number;
  final: number;
  ajst: number;
}

export interface AuditoriaNivel1Result {
  codigo_conferente: string;
  nome: string;
  cpf: string;
  erro_real: number;
  erro_atribuido: number;
  diferenca: number;
  status: 'OK' | 'DIVERGENCIA' | 'ERRO_DE_TERCEIRO_RECEBIDO' | 'ERRO_PROPRIO_EM_OUTRO';
  secoes_divergentes: AuditoriaSecaoDivergente[];
  /** Erros nas seções que o conferente realmente contou (por produto/setor). */
  divergencias_detalhadas?: DivergenciaProdutoSetor[];
}
