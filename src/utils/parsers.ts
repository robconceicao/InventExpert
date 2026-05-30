import type {
  AttendanceCollaborator,
  AttendanceData,
  InventoryCheckerInput,
  ReportA,
  ReportBFarmacias,
  ReportBMercados,
  ReportBOutros,
} from "../types";

// ==========================
// FORMATAÇÃO GERAL
// ==========================
const parseNum = (s: string | number): number => {
  const v = String(s ?? "").replace(/%/g, "").trim();
  if (!v) return 0;
  if (v.includes(",")) return parseFloat(v.replace(/\./g, "").replace(",", ".")) || 0;
  return parseFloat(v) || 0;
};

const fmtTime = (val: string) => (!val ? "" : `*${val.replace(":", "h")}*`);
const fmtIntBr = (val: string | number | "") =>
  val === "" ? "" : `*${parseNum(val).toLocaleString("pt-BR")}*`;
const fmtPct = (val: string | number | "") =>
  val === "" ? "" : `*${parseNum(val).toFixed(2).replace(".", ",")}%*`;
const fmtMoeda = (val: string | number | "") =>
  val === ""
    ? ""
    : `*R$ ${parseNum(val)
        .toFixed(2)
        .replace(".", ",")
        .replace(/\B(?=(\d{3})+(?!\d))/g, ".")}*`;
const fmtVal = (val: string | number | boolean | null | undefined) => (!val && val !== 0 ? "" : `*${val}*`);
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

export const formatTimeInput = (text: string): string => {
  let clean = text.replace(/\D/g, "");
  if (clean.length > 4) {
    clean = clean.slice(0, 4);
  }
  if (clean.length > 2) {
    return `${clean.slice(0, 2)}:${clean.slice(2)}`;
  }
  return clean;
};

export const formatTimeNow = (): string => {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
};


export const formatAttendanceMessage = (data: AttendanceData): string => {
  const icon = (c: AttendanceCollaborator) =>
    c.status === "PRESENTE" ? " ✅" : c.status === "AUSENTE" ? " ❌" : "";
  const linhas: string[] = [];
  let currentNum = 1;
  for (let i = 0; i < data.colaboradores.length; i++) {
    const c = data.colaboradores[i];
    const num = c.numero ?? currentNum;
    currentNum = num + 1;
    
    const sub = (c.substituto ?? "").trim();
    if (sub) {
      linhas.push(`${num} ${c.nome} ❌`);
      linhas.push(`${sub} (substituição) ✅`);
    } else {
      linhas.push(`${num} ${c.nome}${icon(c)}`);
    }
  }
  return (
    `${data.data}\n` +
    `${data.loja || "N/A"}\n` +
    `${data.enderecoLoja || "N/A"}\n\n` +
    linhas.join("\n")
  );
};

// Converte "HH:MM" para minutos para comparação
const timeToMinutes = (t: string): number => {
  if (!t) return Infinity;
  const [h, m] = t.split(":").map(Number);
  const mins = (h ?? 0) * 60 + (m ?? 0);
  // Horários de 0-17h são tratados como dia seguinte (pós-meia-noite)
  return (h ?? 0) < 18 ? mins + 1440 : mins;
};

export const formatReportA = (r: ReportA): string => {
  // Monta os avanços padrão como pares [hora_str, minutos, valor]
  const avancos: { label: string; mins: number; val: string | number | "" }[] = [
    { label: "22h00", mins: timeToMinutes("22:00"), val: r.avanco22h },
    { label: "00h00", mins: timeToMinutes("00:00"), val: r.avanco00h },
    { label: "01h00", mins: timeToMinutes("01:00"), val: r.avanco01h },
    { label: "03h00", mins: timeToMinutes("03:00"), val: r.avanco03h },
    { label: "04h00", mins: timeToMinutes("04:00"), val: r.avanco04h },
  ];
  if (r.avancoExtraHora && r.avancoExtraValor !== "") {
    avancos.push({
      label: r.avancoExtraHora.replace(":", "h"),
      mins: timeToMinutes(r.avancoExtraHora),
      val: r.avancoExtraValor,
    });
  }
  avancos.sort((a, b) => a.mins - b.mins);
  const blocoAvancos = avancos
    .map((a) => `Avanço ${a.label}: ${fmtPct(a.val)}`)
    .join("\n");

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
Cont. Antecipada: ${fmtBool(r.contagemAntecipada)}
Satisfação: ${fmtVal(r.satisfacao)}
Acuracidade: ${fmtPct(r.acuracidade)}
% Auditoria: ${fmtPct(r.percentualAuditoria)}
Produtividade (PH): ${fmtIntBr(r.ph)}
Fim Inventário: ${fmtTime(r.terminoInventario)}`;
};

export const formatReportBFarmacias = (r: ReportBFarmacias): string => {
  return `*RESUMO FINAL DO INVENTÁRIO — FARMÁCIA*

Nº Loja: ${fmtVal(r.lojaNum)}
Loja: ${fmtVal(r.lojaNome)}
Data: ${fmtVal(r.data)}
PIV Prog.: ${fmtVal(r.pivProgramado)}
PIV Real.: ${fmtVal(r.pivRealizado)}
Chegada Equipe: ${fmtTime(r.chegadaEquipe)}
Ini. Cont. Dep.: ${fmtTime(r.inicioDeposito)}
Fim Cont. Dep.: ${fmtTime(r.terminoDeposito)}
Ini. Cont. Loja: ${fmtTime(r.inicioLoja)}
Fim Cont. Loja: ${fmtTime(r.terminoLoja)}
Ini. Audit. Cli.: ${fmtTime(r.inicioAuditoriaCliente)}
Fim Audit. Cli.: ${fmtTime(r.terminoAuditoriaCliente)}
Ini. Diverg. Ctrl.: ${fmtTime(r.inicioControlados)}
Fim Diverg. Ctrl.: ${fmtTime(r.terminoControlados)}
Ini. Diverg.: ${fmtTime(r.inicioDivergencia)}
Fim Diverg.: ${fmtTime(r.terminoDivergencia)}
Itens Alt. Diverg.: ${fmtVal(r.qtdAlterados)}
Ini. N. Cont.: ${fmtTime(r.inicioNaoContados)}
Fim N. Cont.: ${fmtTime(r.terminoNaoContados)}
Itens N. Cont.: ${fmtVal(r.qtdNaoContados)}
Enc. no N. Cont.: ${fmtVal(r.qtdEncontradosNaoContados)}
Ini. Recont. Cli.: ${fmtTime(r.inicioRecontCliente)}
Fim Recont. Cli.: ${fmtTime(r.terminoRecontCliente)}
Qtd. Itens Recont. Cli.: ${fmtVal(r.qtdItensRecontCliente)}
Qtd. Alt. Recont. Cli.: ${fmtVal(r.qtdAltRecontCliente)}
Envio 1º Arq.: ${fmtTime(r.envioArquivo1)}
Envio 2º Arq.: ${fmtTime(r.envioArquivo2)}
Envio 3º Arq.: ${fmtTime(r.envioArquivo3)}
Total Peças: ${fmtIntBr(r.totalPecas)}
Valor Total: ${fmtMoeda(r.valorTotal)}
Aval. Prep. Dep.: ${fmtPct(r.avalPrepDeposito)}
Aval. Prep. Loja: ${fmtPct(r.avalPrepLoja)}
Satisfação: ${fmtVal(r.satisfacao)}
Responsável: ${fmtVal(r.responsavel)}
Acur. Cli.: ${fmtPct(r.acuracidadeCliente)}
Acur. Terc.: ${fmtPct(r.acuracidadeTerceirizada)}
Houve Suporte?: ${fmtBool(r.suporteSolicitado)}
PH Calc.: ${fmtIntBr(r.phCalculado)}
Fim Inventário: ${fmtTime(r.terminoInventario)}`;
};

export const formatReportBMercados = (r: ReportBMercados): string => {
  return `*RESUMO FINAL DO INVENTÁRIO — MERCADO*

Loja: ${fmtVal(r.lojaNome)}
Nº Loja: ${fmtVal(r.lojaNum)}
Data: ${fmtVal(r.data)}
PIV Prog.: ${fmtVal(r.pivProgramado)}
PIV Real.: ${fmtVal(r.pivRealizado)}
Chegada Equipe: ${fmtTime(r.chegadaEquipe)}
Ini. Cont. Dep.: ${fmtTime(r.inicioDeposito)}
Fim Cont. Dep.: ${fmtTime(r.terminoDeposito)}
Ini. Cont. Loja: ${fmtTime(r.inicioLoja)}
Fim Cont. Loja: ${fmtTime(r.terminoLoja)}
Ini. Audit. Cli.: ${fmtTime(r.inicioAuditoriaCliente)}
Fim Audit. Cli.: ${fmtTime(r.terminoAuditoriaCliente)}
Ini. Diverg.: ${fmtTime(r.inicioDivergencia)}
Fim Diverg.: ${fmtTime(r.terminoDivergencia)}
Itens Alt. Diverg.: ${fmtVal(r.qtdAlterados)}
Ini. N. Cont.: ${fmtTime(r.inicioNaoContados)}
Itens N. Cont.: ${fmtVal(r.qtdNaoContados)}
Enc. no N. Cont.: ${fmtVal(r.qtdEncontradosNaoContados)}
Fim N. Cont.: ${fmtTime(r.terminoNaoContados)}
Total Peças: ${fmtIntBr(r.totalPecas)}
Valor Total: ${fmtMoeda(r.valorTotal)}
Aval. Prep. Dep.: ${fmtPct(r.avalPrepDeposito)}
Aval. Prep. Loja: ${fmtPct(r.avalPrepLoja)}
Satisfação: ${fmtVal(r.satisfacao)}
Responsável: ${fmtVal(r.responsavel)}
Acur. Cli.: ${fmtPct(r.acuracidadeCliente)}
Acur. Terc.: ${fmtPct(r.acuracidadeTerceirizada)}
Houve Suporte?: ${fmtBool(r.suporteSolicitado)}
Fim Inventário: ${fmtTime(r.terminoInventario)}`;
};

export const formatReportBOutros = (r: ReportBOutros): string => {
  return `*RESUMO FINAL DO INVENTÁRIO*

Nº Loja: ${fmtVal(r.lojaNum)}
Loja: ${fmtVal(r.lojaNome)}
Data: ${fmtVal(r.data)}
Responsável: ${fmtVal(r.responsavel)}
Qtd. Pessoas: ${fmtVal(r.qtdPessoas)}
Chegada Equipe: ${fmtTime(r.chegadaEquipe)}
Ini. Cont. Dep.: ${fmtTime(r.inicioDeposito)}
Fim Cont. Dep.: ${fmtTime(r.terminoDeposito)}
Ini. Cont. Loja: ${fmtTime(r.inicioLoja)}
Fim Cont. Loja: ${fmtTime(r.terminoLoja)}
Ini. Audit. Cli.: ${fmtTime(r.inicioAuditoriaCliente)}
Fim Audit. Cli.: ${fmtTime(r.terminoAuditoriaCliente)}
Ini. Diverg.: ${fmtTime(r.inicioDivergencia)}
Fim Diverg.: ${fmtTime(r.terminoDivergencia)}
Total Peças: ${fmtIntBr(r.totalPecas)}
Valor Total: ${fmtMoeda(r.valorTotal)}
% Inv.: ${fmtPct(r.pctInv)}
Aval. Est.: ${fmtPct(r.avalEstoque)}
Aval. Loja: ${fmtPct(r.avalLoja)}
Fim Inventário: ${fmtTime(r.terminoInventario)}`;
};

// Aliases mantidos para não quebrar imports de arquivos antigos
/** @deprecated use formatReportBFarmacias */
export const formatReportB = formatReportBFarmacias as unknown as (r: never) => string;
/** @deprecated ReportC removido */
export const formatReportC = (_r: unknown): string => "";
/** @deprecated ReportD removido */
export const formatReportD = (_r: unknown): string => "";

// Número: BR 7.307,00 -> 7307 | 0,027 -> 0.027; US 1,770.65 -> 1770.65
// Também lida com strings de percentagem "1,73%" -> 1.73
const parseNumberBR = (s: string): number => {
  const v = String(s ?? "").replace(/%/g, "").trim();
  if (!v) return 0;
  
  // Detectar formato US exportado pelo XLSX (vírgula antes de ponto): "1,770.65"
  const commaIdx = v.indexOf(",");
  const dotIdx = v.indexOf(".");
  if (commaIdx !== -1 && dotIdx !== -1) {
    if (commaIdx < dotIdx) {
      // US format: remove commas
      return parseFloat(v.replace(/,/g, "")) || 0;
    } else {
      // BR format: remove dots, replace comma with dot
      return parseFloat(v.replace(/\./g, "").replace(",", ".")) || 0;
    }
  }
  
  // Apenas vírgula: "395,33" (BR) ou "5,647" (US thousand?)
  // Se termina com exatos 3 dígitos após a vírgula, e tem formato de milhar, pode ser US.
  // Mas no Brasil, usamos vírgula como decimal na maioria dos textos colados.
  if (v.includes(",")) {
    // Se for "5,647.00" já caiu no if acima. Se for "6,817", é BR decimal "6.817" ou US "6817"?
    // Vamos assumir que vírgula sozinha é BR decimal, a não ser que tenha exatos 3 digitos.
    if (/,\d{3}$/.test(v) && !/,\d{2}$/.test(v)) {
      // Provável US thousand (ex: 5,647)
      return parseFloat(v.replace(/,/g, "")) || 0;
    }
    // BR decimal
    return parseFloat(v.replace(/\./g, "").replace(",", ".")) || 0;
  }
  
  return parseFloat(v) || 0;
};

// ==========================
// PARSER INVENTEXP - CONFERENTES (CSV/Excel)
// ==========================
/**
 * Parser robusto para o formato real exportado pelo sistema cliente.
 *
 * Formato suportado (separador ; , ou tab, números BR):
 *   NOME DO CONFERENTE;PRODUTIVIDADE;QTDE. VOLUMES;1a1;BLOCO;HORAS ESTIMADAS;ERRO;% ERRO
 *   AMANDA DE OLIVEIRA;395,33;752;0;18;1,9;13;1,73%
 *
 * Também aceita o Relatório de Produtividade (RProtmv):
 *   Capa;Matrícula;Nome do Colaborador;Qtde;1a. Coleta;Ult. Coleta;Horas;Produtividade;Erro (Qtde);% (Erro/Qtd);…;1a1;BLOCO
 *
 * E o formato simplificado: Nome,Qtde,Qtde1a1,Produtividade,Erro
 *
 * Lógica:
 *  - qtde   → "Qtde" ou "QTDE. VOLUMES"
 *  - qtde1a1 → "1a1" (não confunde com "1a. Coleta"); se ausente, deriva de Qtde − BLOCO
 *  - produtividade → "Produtividade" / "HorasProdutividade"; senão Qtde ÷ Horas
 *  - erro   → "Erro (Qtde)" / "ERRO" (absoluto); "% (Erro/Qtd)" só se não houver coluna de qtde de erro
 *
 * Nota: o pctBloco é REcalculado pelo sistema como (qtde - qtde1a1) / qtde,
 * ignorando a coluna "BLOCO" e "% ERRO" do CSV (usadas apenas para auditoria).
 */
export const parseInventoryCheckersCsv = (
  text: string,
): InventoryCheckerInput[] => {
  const lines = text
    .split(/[\r\n]+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return [];

  // Detecta o separador dominante numa linha
  const detectSeparator = (line: string): RegExp => {
    const semicolons = (line.match(/;/g) ?? []).length;
    const tabs       = (line.match(/\t/g) ?? []).length;
    const commas     = (line.match(/,/g) ?? []).length;
    if (semicolons >= tabs && semicolons >= commas) return /;/;
    if (tabs >= commas) return /\t/;
    return /,/;
  };

  const parseRow = (row: string, sep: RegExp): string[] => {
    if (!row.includes('"')) {
      return row.split(sep).map((c) => c.trim());
    }
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < row.length; i++) {
      const c = row[i];
      if (c === '"') { inQuotes = !inQuotes; continue; }
      if (sep.test(c) && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += c;
      }
    }
    result.push(current.trim());
    return result;
  };

  const normalizeHeader = (h: string): string =>
    h.replace(/^"|"$/g, "").trim().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");


  type ColMap = {
    nome: number;
    matricula: number;
    qtde: number;
    qtde1a1: number;
    produtividade: number;
    horas: number;
    erro: number;
    pctErro: number;
    bloco: number;
  };

  let headerRowIndex = -1;
  let sep = /,/;
  let col: ColMap = {
    nome: -1,
    matricula: -1,
    qtde: -1,
    qtde1a1: -1,
    produtividade: -1,
    horas: -1,
    erro: -1,
    pctErro: -1,
    bloco: -1,
  };

  const matchCol = (
    header: string[],
    patterns: RegExp[],
    exclude?: RegExp,
  ): number =>
    header.findIndex((h) => {
      if (!h || (exclude && exclude.test(h))) return false;
      return patterns.some((p) => p.test(h));
    });

  // Scan the first 30 lines to find the header row
  for (let r = 0; r < Math.min(lines.length, 30); r++) {
    sep = detectSeparator(lines[r]);
    const rawHeader = parseRow(lines[r], sep);
    const header = rawHeader.map(normalizeHeader);

    const cNome = matchCol(header, [
      /nome\s*(do\s*)?colaborador/,
      /^nome$/,
      /conferente/,
      /colaborador/,
    ]);
    const cMatricula = matchCol(header, [/matricula/, /^matr$/]);
    const cQtdeExact = header.findIndex((h) => /^qtde$/.test(h));
    const cQtde =
      cQtdeExact >= 0
        ? cQtdeExact
        : matchCol(
            header,
            [/^qtde\.?\s*volu/, /^quantidade$/, /^qtd$/, /total.*peca/, /volumes/],
            /1a1|unit|coleta|erro|%/,
          );
    const cQtde1a1 = matchCol(
      header,
      [/^1a1$/, /^1a$/, /qtde1a1/],
      /coleta|ult|estimada|horas|erro|%/,
    );
    const cHoras = matchCol(
      header,
      [/^horas$/, /horas\s*estimadas/, /horas\s*trab/],
      /produtividade/,
    );
    const cProdutividade = matchCol(
      header,
      [/produtividade/, /horasprodutividade/, /ritmo/, /itens.*hora/, /prod.*hora/],
      /^horas$/,
    );
    const cErro = matchCol(
      header,
      [/erro\s*\(qtde\)/, /erro\s*\(qtd\)/, /^erro$/, /^erros$/, /qtde.*erro/, /divergencia/],
      /%|vlr|valor/,
    );
    const cPctErro = matchCol(
      header,
      [/%.*erro/, /erro.*qtd/, /erro.*qtde/, /taxa.*erro/],
    );
    const cBloco = matchCol(header, [/^bloco$/, /^f\s*bloco$/], /contagem|%/);

    if (cNome >= 0 && cQtde >= 0) {
      col = {
        nome: cNome,
        matricula: cMatricula,
        qtde: cQtde,
        qtde1a1:
          cQtde1a1 >= 0 && cQtde1a1 !== cQtde ? cQtde1a1 : -1,
        produtividade:
          cProdutividade >= 0 && cProdutividade !== cQtde && cProdutividade !== cHoras
            ? cProdutividade
            : -1,
        horas: cHoras >= 0 && cHoras !== cProdutividade ? cHoras : -1,
        erro: cErro,
        pctErro: cPctErro,
        bloco: cBloco >= 0 && cBloco !== cQtde ? cBloco : -1,
      };
      headerRowIndex = r;
      break;
    }
  }

  if (headerRowIndex < 0) {
    return [];
  }

  const isSkipNome = (nome: string) =>
    /^(nome|total|soma|media|resumo|capa|matric|page|relat)/i.test(nome);

  const resolveQtde1a1 = (
    qtde: number,
    fromCol: number,
    blocoVal: number,
    has1a1Col: boolean,
  ): number => {
    if (has1a1Col) return Math.min(Math.max(0, fromCol), qtde);
    if (blocoVal > 0 && qtde > 0) {
      return Math.min(Math.max(0, qtde - blocoVal), qtde);
    }
    return 0;
  };

  const resolveProdutividade = (
    qtde: number,
    fromCol: number,
    horas: number,
  ): number => {
    if (fromCol > 0) return fromCol;
    if (horas > 0 && qtde > 0) {
      return Math.round((qtde / horas) * 100) / 100;
    }
    return 0;
  };

  const result: InventoryCheckerInput[] = [];

  for (let i = headerRowIndex + 1; i < lines.length; i++) {
    const cells = parseRow(lines[i], sep).map((c) =>
      (c ?? "").replace(/^"|"$/g, "").trim(),
    );

    const nonEmpties = cells.filter((c) => c !== "");
    const hasDate = nonEmpties.some((c) => /\d{2}\/\d{2}\/\d{4}/.test(c));
    if (
      nonEmpties.length >= 9 &&
      /^\d+$/.test(nonEmpties[0]) &&
      /^\d+$/.test(nonEmpties[1]) &&
      hasDate
    ) {
      const nome = nonEmpties[2];
      if (!nome || isSkipNome(nome)) continue;

      const qtde = parseNumberBR(nonEmpties[3]);
      if (qtde <= 0) continue;

      const horas = nonEmpties.length > 6 ? parseNumberBR(nonEmpties[6]) : 0;
      const prodCol = nonEmpties.length > 7 ? parseNumberBR(nonEmpties[7]) : 0;
      const produtividade = resolveProdutividade(qtde, prodCol, horas);
      const erro = nonEmpties.length > 8 ? parseNumberBR(nonEmpties[8]) : 0;
      const has1a1Col = nonEmpties.length > 13;
      const qtde1a1Col = has1a1Col ? parseNumberBR(nonEmpties[13]) : 0;
      const blocoCol = nonEmpties.length > 14 ? parseNumberBR(nonEmpties[14]) : 0;
      const qtde1a1 = resolveQtde1a1(qtde, qtde1a1Col, blocoCol, has1a1Col);

      result.push({
        nome,
        matricula: nonEmpties[1],
        qtde,
        qtde1a1,
        produtividade,
        erro: Math.min(Math.max(0, erro), qtde),
      });
      continue;
    }

    const nome = (cells[col.nome] ?? "").trim();
    if (!nome || isSkipNome(nome)) continue;

    const qtde = parseNumberBR(cells[col.qtde] ?? "");
    if (qtde <= 0) continue;

    const blocoVal =
      col.bloco >= 0 ? parseNumberBR(cells[col.bloco] ?? "") : 0;
    const qtde1a1Raw =
      col.qtde1a1 >= 0 ? parseNumberBR(cells[col.qtde1a1] ?? "") : 0;
    const qtde1a1 = resolveQtde1a1(
      qtde,
      qtde1a1Raw,
      blocoVal,
      col.qtde1a1 >= 0,
    );

    const horas = col.horas >= 0 ? parseNumberBR(cells[col.horas] ?? "") : 0;
    const prodCol =
      col.produtividade >= 0
        ? parseNumberBR(cells[col.produtividade] ?? "")
        : 0;
    const produtividade = resolveProdutividade(qtde, prodCol, horas);

    let erro = 0;
    if (col.erro >= 0) {
      erro = parseNumberBR(cells[col.erro] ?? "");
    } else if (col.pctErro >= 0) {
      const rawPct = cells[col.pctErro] ?? "";
      const pct = parseNumberBR(rawPct.replace("%", ""));
      erro = Math.round(qtde * (pct / 100));
    }
    erro = Math.min(Math.max(0, erro), qtde);

    const matricula =
      col.matricula >= 0 ? (cells[col.matricula] ?? "").trim() : undefined;

    result.push({
      nome,
      ...(matricula ? { matricula } : {}),
      qtde,
      qtde1a1,
      produtividade,
      erro,
    });
  }

  return result;
};

// ==========================
// PARSER INVENTEXP - TAGS (CSV/Excel) — Formato simples (backward-compat)
// ==========================
export const parseTagsCsv = (
  text: string,
): Record<string, { itensPulados: number; itensDuplicados: number }> => {
  const result: Record<string, { itensPulados: number; itensDuplicados: number }> = {};
  
  const lines = text
    .split(/[\r\n]+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
    
  if (lines.length < 2) return result;

  const detectSeparator = (line: string): RegExp => {
    const semicolons = (line.match(/;/g) ?? []).length;
    const tabs       = (line.match(/\t/g) ?? []).length;
    const commas     = (line.match(/,/g) ?? []).length;
    if (semicolons >= tabs && semicolons >= commas) return /;/;
    if (tabs >= commas) return /\t/;
    return /,/;
  };

  const parseRow = (row: string, sep: RegExp): string[] => {
    if (!row.includes('"')) {
      return row.split(sep).map((c) => c.trim());
    }
    const res: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < row.length; i++) {
      const c = row[i];
      if (c === '"') { inQuotes = !inQuotes; continue; }
      if (sep.test(c) && !inQuotes) {
        res.push(current.trim());
        current = "";
      } else {
        current += c;
      }
    }
    res.push(current.trim());
    return res;
  };

  const normalizeHeader = (h: string): string =>
    h.replace(/^"|"$/g, "").trim().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  let headerRowIndex = -1;
  let sep = /,/;
  let col = { nome: -1, qtdA1: -1 };

  for (let r = 0; r < Math.min(lines.length, 30); r++) {
    sep = detectSeparator(lines[r]);
    const header = parseRow(lines[r], sep).map(normalizeHeader);

    const cNome = header.findIndex((h) => /nome|conferente|colaborador/i.test(h));
    const cQtdA1 = header.findIndex((h) => /qtd.*a1/i.test(h));

    if (cNome >= 0 && cQtdA1 >= 0) {
      col = { nome: cNome, qtdA1: cQtdA1 };
      headerRowIndex = r;
      break;
    }
  }

  if (headerRowIndex < 0) return result;

  for (let i = headerRowIndex + 1; i < lines.length; i++) {
    const cells = parseRow(lines[i], sep).map((c) =>
      (c ?? "").replace(/^"|"$/g, "").trim(),
    );

    const nomeRaw = (cells[col.nome] ?? "").trim();
    if (!nomeRaw || /^(nome|total|soma|media|resumo)/i.test(nomeRaw)) continue;
    
    // Simplificar o nome para facilitar o matching
    const nomeKey = nomeRaw.toLowerCase().trim();
    
    const qtdStr = cells[col.qtdA1] ?? "0";
    const qtdA1 = parseNumberBR(qtdStr); // parseNumberBR suporta virgula decimal e negativo

    if (!result[nomeKey]) {
      result[nomeKey] = { itensPulados: 0, itensDuplicados: 0 };
    }

    if (qtdA1 > 0) {
      result[nomeKey].itensPulados += qtdA1;
    } else if (qtdA1 < 0) {
      result[nomeKey].itensDuplicados += Math.abs(qtdA1);
    }
  }

  return result;
};

// ==========================
// PARSER AVANÇADO - PRODUTIVIDADE_TAG (Formato completo: AREA + MATRICULA + NOME + C1 + A1 ...)
// ==========================
export interface TagsExtendedResult {
  /** Por colaborador: erroSecao = Σ|Qtd(A1)|, numSecoes */
  porColaborador: Record<string, {
    erroSecao: number;
    numSecoes: number;
    itensPulados: number;
    itensDuplicados: number;
    matricula?: string;
  }>;
  /** Por área física: acurácia de estoque */
  porArea: Array<{
    area: string;
    totalC1: number;
    ajusteAbsoluto: number;
    ajusteLiquido: number;
    acuracidade: number;
    colaboradores: string[];
  }>;
  /** Flag indicando se o formato estendido foi detectado */
  isExtended: boolean;
}

/**
 * Parser avançado para o formato completo do relatório RProInv_Produtividade.
 * Suporta o formato exportado com colunas: AREA | MATRICULA | NOME | Seções | Qtd(C1) | Qtd(A1) | Qtd(A2) | Qtd(A3) | QTD(FINAL)
 * Também aceita o formato simples Nome;Qtd(A1) (backward-compat).
 *
 * Calcula:
 *  - erroSecao por conferente = Σ|Qtd(A1)| (erros modulares por seção)
 *  - acurácia por área = 1 - (Σ|Qtd(A1)| / Σ Qtd(C1)) * 100
 */
export const parseTagsExtended = (text: string): TagsExtendedResult => {
  const lines = text
    .split(/[\r\n]+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const emptyResult: TagsExtendedResult = {
    porColaborador: {},
    porArea: [],
    isExtended: false,
  };

  if (lines.length < 2) return emptyResult;

  const detectSeparator = (line: string): RegExp => {
    const tabs = (line.match(/\t/g) ?? []).length;
    const semi = (line.match(/;/g) ?? []).length;
    const commas = (line.match(/,/g) ?? []).length;
    if (tabs >= semi && tabs >= commas) return /\t/;
    if (semi >= commas) return /;/;
    return /,/;
  };

  const parseRow = (row: string, sep: RegExp): string[] =>
    row.split(sep).map((c) => c.replace(/^"|"$/g, "").trim());

  const normalizeH = (h: string): string =>
    h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();

  const parseBR = (s: string): number => {
    const v = String(s ?? "").replace(/%/g, "").replace(/\s/g, "").trim();
    if (!v) return 0;
    if (v.includes(",")) {
      return parseFloat(v.replace(/\./g, "").replace(",", ".")) || 0;
    }
    return parseFloat(v) || 0;
  };

  // Procura header do formato estendido (AREA, NOME, Qtd(C1), Qtd(A1))
  let headerIdx = -1;
  let sep = /\t/;
  let cArea = -1, cMatricula = -1, cNome = -1, cSecoes = -1, cC1 = -1, cA1 = -1;

  for (let r = 0; r < Math.min(lines.length, 20); r++) {
    sep = detectSeparator(lines[r]);
    const raw = parseRow(lines[r], sep);
    const hdr = raw.map(normalizeH);

    const iArea     = hdr.findIndex(h => /^area$/.test(h));
    const iNome     = hdr.findIndex(h => /^nome$/.test(h));
    const iC1       = hdr.findIndex(h => /qtd.*c1/i.test(h));
    const iA1       = hdr.findIndex(h => /qtd.*a1/i.test(h));
    const iMatr     = hdr.findIndex(h => /matricula/i.test(h));
    const iSecoes   = hdr.findIndex(h => /sec[oa]es\s*contadas|secoes/i.test(h));

    if (iArea >= 0 && iNome >= 0 && iC1 >= 0 && iA1 >= 0) {
      cArea = iArea; cNome = iNome; cC1 = iC1; cA1 = iA1;
      cMatricula = iMatr; cSecoes = iSecoes;
      headerIdx = r;
      break;
    }
  }

  // Formato estendido não detectado → tenta formato simples
  if (headerIdx < 0) {
    const simple = parseTagsCsv(text);
    const por: TagsExtendedResult["porColaborador"] = {};
    for (const [k, v] of Object.entries(simple)) {
      por[k] = { erroSecao: 0, numSecoes: 0, ...v };
    }
    return { porColaborador: por, porArea: [], isExtended: false };
  }

  // Estruturas de acumulação
  const colabMap: Record<string, {
    erroSecao: number; numSecoes: number;
    itensPulados: number; itensDuplicados: number; matricula?: string;
  }> = {};
  const areaMap: Record<string, {
    totalC1: number; ajusteAbsoluto: number; ajusteLiquido: number; colaboradores: Set<string>;
  }> = {};

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cells = parseRow(lines[i], sep);

    const area  = (cells[cArea] ?? "").trim();
    const nome  = (cells[cNome] ?? "").trim();
    const c1Raw = cells[cC1] ?? "";
    const a1Raw = cells[cA1] ?? "";

    // Pula linhas de total/subtotal (sem nome ou sem área), cabeçalhos repetidos e linhas de página
    if (!area || !nome) continue;
    if (/^(area|nome|total|page|rproinv|relat)/i.test(area)) continue;
    if (/^(nome|total|soma|media|page)/i.test(nome)) continue;

    const c1 = parseBR(c1Raw);
    const a1 = parseBR(a1Raw);
    const secoes = cSecoes >= 0 ? (parseBR(cells[cSecoes] ?? "0") || 1) : 1;
    const matricula = cMatricula >= 0 ? (cells[cMatricula] ?? "").trim() || undefined : undefined;

    if (c1 <= 0 && a1 === 0) continue; // linha de subtotal sem dados reais

    // Acumula por colaborador (chave normalizada = lowercase)
    const nomeKey = nome.toLowerCase().trim();
    if (!colabMap[nomeKey]) {
      colabMap[nomeKey] = { erroSecao: 0, numSecoes: 0, itensPulados: 0, itensDuplicados: 0, matricula };
    }
    colabMap[nomeKey].erroSecao += Math.abs(a1);
    colabMap[nomeKey].numSecoes += secoes;
    if (a1 > 0) colabMap[nomeKey].itensPulados += a1;
    else if (a1 < 0) colabMap[nomeKey].itensDuplicados += Math.abs(a1);

    // Acumula por área (apenas linhas com nome de colaborador, não subtotais)
    const areaKey = area.toUpperCase().trim();
    if (!areaMap[areaKey]) {
      areaMap[areaKey] = { totalC1: 0, ajusteAbsoluto: 0, ajusteLiquido: 0, colaboradores: new Set() };
    }
    areaMap[areaKey].totalC1 += c1;
    areaMap[areaKey].ajusteAbsoluto += Math.abs(a1);
    areaMap[areaKey].ajusteLiquido += a1;
    areaMap[areaKey].colaboradores.add(nome);
  }

  // Monta array de acurácia por área, ordenado do pior para o melhor
  const porArea = Object.entries(areaMap)
    .map(([area, d]) => ({
      area,
      totalC1: d.totalC1,
      ajusteAbsoluto: d.ajusteAbsoluto,
      ajusteLiquido: d.ajusteLiquido,
      acuracidade: d.totalC1 > 0
        ? Math.max(0, Math.min(100, (1 - d.ajusteAbsoluto / d.totalC1) * 100))
        : 100,
      colaboradores: Array.from(d.colaboradores),
    }))
    .sort((a, b) => a.acuracidade - b.acuracidade);

  return { porColaborador: colabMap, porArea, isExtended: true };
};
