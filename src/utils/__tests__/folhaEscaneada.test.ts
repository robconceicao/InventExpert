import {
  createFolhaId,
  excluirFolha,
  folhasFromUris,
  inserirDepoisNaLista,
  reescanearFolhaNaLista,
  renumerarFolhas,
  reordenarFolhas,
  urisOrdenadas,
  type FolhaEscaneada,
} from "../folhaEscaneada";

function makeFolha(
  overrides: Partial<FolhaEscaneada> & { id: string; uri: string },
): FolhaEscaneada {
  return {
    ordem: 1,
    timestamp: 1,
    ...overrides,
  };
}

describe("folhaEscaneada", () => {
  it("createFolhaId gera ids distintos", () => {
    const a = createFolhaId();
    const b = createFolhaId();
    expect(a).not.toBe(b);
    expect(a).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("folhasFromUris cria ids estáveis e ordem sequencial", () => {
    const lista = folhasFromUris(["uri-a", "uri-b", ""]);
    expect(lista).toHaveLength(2);
    expect(lista[0].uri).toBe("uri-a");
    expect(lista[1].uri).toBe("uri-b");
    expect(lista[0].ordem).toBe(1);
    expect(lista[1].ordem).toBe(2);
    expect(lista[0].id).not.toBe(lista[1].id);
  });

  it("excluirFolha remove só a folha e renumera sem alterar uris restantes", () => {
    const lista = renumerarFolhas([
      makeFolha({ id: "a", uri: "u1" }),
      makeFolha({ id: "b", uri: "u2" }),
      makeFolha({ id: "c", uri: "u3" }),
    ]);
    const next = excluirFolha(lista, "b");
    expect(next.map((f) => f.id)).toEqual(["a", "c"]);
    expect(next.map((f) => f.uri)).toEqual(["u1", "u3"]);
    expect(next.map((f) => f.ordem)).toEqual([1, 2]);
  });

  it("reescanearFolhaNaLista substitui só a uri da folha alvo e mantém posição", () => {
    const lista = renumerarFolhas([
      makeFolha({ id: "a", uri: "u1" }),
      makeFolha({ id: "b", uri: "u2" }),
      makeFolha({ id: "c", uri: "u3" }),
    ]);
    const next = reescanearFolhaNaLista(lista, "b", "u2-nova");
    expect(next.map((f) => f.id)).toEqual(["a", "b", "c"]);
    expect(next.map((f) => f.uri)).toEqual(["u1", "u2-nova", "u3"]);
    expect(next.map((f) => f.ordem)).toEqual([1, 2, 3]);
    expect(next[1].timestamp).toBeGreaterThanOrEqual(lista[1].timestamp);
  });

  it("inserirDepois posiciona corretamente mesmo após exclusões", () => {
    let lista = renumerarFolhas([
      makeFolha({ id: "a", uri: "u1" }),
      makeFolha({ id: "b", uri: "u2" }),
      makeFolha({ id: "c", uri: "u3" }),
      makeFolha({ id: "d", uri: "u4" }),
    ]);
    lista = excluirFolha(lista, "b");
    lista = excluirFolha(lista, "d");
    // restam a, c
    lista = inserirDepoisNaLista(lista, "a", "u-nova");
    expect(lista.map((f) => f.uri)).toEqual(["u1", "u-nova", "u3"]);
    expect(lista.map((f) => f.ordem)).toEqual([1, 2, 3]);
    expect(lista[0].id).toBe("a");
    expect(lista[2].id).toBe("c");
    expect(lista[1].id).not.toBe("a");
    expect(lista[1].id).not.toBe("c");
  });

  it("reordenarFolhas persiste a nova ordem e renumera", () => {
    const lista = renumerarFolhas([
      makeFolha({ id: "a", uri: "u1" }),
      makeFolha({ id: "b", uri: "u2" }),
      makeFolha({ id: "c", uri: "u3" }),
    ]);
    const reordered = reordenarFolhas([lista[2], lista[0], lista[1]]);
    expect(reordered.map((f) => f.id)).toEqual(["c", "a", "b"]);
    expect(reordered.map((f) => f.uri)).toEqual(["u3", "u1", "u2"]);
    expect(reordered.map((f) => f.ordem)).toEqual([1, 2, 3]);
  });

  it("urisOrdenadas reflete exatamente a lista revisada", () => {
    let lista = renumerarFolhas([
      makeFolha({ id: "a", uri: "u1" }),
      makeFolha({ id: "b", uri: "u2" }),
      makeFolha({ id: "c", uri: "u3" }),
    ]);
    lista = excluirFolha(lista, "a");
    lista = reordenarFolhas([lista[1], lista[0]]);
    expect(urisOrdenadas(lista)).toEqual(["u3", "u2"]);
  });
});
