/**
 * CSV/TSV do Crystal Reports → matriz (array de arrays).
 *
 * Separado de `excelParser.ts` porque aquele arquivo importa o DocumentPicker:
 * o miolo tem de rodar no Jest sem mock de React Native, como já acontece com
 * `fileFormat` e `spreadsheetReader`.
 *
 * Dois defeitos que a versão anterior tinha, ambos silenciosos:
 *
 * 1. O separador era decidido por `texto.includes('\t')` sobre o documento
 *    inteiro. Uma única tabulação perdida numa descrição de produto fazia o
 *    arquivo todo — separado por `;` — ser fatiado por tabulação, e cada linha
 *    virava uma célula só. Nenhum parser reclamava: eles procuram o cabeçalho
 *    pelos rótulos e simplesmente não o encontravam.
 *
 * 2. Campo entre aspas contendo o separador era partido no meio. Descrição do
 *    tipo `"AMOXICILINA 500MG, 21 CPS"` virava duas colunas num CSV por
 *    vírgula, deslocando todas as colunas seguintes daquela linha.
 */

/** Separadores que o Crystal usa, em ordem de preferência no empate. */
const CANDIDATOS = [";", "\t", ","] as const;

/** Conta ocorrências do separador fora de aspas. */
function contarForaDeAspas(linha: string, sep: string): number {
  let total = 0;
  let entreAspas = false;
  for (let i = 0; i < linha.length; i += 1) {
    const c = linha[i];
    if (c === '"') entreAspas = !entreAspas;
    else if (c === sep && !entreAspas) total += 1;
  }
  return total;
}

/**
 * Separador dominante, pela **mediana** de ocorrências por linha.
 *
 * A mediana é o que resolve o defeito (1): um `\t` isolado numa linha de 4.000
 * deixa a mediana de tabulação em 0, enquanto a de `;` continua alta. Contar o
 * total do documento não bastaria — um arquivo com muitas descrições contendo
 * vírgula ainda poderia superar o separador verdadeiro.
 */
export function detectarSeparador(texto: string): string {
  const linhas = texto
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0)
    .slice(0, 50);
  if (linhas.length === 0) return ";";

  let melhor: string = CANDIDATOS[0];
  let melhorMediana = 0;
  for (const sep of CANDIDATOS) {
    const contagens = linhas
      .map((l) => contarForaDeAspas(l, sep))
      .sort((a, b) => a - b);
    const mediana = contagens[Math.floor(contagens.length / 2)] ?? 0;
    if (mediana > melhorMediana) {
      melhorMediana = mediana;
      melhor = sep;
    }
  }
  return melhor;
}

/**
 * Converte texto delimitado em matriz.
 *
 * Varre caractere a caractere em vez de `split('\n').split(sep)`, porque só
 * assim o separador e a quebra de linha dentro de aspas deixam de partir a
 * célula. `""` dentro de campo citado vale uma aspa literal.
 *
 * Linha em branco no meio do arquivo é preservada como `[""]`: os parsers do
 * Crystal localizam o cabeçalho por índice, e engolir a linha deslocaria tudo
 * abaixo dela. Já a quebra final não gera linha fantasma, e texto vazio devolve
 * `[]` — é o que faz `pickSheetAsMatrix()` conseguir dizer "está vazio".
 */
export function csvParaMatriz(texto: string, separador?: string): string[][] {
  const sep = separador ?? detectarSeparador(texto);
  const matriz: string[][] = [];
  let linha: string[] = [];
  let celula = "";
  let entreAspas = false;

  const fecharCelula = () => {
    linha.push(celula.trim());
    celula = "";
  };
  const fecharLinha = () => {
    fecharCelula();
    matriz.push(linha);
    linha = [];
  };

  for (let i = 0; i < texto.length; i += 1) {
    const c = texto[i];

    if (entreAspas) {
      if (c !== '"') celula += c;
      else if (texto[i + 1] === '"') {
        celula += '"';
        i += 1;
      } else entreAspas = false;
      continue;
    }

    if (c === '"') entreAspas = true;
    else if (c === sep) fecharCelula();
    else if (c === "\n") fecharLinha();
    else if (c === "\r") {
      if (texto[i + 1] === "\n") i += 1;
      fecharLinha();
    } else celula += c;
  }

  if (celula.length > 0 || linha.length > 0) fecharLinha();
  return matriz;
}
