import type {
  AttendanceCollaborator,
  AttendanceData,
  ConferrerInput,
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
// PARSER DE ESCALA (NOVA LÓGICA RÍGIDA)
// ==========================
export const parseWhatsAppScale = (text: string): AttendanceData => {
  // Remove linhas vazias e espaços extras
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Regra Estrita:
  // Linha 0 -> Data
  // Linha 1 -> Loja
  // Linha 2 -> Endereço
  const dataRaw = lines[0] || "";
  const lojaRaw = lines[1] || "";
  const enderecoRaw = lines[2] || "";

  const nomes: AttendanceCollaborator[] = [];

  // Regex para identificar linhas que começam com número (ex: "1 GABRIEL...")
  // ^\d+ -> Começa com digitos
  // [\s.-]* -> Pode ter espaço, ponto ou traço depois do numero
  // (.*) -> Captura o resto como nome
  const collaboratorRegex = /^\d+[\s.-]*(.*)/;

  // Começa a procurar colaboradores da linha 3 em diante (índice 3 é a 4ª linha)
  // Mas vamos varrer tudo para garantir, caso a formatação varie um pouco,
  // priorizando a regra de "começar com número".
  lines.forEach((line, index) => {
    // Ignora as 3 primeiras linhas que já usamos para cabeçalho
    if (index < 3) return;

    const match = line.match(collaboratorRegex);
    if (match && match[1]) {
      // match[1] é o nome limpo (sem o número da frente)
      const cleanName = match[1].trim();
      if (cleanName.length > 2) {
        // Ignora lixo muito curto
        nomes.push({
          id: Date.now().toString() + Math.random().toString(),
          nome: cleanName,
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

// ... (Mantenha as funções formatAttendanceMessage, formatReportA e formatReportB iguais)
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

// ==========================
// PARSER DE CONFERENTES (CSV/Excel)
// ==========================
/** Colunas: Nome, Qtde, Horas, Produtividade?, Erro, %Erro?, 1a1, Bloco [, Anuência?] */
export const parseConferrersCsv = (text: string): ConferrerInput[] => {
  const lines = text
    .split(/[\r\n]+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return [];

  const parseRow = (row: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < row.length; i++) {
      const c = row[i];
      if (c === '"') inQuotes = !inQuotes;
      else if ((c === "," || c === "\t") && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += c;
      }
    }
    result.push(current.trim());
    return result;
  };

  const findCol = (header: string[], patterns: RegExp[]): number => {
    for (const p of patterns) {
      const i = header.findIndex((h) => p.test(h));
      if (i >= 0) return i;
    }
    return -1;
  };

  const header = parseRow(lines[0]).map((h) => h.trim());
  const col = {
    nome: findCol(header, [/^nome$/i, /name/i]),
    qtde: findCol(header, [/^qtde$/i, /qtd/i, /quantidade/i]),
    horas: findCol(header, [/^horas$/i, /hour/i]),
    produtividade: findCol(header, [/produtividade/i, /prod/i]),
    erro: findCol(header, [/^erro$/i, /erros/i]),
    pctErro: findCol(header, [/%\s*erro/i, /erro\s*%/i, /percentual\s*erro/i]),
    umAum: findCol(header, [/1a1/i, /1\s*a\s*1/i, /um a um/i]),
    bloco: findCol(header, [/bloco/i]),
    anuencia: findCol(header, [/anu[eê]ncia/i, /autoriza/i, /l[ií]der/i]),
  };

  if (col.nome < 0) return [];
  const hasQtde = col.qtde >= 0;

  const result: ConferrerInput[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseRow(lines[i]);
    const nome = (cells[col.nome] ?? "").trim();
    if (!nome) continue;

    const umAumVal =
      col.umAum >= 0
        ? parseFloat(String(cells[col.umAum] ?? 0).replace(",", ".")) || 0
        : 0;
    const blocoVal =
      col.bloco >= 0
        ? parseFloat(String(cells[col.bloco] ?? 0).replace(",", ".")) || 0
        : 0;

    const qtde = hasQtde
      ? parseFloat(String(cells[col.qtde] ?? 0).replace(",", ".")) || 0
      : umAumVal + blocoVal || 0;
    const horas = col.horas >= 0
      ? parseFloat(String(cells[col.horas] ?? 1).replace(",", ".")) || 1
      : 1;
    const produtividade =
      col.produtividade >= 0 && cells[col.produtividade]
        ? parseFloat(String(cells[col.produtividade]).replace(",", "."))
        : undefined;
    const erro =
      col.erro >= 0
        ? parseFloat(String(cells[col.erro] ?? 0).replace(",", ".")) || 0
        : 0;
    const pctRaw = col.pctErro >= 0 ? cells[col.pctErro] : null;
    const percentualErro = pctRaw
      ? parseFloat(String(pctRaw).replace(",", ".").replace("%", ""))
      : undefined;
    const umAum =
      col.umAum >= 0 ? umAumVal : Math.max(0, qtde - blocoVal);
    const bloco =
      col.bloco >= 0 ? blocoVal : Math.max(0, qtde - umAumVal);

    let anuenciaLider: boolean | undefined;
    if (col.anuencia >= 0 && cells[col.anuencia]) {
      const v = String(cells[col.anuencia]).toLowerCase();
      anuenciaLider = /^s$|^sim$|^yes$|^1$|^true$/i.test(v);
    }

    const finalUmAum = umAum || Math.max(0, qtde - bloco);
    const finalBloco = bloco || Math.max(0, qtde - umAum);
    result.push({
      nome,
      qtde,
      horas,
      produtividade,
      erro,
      percentualErro,
      umAum: finalUmAum,
      bloco: finalBloco,
      anuenciaLider,
    });
  }
  return result;
};
