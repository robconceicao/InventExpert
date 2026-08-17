/**
 * Avaliação consolidada do inventário — a planilha que o líder analisa.
 *
 * Espelha o `Avaliacao_Consolidada_<loja>.xlsx` de referência: oito abas, da
 * visão executiva à rastreabilidade item a item. É o par do PDF individual —
 * enquanto a ficha responde "como eu fui", esta responde "como foi o
 * inventário e onde estão os riscos".
 *
 * Módulo puro: só `xlsx` e os tipos do motor v3. Roda no Jest sem mock de
 * React Native, e é assim que as abas ficam cobertas por teste.
 */
import * as XLSX from "xlsx";

import type { AvaliacaoV3 } from "../services/AvaliacaoV3Service";
import type { AreaAtribuida } from "../services/AreaMappingService";
import type { InventoryOperationType } from "../types";

/** Diagnóstico da execução — o que sustenta a aba de ressalvas. */
export interface DiagnosticoConsolidado {
  secoesMapeadas: number;
  areasNaoConformes: number;
  divergencias: number;
  orfas: number;
  compartilhadas: number;
  reconciliacaoOk: boolean;
  falhasReconciliacao: { matricula: string; esperado: number; apurado: number }[];
  naoContados: number;
  naoContadosAlta: number;
  dobro: number;
  enderecosForaPadrao?: number;
  datasDistintas?: string[];
  arquivosPrc?: number;
}

export interface ContextoConsolidado {
  loja: string;
  capa?: string;
  dataInventario: string;
  operacao: InventoryOperationType;
  medianaEquipe: number;
  diagnostico?: DiagnosticoConsolidado | null;
  /** Nome de quem gerou — entra no rodapé da metodologia. */
  emitidoPor?: string;
}

type Linha = (string | number | null)[];

const BRL = (v: number) => Number.isFinite(v) ? Number(v.toFixed(2)) : 0;
const PCT = (v: number) => Number.isFinite(v) ? Number(v.toFixed(2)) : 0;

const hora = (d: Date | null | undefined): string =>
  d instanceof Date && !Number.isNaN(d.getTime())
    ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : "sem dado";

/** Nomes das áreas com o número de seções, como no relatório de referência. */
function resumirAreas(areas: AreaAtribuida[]): string {
  return areas
    .map((a) => `${a.area} (${a.secoes.length})`)
    .join(" · ");
}

function abaResumo(
  avaliacoes: AvaliacaoV3[],
  ctx: ContextoConsolidado,
): Linha[] {
  const d = ctx.diagnostico;
  const pecas = avaliacoes.reduce((s, a) => s + a.pecasContagem, 0);
  const valorContado = avaliacoes.reduce((s, a) => s + a.valorContado, 0);
  const valorAjustado = avaliacoes.reduce((s, a) => s + a.valorAjustado, 0);
  const unidadesErro = avaliacoes.reduce((s, a) => s + a.unidadesEmErro, 0);
  const controlados = avaliacoes.reduce((s, a) => s + a.divergenciasControlados, 0);
  const notas = avaliacoes.map((a) => a.nota).sort((x, y) => x - y);
  const mediana = notas.length
    ? notas.length % 2
      ? notas[(notas.length - 1) / 2]
      : (notas[notas.length / 2 - 1] + notas[notas.length / 2]) / 2
    : 0;

  const linhas: Linha[] = [
    [`AVALIAÇÃO DE CONFERENTES — INVENTÁRIO ${ctx.loja}`],
    [
      [
        ctx.capa ? `Capa ${ctx.capa}` : null,
        `Data-base ${ctx.dataInventario}`,
        `Operação ${ctx.operacao}`,
        `Emissão ${new Date().toLocaleDateString("pt-BR")}`,
      ]
        .filter(Boolean)
        .join(" · "),
    ],
    [],
    ["Indicador", "Valor", "Fonte"],
    ["Conferentes avaliados", avaliacoes.length, "RProInv_Produtividade + PROD_SEÇÃO"],
    ["Peças contadas (sem auditoria dirigida)", pecas, "Arquivos .prc"],
    ["Mediana de produtividade (peças/h)", PCT(ctx.medianaEquipe), "Calculada sobre a equipe"],
    ["Nota mediana da equipe", PCT(mediana), "Motor v3"],
    ["Valor contado (R$)", BRL(valorContado), "CadProd × contagem"],
    ["Valor ajustado (R$)", BRL(valorAjustado), "ACURACIDADE × custo"],
    [
      "% do valor em divergência",
      valorContado > 0 ? PCT((valorAjustado / valorContado) * 100) : 0,
      "Calculado",
    ],
    ["Unidades em erro", unidadesErro, "ACURACIDADE"],
    ["Divergências em controlados", controlados, "CONTROLADOS.xls"],
  ];

  if (d) {
    linhas.push(
      [],
      ["Rastreabilidade", "Valor", "Observação"],
      ["Seções mapeadas para área", d.secoesMapeadas, "PROD_SEÇÃO + .prc"],
      ["Divergências atribuídas", d.divergencias, "Par SEÇÃO+EAN"],
      ["Divergências órfãs", d.orfas, "Sem bipada correspondente — não atribuídas"],
      ["Divergências compartilhadas", d.compartilhadas, "Mais de um conferente no par"],
      ["Produtos não contados", d.naoContados, `${d.naoContadosAlta} com confiança ALTA`],
      ["Itens em dobro", d.dobro, "DOBRO.xls — indicador de método"],
      [
        "Reconciliação com Erro (Qtde)",
        d.reconciliacaoOk ? "FECHOU" : `${d.falhasReconciliacao.length} conferente(s) fora`,
        "Soma atribuída × relatório do sistema",
      ],
    );
  }

  linhas.push(
    [],
    ["Nota = 0,35×Acuracidade + 0,25×Produtividade + 0,25×Valor + 0,15×Cobertura − penalidades"],
    ["Penalidades: −5 por divergência em controlado · −2 por não contado de confiança ALTA (−1 se recuperado)"],
  );

  return linhas;
}

function abaRanking(avaliacoes: AvaliacaoV3[]): Linha[] {
  const linhas: Linha[] = [
    ["RANKING GERAL — NOTA COMPOSTA"],
    [
      "Prestadores de serviço aparecem na planilha do líder, mas não recebem posição na própria ficha.",
    ],
    [],
    [
      "Posição",
      "Conferente",
      "Matrícula/CPF",
      "Vínculo",
      "Nota",
      "Faixa",
      "Acuracidade (un) %",
      "Produtividade (peças/h)",
      "Índice prod.",
      "% erro valor",
      "Cobertura",
      "Penalidade",
      "Encaminhamento",
    ],
  ];

  avaliacoes.forEach((a, i) => {
    linhas.push([
      i + 1,
      a.nome,
      a.matricula,
      a.modalidade,
      PCT(a.nota),
      a.faixa,
      PCT(a.acuracidadeUnidades),
      PCT(a.produtividade),
      PCT(a.indiceProdutividade),
      PCT(a.pctErroValor),
      PCT(a.cobertura),
      PCT(a.penalidade),
      encaminhamento(a.nota),
    ]);
  });

  return linhas;
}

/** Faixa → ação, como no procedimento. */
export function encaminhamento(nota: number): string {
  if (nota >= 90) return "Manter — referência para os demais";
  if (nota >= 80) return "Devolutiva com os pontos de melhora";
  if (nota >= 70) return "Acompanhamento em campo no próximo inventário";
  return "Reciclagem antes da próxima escala";
}

function abaPorConferente(avaliacoes: AvaliacaoV3[]): Linha[] {
  const linhas: Linha[] = [
    ["FICHA POR CONFERENTE"],
    [],
    [
      "Nome",
      "Matrícula/CPF",
      "Vínculo",
      "Áreas atendidas",
      "Seções",
      "Horas (contagem)",
      "Ociosidade (min)",
      "Peças (contagem)",
      "Peças (auditoria dirigida)",
      "Peças/h",
      "Itens auditados",
      "Itens com erro",
      "Unidades em erro",
      "Acuracidade un. %",
      "Valor contado (R$)",
      "Valor ajustado (R$)",
      "% erro valor",
      "Não contados ALTA",
      "Divergências controlados",
      "Itens em dobro",
      "Nota",
      "Faixa",
    ],
  ];

  for (const a of avaliacoes) {
    linhas.push([
      a.nome,
      a.matricula,
      a.modalidade,
      resumirAreas(a.areas),
      a.secoes,
      PCT(a.horasContagem),
      Math.round(a.ociosidadeMin),
      a.pecasContagem,
      a.pecasAuditoria,
      PCT(a.produtividade),
      a.itensAuditados,
      a.itensComErro,
      a.unidadesEmErro,
      PCT(a.acuracidadeUnidades),
      BRL(a.valorContado),
      BRL(a.valorAjustado),
      PCT(a.pctErroValor),
      a.naoContadosAlta,
      a.divergenciasControlados,
      a.itensEmDobro,
      PCT(a.nota),
      a.faixa,
    ]);
  }

  return linhas;
}

function abaErros(avaliacoes: AvaliacaoV3[]): Linha[] {
  const linhas: Linha[] = [
    ["DIVERGÊNCIAS DE QUANTIDADE — ITEM A ITEM"],
    [
      "Atribuição pelo par SEÇÃO+EAN do ACURACIDADE cruzado com a bipada correspondente nos arquivos .prc.",
    ],
    [],
    [
      "Conferente",
      "Matrícula/CPF",
      "Área",
      "Seção",
      "EAN",
      "Descrição do produto",
      "Qtde contada (C1)",
      "Qtde final",
      "Ajuste (qtd)",
      "Tipo",
      "Custo unit. (R$)",
      "Valor da divergência (R$)",
      "Modo de contagem",
      "Hora da bipada",
      "Controlado",
      "Compartilhada",
    ],
  ];

  for (const a of avaliacoes) {
    for (const d of a.divergencias) {
      linhas.push([
        a.nome,
        a.matricula,
        d.area,
        d.secao,
        d.ean,
        d.descricao,
        d.qtdC1,
        d.qtdFinal,
        d.ajuste,
        d.tipo,
        BRL(d.custoUnitario),
        BRL(d.valor),
        d.modo,
        hora(d.hora),
        d.controlado ? "SIM" : "não",
        d.compartilhada ? "SIM" : "não",
      ]);
    }
  }

  if (linhas.length === 4) linhas.push(["Nenhuma divergência atribuída."]);
  return linhas;
}

function abaNaoContados(avaliacoes: AvaliacaoV3[]): Linha[] {
  const linhas: Linha[] = [
    ["PRODUTOS NÃO CONTADOS — ATRIBUIÇÃO POR ÁREA E RESPONSÁVEL"],
    [
      "Os relatórios de não contados não trazem seção. A área provável vem do local onde produtos da mesma marca (ou família) foram contados.",
    ],
    [
      "ALTA pesa na nota · MÉDIA e BAIXA dirigem recontagem e não penalizam ninguém.",
    ],
    [],
    [
      "Conferente",
      "Matrícula/CPF",
      "Área provável",
      "Confiança",
      "EAN(s)",
      "Descrição",
      "Situação",
      "Valor (R$)",
      "Base da atribuição",
      "Seções de referência",
      "Peso na nota",
    ],
  ];

  for (const a of avaliacoes) {
    for (const n of a.naoContados) {
      linhas.push([
        a.nome,
        a.matricula,
        n.area,
        n.nivel ?? "sem base",
        n.eans.join(", "),
        n.descricao,
        n.situacao,
        BRL(n.valor),
        n.base,
        n.secoesReferencia.join(", "),
        n.peso,
      ]);
    }
  }

  if (linhas.length === 5) linhas.push(["Nenhum produto não contado atribuído."]);
  return linhas;
}

function abaMapaAreas(avaliacoes: AvaliacaoV3[]): Linha[] {
  const linhas: Linha[] = [
    ["MAPA DE ÁREAS — QUEM CONTOU O QUÊ"],
    [
      "Reconstruído cruzando o PROD_SEÇÃO (área × conferente × nº de seções × peças) com as seções reais das bipadas.",
    ],
    [],
    [
      "Área",
      "Conferente",
      "Matrícula/CPF",
      "Seções",
      "Peças declaradas",
      "Peças apuradas",
      "Fechou",
      "Faixa de seções",
    ],
  ];

  const todas: { area: AreaAtribuida; nome: string; matricula: string }[] = [];
  for (const a of avaliacoes) {
    for (const area of a.areas) {
      todas.push({ area, nome: a.nome, matricula: a.matricula });
    }
  }
  todas.sort((x, y) => x.area.area.localeCompare(y.area.area, "pt-BR"));

  for (const { area, nome, matricula } of todas) {
    const ordenadas = [...area.secoes].sort();
    linhas.push([
      area.area,
      nome,
      matricula,
      area.secoes.length,
      area.qtdDeclarada,
      area.qtdApurada,
      area.conforme ? "SIM" : "não — ver ressalvas",
      ordenadas.length
        ? `${ordenadas[0]} a ${ordenadas[ordenadas.length - 1]}`
        : "sem dado",
    ]);
  }

  if (linhas.length === 4) linhas.push(["Mapa de áreas não disponível (falta PROD_SEÇÃO)."]);
  return linhas;
}

function abaRessalvas(
  avaliacoes: AvaliacaoV3[],
  ctx: ContextoConsolidado,
): Linha[] {
  const d = ctx.diagnostico;
  const linhas: Linha[] = [
    ["RESSALVAS E LIMITES DA ANÁLISE"],
    ["Tudo que reduz o alcance da avaliação fica registrado aqui — nunca escondido."],
    [],
    ["Ressalva", "Qtde", "Observação"],
  ];

  if (d) {
    linhas.push(
      [
        "Combinações área × conferente que não fecharam",
        d.areasNaoConformes,
        d.areasNaoConformes > 0
          ? "Diferença dentro da margem de rebipagem; conferir se o volume for alto"
          : "Todas fecharam",
      ],
      [
        "Divergências órfãs",
        d.orfas,
        "Sem bipada correspondente — não atribuídas a ninguém",
      ],
      [
        "Divergências compartilhadas",
        d.compartilhadas,
        "Par SEÇÃO+EAN bipado por mais de um conferente",
      ],
      [
        "Não contados sem confiança ALTA",
        Math.max(0, d.naoContados - d.naoContadosAlta),
        "Dirigem recontagem; não pesam na nota",
      ],
    );

    if (!d.reconciliacaoOk) {
      linhas.push([
        "Reconciliação não fechou",
        d.falhasReconciliacao.length,
        "A soma atribuída não reproduz o Erro (Qtde) do sistema — não publicar antes de investigar",
      ]);
      for (const f of d.falhasReconciliacao) {
        linhas.push([
          `  ${f.matricula}`,
          f.apurado - f.esperado,
          `esperado ${f.esperado}, apurado ${f.apurado}`,
        ]);
      }
    }

    if (d.enderecosForaPadrao) {
      linhas.push([
        "Endereços fora do padrão no .prc",
        d.enderecosForaPadrao,
        "Digitação manual no coletor; normalizados pelos últimos 4 dígitos",
      ]);
    }
    if (d.datasDistintas && d.datasDistintas.length > 1) {
      linhas.push([
        "Datas distintas nas bipadas",
        d.datasDistintas.length,
        `Relógio de coletor fora de data (${d.datasDistintas.join(", ")}) — horas medidas por janela diária`,
      ]);
    }
  }

  const semRelogio = avaliacoes.filter((a) => !a.relogioOk);
  if (semRelogio.length) {
    linhas.push([
      "Conferentes com relógio de coletor fora de data",
      semRelogio.length,
      semRelogio.map((a) => a.nome).join(", "),
    ]);
  }

  if (linhas.length === 4) linhas.push(["Nenhuma ressalva registrada."]);
  return linhas;
}

function abaMetodologia(ctx: ContextoConsolidado): Linha[] {
  return [
    ["METODOLOGIA E RASTREABILIDADE"],
    ["Procedimento PO-AVA-001 · motor v3 · ver docs/PROCEDIMENTO_AVALIACAO.md"],
    [],
    ["Item", "Detalhe"],
    ["FONTES", ""],
    ["Produtividade", "RProInv_Produtividade.xlsx — matrícula, peças, horas, erro"],
    ["Área física", "PROD_SEÇÃO.xlsx — única fonte da área física da loja"],
    ["Divergências", "RELATORIOS/ACURACIDADE.xls — por seção e EAN"],
    ["Bipadas brutas", "BKP/CNT/*.prc — matrícula, seção, produto, quantidade, hora"],
    ["Custo e família", "BKP/CadProd — valoriza a divergência e infere a área do não contado"],
    ["", ""],
    ["EIXOS DA NOTA", ""],
    ["Acuracidade — 35%", "(1 − unidades em erro ÷ peças contadas) × 100"],
    ["Produtividade — 25%", "peças/h ÷ mediana da equipe × 100, limitado a 100"],
    ["Valor — 25%", "100 − (valor ajustado ÷ valor contado × 100)"],
    ["Cobertura — 15%", "100 − fatia do valor perdida em não contados de confiança ALTA"],
    ["", ""],
    ["DECISÕES DE MÉTODO", ""],
    ["Mediana, não média", "Um conferente muito rápido desloca a média e faz o resto parecer lento"],
    ["Mediana da equipe, não meta fixa", "Compara com quem esteve na mesma loja, no mesmo turno"],
    ["Auditoria dirigida fora da produtividade", "Quem executa a auditoria não é penalizado por isso"],
    ["Cobertura proporcional ao valor contado", "Não punir o conferente de área nobre pelo tamanho da área"],
    ["Bloco pela quantidade da bipada", "Quantidade > 1; a flag do .prc reconhecia 0,9% dos casos reais"],
    ["Seção = últimos 4 dígitos", "Os 6 dígitos não cruzam com as tabelas de seção e de limite de bloco"],
    ["Horas por janela diária", "Relógio de coletor fora de data destrói a diferença entre 1ª e última bipada"],
    ["", ""],
    ["LIMITES", ""],
    ["Não atribuível", "Divergência sem bipada correspondente fica órfã — nunca se atribui por proximidade"],
    ["Não contado", "Só pesa na nota com confiança ALTA; MÉDIA e BAIXA dirigem recontagem"],
    ["Sem dado", "Métrica sem fonte aparece como 'sem dado' — nunca estimada"],
    ["", ""],
    ["EMISSÃO", ""],
    ["Gerado por", ctx.emitidoPor || "InventExpert — módulo Avaliação"],
    ["Data", new Date().toLocaleString("pt-BR")],
    ["Inventário", `${ctx.loja}${ctx.capa ? ` · capa ${ctx.capa}` : ""} · ${ctx.dataInventario}`],
  ];
}

/** Larguras que deixam a planilha legível sem ajuste manual. */
function aplicarLarguras(ws: XLSX.WorkSheet, larguras: number[]): void {
  ws["!cols"] = larguras.map((w) => ({ wch: w }));
}

/**
 * Monta o workbook consolidado com as oito abas.
 *
 * `avaliacoes` deve vir já ordenada pelo ranking — a aba Ranking usa a ordem
 * recebida para numerar as posições.
 */
export function montarWorkbookConsolidado(
  avaliacoes: AvaliacaoV3[],
  ctx: ContextoConsolidado,
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  const abas: [string, Linha[], number[]][] = [
    ["Resumo", abaResumo(avaliacoes, ctx), [46, 18, 42]],
    ["Ranking", abaRanking(avaliacoes), [8, 30, 16, 14, 8, 20, 16, 18, 12, 12, 12, 12, 40]],
    ["Por_Conferente", abaPorConferente(avaliacoes), [30, 16, 14, 60, 8, 14, 12, 14, 16, 10, 12, 12, 12, 14, 16, 16, 12, 14, 16, 12, 8, 20]],
    ["Erros_Detalhados", abaErros(avaliacoes), [30, 16, 24, 10, 16, 42, 12, 12, 10, 10, 12, 16, 12, 12, 12, 12]],
    ["Nao_Contados", abaNaoContados(avaliacoes), [30, 16, 24, 12, 20, 42, 16, 12, 46, 24, 10]],
    ["Mapa_Areas", abaMapaAreas(avaliacoes), [26, 30, 16, 10, 16, 16, 20, 18]],
    ["Ressalvas", abaRessalvas(avaliacoes, ctx), [46, 10, 60]],
    ["Metodologia", abaMetodologia(ctx), [40, 70]],
  ];

  for (const [nome, linhas, larguras] of abas) {
    const ws = XLSX.utils.aoa_to_sheet(linhas);
    aplicarLarguras(ws, larguras);
    XLSX.utils.book_append_sheet(wb, ws, nome);
  }

  return wb;
}

/** Nome do arquivo consolidado, no padrão do relatório de referência. */
export function nomeArquivoConsolidado(loja: string, data = new Date()): string {
  const lojaLimpa = (loja || "inventario").replace(/[^\w-]/g, "_").slice(0, 24);
  return `Avaliacao_Consolidada_${lojaLimpa}_${data.toISOString().slice(0, 10)}.xlsx`;
}
