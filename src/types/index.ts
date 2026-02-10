export interface ReportA {
  // 1. Identificação
  lojaNum: string;
  lojaNome: string;
  enderecoLoja?: string;
  qtdColaboradores: number | "";
  lider: string;

  // 2. Cronograma
  hrChegada: string;
  inicioContagemEstoque: string;
  terminoContagemEstoque: string;
  inicioContagemLoja: string;
  terminoContagemLoja: string;
  inicioDivergencia: string;
  terminoDivergencia: string;
  terminoInventario: string;

  // 3. Avanço (0-100%)
  avanco22h: number | "";
  avanco00h: number | "";
  avanco01h: number | "";
  avanco03h: number | "";
  avanco04h: number | "";

  // --- NOVOS CAMPOS: Controle de Encerramento Antecipado ---
  usarAvancoExtra: boolean; // True = Substitui 03h/04h pelo horário real
  avancoExtraHora: string; // Ex: "02:15"
  avancoExtraValor: number | ""; // Ex: 100
  // ---------------------------------------------------------

  // 4. Gestão
  envioArquivo1: string;
  envioArquivo2: string;
  envioArquivo3: string;

  // 5. Indicadores
  avalEstoque: number | "";
  avalLoja: number | "";
  acuracidade: number | "";
  percentualAuditoria: number | "";
  ph: number | "";
  satisfacao: number | ""; // 1 a 5

  // 6. Status
  contagemAntecipada: boolean | null;
}

export interface ReportB {
  // 1. Identificação
  cliente: string;
  lojaNum: string;
  data: string;
  pivProgramado: number | "";
  pivRealizado: number | "";

  // 2. Cronograma Operacional
  chegadaEquipe: string;
  inicioDeposito: string;
  terminoDeposito: string;
  inicioLoja: string;
  terminoLoja: string;

  // 3. Auditoria e Divergências
  inicioAuditoriaCliente: string;
  terminoAuditoriaCliente: string;
  inicioDivergencia: string;
  terminoDivergencia: string;
  inicioNaoContados: string;
  terminoNaoContados: string;

  // 4. Resultado
  qtdAlterados: number | "";
  qtdNaoContados: number | "";
  qtdEncontradosNaoContados: number | "";
  totalPecas: number | "";
  valorFinanceiro: number | "";

  // 5. Envio de Arquivos
  envioArquivo1: string;
  envioArquivo2: string;
  envioArquivo3: string;

  // 6. Indicadores
  avalPrepDeposito: number | "";
  avalPrepLoja: number | "";
  acuracidadeCliente: number | ""; // Novo
  acuracidadeTerceirizada: number | ""; // Novo
  satisfacao: number | "";

  // 7. Finalização
  responsavel: string;
  suporteSolicitado: boolean | null;
  terminoInventario: string;
}

export interface AttendanceCollaborator {
  id: string;
  nome: string;
  status: "PRESENTE" | "AUSENTE" | "NAO_DEFINIDO";
  substituto?: string;
}

export interface AttendanceData {
  data: string;
  loja: string;
  enderecoLoja: string;
  colaboradores: AttendanceCollaborator[];
}
