/**
 * Valida formatadores ReportA–J com a massa de exemplo do spec de navegação/relatórios.
 */
import type {
  ReportA,
  ReportB,
  ReportC,
  ReportD,
  ReportE,
  ReportF,
  ReportG,
  ReportH,
  ReportI,
  ReportJ,
} from "../../types";
import {
  formatReportA,
  formatReportB,
  formatReportC,
  formatReportD,
  formatReportE,
  formatReportF,
  formatReportG,
  formatReportH,
  formatReportI,
  formatReportJ,
} from "../parsers";

describe("formatReportA — DSP", () => {
  it("emite título DSP e campos principais", () => {
    const r: ReportA = {
      lojaNum: "805",
      lojaNome: "DROGARIA SÃO PAULO VD805",
      qtdColaboradores: "11",
      lider: "LEVI HENRIQUE",
      hrChegada: "20:30",
      inicioContagemEstoque: "21:00",
      terminoContagemEstoque: "23:20",
      inicioContagemLoja: "22:00",
      terminoContagemLoja: "03:15",
      inicioDivergencia: "03:33",
      terminoDivergencia: "01:05",
      terminoInventario: "08:00",
      avanco22h: "50",
      avanco00h: "70",
      avanco01h: "80",
      avanco03h: "95",
      avanco04h: "100",
      avancoExtraHora: "",
      avancoExtraValor: "",
      envioArquivo1: "03:32",
      envioArquivo2: "06:10",
      envioArquivo3: "07:18",
      avalEstoque: "90",
      avalLoja: "95",
      acuracidade: "99",
      percentualAuditoria: "10",
      ph: "1200",
      satisfacao: "4.86",
      contagemAntecipada: false,
    };
    const out = formatReportA(r);
    expect(out).toContain("ACOMPANHAMENTO DE INVENTÁRIO (DSP)");
    expect(out).toContain("Nº Loja:");
    expect(out).toContain("805");
    expect(out).toContain("Avanço 22h00:");
    expect(out).toContain("Produtividade (PH):");
  });
});

describe("formatReportB — Farmaconde", () => {
  it("emite blocos Inventário / Mapeamento / Divergências", () => {
    const r: ReportB = {
      cliente: "FARMACONDE",
      filial: "467",
      lider: "Gabriel Henrique",
      qtdEquipe: "9",
      qtdFaltas: "0",
      inicioContagemGeral: "22:00",
      fimContagemGeral: "01:45",
      pctInventario: "100",
      naoContadosInicio: "01:45",
      naoContadosTotal: "209",
      naoContadosFim: "03:38",
      div1Inicio: "01:50",
      div1Controlados: "10",
      div1Negativos: "50",
      div1Positivos: "89",
      div1Total: "139",
      div1Fim: "03:38",
      div2Inicio: "",
      div2Negativos: "",
      div2Positivos: "",
      div2Total: "",
      div2Fim: "",
    };
    const out = formatReportB(r);
    expect(out).toContain("FARMACONDE");
    expect(out).toContain("*Inventário*");
    expect(out).toContain("*Mapeamento*");
    expect(out).toContain("*Não Contados*");
    expect(out).toContain("*1º Divergência*");
    expect(out).toContain("467");
  });
});

describe("formatReportC — Farmácias Em Geral", () => {
  it("preenche exemplo DSP VD805", () => {
    const r: ReportC = {
      lojaNum: "805",
      lojaNome: "DROGARIA SÃO PAULO VD805",
      data: "07/05/2026",
      pivProgramado: "11",
      pivRealizado: "11",
      chegadaEquipe: "20:30",
      inicioDeposito: "21:00",
      terminoDeposito: "23:20",
      inicioLoja: "22:00",
      terminoLoja: "03:15",
      inicioAuditoriaCliente: "22:00",
      terminoAuditoriaCliente: "23:00",
      inicioControlados: "",
      terminoControlados: "",
      inicioDivergencia: "03:33",
      terminoDivergencia: "01:05",
      qtdAlterados: "110",
      inicioNaoContados: "03:33",
      terminoNaoContados: "05:00",
      qtdNaoContados: "34",
      qtdEncontradosNaoContados: "15",
      inicioRecontCliente: "",
      terminoRecontCliente: "",
      qtdItensRecontCliente: "",
      qtdAltRecontCliente: "",
      envioArquivo1: "03:32",
      envioArquivo2: "06:10",
      envioArquivo3: "07:18",
      totalPecas: "46100",
      valorTotal: "1244103.45",
      avalPrepDeposito: "90",
      avalPrepLoja: "95",
      satisfacao: "4.86",
      responsavel: "LEVI HENRIQUE",
      acuracidadeCliente: "99",
      acuracidadeTerceirizada: "99",
      suporteSolicitado: null,
      phCalculado: "",
      terminoInventario: "08:00",
    };
    const out = formatReportC(r);
    expect(out).toContain("Farmácias Em Geral");
    expect(out).toContain("07/05/2026");
    expect(out).toContain("LEVI HENRIQUE");
    expect(out).toContain("Houve Suporte?:");
  });
});

describe("formatReportD — Mercados", () => {
  it("preenche exemplo Minuto Pão de Açúcar", () => {
    const r: ReportD = {
      lojaNome: "Minuto Pão de Açúcar Alexandre Mingues",
      lojaNum: "1518",
      data: "05/05/2026",
      pivProgramado: "9",
      pivRealizado: "9",
      chegadaEquipe: "19:00",
      inicioDeposito: "20:00",
      terminoDeposito: "20:30",
      inicioLoja: "22:00",
      terminoLoja: "02:20",
      inicioAuditoriaCliente: "22:00",
      terminoAuditoriaCliente: "23:00",
      inicioDivergencia: "02:30",
      terminoDivergencia: "04:00",
      qtdAlterados: "28",
      inicioNaoContados: "02:30",
      qtdNaoContados: "137",
      qtdEncontradosNaoContados: "11",
      terminoNaoContados: "03:50",
      totalPecas: "58421.707",
      valorTotal: "373877.47",
      avalPrepDeposito: "96",
      avalPrepLoja: "96",
      satisfacao: "4.5",
      responsavel: "Maciete Larissa",
      acuracidadeCliente: "99.98",
      acuracidadeTerceirizada: "99.99",
      suporteSolicitado: null,
      terminoInventario: "04:50",
    };
    const out = formatReportD(r);
    expect(out).toContain("Mercados");
    expect(out).toContain("1518");
    expect(out).toContain("Maciete Larissa");
  });
});

describe("formatReportE — Outros", () => {
  it("preenche exemplo TelhaNorte", () => {
    const r: ReportE = {
      lojaNum: "058",
      lojaNome: "TelhaNorte 058",
      data: "12/05/2026",
      responsavel: "Lucas Hatiro",
      qtdPessoas: "33",
      chegadaEquipe: "19:00",
      inicioDeposito: "21:00",
      terminoDeposito: "22:00",
      inicioLoja: "22:00",
      terminoLoja: "03:20",
      inicioAuditoriaCliente: "02:40",
      terminoAuditoriaCliente: "08:00",
      inicioDivergencia: "",
      terminoDivergencia: "",
      totalPecas: "277079.562",
      valorTotal: "",
      pctInv: "100",
      avalEstoque: "94",
      avalLoja: "94",
      terminoInventario: "08:30",
    };
    const out = formatReportE(r);
    expect(out).toContain("Outros Estabelecimentos");
    expect(out).toContain("TelhaNorte 058");
    expect(out).toContain("Lucas Hatiro");
    expect(out).toContain("% Inv.:");
  });
});

describe("formatReportF — Assaí", () => {
  it("emite labels oficiais Assaí", () => {
    const r: ReportF = {
      lojaNome: "Assaí Exemplo",
      lojaNum: "100",
      lider: "João",
      qtdPessoas: "40",
      chegadaEquipe: "20:00",
      inicioContagemEstoque: "21:00",
      terminoContagemEstoque: "23:00",
      inicioContagemLoja: "23:00",
      terminoContagemLoja: "04:00",
      inicioAuditoria: "01:00",
      terminoAuditoria: "02:00",
      inicioDivergencia: "04:00",
      terminoDivergencia: "06:00",
      qtdPecas: "100000",
      valorTotal: "500000",
      pctInventario: "100",
      avalEstoque: "90",
      avalLoja: "92",
      terminoInventario: "07:00",
    };
    const out = formatReportF(r);
    expect(out).toContain("Assaí");
    expect(out).toContain("Nome da Loja:");
    expect(out).toContain("Quantidade de Peças:");
    expect(out).toContain("Término do Inventário:");
  });
});

describe("formatReportG — Resumo Final", () => {
  it("emite título consolidado e campos de resumo", () => {
    const r: ReportG = {
      lojaNum: "479",
      lojaNome: "VD479",
      data: "06/05/2026",
      pivProgramado: "14",
      pivRealizado: "13",
      chegadaEquipe: "21:00",
      inicioDeposito: "22:00",
      terminoDeposito: "23:45",
      inicioLoja: "22:00",
      terminoLoja: "04:26",
      inicioControlados: "",
      inicioDivergencia: "04:34",
      terminoDivergencia: "06:14",
      qtdAlterados: "99",
      qtdNaoContados: "59",
      qtdEncontradosNaoContados: "8",
      envioArquivo1: "04:33",
      envioArquivo2: "07:36",
      envioArquivo3: "",
      totalPecas: "51710",
      valorTotal: "1296549.85",
      avalPrepDeposito: "90",
      avalPrepLoja: "92",
      satisfacao: "4.39",
      responsavel: "Maciete Larissa",
      acuracidadeCliente: "99",
      acuracidadeTerceirizada: "99.88",
      suporteSolicitado: null,
      phCalculado: "",
      terminoInventario: "08:30",
    };
    const out = formatReportG(r);
    expect(out).toContain("RESUMO FINAL DO INVENTÁRIO");
    expect(out).toContain("Ini. Div. Controlados:");
    expect(out).toContain("Acurac. Cliente:");
    expect(out).toContain("PH Calculado:");
    expect(out).toContain("VD479");
  });
});

describe("formatReportH — Resumo Farmaconde", () => {
  it("emite título e rótulos oficiais Farmaconde", () => {
    const r: ReportH = {
      lojaNome: "FARMACONDE 467",
      lojaNum: "467",
      data: "24/07/2026",
      pivProgramado: "10",
      pivRealizado: "9",
      chegadaEquipe: "21:00",
      inicioDeposito: "22:00",
      terminoDeposito: "23:30",
      inicioLoja: "22:00",
      terminoLoja: "03:00",
      inicioAuditoriaCliente: "03:10",
      terminoAuditoriaCliente: "04:00",
      inicioDivergencia: "04:10",
      terminoDivergencia: "05:00",
      inicioNaoContados: "05:00",
      terminoNaoContados: "05:40",
      qtdItensAlterados: "12",
      qtdItensNaoContados: "30",
      qtdItensEncontradosNaoContados: "4",
      envioArquivo: "06:00",
      terminoInventario: "07:00",
      totalPecas: "40000",
      valorTotal: "900000",
      avalPrepDeposito: "90",
      avalPrepLoja: "92",
      responsavelInventario: "Gabriel",
      satisfacao: "4.5",
      acuracidadeCliente: "99",
      acuracidadeTerceirizada: "99.5",
      suporteSolicitado: false,
    };
    const out = formatReportH(r);
    expect(out).toContain("RESUMO DO INVENTÁRIO — FARMACONDE");
    expect(out).toContain("Cheg. Equipe:");
    expect(out).toContain("Ini. Cont. Dep.:");
    expect(out).toContain("Fim Cont. Dep.:");
    expect(out).toContain("Solic. Suporte?:");
    expect(out).toContain("FARMACONDE 467");
  });
});

describe("formatReportI — Resumo Mercados", () => {
  it("emite título e envio do primeiro arquivo", () => {
    const r: ReportI = {
      lojaNome: "Mercado Centro",
      lojaNum: "12",
      data: "24/07/2026",
      pivProgramado: "8",
      pivRealizado: "8",
      chegadaEquipe: "20:00",
      inicioDeposito: "21:00",
      terminoDeposito: "23:00",
      inicioLoja: "21:00",
      terminoLoja: "04:00",
      inicioAuditoriaCliente: "04:10",
      terminoAuditoriaCliente: "05:00",
      inicioDivergencia: "05:10",
      terminoDivergencia: "06:00",
      inicioNaoContados: "06:00",
      terminoNaoContados: "06:30",
      qtdItensAlterados: "5",
      qtdItensNaoContados: "10",
      qtdItensEncontradosNaoContados: "2",
      envioPrimeiroArquivo: "04:05",
      terminoInventario: "07:30",
      totalPecas: "80000",
      valorTotal: "1500000",
    };
    const out = formatReportI(r);
    expect(out).toContain("RESUMO DO INVENTÁRIO — MERCADOS");
    expect(out).toContain("Envio 1º Arq.:");
    expect(out).toContain("Mercado Centro");
    expect(out).toContain("Ini. Não Contados:");
  });
});

describe("formatReportJ — Resumo Demais Estabelecimentos", () => {
  it("emite título e campos simplificados", () => {
    const r: ReportJ = {
      lojaNome: "Telha Norte 058",
      lojaNum: "058",
      lider: "Lucas",
      qtdColaboradores: "12",
      qtdPecas: "277079",
      pctInventario: "100",
      chegada: "20:30",
      inicioControlados: "21:00",
      terminoControlados: "22:00",
      inicioLoja: "22:00",
      terminoLoja: "05:00",
      inicioAuditoria: "05:10",
      terminoAuditoria: "06:00",
      avalEstoque: "94",
      avalLoja: "94",
      terminoInventario: "07:00",
    };
    const out = formatReportJ(r);
    expect(out).toContain("RESUMO DO INVENTÁRIO — DEMAIS ESTABELECIMENTOS");
    expect(out).toContain("Cheg. Equipe:");
    expect(out).toContain("Ini. Controlados:");
    expect(out).toContain("Telha Norte 058");
    expect(out).toContain("Qtd. Colaboradores:");
  });
});
