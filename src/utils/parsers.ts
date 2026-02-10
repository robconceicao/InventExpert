import type {
  AttendanceCollaborator,
  AttendanceData,
  ReportA,
  ReportB,
} from "../types";

// ==========================
// FORMATAÇÃO GERAL
// ==========================
const fmtTime = (val: string) => (!val ? "" : `*${val.replace(":", "h")}*`);
const fmtIntBr = (val: number | "") =>
  val === "" ? "" : `*${val.toLocaleString("pt-BR")}*`;
const fmtPct = (val: number | "") =>
  val === "" ? "" : `*${val.toString().replace(".", ",")}%*`;
const fmtMoeda = (val: number | "") =>
  val === ""
    ? ""
    : `*R$ ${val
        .toFixed(2)
        .replace(".", ",")
        .replace(/\B(?=(\d{3})+(?!\d))/g, ".")}*`;
const fmtVal = (val: any) => (!val ? "" : `*${val}*`);
const fmtBool = (val: boolean | null) =>
  val === true ? "*Sim*" : val === false ? "*Não*" : "*N/A*";

// ==========================
// PARSER DE ESCALA (ENTRADA)
// ==========================
export const parseWhatsAppScale = (text: string): AttendanceData => {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Regra: Linha 1=Data, 2=Loja, 3=Endereço
  const dataRaw = lines[0] || "";
  const lojaRaw = lines[1] || "";
  const enderecoRaw = lines[2] || "";

  const nomes: AttendanceCollaborator[] = [];

  // Regex: Pega linhas começando com número OU "BKP"
  const collaboratorRegex = /^(\d+|BKP)[\s.-]*(.*)/i;

  lines.forEach((line, index) => {
    // Pula as 3 primeiras linhas de cabeçalho
    if (index < 3) return;

    const match = line.match(collaboratorRegex);
    if (match && match[2]) {
      const prefix = match[1].toUpperCase();
      const cleanName = match[2].trim();

      if (cleanName.length > 1) {
        // Se for BKP, incluímos "BKP" no nome para exibir na lista
        const nomeFinal = prefix === "BKP" ? `BKP ${cleanName}` : cleanName;

        nomes.push({
          id: Date.now().toString() + Math.random().toString(),
          nome: nomeFinal,
          status: "NAO_DEFINIDO",
          substituto: "",
        });
      }
    }
  });

  return {
    data: dataRaw,
    loja: lojaRaw,
    enderecoLoja: enderecoRaw,
    colaboradores: nomes,
  };
};

export const formatDateInput = (text: string) => {
  let v = text.replace(/\D/g, "");
  if (v.length > 8) v = v.slice(0, 8);
  if (v.length > 4) return `${v.slice(0, 2)}/${v.slice(2, 4)}/${v.slice(4)}`;
  if (v.length > 2) return `${v.slice(0, 2)}/${v.slice(2)}`;
  return v;
};

// ==========================
// SAÍDA PARA WHATSAPP (FORMATO LIMPO)
// ==========================
export const formatAttendanceMessage = (data: AttendanceData): string => {
  // Cabeçalho simples
  let msg = `${data.data}\n${data.loja}\n${data.enderecoLoja}\n\n`;

  // Lista simples numerada
  data.colaboradores.forEach((c, index) => {
    // Ícone apenas se estiver PRESENTE
    const statusIcon = c.status === "PRESENTE" ? "✅" : "";

    // Numeração: Se o nome já começa com BKP, não põe número. Senão, põe contador.
    const prefix = c.nome.startsWith("BKP") ? "" : `${index + 1} `;

    // Nome + Substituto se houver
    const nomeFinal = c.substituto
      ? `${c.nome} (Subst: ${c.substituto})`
      : c.nome;

    msg += `${prefix}${nomeFinal} ${statusIcon}\n`;
  });

  return msg.trim();
};

// ... Funções formatReportA e formatReportB continuam iguais ...
export const formatReportA = (r: ReportA): string => {
  let blocoAvancos = `Avanço 22h00: ${fmtPct(r.avanco22h)}
Avanço 00h00: ${fmtPct(r.avanco00h)}
Avanço 01h00: ${fmtPct(r.avanco01h)}`;
  if (r.usarAvancoExtra) {
    const horaReal = r.avancoExtraHora
      ? r.avancoExtraHora.replace(":", "h")
      : "??h??";
    blocoAvancos += `\nAvanço Final (${horaReal}): ${fmtPct(r.avancoExtraValor)}`;
  } else {
    blocoAvancos += `\nAvanço 03h00: ${fmtPct(r.avanco03h)}
Avanço 04h00: ${fmtPct(r.avanco04h)}`;
  }
  return `*ACOMPANHAMENTO DE INVENTÁRIO*

Nº Loja: ${fmtVal(r.lojaNum)}
Loja: ${fmtVal(r.lojaNome)}
Qtd. Colab.: ${fmtVal(r.qtdColaboradores)}
Líder: ${fmtVal(r.lider)}
Chegada: ${fmtTime(r.hrChegada)}
Ini. Cont. Est.: ${fmtTime(r.inicioContagemEstoque)}
Fim Cont. Est.: ${fmtTime(r.terminoContagemEstoque)}
Ini. Cont. Loja: ${fmtTime(r.inicioContagemLoja)}
Fim Cont. Loja: ${fmtTime(r.terminoContagemLoja)}
${blocoAvancos}
Ini. Diverg.: ${fmtTime(r.inicioDivergencia)}
Fim Diverg.: ${fmtTime(r.terminoDivergencia)}
Aval. Estoque: ${fmtPct(r.avalEstoque)}
Aval. Loja: ${fmtPct(r.avalLoja)}
Envio 1º Arq.: ${fmtTime(r.envioArquivo1)}
Envio 2º Arq.: ${fmtTime(r.envioArquivo2)}
Envio 3º Arq.: ${fmtTime(r.envioArquivo3)}
Fim Inventário: ${fmtTime(r.terminoInventario)}
Cont. Antecipada: ${fmtBool(r.contagemAntecipada)}
Satisfação: ${fmtVal(r.satisfacao)}
Acuracidade: ${fmtPct(r.acuracidade)}
% Auditoria: ${fmtPct(r.percentualAuditoria)}
Produtividade (PH): ${fmtIntBr(r.ph)}`;
};

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
