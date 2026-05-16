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
 * Também aceita o formato simplificado:
 *   Nome,Qtde,Qtde1a1,Produtividade,Erro
 *
 * Lógica:
 *  - qtde   → coluna "QTDE. VOLUMES" ou "Qtde"
 *  - qtde1a1 → coluna "1a1"
 *  - produtividade → coluna "PRODUTIVIDADE"
 *  - erro   → coluna "ERRO" (quantidade absoluta, não percentagem)
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


  let headerRowIndex = -1;
  let sep = /,/;
  let col = { nome: -1, qtde: -1, qtde1a1: -1, produtividade: -1, erro: -1 };

  // Scan the first 30 lines to find the header row
  for (let r = 0; r < Math.min(lines.length, 30); r++) {
    sep = detectSeparator(lines[r]);
    const rawHeader = parseRow(lines[r], sep);
    const header = rawHeader.map(normalizeHeader);

    const matchCol = (patterns: RegExp[], exclude?: RegExp): number => {
      return header.findIndex((h) => {
        if (exclude && exclude.test(h)) return false;
        return patterns.some((p) => p.test(h));
      });
    };

    const cNome = matchCol([/nome/i, /conferente/i, /colaborador/i]);
    const cQtde = matchCol([/^qtde\.?\s*volu/i, /^qtde/i, /^quantidade/i, /^qtd/i, /total.*peca/i, /volumes/i], /1a1|unit/i);
    const cQtde1a1 = matchCol([/1\s*a\s*1/i, /1a1/i, /qtde1a1/i, /unit[aá]rio/i, /unit/i]);
    // Produtividade: evitar "horas trabalhadas" ou "estimadas"
    const cProdutividade = matchCol([/produtividade/i, /ritmo/i, /itens.*hora/i, /prod.*hora/i]);
    // Erro: erro absoluto
    const cErro = matchCol([/^erro/i, /^erros/i, /^qtde.*erro/i, /divergencia/i], /%/); 
    const cPctErro = matchCol([/%/i, /taxa.*erro/i]); 

    // Diagnóstico flexível: tenta encontrar pelo menos Nome e Quantidade
    if (cNome >= 0 && cQtde >= 0) {
      col = { 
        nome: cNome, 
        qtde: cQtde, 
        qtde1a1: cQtde1a1 >= 0 && cQtde1a1 !== cQtde ? cQtde1a1 : -1, 
        produtividade: cProdutividade >= 0 && cProdutividade !== cQtde ? cProdutividade : -1, 
        erro: cErro >= 0 ? cErro : cPctErro 
      };

      headerRowIndex = r;
      break;
    }
  }

  if (headerRowIndex < 0) {
    return [];
  }

  const result: InventoryCheckerInput[] = [];

  for (let i = headerRowIndex + 1; i < lines.length; i++) {
    const cells = parseRow(lines[i], sep).map((c) =>
      (c ?? "").replace(/^"|"$/g, "").trim(),
    );

    // HEURÍSTICA DIRETA PARA O EXCEL DO CLIENTE:
    // Evita o problema de colunas desalinhadas (merged cells) no Excel.
    const nonEmpties = cells.filter(c => c !== "");
    if (nonEmpties.length >= 10 && /^\d+$/.test(nonEmpties[0]) && /^\d+$/.test(nonEmpties[1]) && /\d{2}\/\d{2}\/\d{4}/.test(nonEmpties[4])) {
      const nome = nonEmpties[2];
      if (/^(nome|total|soma|media|resumo)/i.test(nome)) continue;
      
      const qtde = parseNumberBR(nonEmpties[3]);
      const produtividade = parseNumberBR(nonEmpties[7]);
      const erro = parseNumberBR(nonEmpties[8]);
      const qtde1a1 = nonEmpties.length > 13 ? parseNumberBR(nonEmpties[13]) : 0;

      result.push({
        nome,
        qtde: Math.max(0, qtde),
        qtde1a1: Math.max(0, qtde1a1),
        produtividade: Math.max(0, produtividade),
        erro: Math.max(0, erro),
      });
      continue;
    }

    // FALLBACK ORIGINAL (Para CSVs normais ou colados à mão)
    const nome = (cells[col.nome] ?? "").trim();
    if (!nome) continue;
    if (/^(nome|total|soma|media|resumo)/i.test(nome)) continue;

    const qtde = parseNumberBR(cells[col.qtde] ?? "");
    const qtde1a1Raw = col.qtde1a1 >= 0 ? parseNumberBR(cells[col.qtde1a1] ?? "") : 0;
    const qtde1a1 = Math.max(0, qtde1a1Raw);
    const produtividade = col.produtividade >= 0 ? parseNumberBR(cells[col.produtividade] ?? "") : 0;
    let erro = 0;
    if (col.erro >= 0) {
      const rawErro = cells[col.erro] ?? "";
      const valErro = parseNumberBR(rawErro);
      // Se a coluna lida for a de porcentagem (ex: 1,73%), precisamos calcular o valor absoluto
      if (rawErro.includes('%') || valErro < 5) { // heurística: se erro for um número muito baixo com casas decimais
        // É provável que seja um percentual, então calculamos: qtde * (valErro / 100)
        // A menos que não tenha o sinal de %, aí usamos o valErro como absoluto (pode ser 1 ou 2)
        if (rawErro.includes('%')) {
          erro = Math.round(qtde * (valErro / 100));
        } else {
          erro = valErro;
        }
      } else {
        erro = valErro;
      }
    }
    
    erro = Math.max(0, erro);

    if (qtde <= 0) continue;

    result.push({
      nome,
      qtde,
      qtde1a1: Math.min(qtde1a1, qtde),
      produtividade,
      erro: Math.min(erro, qtde),
    });
  }

  return result;
};
