import { desambiguarNomes } from "../nomeArquivo";

/**
 * O caso real: `RProInv_Produtividade` sem coluna de matrícula faz todas as
 * fichas caírem em `Avaliacao_sem_matricula_<NOME>.pdf`, e o nome ainda é
 * cortado em 40 caracteres. Dois homônimos produziam o mesmo arquivo — no iOS
 * o segundo sobrescrevia o primeiro sem erro, e o lote reportava as duas
 * como salvas.
 */
describe("desambiguarNomes", () => {
  it("deixa nomes distintos exatamente como estão", () => {
    const { nomes, renomeados } = desambiguarNomes([
      "Avaliacao_123_JOAO.pdf",
      "Avaliacao_456_MARIA.pdf",
    ]);
    expect(nomes).toEqual(["Avaliacao_123_JOAO.pdf", "Avaliacao_456_MARIA.pdf"]);
    expect(renomeados).toEqual([]);
  });

  it("numera o repetido sem tocar no primeiro", () => {
    const { nomes } = desambiguarNomes([
      "Avaliacao_sem_matricula_JOAO_DA_SILVA.pdf",
      "Avaliacao_sem_matricula_JOAO_DA_SILVA.pdf",
    ]);
    expect(nomes).toEqual([
      "Avaliacao_sem_matricula_JOAO_DA_SILVA.pdf",
      "Avaliacao_sem_matricula_JOAO_DA_SILVA (2).pdf",
    ]);
  });

  it("numera três ou mais em sequência", () => {
    const { nomes } = desambiguarNomes(["f.pdf", "f.pdf", "f.pdf", "f.pdf"]);
    expect(nomes).toEqual(["f.pdf", "f (2).pdf", "f (3).pdf", "f (4).pdf"]);
  });

  it("não colide com um sufixo que já venha no lote", () => {
    const { nomes } = desambiguarNomes(["f.pdf", "f (2).pdf", "f.pdf"]);
    expect(nomes).toEqual(["f.pdf", "f (2).pdf", "f (3).pdf"]);
    expect(new Set(nomes).size).toBe(3);
  });

  it("compara ignorando caixa — o destino pode ser FAT32", () => {
    const { nomes } = desambiguarNomes(["Ficha.pdf", "FICHA.pdf"]);
    expect(nomes).toEqual(["Ficha.pdf", "FICHA (2).pdf"]);
  });

  it("preserva a extensão, inclusive .html da web", () => {
    const { nomes } = desambiguarNomes(["f.html", "f.html"]);
    expect(nomes[1]).toBe("f (2).html");
  });

  it("nome sem extensão recebe o sufixo no fim", () => {
    const { nomes } = desambiguarNomes(["relatorio", "relatorio"]);
    expect(nomes).toEqual(["relatorio", "relatorio (2)"]);
  });

  it("ponto no meio do nome não vira extensão falsa", () => {
    const { nomes } = desambiguarNomes(["Av_1.2_JOAO.pdf", "Av_1.2_JOAO.pdf"]);
    expect(nomes[1]).toBe("Av_1.2_JOAO (2).pdf");
  });

  it("relata o que renomeou, para a tela avisar o líder", () => {
    const { renomeados } = desambiguarNomes(["f.pdf", "f.pdf"]);
    expect(renomeados).toEqual([{ de: "f.pdf", para: "f (2).pdf" }]);
  });

  it("lote vazio não quebra", () => {
    expect(desambiguarNomes([])).toEqual({ nomes: [], renomeados: [] });
  });

  it("garante unicidade em lote grande de homônimos", () => {
    const entrada = Array.from({ length: 30 }, () => "Avaliacao_sem_matricula_ANA.pdf");
    const { nomes } = desambiguarNomes(entrada);
    expect(new Set(nomes.map((n) => n.toLowerCase())).size).toBe(30);
  });
});
