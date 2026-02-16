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

  // Linhas 3+: número + nome (ex: "1 GABRIEL...") ou BKP + nome (ex: "BKP NICOLAS NASCIMENTO")
  lines.forEach((line, index) => {
    if (index < 3) return;

    const matchNum = line.match(/^(\d+)[\s.-]*(.*)/);
    if (matchNum && matchNum[2]?.trim()) {
      const num = parseInt(matchNum[1], 10);
      const cleanName = matchNum[2].trim().replace(/\s*[✅❌]\s*$/, "").trim();
      if (cleanName.length > 2) {
        nomes.push({
          id: Date.now().toString() + Math.random().toString(),
          nome: cleanName,
          numero: num,
          ehBkp: false,
          status: "NAO_DEFINIDO",
          substituto: "",
        });
      }
      return;
    }

    const matchBkp = line.match(/^BKP\s+(.+)/i);
    if (matchBkp && matchBkp[1]?.trim()) {
      const cleanName = matchBkp[1].trim().replace(/\s*[✅❌]\s*$/, "").trim();
      if (cleanName.length > 2) {
        nomes.push({
          id: Date.now().toString() + Math.random().toString(),
          nome: cleanName,
          ehBkp: true,
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

export const formatAttendanceMessage = (data: AttendanceData): string => {
  const icon = (c: AttendanceCollaborator) =>
    c.status === "PRESENTE" ? " ✅" : c.status === "AUSENTE" ? " ❌" : "";
  const linhas =
    `${data.data}\n` +
    `${data.loja || "N/A"}\n` +
    `${data.enderecoLoja || "N/A"}\n\n` +
    data.colaboradores
      .map((c, i) => {
        if (c.ehBkp) {
          return `BKP ${c.nome}${icon(c)}`;
        }
        const num = c.numero ?? i + 1;
        return `${num} ${c.nome}${icon(c)}`;
      })
      .join("\n");
  return linhas;
};

export const formatReportA = (r: ReportA): string => {
  let blocoAvancos = `Avanço 22h00: ${fmtPct(r.avanco22h)}
Avanço 00h00: ${fmtPct(r.avanco00h)}
Avanço 01h00: ${fmtPct(r.avanco01h)}
Avanço 03h00: ${fmtPct(r.avanco03h)}
Avanço 04h00: ${fmtPct(r.avanco04h)}`;
  if (r.avancoExtraHora && r.avancoExtraValor !== "") {
    const horaReal = r.avancoExtraHora.replace(":", "h");
    blocoAvancos += `\nAvanço ${horaReal}: ${fmtPct(r.avancoExtraValor)}`;
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

// Número: BR 7.307,00 -> 7307 | 0,027 -> 0.027; US 5.23 -> 5.23
const parseNumberBR = (s: string): number => {
  const v = String(s ?? "").trim();
  if (!v) return 0;
  if (v.includes(",")) {
    const normal = v.replace(/\./g, "").replace(",", ".");
    const n = parseFloat(normal);
    return isNaN(n) ? 0 : n;
  }
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
};

// ==========================
// PARSER DE CONFERENTES (CSV/Excel)
// ==========================
/** Colunas: Nome/Nome do Colaborador, Qtde, Horas, Produtividade?, Erro, %Erro?, 1a1, Bloco/BLOCO. Aceita , ; ou tab. Números BR (1.234,56). */
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
    const separators = /[,\t;]/;
    for (let i = 0; i < row.length; i++) {
      const c = row[i];
      if (c === '"') inQuotes = !inQuotes;
      else if (separators.test(c) && !inQuotes) {
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
    nome: findCol(header, [/^nome\s+do\s+colaborador$/i, /^nome$/i, /colaborador/i, /name/i]),
    qtde: findCol(header, [/^qtde$/i, /qtd/i, /quantidade/i]),
    horas: findCol(header, [/^horas$/i, /hour/i]),
    produtividade: findCol(header, [/produtividade/i, /prod/i]),
    erro: findCol(header, [/^erro$/i, /erros/i]),
    pctErro: findCol(header, [/%\s*erro/i, /erro\s*%/i, /percentual\s*erro/i]),
    umAum: findCol(header, [/1a1/i, /1\s*a\s*1/i, /um a um/i]),
    bloco: findCol(header, [/^bloco$/i, /BLOCO/i]),
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
      col.umAum >= 0 ? parseNumberBR(cells[col.umAum]) : 0;
    const blocoVal =
      col.bloco >= 0 ? parseNumberBR(cells[col.bloco]) : 0;

    const qtde = hasQtde ? parseNumberBR(cells[col.qtde]) : umAumVal + blocoVal || 0;
    const horas = col.horas >= 0 ? parseNumberBR(cells[col.horas]) || 1 : 1;
    const produtividade =
      col.produtividade >= 0 && cells[col.produtividade]
        ? parseNumberBR(cells[col.produtividade])
        : undefined;
    const erro = col.erro >= 0 ? parseNumberBR(cells[col.erro]) : 0;
    const pctRaw = col.pctErro >= 0 ? cells[col.pctErro] : null;
    const percentualErro = pctRaw ? parseNumberBR(String(pctRaw).replace("%", "")) : undefined;
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
