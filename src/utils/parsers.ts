import type { ReportA, ReportB } from "../types";

// ==========================================
// FUNÇÕES AUXILIARES (ABNT & FORMATAÇÃO)
// ==========================================

// 21:30 -> *21h30*
const fmtTime = (val: string) => {
  if (!val) return "";
  return `*${val.replace(":", "h")}*`;
};

// 43961 -> *43.961*
const fmtIntBr = (val: number | "") => {
  if (val === "" || val === null || val === undefined) return "";
  return `*${val.toLocaleString("pt-BR")}*`;
};

// 99.9 -> *99,9%*
const fmtPct = (val: number | "") => {
  if (val === "" || val === null || val === undefined) return "";
  return `*${val.toString().replace(".", ",")}%*`;
};

// Moeda -> *R$ 1.200,50*
const fmtMoeda = (val: number | "") => {
  if (val === "" || val === null || val === undefined) return "";
  return `*R$ ${val
    .toFixed(2)
    .replace(".", ",")
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".")}*`;
};

// Texto Geral -> *Texto*
const fmtVal = (val: any) => {
  if (val === "" || val === null || val === undefined) return "";
  return `*${val}*`;
};

const fmtBool = (val: boolean | null) =>
  val === true ? "*Sim*" : val === false ? "*Não*" : "*N/A*";

// ==========================================
// REPORT A (ACOMPANHAMENTO)
// ==========================================
export const formatReportA = (r: ReportA): string => {
  // Lógica: Avanço Padrão vs Encerramento Antecipado
  let blocoAvancos = `Avanço do inventário (22h00): ${fmtPct(r.avanco22h)}
Avanço do inventário (00h00): ${fmtPct(r.avanco00h)}
Avanço do inventário (01h00): ${fmtPct(r.avanco01h)}`;

  if (r.usarAvancoExtra) {
    // Se marcou que encerrou antes
    const horaReal = r.avancoExtraHora
      ? r.avancoExtraHora.replace(":", "h")
      : "??h??";
    blocoAvancos += `\nAvanço Final (${horaReal}): ${fmtPct(r.avancoExtraValor)}`;
  } else {
    // Padrão
    blocoAvancos += `\nAvanço do inventário (03h00): ${fmtPct(r.avanco03h)}
Avanço do inventário (04h00): ${fmtPct(r.avanco04h)}`;
  }

  return `*ACOMPANHAMENTO DE INVENTÁRIO*

Nº da loja: ${fmtVal(r.lojaNum)}
Nome da Loja: ${fmtVal(r.lojaNome)}
Qtd. de colaboradores: ${fmtVal(r.qtdColaboradores)}
Líder do Inventário: ${fmtVal(r.lider)}
Horário de chegada em loja: ${fmtTime(r.hrChegada)}
Início da contagem de estoque: ${fmtTime(r.inicioContagemEstoque)}
Término da contagem de estoque: ${fmtTime(r.terminoContagemEstoque)}
Início da contagem da loja: ${fmtTime(r.inicioContagemLoja)}
Término da contagem da loja: ${fmtTime(r.terminoContagemLoja)}
${blocoAvancos}
Início da divergência: ${fmtTime(r.inicioDivergencia)}
Término da divergência: ${fmtTime(r.terminoDivergencia)}
Avaliação do estoque (%): ${fmtPct(r.avalEstoque)}
Avaliação da loja (%): ${fmtPct(r.avalLoja)}
Envio do 1º arquivo (hora): ${fmtTime(r.envioArquivo1)}
Envio do 2º arquivo (hora): ${fmtTime(r.envioArquivo2)}
Envio do 3º arquivo (hora): ${fmtTime(r.envioArquivo3)}
Término do inventário: ${fmtTime(r.terminoInventario)}
PH: ${fmtVal(r.ph)}
Contagem antecipada (Sim/Não): ${fmtBool(r.contagemAntecipada)}
Satisfação (1 a 5): ${fmtVal(r.satisfacao)}
Acuracidade (%): ${fmtPct(r.acuracidade)}
Percentual de auditoria: ${fmtPct(r.percentualAuditoria)}
Produtividade (PH): ${fmtVal(r.ph)}`;
};

// ==========================================
// REPORT B (RESUMO FINAL)
// ==========================================
export const formatReportB = (r: ReportB): string => {
  const phCalculado =
    typeof r.totalPecas === "number" &&
    typeof r.pivProgramado === "number" &&
    r.pivProgramado > 0
      ? (r.totalPecas / r.pivProgramado).toFixed(0)
      : "0";

  return `*RESUMO FINAL DO INVENTÁRIO*

Nº Loja: ${fmtVal(r.lojaNum)}
Loja: ${fmtVal(r.cliente)}
Data: ${fmtVal(r.data)}
PIV Prog.: ${fmtVal(r.pivProgramado)}
PIV Real.: ${fmtVal(r.pivRealizado)}
Chegada Equipe: ${fmtTime(r.chegadaEquipe)}
Ini. Cont. Dep.: ${fmtTime(r.inicioDeposito)}
Fim Cont. Dep.: ${fmtTime(r.terminoDeposito)}
Ini. Cont. Loja: ${fmtTime(r.inicioLoja)}
Fim Cont. Loja: ${fmtTime(r.terminoLoja)}
Ini. Div. Controlados: ${fmtTime(r.inicioDivergencia)}
Ini. Divergência: ${fmtTime(r.inicioDivergencia)}
Fim Divergência: ${fmtTime(r.terminoDivergencia)}
Itens Alt. Diverg.: ${fmtVal(r.qtdAlterados)}
Itens Não Cont.: ${fmtVal(r.qtdNaoContados)}
Enc. no Não Cont.: ${fmtVal(r.qtdEncontradosNaoContados)}
Envio 1º Arq.: ${fmtTime(r.envioArquivo1)}
Envio 2º Arq.: ${fmtTime(r.envioArquivo2)}
Envio 3º Arq.: ${fmtTime(r.envioArquivo3)}
Fim Inventário: ${fmtTime(r.terminoInventario)}
Total Peças: ${fmtIntBr(r.totalPecas)}
Valor Total: ${fmtMoeda(r.valorFinanceiro)}
Aval. Prep. Dep.: ${fmtPct(r.avalPrepDeposito)}
Aval. Prep. Loja: ${fmtPct(r.avalPrepLoja)}
Satisfação: ${fmtVal(r.satisfacao)}
Responsável: ${fmtVal(r.responsavel)}
Acurac. Cliente: ${fmtPct(r.acuracidadeCliente)}
Acurac. Terc.: ${fmtPct(r.acuracidadeTerceirizada)}
Houve Suporte?: ${fmtBool(r.suporteSolicitado)}
PH Calculado: *${phCalculado}*`;
};
