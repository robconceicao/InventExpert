import {
  buildGeracaoPdf,
  contarOutrasVersoesNaCadeia,
  folhasArquivadasParaRevisao,
  formatarBytes,
  idsDaCadeia,
  nextVersaoNaCadeia,
  ordenarGeracoesRecentes,
  removerGeracoes,
  resolveRootId,
  rotuloCorrecao,
  rotuloVersao,
  somarTamanhoBytes,
  type FolhaArquivada,
  type GeracaoPdf,
} from "../scannerGeracao";

function makeGeracao(
  overrides: Partial<GeracaoPdf> & Pick<GeracaoPdf, "geracaoId">,
): GeracaoPdf {
  return {
    geracaoOriginalId: null,
    versao: 1,
    nomePdf: "relatorio",
    criadoEm: "2026-07-20T10:00:00.000Z",
    pdfUri: "file:///pdf.pdf",
    folhas: [],
    qtdFolhas: 0,
    ...overrides,
  };
}

describe("scannerGeracao", () => {
  it("resolveRootId retorna o próprio id na original e a raiz nas correções", () => {
    const original = makeGeracao({ geracaoId: "root-1" });
    const correcao = makeGeracao({
      geracaoId: "fix-2",
      geracaoOriginalId: "root-1",
      versao: 2,
    });
    expect(resolveRootId(original)).toBe("root-1");
    expect(resolveRootId(correcao)).toBe("root-1");
  });

  it("nextVersaoNaCadeia isola cadeias por geracaoId (sem vazamento)", () => {
    const lista = [
      makeGeracao({ geracaoId: "a1", versao: 1 }),
      makeGeracao({
        geracaoId: "a2",
        geracaoOriginalId: "a1",
        versao: 2,
      }),
      makeGeracao({ geracaoId: "b1", versao: 1 }),
    ];
    expect(nextVersaoNaCadeia(lista, "a1")).toBe(3);
    expect(nextVersaoNaCadeia(lista, "b1")).toBe(2);
    expect(nextVersaoNaCadeia([], "novo")).toBe(1);
  });

  it("buildGeracaoPdf original tem versao 1 e sem vínculo", () => {
    const folhas: FolhaArquivada[] = [
      { id: "f1", uri: "u1", ordem: 2, timestamp: 1 },
      { id: "f2", uri: "u2", ordem: 1, timestamp: 2 },
    ];
    const g = buildGeracaoPdf({
      geracaoId: "g1",
      nomePdf: "teste",
      pdfUri: "file:///out.pdf",
      folhas,
    });
    expect(g.versao).toBe(1);
    expect(g.geracaoOriginalId).toBeNull();
    expect(g.qtdFolhas).toBe(2);
    // renumera por ordem
    expect(g.folhas.map((f) => f.id)).toEqual(["f2", "f1"]);
    expect(g.folhas.map((f) => f.ordem)).toEqual([1, 2]);
  });

  it("buildGeracaoPdf correção aponta para a raiz e incrementa versão", () => {
    const existentes = [
      makeGeracao({ geracaoId: "root", versao: 1 }),
      makeGeracao({
        geracaoId: "c1",
        geracaoOriginalId: "root",
        versao: 2,
      }),
    ];
    // corrigindo a v2 ainda vincula à raiz e vira v3
    const g = buildGeracaoPdf({
      geracaoId: "c2",
      nomePdf: "teste",
      pdfUri: "file:///out2.pdf",
      folhas: [{ id: "f", uri: "u", ordem: 1, timestamp: 1 }],
      base: existentes[1],
      existentes,
    });
    expect(g.geracaoOriginalId).toBe("root");
    expect(g.versao).toBe(3);
    expect(g.geracaoId).toBe("c2");
  });

  it("rotuloVersao e rotuloCorrecao", () => {
    expect(rotuloVersao({ versao: 1 })).toBe("v1");
    expect(rotuloVersao({ versao: 3 })).toBe("v3");
    expect(
      rotuloCorrecao({
        versao: 1,
        criadoEm: "2026-07-20T10:00:00.000Z",
        geracaoOriginalId: null,
      }),
    ).toBeNull();
    expect(
      rotuloCorrecao(
        {
          versao: 2,
          criadoEm: "2026-07-21T15:30:00.000Z",
          geracaoOriginalId: "root",
        },
        () => "21/07/2026 15:30",
      ),
    ).toBe("Corrigido em 21/07/2026 15:30");
  });

  it("folhasArquivadasParaRevisao preserva ids e ordem", () => {
    const rev = folhasArquivadasParaRevisao([
      { id: "b", uri: "ub", ordem: 2, timestamp: 20 },
      { id: "a", uri: "ua", ordem: 1, timestamp: 10 },
    ]);
    expect(rev.map((f) => f.id)).toEqual(["a", "b"]);
    expect(rev.map((f) => f.uri)).toEqual(["ua", "ub"]);
    expect(rev.map((f) => f.ordem)).toEqual([1, 2]);
  });

  it("idsDaCadeia agrupa raiz + correções e ignora outras cadeias", () => {
    const lista = [
      makeGeracao({ geracaoId: "a1" }),
      makeGeracao({ geracaoId: "a2", geracaoOriginalId: "a1", versao: 2 }),
      makeGeracao({ geracaoId: "a3", geracaoOriginalId: "a1", versao: 3 }),
      makeGeracao({ geracaoId: "b1" }),
    ];
    expect(idsDaCadeia(lista, "a1").sort()).toEqual(["a1", "a2", "a3"]);
    expect(idsDaCadeia(lista, "b1")).toEqual(["b1"]);
  });

  it("contarOutrasVersoesNaCadeia conta a partir de qualquer versão", () => {
    const lista = [
      makeGeracao({ geracaoId: "a1" }),
      makeGeracao({ geracaoId: "a2", geracaoOriginalId: "a1", versao: 2 }),
      makeGeracao({ geracaoId: "b1" }),
    ];
    expect(contarOutrasVersoesNaCadeia(lista, lista[0])).toBe(1);
    expect(contarOutrasVersoesNaCadeia(lista, lista[1])).toBe(1);
    expect(contarOutrasVersoesNaCadeia(lista, lista[2])).toBe(0);
  });

  it("removerGeracoes remove só os ids pedidos", () => {
    const lista = [
      makeGeracao({ geracaoId: "a1" }),
      makeGeracao({ geracaoId: "a2", geracaoOriginalId: "a1", versao: 2 }),
      makeGeracao({ geracaoId: "b1" }),
    ];
    const restantes = removerGeracoes(lista, ["a2"]);
    expect(restantes.map((g) => g.geracaoId)).toEqual(["a1", "b1"]);
  });

  it("removerGeracoes promove nova raiz quando a original é apagada", () => {
    const lista = [
      makeGeracao({ geracaoId: "a1" }),
      makeGeracao({ geracaoId: "a3", geracaoOriginalId: "a1", versao: 3 }),
      makeGeracao({ geracaoId: "a2", geracaoOriginalId: "a1", versao: 2 }),
    ];
    const restantes = removerGeracoes(lista, ["a1"]);
    const a2 = restantes.find((g) => g.geracaoId === "a2");
    const a3 = restantes.find((g) => g.geracaoId === "a3");
    // a mais antiga remanescente vira raiz; a outra passa a apontar para ela
    expect(a2?.geracaoOriginalId).toBeNull();
    expect(a3?.geracaoOriginalId).toBe("a2");
    // versões preservadas — não há renumeração
    expect(a2?.versao).toBe(2);
    expect(a3?.versao).toBe(3);
    // e a cadeia continua íntegra para novas correções
    expect(nextVersaoNaCadeia(restantes, resolveRootId(a3!))).toBe(4);
  });

  it("removerGeracoes com a cadeia inteira esvazia sem sobras", () => {
    const lista = [
      makeGeracao({ geracaoId: "a1" }),
      makeGeracao({ geracaoId: "a2", geracaoOriginalId: "a1", versao: 2 }),
      makeGeracao({ geracaoId: "b1" }),
    ];
    const restantes = removerGeracoes(lista, idsDaCadeia(lista, "a1"));
    expect(restantes.map((g) => g.geracaoId)).toEqual(["b1"]);
    expect(removerGeracoes(lista, ["nao-existe"])).toHaveLength(3);
  });

  it("somarTamanhoBytes ignora registros antigos sem medida", () => {
    expect(
      somarTamanhoBytes([
        { tamanhoBytes: 1000 },
        { tamanhoBytes: undefined },
        { tamanhoBytes: 2048 },
      ]),
    ).toBe(3048);
    expect(somarTamanhoBytes([])).toBe(0);
  });

  it("formatarBytes usa B/KB/MB e retorna null sem medida", () => {
    expect(formatarBytes(0)).toBeNull();
    expect(formatarBytes(undefined)).toBeNull();
    expect(formatarBytes(512)).toBe("512 B");
    expect(formatarBytes(2048)).toBe("2,0 KB");
    expect(formatarBytes(5 * 1024 * 1024)).toBe("5,0 MB");
    expect(formatarBytes(24 * 1024 * 1024)).toBe("24 MB");
  });

  it("ordenarGeracoesRecentes coloca a mais nova primeiro", () => {
    const lista = ordenarGeracoesRecentes([
      makeGeracao({
        geracaoId: "old",
        criadoEm: "2026-01-01T00:00:00.000Z",
      }),
      makeGeracao({
        geracaoId: "new",
        criadoEm: "2026-07-01T00:00:00.000Z",
      }),
    ]);
    expect(lista.map((g) => g.geracaoId)).toEqual(["new", "old"]);
  });
});
