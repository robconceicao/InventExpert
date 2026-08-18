/**
 * Trava a revisão de limites de bloco de 2026-08 (docs/LIMITES_BLOCO_FARMACIA.md).
 *
 * Dois riscos que estes testes cobrem:
 *
 * 1. **Área crítica sem cadastro.** Ausência de linha na tabela significa "não
 *    penalizar". PSICO, THERMOLABS e VACINAS existem no campo, são de
 *    tolerância zero e não tinham cadastro nenhum — o bloco delas nunca foi
 *    verificado. O mesmo valia para as variantes de nome das paredes.
 *
 * 2. **Casamento literal.** O lookup do fallback comparava `toUpperCase()`
 *    direto, então ANTIBIOTICOS não achava ANTIBIÓTICOS e RUA 3 FRENTE não
 *    achava G 3. Área que não casa não é penalizada, e nesse grupo estavam
 *    justamente as de limite 0%.
 */
import {
  LIMITES_BLOCO_FARMACIA,
  LIMITE_BLOCO_SEM_LIMITE,
  getLimitesBlocoFallback,
  getViolacoesBloco,
  gravidadeDaViolacao,
  ehToleranciaZero,
  lookupLimiteBlocoArea,
  penalidadeDaViolacao,
} from "../inventoryEvalConfig";
import { buildViolacaoBloco } from "../../types";
import { areasSemLimiteCadastrado } from "../../utils/inventExpUtils";

/** As 25 áreas do inventário DPSP L2601, como saem do PROD_SEÇÃO. */
const AREAS_L2601 = [
  "ANTIBIOTICOS",
  "ATRAS DO CAIXA",
  "BALCAO",
  "ESTOQUE FRENTE",
  "ESTOQUE FUNDOS",
  "FRENTE DE CAIXA",
  "ILHAS FRENTE DE LOJA",
  "ILHAS FUNDO",
  "MEDICAMENTOS",
  "NÃO CONTADOS",
  "PAREDE CARTELADO",
  "PAREDE DERMO",
  "PAREDE INFANTIL",
  "PSICO",
  "RUA 1",
  "RUA 2",
  "RUA 3 FRENTE",
  "RUA 3 FUNDO",
  "RUA 4 FRENTE",
  "RUA 4 FUNDO",
  "RUA 5 FRENTE",
  "RUA 5 FUNDO",
  "TESTE",
  "THERMOLABS",
  "VACINAS",
];

describe("cobertura das áreas reais", () => {
  const limites = getLimitesBlocoFallback("FARMACIA");

  it("só TESTE fica sem limite cadastrado", () => {
    // TESTE é área de teste do coletor: fora do cálculo, mas visível na aba
    // Ressalvas do consolidado — 105 peças não podem sumir em silêncio.
    expect(areasSemLimiteCadastrado(AREAS_L2601, limites)).toEqual(["TESTE"]);
  });

  it("as gôndolas casam nas três nomenclaturas da rede", () => {
    ["RUA 3 FRENTE", "R3", "G 03 FUNDO", "RUA 3 FUNDO"].forEach((nome) => {
      expect(lookupLimiteBlocoArea(nome)?.limite).toBe(15);
    });
  });

  it("ANTIBIOTICOS sem acento continua sendo área de tolerância zero", () => {
    expect(lookupLimiteBlocoArea("ANTIBIOTICOS")).toEqual({ limite: 0, critica: true });
  });
});

describe("tolerância zero", () => {
  it.each(["MEDICAMENTOS", "ANTIBIÓTICOS", "PSICO", "THERMOLABS", "VACINAS"])(
    "%s = 0%% e área crítica",
    (area) => {
      expect(lookupLimiteBlocoArea(area)).toEqual({ limite: 0, critica: true });
    },
  );

  it("qualquer bloco nessas áreas vira violação", () => {
    const violacoes = getViolacoesBloco(
      [{ area: "PSICO", pctBloco: 0.1 }],
      "FARMACIA",
      getLimitesBlocoFallback("FARMACIA"),
    );
    expect(violacoes).toHaveLength(1);
    expect(violacoes[0].area_critica).toBe(true);
  });
});

describe("limites revistos em 2026-08", () => {
  it("dermo e infantil sobem para 10% sem perder o alerta formal", () => {
    // O alerta dispara por "crítica OU limite <= 5%". Subir o limite sem
    // manter o flag apagaria a visibilidade junto.
    ["P DERMO", "PAREDE DERMO", "P INFANTIL", "PAREDE INFANTIL"].forEach((area) => {
      expect(lookupLimiteBlocoArea(area)).toEqual({ limite: 10, critica: true });
    });
  });

  it("balcão e atrás do caixa passam a ter limite — antes um deles não tinha", () => {
    ["BALCÃO DE ATENDIMENTO", "BALCAO", "ATRÁS DE CAIXA", "ATRAS DO CAIXA"].forEach(
      (area) => expect(lookupLimiteBlocoArea(area)?.limite).toBe(20),
    );
  });

  it("os três nomes do cartelado carregam o mesmo limite", () => {
    // Deixar MEDICAMENTOS CARTELADOS em 30% faria o limite da mesma parede
    // depender de qual nome a loja cadastrou.
    ["CARTELADO", "PAREDE CARTELADO", "MEDICAMENTOS CARTELADOS"].forEach((area) =>
      expect(lookupLimiteBlocoArea(area)?.limite).toBe(70),
    );
  });

  it("ilhas sobem para 50%", () => {
    ["ILHAS", "ILHAS FRENTE DE LOJA", "ILHAS FUNDO"].forEach((area) =>
      expect(lookupLimiteBlocoArea(area)?.limite).toBe(50),
    );
  });

  it("nenhuma área ficou como 'sem limite'", () => {
    const semLimite = Object.entries(LIMITES_BLOCO_FARMACIA)
      .filter(([, r]) => r.limite >= LIMITE_BLOCO_SEM_LIMITE)
      .map(([nome]) => nome);
    expect(semLimite).toEqual([]);
  });
});

describe("o que não mudou", () => {
  it("operação que não é farmácia não penaliza bloco em área nenhuma", () => {
    expect(getViolacoesBloco([{ area: "MEDICAMENTOS", pctBloco: 100 }], "SUPERMERCADO")).toEqual(
      [],
    );
    expect(lookupLimiteBlocoArea("MEDICAMENTOS", "SUPERMERCADO")).toBeNull();
  });

  it("área desconhecida não vira violação nem default de 20%", () => {
    expect(lookupLimiteBlocoArea("SETOR INEXISTENTE")).toBeNull();
    expect(
      getViolacoesBloco([{ area: "SETOR INEXISTENTE", pctBloco: 100 }], "FARMACIA"),
    ).toEqual([]);
  });

  it("NÃO CONTADOS é bucket de auditoria e não penaliza", () => {
    expect(
      getViolacoesBloco(
        [{ area: "NÃO CONTADOS", pctBloco: 100 }],
        "FARMACIA",
        getLimitesBlocoFallback("FARMACIA"),
      ),
    ).toEqual([]);
  });
});

describe("escalonamento da penalidade de bloco", () => {
  const v = (limite: number, real: number, critica: boolean) =>
    buildViolacaoBloco({
      area_nome: "X",
      real_pct: real,
      limite_pct: limite,
      area_critica: critica,
    });

  it("tolerância zero pesa conforme o tamanho do bloco, não mais 20 fixos", () => {
    // O que muda em relação ao modelo antigo: contar 0,5% de MEDICAMENTOS em
    // bloco é engano; contar 40% é método. A nota precisa distinguir os dois.
    expect(penalidadeDaViolacao(v(0, 0.5, true))).toBe(20);
    expect(penalidadeDaViolacao(v(0, 12, true))).toBe(30);
    expect(penalidadeDaViolacao(v(0, 40, true))).toBe(40);
  });

  it("as faixas abrem no limite exato, não fecham", () => {
    expect(gravidadeDaViolacao(v(0, 5, true))).toBe("TOLERANCIA_ZERO");
    expect(gravidadeDaViolacao(v(0, 5.1, true))).toBe("TOLERANCIA_ZERO_ALTA");
    expect(gravidadeDaViolacao(v(0, 20, true))).toBe("TOLERANCIA_ZERO_ALTA");
    expect(gravidadeDaViolacao(v(0, 20.1, true))).toBe("TOLERANCIA_ZERO_GRAVE");
  });

  it("área crítica com limite > 0 pesa mais que área comum", () => {
    // Dermo e infantil: os SKUs mais parecidos entre si e de maior valor.
    expect(penalidadeDaViolacao(v(10, 25, true))).toBe(15);
    expect(penalidadeDaViolacao(v(10, 25, false))).toBe(10); // excesso > 2×
    expect(penalidadeDaViolacao(v(10, 15, false))).toBe(5);
  });

  it("só tolerância zero exige advertência sanitária", () => {
    expect(ehToleranciaZero(gravidadeDaViolacao(v(0, 1, true)))).toBe(true);
    expect(ehToleranciaZero(gravidadeDaViolacao(v(10, 90, true)))).toBe(false);
    expect(ehToleranciaZero(gravidadeDaViolacao(v(70, 95, false)))).toBe(false);
  });

  it("limite 0 sem flag de crítica não vira tolerância zero", () => {
    // A classificação depende das duas coisas; um cadastro com limite 0 e
    // critica=false é erro de dados, e tratá-lo como sanitário mascararia isso.
    expect(gravidadeDaViolacao(v(0, 30, false))).toBe("EXCESSO_ALTO");
  });
});
