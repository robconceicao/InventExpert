import * as XLSX from "xlsx";

import type { AvaliacaoV3 } from "../../services/AvaliacaoV3Service";
import {
  encaminhamento,
  montarWorkbookConsolidado,
  nomeArquivoConsolidado,
  type ContextoConsolidado,
} from "../avaliacaoConsolidadaXlsx";

const CTX: ContextoConsolidado = {
  loja: "L2601",
  capa: "2915",
  dataInventario: "06/08/2026",
  operacao: "FARMACIA",
  medianaEquipe: 800,
  diagnostico: {
    secoesMapeadas: 1045,
    areasNaoConformes: 4,
    divergencias: 56,
    orfas: 0,
    compartilhadas: 0,
    reconciliacaoOk: true,
    falhasReconciliacao: [],
    naoContados: 30,
    naoContadosAlta: 7,
    dobro: 12,
    enderecosForaPadrao: 165,
    datasDistintas: ["20260806", "20220101"],
  },
};

function avaliacao(over: Partial<AvaliacaoV3> = {}): AvaliacaoV3 {
  return {
    matricula: "48779594832",
    nome: "DIEGO DA SILVA SOUTO",
    modalidade: "CLT",
    areas: [
      {
        area: "MEDICAMENTOS",
        matricula: "48779594832",
        nome: "DIEGO DA SILVA SOUTO",
        secoes: ["0217", "0218"],
        qtdDeclarada: 100,
        qtdApurada: 100,
        conforme: true,
      },
    ],
    secoes: 2,
    pecasContagem: 5795,
    pecasAuditoria: 0,
    horasContagem: 4.1,
    ociosidadeMin: 0,
    ociosidade: [],
    produtividade: 1413.4,
    itensAuditados: 120,
    itensComErro: 6,
    unidadesEmErro: 13,
    acuracidadeUnidades: 99.78,
    acuracidadeItens: 95,
    valorContado: 30000,
    valorAjustado: 300,
    pctErroValor: 1,
    cobertura: 98,
    divergencias: [
      {
        secao: "0217",
        area: "MEDICAMENTOS",
        ean: "007896585628206",
        descricao: "COLIDIS 5ML",
        qtdC1: 16,
        qtdFinal: 2,
        ajuste: -14,
        tipo: "SOBRA",
        modo: "BLOCO",
        custoUnitario: 111.59,
        valor: 1562.26,
        controlado: false,
        matricula: "48779594832",
        hora: new Date("2026-08-07T00:15:36"),
        compartilhada: false,
      },
    ],
    naoContados: [
      {
        descricao: "COLIDIS 10ML",
        eans: ["007896585628213"],
        situacao: "NAO_ENCONTRADO",
        valor: 1562.26,
        nivel: "ALTA",
        area: "RUA 4 FUNDO",
        matricula: "48779594832",
        base: "Troca de código comprovada com COLIDIS 5ML na seção 2312",
        secoesReferencia: ["2312"],
        peso: 1,
      },
    ],
    naoContadosAlta: 1,
    divergenciasControlados: 0,
    indiceProdutividade: 100,
    penalidade: 2,
    nota: 92.5,
    nivel: "EXCELENTE",
    faixa: "Excelente",
    relogioOk: true,
    enderecosForaPadrao: 3,
    itensEmDobro: 2,
    ...over,
  } as AvaliacaoV3;
}

/** Lê uma aba como matriz, do jeito que o Excel mostraria. */
function aba(wb: XLSX.WorkBook, nome: string): any[][] {
  return XLSX.utils.sheet_to_json(wb.Sheets[nome], { header: 1, raw: false, defval: null });
}

const texto = (m: any[][]) => m.map((l) => (l ?? []).join("|")).join("\n");

describe("montarWorkbookConsolidado", () => {
  it("cria as oito abas na ordem do relatório de referência", () => {
    const wb = montarWorkbookConsolidado([avaliacao()], CTX);
    expect(wb.SheetNames).toEqual([
      "Resumo",
      "Ranking",
      "Por_Conferente",
      "Erros_Detalhados",
      "Nao_Contados",
      "Mapa_Areas",
      "Ressalvas",
      "Metodologia",
    ]);
  });

  it("o Resumo identifica o inventário e traz a fórmula da nota", () => {
    const t = texto(aba(montarWorkbookConsolidado([avaliacao()], CTX), "Resumo"));
    expect(t).toContain("INVENTÁRIO L2601");
    expect(t).toContain("Capa 2915");
    expect(t).toContain("0,35×Acuracidade");
    expect(t).toContain("Conferentes avaliados");
  });

  it("o Resumo mostra a reconciliação como FECHOU quando fechou", () => {
    const t = texto(aba(montarWorkbookConsolidado([avaliacao()], CTX), "Resumo"));
    expect(t).toContain("FECHOU");
  });

  it("o Ranking numera as posições na ordem recebida", () => {
    const wb = montarWorkbookConsolidado(
      [avaliacao({ nome: "PRIMEIRA", nota: 95 }), avaliacao({ nome: "SEGUNDA", nota: 70 })],
      CTX,
    );
    const m = aba(wb, "Ranking");
    const primeira = m.find((l) => l?.includes("PRIMEIRA"));
    const segunda = m.find((l) => l?.includes("SEGUNDA"));
    expect(primeira?.[0]).toBe("1");
    expect(segunda?.[0]).toBe("2");
  });

  it("o Ranking traz o encaminhamento da faixa", () => {
    const t = texto(aba(montarWorkbookConsolidado([avaliacao({ nota: 65 })], CTX), "Ranking"));
    expect(t).toContain("Reciclagem antes da próxima escala");
  });

  it("Por_Conferente resume as áreas com o número de seções", () => {
    const t = texto(aba(montarWorkbookConsolidado([avaliacao()], CTX), "Por_Conferente"));
    expect(t).toContain("MEDICAMENTOS (2)");
    expect(t).toContain("DIEGO DA SILVA SOUTO");
  });

  it("Erros_Detalhados desce até o produto, com hora e valor", () => {
    const t = texto(aba(montarWorkbookConsolidado([avaliacao()], CTX), "Erros_Detalhados"));
    expect(t).toContain("COLIDIS 5ML");
    expect(t).toContain("007896585628206");
    expect(t).toContain("1562.26");
    expect(t).toContain("00:15");
  });

  it("Nao_Contados registra confiança e a base da atribuição", () => {
    const t = texto(aba(montarWorkbookConsolidado([avaliacao()], CTX), "Nao_Contados"));
    expect(t).toContain("ALTA");
    expect(t).toContain("Troca de código comprovada");
    expect(t).toContain("RUA 4 FUNDO");
  });

  it("Mapa_Areas mostra a faixa de seções e se a combinação fechou", () => {
    const t = texto(aba(montarWorkbookConsolidado([avaliacao()], CTX), "Mapa_Areas"));
    expect(t).toContain("0217 a 0218");
    expect(t).toContain("SIM");
  });

  it("Ressalvas expõe órfãs, compartilhadas e relógio fora de data", () => {
    const wb = montarWorkbookConsolidado(
      [avaliacao({ relogioOk: false, nome: "COM RELOGIO ERRADO" })],
      { ...CTX, diagnostico: { ...CTX.diagnostico!, orfas: 3, compartilhadas: 2 } },
    );
    const t = texto(aba(wb, "Ressalvas"));
    expect(t).toContain("Divergências órfãs");
    expect(t).toContain("COM RELOGIO ERRADO");
    expect(t).toContain("Datas distintas");
  });

  it("Ressalvas detalha cada conferente quando a reconciliação não fecha", () => {
    const wb = montarWorkbookConsolidado([avaliacao()], {
      ...CTX,
      diagnostico: {
        ...CTX.diagnostico!,
        reconciliacaoOk: false,
        falhasReconciliacao: [{ matricula: "123", esperado: 13, apurado: 9 }],
      },
    });
    const t = texto(aba(wb, "Ressalvas"));
    expect(t).toContain("Reconciliação não fechou");
    expect(t).toContain("esperado 13, apurado 9");
  });

  it("Metodologia declara os pesos dos quatro eixos", () => {
    const t = texto(aba(montarWorkbookConsolidado([avaliacao()], CTX), "Metodologia"));
    expect(t).toContain("Acuracidade — 35%");
    expect(t).toContain("Produtividade — 25%");
    expect(t).toContain("Valor — 25%");
    expect(t).toContain("Cobertura — 15%");
    expect(t).toContain("PO-AVA-001");
  });

  it("aguenta equipe vazia sem quebrar", () => {
    const wb = montarWorkbookConsolidado([], CTX);
    expect(wb.SheetNames).toHaveLength(8);
    expect(texto(aba(wb, "Erros_Detalhados"))).toContain("Nenhuma divergência atribuída");
  });

  it("sobrevive à ida e volta pelo formato xlsx", () => {
    const wb = montarWorkbookConsolidado([avaliacao()], CTX);
    const b64 = XLSX.write(wb, { bookType: "xlsx", type: "base64" });
    const relido = XLSX.read(b64, { type: "base64" });
    expect(relido.SheetNames).toEqual(wb.SheetNames);
    expect(texto(aba(relido, "Ranking"))).toContain("DIEGO DA SILVA SOUTO");
  });
});

describe("encaminhamento", () => {
  it("mapeia a nota para a ação do procedimento", () => {
    expect(encaminhamento(95)).toContain("Manter");
    expect(encaminhamento(85)).toContain("Devolutiva");
    expect(encaminhamento(75)).toContain("Acompanhamento");
    expect(encaminhamento(60)).toContain("Reciclagem");
  });
});

describe("nomeArquivoConsolidado", () => {
  it("usa loja e data no padrão do relatório de referência", () => {
    expect(nomeArquivoConsolidado("L2601", new Date("2026-08-16T12:00:00Z"))).toBe(
      "Avaliacao_Consolidada_L2601_2026-08-16.xlsx",
    );
  });

  it("limpa caracteres que quebram nome de arquivo", () => {
    expect(nomeArquivoConsolidado("DPSP / L2601")).toMatch(/^Avaliacao_Consolidada_DPSP___L2601_/);
  });
});
