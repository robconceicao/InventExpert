import type { ReportA, ReportC, ReportG } from "../../types";
import {
  mapReportAToG,
  mapReportCToG,
  mapReportEToG,
  mergeReportGPatch,
} from "../mirrorToReportG";

describe("mergeReportGPatch", () => {
  it("não sobrescreve com string vazia da origem", () => {
    const base: Partial<ReportG> = {
      lojaNome: "Loja Base",
      lojaNum: "100",
      chegadaEquipe: "20:00",
    };
    const patch: Partial<ReportG> = {
      lojaNome: "Loja Nova",
      lojaNum: "",
      chegadaEquipe: "21:00",
    };
    const merged = mergeReportGPatch(base, patch);
    expect(merged.lojaNome).toBe("Loja Nova");
    expect(merged.lojaNum).toBe("100"); // preservado
    expect(merged.chegadaEquipe).toBe("21:00");
  });
});

describe("mapReportAToG", () => {
  it("mapeia campos DSP → Resumo", () => {
    const a: ReportA = {
      lojaNum: "805",
      lojaNome: "DSP VD805",
      qtdColaboradores: "11",
      lider: "Levi",
      hrChegada: "20:30",
      inicioContagemEstoque: "21:00",
      terminoContagemEstoque: "23:20",
      inicioContagemLoja: "22:00",
      terminoContagemLoja: "03:15",
      inicioDivergencia: "03:33",
      terminoDivergencia: "05:00",
      terminoInventario: "08:00",
      avanco22h: "",
      avanco00h: "",
      avanco01h: "",
      avanco03h: "",
      avanco04h: "",
      avancoExtraHora: "",
      avancoExtraValor: "",
      envioArquivo1: "03:32",
      envioArquivo2: "06:10",
      envioArquivo3: "",
      avalEstoque: "90",
      avalLoja: "95",
      acuracidade: "99",
      percentualAuditoria: "",
      ph: "1200",
      satisfacao: "4.86",
      contagemAntecipada: null,
    };
    const g = mapReportAToG(a);
    expect(g.lojaNum).toBe("805");
    expect(g.chegadaEquipe).toBe("20:30");
    expect(g.inicioDeposito).toBe("21:00");
    expect(g.responsavel).toBe("Levi");
    expect(g.avalPrepDeposito).toBe("90");
    expect(g.phCalculado).toBe("1200");
  });
});

describe("mapReportCToG", () => {
  it("espelha farmácias em geral de forma quase 1:1", () => {
    const c: ReportC = {
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
      inicioAuditoriaCliente: "",
      terminoAuditoriaCliente: "",
      inicioControlados: "04:30",
      terminoControlados: "",
      inicioDivergencia: "04:34",
      terminoDivergencia: "06:14",
      qtdAlterados: "99",
      inicioNaoContados: "",
      terminoNaoContados: "",
      qtdNaoContados: "59",
      qtdEncontradosNaoContados: "8",
      inicioRecontCliente: "",
      terminoRecontCliente: "",
      qtdItensRecontCliente: "",
      qtdAltRecontCliente: "",
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
    const g = mapReportCToG(c);
    expect(g.lojaNome).toBe("VD479");
    expect(g.qtdNaoContados).toBe("59");
    expect(g.inicioControlados).toBe("04:30");
    expect(g.responsavel).toBe("Maciete Larissa");
  });
});

describe("mapReportEToG", () => {
  it("mapeia outros estabelecimentos", () => {
    const g = mapReportEToG({
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
      totalPecas: "277079",
      valorTotal: "",
      pctInv: "100",
      avalEstoque: "94",
      avalLoja: "94",
      terminoInventario: "08:30",
    });
    expect(g.lojaNome).toBe("TelhaNorte 058");
    expect(g.pivRealizado).toBe("33");
    expect(g.avalPrepDeposito).toBe("94");
  });
});
