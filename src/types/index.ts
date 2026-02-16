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
  satisfacao: number | "";
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
  satisfacao: number | "";
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

// ========== AVALIAÇÃO DE CONFERENTES ==========
export type TipoOperacao = "farmacia" | "supermercado" | "atacarejo";

export interface ConferrerInput {
  nome: string;
  qtde: number;
  horas: number;
  produtividade?: number; // itens/h (opcional, calculado se omitido)
  erro: number;
  percentualErro?: number; // opcional, calculado se omitido
  umAum: number; // contagem 1a1
  bloco: number; // contagem em bloco
  anuenciaLider?: boolean; // para farmácia: se bloco foi autorizado
}

export interface EvaluationConfig {
  tipoOperacao: TipoOperacao;
  duracaoInventario_horas: number;
  metaProdutividade_itensH: number | "auto";
  pesos: { qualidade: number; produtividade: number; metodo: number };
  limites: {
    erro: { excelente: number; bom: number; atencao: number; critico: number };
    produtividade?: {
      excelente: number;
      bom: number;
      atencao: number;
      critico: number;
    };
    bloco: { aceitavel: number; maximo: number; critico: number };
  };
  classificacao: { excelente: number; bom: number; atencao: number };
  bonificacoes: {
    excelenciaCombinada: number;
    zeroErros: number;
    altoVolumeQualidade: number;
    maximoBonificacao: number;
  };
  penalidades: {
    blocoExcessivoFarmacia: number;
    produtividadeSuspeita: number;
    erroCritico: number;
    maximoPenalidade: number;
  };
}

export type ClassificacaoGeral = "EXCELENTE" | "BOM" | "ATENCAO" | "CRITICO";
export type ClassificacaoIRB = "Baixo" | "Medio" | "Alto" | "Critico";

export interface ConferrerEvaluation {
  input: ConferrerInput;
  produtividadeReal: number;
  taxaErroPercentual: number;
  taxaErroPor1000: number;
  acuracia: number;
  percentual1a1: number;
  percentualBloco: number;
  irb: number;
  irbClassificacao: ClassificacaoIRB;
  pontosQualidade: number;
  pontosProdutividade: number;
  pontosMetodo: number;
  bonificacoes: number;
  penalidades: number;
  scoreFinal: number;
  classificacaoGeral: ClassificacaoGeral;
  badge: string;
  alertas: Array<{ tipo: string; mensagem: string }>;
}
