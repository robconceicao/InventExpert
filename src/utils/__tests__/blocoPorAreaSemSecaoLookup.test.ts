/**
 * Regressão: bloco por área quando `secao_lookup` está vazia.
 *
 * A tabela `secao_lookup` é opcional e no projeto real está zerada. Sem ela, o
 * motor v2.1 não conseguia casar bipada com área: `resolverAreasNasContagens()`
 * caía no código da seção como nome da área, `enriquecerSecoesComBloco()` não
 * encontrava nenhuma contagem da área e o `bloco_pct` ficava com o valor que
 * veio da planilha. Numa planilha sem coluna de bloco isso zera o percentual e
 * a violação passa despercebida — contra a regra de que Qualidade nunca pode
 * ser 100 havendo violação de bloco.
 *
 * A tela passou a sobrepor ao lookup o mapa Seção → Área que o v3 reconstrói do
 * PROD_SEÇÃO + `.prc`. Estes testes cobrem essa composição.
 */
import { construirMapaAreas, type ProdSecaoRow } from "../../services/AreaMappingService";
import type { ContagemDetalhada, SectionAccuracyRecord } from "../../types";
import type { LimiteBlocoRow } from "../../config/inventoryEvalConfig";
import {
  areasSemLimiteCadastrado,
  canonizarGondola,
  mesmaArea,
  normalizarNomeArea,
} from "../inventExpUtils";
import {
  enriquecerSecoesComBloco,
  resolverAreasNasContagens,
} from "../inventoryImportParsers";

const CONFERENTE = "29291408875";

function bip(secao: string, quantidade: number, is_bloco: boolean): ContagemDetalhada {
  return {
    matricula: CONFERENTE,
    area_codigo: secao,
    area_nome: "",
    produto_codigo: `78960000${secao}`,
    produto_nome: "",
    produto_ean: `078960000${secao}`,
    produto_classe: "",
    quantidade,
    is_bloco,
    data_hora: new Date("2026-08-07T00:15:36"),
    endereco: `0000000PI00${secao}`,
    endereco_fora_padrao: false,
    flag_origem: is_bloco ? "X" : "P",
  };
}

/**
 * MEDICAMENTOS (limite 0%) com 80 de 100 peças bipadas em bloco, e
 * PERFUMARIA (limite 90%) sem bloco nenhum.
 */
function cenario() {
  const contagens: ContagemDetalhada[] = [
    bip("0217", 20, false),
    bip("0218", 80, true),
    bip("0431", 50, false),
    bip("0432", 50, false),
  ];

  const prodSecao: ProdSecaoRow[] = [
    { area: "MEDICAMENTOS", matricula: CONFERENTE, nome: "FULANO", secoes: 2, qtdC1: 100 },
    { area: "PERFUMARIA", matricula: CONFERENTE, nome: "FULANO", secoes: 2, qtdC1: 100 },
  ];

  // Como sai do PROD_SEÇÃO quando a planilha não traz coluna de bloco.
  const secoes: SectionAccuracyRecord[] = [
    { area_nome: "MEDICAMENTOS", qtde: 100, erro: 0 } as SectionAccuracyRecord,
    { area_nome: "PERFUMARIA", qtde: 100, erro: 0 } as SectionAccuracyRecord,
  ];

  const limites: LimiteBlocoRow[] = [
    { nome_area: "MEDICAMENTOS", limite_pct: 0, area_critica: true } as LimiteBlocoRow,
    { nome_area: "PERFUMARIA", limite_pct: 90, area_critica: false } as LimiteBlocoRow,
  ];

  return { contagens, prodSecao, secoes, limites };
}

/** Reproduz a montagem do `secaoMap` feita na tela. */
function montarSecaoMap(
  prodSecao: ProdSecaoRow[],
  contagens: ContagemDetalhada[],
  lookup: Array<{ codigo_secao: string; nome_area: string }> = [],
): Map<string, string> {
  const secaoMap = new Map<string, string>();
  for (const s of lookup) {
    secaoMap.set(s.codigo_secao, s.nome_area);
    const semZeros = s.codigo_secao.replace(/^0+/, "");
    if (semZeros) secaoMap.set(semZeros, s.nome_area);
  }
  const mapa = construirMapaAreas(prodSecao, contagens);
  for (const [secao, area] of mapa.secaoParaArea) {
    secaoMap.set(secao, area);
    const semZeros = secao.replace(/^0+/, "");
    if (semZeros) secaoMap.set(semZeros, area);
    secaoMap.set(secao.padStart(6, "0"), area);
  }
  return secaoMap;
}

describe("bloco por área sem secao_lookup", () => {
  it("sem lookup e sem mapa, o bloco% cai no valor da planilha (o bug)", () => {
    const { contagens, secoes, limites } = cenario();

    const resolvidas = resolverAreasNasContagens(contagens, new Map());
    const enriquecidas = enriquecerSecoesComBloco(secoes, resolvidas, limites);

    const medicamentos = enriquecidas.find((s) => s.area_nome === "MEDICAMENTOS")!;
    expect(medicamentos.bloco_pct).toBe(0); // 80% de bloco real, invisível
    expect(medicamentos.violacao_bloco).toBe(false);
  });

  it("com o mapa do PROD_SEÇÃO, o bloco% sai das bipadas e a violação aparece", () => {
    const { contagens, prodSecao, secoes, limites } = cenario();

    const secaoMap = montarSecaoMap(prodSecao, contagens);
    const resolvidas = resolverAreasNasContagens(contagens, secaoMap);
    const enriquecidas = enriquecerSecoesComBloco(secoes, resolvidas, limites);

    const medicamentos = enriquecidas.find((s) => s.area_nome === "MEDICAMENTOS")!;
    expect(medicamentos.bloco_pct).toBeCloseTo(80);
    expect(medicamentos.violacao_bloco).toBe(true);
    expect(medicamentos.area_critica).toBe(true);
  });

  it("área dentro do limite não vira violação", () => {
    const { contagens, prodSecao, secoes, limites } = cenario();

    const secaoMap = montarSecaoMap(prodSecao, contagens);
    const resolvidas = resolverAreasNasContagens(contagens, secaoMap);
    const enriquecidas = enriquecerSecoesComBloco(secoes, resolvidas, limites);

    const perfumaria = enriquecidas.find((s) => s.area_nome === "PERFUMARIA")!;
    expect(perfumaria.bloco_pct).toBe(0);
    expect(perfumaria.violacao_bloco).toBe(false);
  });

  it("o lookup do banco continua valendo para seções fora do PROD_SEÇÃO", () => {
    const { contagens, prodSecao } = cenario();
    const extra = bip("0900", 5, false);

    const secaoMap = montarSecaoMap(prodSecao, contagens, [
      { codigo_secao: "000900", nome_area: "DEPOSITO" },
    ]);
    const resolvidas = resolverAreasNasContagens([...contagens, extra], secaoMap);

    expect(resolvidas.find((c) => c.area_codigo === "0900")!.area_nome).toBe("DEPOSITO");
    expect(resolvidas.find((c) => c.area_codigo === "0217")!.area_nome).toBe("MEDICAMENTOS");
  });

  it("o mapa do evento vence o lookup global quando os dois cobrem a seção", () => {
    const { contagens, prodSecao } = cenario();

    const secaoMap = montarSecaoMap(prodSecao, contagens, [
      { codigo_secao: "0217", nome_area: "AREA ANTIGA" },
    ]);
    const resolvidas = resolverAreasNasContagens(contagens, secaoMap);

    expect(resolvidas.find((c) => c.area_codigo === "0217")!.area_nome).toBe("MEDICAMENTOS");
  });
});

describe("áreas sem limite de bloco cadastrado", () => {
  const limites = [
    { nome_area: "ANTIBIÓTICOS" },
    { nome_area: "MEDICAMENTOS" },
    { nome_area: "ATRÁS DE CAIXA" },
  ];

  it("casa apesar da diferença de acento — era o que escondia área crítica", () => {
    expect(areasSemLimiteCadastrado(["ANTIBIOTICOS"], limites)).toEqual([]);
    expect(areasSemLimiteCadastrado(["ATRAS DE CAIXA"], limites)).toEqual([]);
  });

  it("lista o que realmente não tem cadastro", () => {
    const faltando = areasSemLimiteCadastrado(
      ["ANTIBIOTICOS", "PSICO", "RUA 1", "MEDICAMENTOS"],
      limites,
    );
    expect(faltando).toEqual(["PSICO", "RUA 1"]);
  });

  it("não repete a mesma área escrita de formas diferentes", () => {
    expect(areasSemLimiteCadastrado(["PSICO", "psico", "Psico "], limites)).toEqual(["PSICO"]);
  });

  it("mesmaArea ignora acento e espaço duplicado", () => {
    expect(mesmaArea("ANTIBIOTICOS", "ANTIBIÓTICOS")).toBe(true);
    expect(mesmaArea("ATRAS  DE CAIXA", "ATRÁS DE CAIXA")).toBe(true);
    expect(mesmaArea("PSICO", "PSICOTRÓPICOS")).toBe(false);
    expect(mesmaArea("", "MEDICAMENTOS")).toBe(false);
  });
});

describe("nomenclatura de gôndola", () => {
  it("os três padrões da rede caem na mesma gôndola", () => {
    ["RUA 3 FRENTE", "R 3 FRENTE", "R3", "G3", "G 03 FUNDO"].forEach((n) =>
      expect(canonizarGondola(n)).toBe("GONDOLA 3"),
    );
  });

  it("os dois lados herdam o limite da gôndola cadastrada", () => {
    expect(mesmaArea("RUA 4 FRENTE", "G 4")).toBe(true);
    expect(mesmaArea("RUA 4 FUNDO", "G 4")).toBe(true);
    expect(mesmaArea("RUA 4 FUNDO", "G 5")).toBe(false);
  });

  it("o nome de exibição não muda — o conferente conhece a área assim", () => {
    expect(normalizarNomeArea("RUA 4 FUNDO")).toBe("RUA 4 FUNDO");
  });

  it("não captura área que apenas começa com R ou G", () => {
    expect(canonizarGondola("REFRIGERADOS")).toBeNull();
    expect(canonizarGondola("GELADEIRAS MEDICAMENTOS")).toBeNull();
    expect(canonizarGondola("PAREDE DERMO")).toBeNull();
  });

  it("gôndola sem cadastro continua aparecendo como lacuna", () => {
    expect(areasSemLimiteCadastrado(["RUA 7"], [{ nome_area: "G 4" }])).toEqual(["RUA 7"]);
    expect(areasSemLimiteCadastrado(["RUA 4 FUNDO"], [{ nome_area: "G 4" }])).toEqual([]);
  });
});
