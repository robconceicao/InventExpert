import type {
  AttendanceCollaborator,
  AttendanceData,
  ReportA,
  ReportB,
} from "../types";

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

export const parseWhatsAppScale = (text: string): AttendanceData => {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l);
  let dataFound = "";
  let lojaFound = "";
  const nomes: AttendanceCollaborator[] = [];
  const dateRegex = /(\d{2}\/\d{2}(\/\d{2,4})?)/;

  lines.forEach((line) => {
    if (line.toLowerCase().includes("data")) {
      const match = line.match(dateRegex);
      if (match) dataFound = match[0];
    } else if (!dataFound && dateRegex.test(line)) {
      dataFound = line.match(dateRegex)?.[0] || "";
    }
    if (line.toLowerCase().includes("loja")) {
      lojaFound = line.replace(/loja\s*:?/i, "").trim();
    } else if (!line.toLowerCase().includes("data") && line.length > 3) {
      if (!line.includes("ESCALA") && !line.includes("RELATÓRIO")) {
        nomes.push({
          id: Date.now().toString() + Math.random().toString(),
          nome: line.replace(/^-/, "").trim(),
          status: "NAO_DEFINIDO",
          substituto: "",
        });
      }
    }
  });

  return {
    data: dataFound || new Date().toLocaleDateString("pt-BR"),
    loja: lojaFound,
    enderecoLoja: "",
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

export const formatAttendanceMessage = (data: AttendanceData): string => {
  const presentes = data.colaboradores.filter((c) => c.status === "PRESENTE");
  const ausentes = data.colaboradores.filter((c) => c.status === "AUSENTE");
  const listaPresentes = presentes.map((c) =>
    c.substituto ? `${c.nome} (Subst: ${c.substituto})` : c.nome,
  );
  return `*RELATÓRIO DE ESCALA*

📅 Data: *${data.data}*
🏢 Loja: *${data.loja || "N/A"}*
📍 Endereço: *${data.enderecoLoja || "N/A"}*

👥 *Resumo da Equipe*
Total: ${data.colaboradores.length} | Presentes: ${presentes.length} | Ausentes: ${ausentes.length}

✅ *Presentes:*
${listaPresentes.length > 0 ? listaPresentes.join("\n") : "- Ninguém"}

❌ *Ausentes:*
${ausentes.length > 0 ? ausentes.map((c) => c.nome).join("\n") : "- Ninguém"}

📋 *Status Completo:*
${data.colaboradores
  .map((c) => {
    const icon =
      c.status === "PRESENTE" ? "✅" : c.status === "AUSENTE" ? "❌" : "❓";
    return `${icon} ${c.nome}`;
  })
  .join("\n")}`;
};

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
