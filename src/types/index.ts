export interface ReportA {
  lojaNum: string;
  lojaNome: string;
  enderecoLoja: string;
  qtdColaboradores: number;
  lider: string;
  hrChegada: string;
  inicioEstoque: string;
  terminoEstoque: string;
  inicioLoja: string;
  terminoLoja: string;
  inicioDivergencia: string;
  terminoDivergencia: string;
  terminoInventario: string;
  avanco22h: number;
  avanco00h: number;
  avanco01h: number;
  avanco03h: number;
  avanco04h: number;
  arquivo1: string;
  arquivo2: string;
  arquivo3: string;
  avalEstoque: number;
  avalLoja: number;
  acuracidade: number;
  percentualAuditoria: number;
  ph: number;
  satisfacao: number;
  contagemAntecipada: 'Sim' | 'Não' | 'N/A';
}

export interface ReportB {
  cliente: string;
  lojaNum: string;
  enderecoLoja: string;
  data: string;
  pivProgramado: number;
  pivRealizado: number;
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
  qtdAlterados: number;
  qtdNaoContados: number;
  qtdEncontradosNaoContados: number;
  totalPecas: number;
  valorFinanceiro: number;
  arquivo1: string;
  arquivo2: string;
  arquivo3: string;
  avalPrepDeposito: number;
  avalPrepLoja: number;
  acuracidadeCliente: number;
  acuracidadeTerceirizada: number;
  satisfacao: number;
  responsavel: string;
  suporteSolicitado: 'Sim' | 'Não' | 'N/A';
  terminoInventario: string;
}

export interface AttendanceCollaborator {
  id: string;
  nome: string;
  status: 'PRESENTE' | 'AUSENTE' | 'NAO_DEFINIDO';
  substituto?: string;
}

export interface AttendanceData {
  data: string;
  loja: string;
  enderecoLoja: string;
  colaboradores: AttendanceCollaborator[];
}
