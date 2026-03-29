import type {
  AttendanceCollaborator,
  AttendanceData,
  InventoryCheckerInput,
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
  for (let i = 0; i < data.colaboradores.length; i++) {
    const c = data.colaboradores[i];
    if (c.ehBkp) {
      linhas.push(`BKP ${c.nome}${icon(c)}`);
      continue;
    }
    const num = c.numero ?? i + 1;
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
  const avancos: { label: string; mins: number; val: number | "" }[] = [
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
Fim Inventário: ${fmtTime(r.terminoInventario)}
Cont. Antecipada: ${fmtBool(r.contagemAntecipada)}
Satisfação: ${fmtVal(r.satisfacao)}
Acuracidade: ${fmtPct(r.acuracidade)}
% Auditoria: ${fmtPct(r.percentualAuditoria)}
Produtividade (PH): ${fmtIntBr(r.ph)}`;
};

export const formatReportB = (r: ReportB): string => {
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
Início Aud. Cliente: ${fmtTime(r.inicioAuditoriaCliente)}
Fim Aud. Cliente: ${fmtTime(r.terminoAuditoriaCliente)}
Ini. Div. Controlados: ${fmtTime(r.inicioControlados)}
Ini. Divergência: ${fmtTime(r.inicioDivergencia)}
Fim Divergência: ${fmtTime(r.terminoDivergencia)}
Ini. Ñ contados: ${fmtTime(r.inicioNaoContados)}
Fim Ñ contados: ${fmtTime(r.terminoNaoContados)}
Itens Alt. Diverg.: ${fmtVal(r.qtdAlterados)}
Itens Ñ Cont.: ${fmtVal(r.qtdNaoContados)}
Enc. no Não Cont.: ${fmtVal(r.qtdEncontradosNaoContados)}
Fim Inventário: ${fmtTime(r.terminoInventario)}
Total Peças: ${fmtIntBr(r.totalPecas)}
Val. Fin.: ${fmtMoeda(r.valorFinanceiro)}
Aval. Prep. Dep.: ${fmtPct(r.avalPrepDeposito)}
Aval. Prep. Loja: ${fmtPct(r.avalPrepLoja)}
Satisfação: ${fmtVal(r.satisfacao)}
Responsável: ${fmtVal(r.responsavel)}
Acurac. Cliente: ${fmtPct(r.acuracidadeCliente)}
Acurac. Terc.: ${fmtPct(r.acuracidadeTerceirizada)}
Houve Suporte: ${fmtBool(r.suporteSolicitado)}`;
};

// Número: BR 7.307,00 -> 7307 | 0,027 -> 0.027; US 5.23 -> 5.23
// Também lida com strings de percentagem "1,73%" -> 1.73
const parseNumberBR = (s: string): number => {
  // Remove símbolo de percentagem e espaços
  const v = String(s ?? "").replace(/%/g, "").trim();
  if (!v) return 0;
  // Formato BR: pontos como separador de milhar, vírgula como decimal
  if (v.includes(",")) {
    const normal = v.replace(/\./g, "").replace(",", ".");
    const n = parseFloat(normal);
    return isNaN(n) ? 0 : n;
  }
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
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

  // Detecta o separador dominante na linha de cabeçalho
  const detectSeparator = (headerLine: string): RegExp => {
    const semicolons = (headerLine.match(/;/g) ?? []).length;
    const tabs       = (headerLine.match(/\t/g) ?? []).length;
    const commas     = (headerLine.match(/,/g) ?? []).length;
    if (semicolons >= tabs && semicolons >= commas) return /;/;
    if (tabs >= commas) return /\t/;
    return /,/;
  };

  const sep = detectSeparator(lines[0]);

  const parseRow = (row: string): string[] => {
    // Usa split simples quando não há aspas (mais rápido e correto para este formato)
    if (!row.includes('"')) {
      return row.split(sep).map((c) => c.trim());
    }
    // Fallback: parser com controlo de aspas
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
      .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // remove acentos

  const findCol = (header: string[], patterns: RegExp[]): number => {
    for (const p of patterns) {
      const i = header.findIndex((h) => p.test(h));
      if (i >= 0) return i;
    }
    return -1;
  };

  const rawHeader = parseRow(lines[0]);
  const header    = rawHeader.map(normalizeHeader);

  const col = {
    // Nome: "nome do conferente", "colaborador", "name", "nome"
    nome: findCol(header, [
      /nome\s*(do)?\s*conferente/i,
      /^nome$/i,
      /colaborador/i,
      /name/i,
    ]),
    // Quantidade total: "qtde. volumes", "qtde", "quantidade"
    qtde: findCol(header, [
      /qtde\.?\s*volu/i,
      /^qtde\.?/i,
      /^qtd\.?/i,
      /quantidade/i,
      /total.*pecas/i,
    ]),
    // Quantidade 1 a 1: "1a1", "qtde1a1", "unitario"
    qtde1a1: findCol(header, [
      /^1a1$/i,
      /^qtde1a1$/i,
      /1\s*a\s*1/i,
      /unit[aá]rio/i,
    ]),
    // Produtividade: "produtividade", "itens/hora", "prod"
    produtividade: findCol(header, [
      /^produtividade/i,
      /prod.*hora/i,
      /itens.*hora/i,
    ]),
    // Erro: "erro" absoluto — NÃO confundir com "% erro"
    erro: findCol(header, [
      /^erro$/i,
      /^qtde.*erro/i,
      /^erros$/i,
    ]),
  };

  // Diagnóstico: se colunas críticas não foram encontradas, retorna vazio
  if (
    col.nome < 0 ||
    col.qtde < 0 ||
    col.qtde1a1 < 0 ||
    col.produtividade < 0 ||
    col.erro < 0
  ) {
    return [];
  }

  const result: InventoryCheckerInput[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = parseRow(lines[i]).map((c) =>
      (c ?? "").replace(/^"|"$/g, "").trim(),
    );

    const nome = (cells[col.nome] ?? "").trim();
    if (!nome) continue;
    // Ignora linhas que são claramente de cabeçalho repetido ou totais
    if (/^(nome|total|soma|media)/i.test(nome)) continue;

    const qtde          = parseNumberBR(cells[col.qtde]         ?? "");
    const qtde1a1       = Math.max(0, parseNumberBR(cells[col.qtde1a1]      ?? ""));
    const produtividade = parseNumberBR(cells[col.produtividade] ?? "");
    const erro          = Math.max(0, parseNumberBR(cells[col.erro]          ?? ""));

    // Descarta linhas inválidas: sem quantidade ou produtividade negativa
    if (qtde <= 0 || produtividade < 0) continue;

    result.push({
      nome,
      qtde,
      qtde1a1: Math.min(qtde1a1, qtde), // nunca pode ser maior que o total
      produtividade,
      erro: Math.min(erro, qtde),        // nunca pode ser maior que o total
    });
  }

  return result;
};
