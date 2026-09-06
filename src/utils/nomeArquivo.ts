/**
 * Nomes de arquivo únicos dentro de um lote.
 *
 * As fichas saem como `Avaliacao_<matrícula>_<NOME>.pdf`. Quando o
 * `RProInv_Produtividade` vem sem coluna de matrícula, todas caem em
 * `Avaliacao_sem_matricula_<NOME>.pdf`, e o nome ainda é cortado em 40
 * caracteres — dois homônimos, ou dois nomes longos com o mesmo começo,
 * produzem o mesmo arquivo.
 *
 * O estrago varia por plataforma, e em nenhuma delas aparece um erro:
 *
 * - **iOS e fallback:** o caminho é `documentDirectory + nome` e o
 *   `writeAsStringAsync` sobrescreve. A segunda ficha apaga a primeira.
 * - **Android/SAF:** o provider renomeia sozinho, e o líder recebe um arquivo
 *   com nome que não casa com nenhum conferente.
 * - **Web:** o navegador anexa " (1)".
 *
 * Em todos, `salvarArquivosEmLote` reportava as duas como salvas. Numa ficha
 * individual — documento que se lê junto com a pessoa avaliada — entregar a
 * do colega é pior que não entregar nenhuma.
 */

/** Separa `Avaliacao_123_JOAO.pdf` em `["Avaliacao_123_JOAO", ".pdf"]`. */
function separarExtensao(nome: string): [string, string] {
  const i = nome.lastIndexOf(".");
  return i > 0 ? [nome.slice(0, i), nome.slice(i)] : [nome, ""];
}

export interface NomesDesambiguados {
  /** Mesma ordem da entrada, já sem repetição. */
  nomes: string[];
  /** O que mudou, para a tela poder avisar em vez de renomear em silêncio. */
  renomeados: { de: string; para: string }[];
}

/**
 * Devolve a lista com os repetidos numerados: `X.pdf`, `X (2).pdf`, `X (3).pdf`.
 *
 * A comparação ignora caixa porque o destino pode ser um cartão em FAT32, onde
 * `JOAO.pdf` e `joao.pdf` são o mesmo arquivo. O sufixo procura o primeiro
 * número livre, então um lote que já traga `X (2).pdf` não gera outro igual.
 */
export function desambiguarNomes(entrada: string[]): NomesDesambiguados {
  const tomados = new Set<string>();
  const renomeados: { de: string; para: string }[] = [];

  const nomes = entrada.map((nome) => {
    if (!tomados.has(nome.toLowerCase())) {
      tomados.add(nome.toLowerCase());
      return nome;
    }
    const [base, ext] = separarExtensao(nome);
    let n = 2;
    let candidato = `${base} (${n})${ext}`;
    while (tomados.has(candidato.toLowerCase())) {
      n += 1;
      candidato = `${base} (${n})${ext}`;
    }
    tomados.add(candidato.toLowerCase());
    renomeados.push({ de: nome, para: candidato });
    return candidato;
  });

  return { nomes, renomeados };
}
