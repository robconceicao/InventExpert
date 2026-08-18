import type { ProdSecaoRow } from '../services/AreaMappingService';
import type { AcuracidadeRow } from '../services/ErroAtribuicaoService';
import type { NaoContadoInput } from '../services/NaoContadoService';
import type { SectionAccuracyRecord } from '../types';
import { normalizarNomeArea } from './inventExpUtils';

/**
 * Parsers das entradas que o motor v3 acrescentou.
 *
 * Todos recebem MATRIZ (array de arrays) em vez de objetos: os relatórios do
 * Crystal Reports trazem título, filtros e células mescladas antes do cabeçalho,
 * e as colunas ficam espalhadas por dezenas de posições vazias. Cada parser
 * localiza a própria linha de cabeçalho pelos rótulos e memoriza os índices.
 *
 * Layouts conferidos contra os arquivos reais do inventário DPSP L2601.
 */

const norm = (v: unknown): string =>
  (v ?? '')
    .toString()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Número em pt-BR ou en-US: "1.234,56" e "1234.56" viram 1234.56. */
export function parseNumeroBr(v: unknown): number {
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  const s = (v ?? '').toString().trim();
  if (!s) return 0;
  const limpo = s.replace(/[^\d,.-]/g, '');
  const temVirgula = limpo.includes(',');
  const temPonto = limpo.includes('.');
  let final = limpo;
  if (temVirgula && temPonto) final = limpo.replace(/\./g, '').replace(',', '.');
  else if (temVirgula) final = limpo.replace(',', '.');
  const n = parseFloat(final);
  return isNaN(n) ? 0 : n;
}

/**
 * Primeiras linhas com cara de cabeçalho, para a mensagem de erro.
 *
 * Sem isso, "cabeçalho não encontrado" não diz o que o arquivo realmente tem —
 * e quem está em campo não consegue reportar nada além de "não funcionou".
 */
function amostrarLinhas(matriz: any[][], quantas = 5): string {
  const candidatas = matriz
    .slice(0, 200)
    .filter((l) => Array.isArray(l) && l.filter((c) => norm(c)).length >= 3)
    .slice(0, quantas)
    .map((l, i) => `${i + 1}) ${l.filter((c) => norm(c)).slice(0, 8).map(norm).join(' | ')}`);

  if (candidatas.length === 0) {
    return `A planilha tem ${matriz.length} linha(s), nenhuma com 3 ou mais colunas preenchidas.`;
  }
  return `Linhas encontradas no arquivo:\n${candidatas.join('\n')}`;
}

/**
 * Localiza a linha de cabeçalho pelos rótulos e devolve o índice de cada coluna.
 *
 * O limite existe para não varrer a planilha inteira atrás de um cabeçalho que
 * não existe. 60 linhas era pouco: o Crystal empilha título, filtros e linhas
 * em branco antes do cabeçalho, e `blankrows: true` faz cada uma delas contar.
 */
function localizarCabecalho(
  matriz: any[][],
  obrigatorios: string[],
  colunas: Record<string, string[]>,
  limite = 200,
): { linha: number; idx: Record<string, number> } | null {
  for (let i = 0; i < Math.min(matriz.length, limite); i++) {
    const linha = matriz[i];
    if (!Array.isArray(linha)) continue;
    const texto = linha.map(norm).join(';');
    if (!obrigatorios.every((o) => texto.includes(o))) continue;

    const idx: Record<string, number> = {};
    linha.forEach((celula, c) => {
      const v = norm(celula);
      if (!v) return;
      for (const [chave, rotulos] of Object.entries(colunas)) {
        if (idx[chave] !== undefined) continue;
        if (rotulos.some((r) => v === r || v.includes(r))) idx[chave] = c;
      }
    });
    return { linha: i, idx };
  }
  return null;
}

// ---------------------------------------------------------------------------
// PROD_SEÇÃO.xlsx — área física × conferente
// ---------------------------------------------------------------------------

/**
 * O nome da área aparece só na primeira linha do grupo (célula mesclada);
 * as linhas seguintes do mesmo grupo vêm em branco. Por isso a área é
 * arrastada para baixo até mudar.
 *
 * Linhas de subtotal repetem as quantidades sem matrícula — são descartadas
 * pela exigência de matrícula numérica e nome preenchido.
 */
export function parseProdSecaoMatrix(matriz: any[][]): ProdSecaoRow[] {
  const cab = localizarCabecalho(
    matriz,
    ['AREA', 'MATRICULA'],
    {
      area: ['AREA'],
      matricula: ['MATRICULA'],
      nome: ['NOME'],
      secoes: ['SECOES CONTADAS', 'SECOES'],
      c1: ['QTD(C1)', 'QTDC1', 'QTD (C1)'],
      a1: ['QTD(A1)', 'QTDA1'],
      a2: ['QTD(A2)', 'QTDA2'],
      a3: ['QTD(A3)', 'QTDA3'],
      final: ['QTD(FINAL)', 'QTDFINAL', 'QTD (FINAL)'],
    },
  );

  const idx = cab?.idx ?? {};
  const iArea = idx.area ?? 1;
  const iMat = idx.matricula ?? 6;
  const iNome = idx.nome ?? 9;
  const iSec = idx.secoes ?? 21;
  const iC1 = idx.c1 ?? 26;
  const iA1 = idx.a1 ?? 29;
  const iA2 = idx.a2 ?? 32;
  const iA3 = idx.a3 ?? 34;
  const iFinal = idx.final ?? 37;
  const inicio = (cab?.linha ?? 6) + 1;

  const linhas: ProdSecaoRow[] = [];
  let areaAtual = '';

  for (let i = inicio; i < matriz.length; i++) {
    const l = matriz[i];
    if (!Array.isArray(l)) continue;

    const areaCelula = (l[iArea] ?? '').toString().trim();
    if (areaCelula) areaAtual = areaCelula;

    const matricula = (l[iMat] ?? '').toString().replace(/\D/g, '');
    const nome = (l[iNome] ?? '').toString().trim();
    if (!matricula || !nome) continue;
    if (norm(nome).includes('TOTAL')) continue;

    const secoes = Math.round(parseNumeroBr(l[iSec]));
    const qtdC1 = Math.round(parseNumeroBr(l[iC1]));
    if (secoes <= 0) continue;

    linhas.push({
      area: normalizarNomeArea(areaAtual),
      matricula,
      nome,
      secoes,
      qtdC1,
      qtdFinal: Math.round(parseNumeroBr(l[iFinal])),
      ajusteA1: Math.round(parseNumeroBr(l[iA1])),
      ajusteA2: Math.round(parseNumeroBr(l[iA2])),
      ajusteA3: Math.round(parseNumeroBr(l[iA3])),
    });
  }
  return linhas;
}

// ---------------------------------------------------------------------------
// ACURACIDADE.xls — divergência por seção + EAN
// ---------------------------------------------------------------------------

/**
 * A seção vem com 4 dígitos, igual à que o `prcParser` extrai do endereço.
 * Divergência aritmética (AJST ≠ FINAL − C1) é avisada, não descartada: o
 * relatório é a fonte, e mascarar inconsistência dele esconde problema real.
 */
export function parseAcuracidadeMatrix(matriz: any[][]): AcuracidadeRow[] {
  const cab = localizarCabecalho(
    matriz,
    ['SECAO', 'C1'],
    {
      secao: ['SECAO'],
      ean: ['BARRA', 'EAN'],
      descricao: ['DESCRICAO'],
      c1: ['QTD(C1)', 'C1'],
      a1: ['QTD(A1)', 'A1'],
      a2: ['QTD(A2)', 'A2'],
      a3: ['QTD(A3)', 'A3'],
      final: ['QTD(FINAL)', 'FINAL'],
      ajuste: ['AJST', 'AJUSTE'],
    },
  );
  if (!cab) {
    throw new Error(
      'Cabeçalho não encontrado no ACURACIDADE (esperado "SECAO" e "C1").\n\n' +
        amostrarLinhas(matriz),
    );
  }

  const { idx } = cab;
  const linhas: AcuracidadeRow[] = [];
  let inconsistentes = 0;

  for (let i = cab.linha + 1; i < matriz.length; i++) {
    const l = matriz[i];
    if (!Array.isArray(l)) continue;

    const secao = (l[idx.secao] ?? '').toString().trim();
    if (!secao || norm(secao).includes('TOTAL')) continue;
    const ean = (l[idx.ean] ?? '').toString().trim();
    if (!ean) continue;

    const qtdC1 = parseNumeroBr(l[idx.c1]);
    const qtdFinal = parseNumeroBr(l[idx.final]);
    const ajuste = parseNumeroBr(l[idx.ajuste]);
    if (Math.abs(ajuste - (qtdFinal - qtdC1)) > 0.01) inconsistentes++;

    linhas.push({
      secao: secao.padStart(4, '0'),
      ean,
      descricao: (l[idx.descricao] ?? '').toString().trim(),
      qtdC1,
      qtdA1: parseNumeroBr(l[idx.a1]),
      qtdA2: parseNumeroBr(l[idx.a2]),
      qtdA3: parseNumeroBr(l[idx.a3]),
      qtdFinal,
      ajuste,
    });
  }

  if (inconsistentes > 0) {
    console.warn(
      `[Avaliação] ACURACIDADE: ${inconsistentes} linha(s) com AJST diferente de FINAL − C1.`,
    );
  }
  return linhas;
}

// ---------------------------------------------------------------------------
// NAO CONTADOS.xls — produtos que ficaram sem coleta
// ---------------------------------------------------------------------------

/**
 * O relatório alterna uma linha de produto com uma ou mais linhas só de EAN
 * (o mesmo produto costuma ter EAN de unidade e de caixa). Os EANs pertencem
 * ao produto imediatamente acima.
 *
 * Não há coluna de seção — é justamente por isso que o `NaoContadoService`
 * precisa inferir a área pela marca.
 */
export function parseNaoContadosMatrix(matriz: any[][]): NaoContadoInput[] {
  const cab = localizarCabecalho(matriz, ['ORDEM', 'DESCRICAO'], {
    ordem: ['ORDEM'],
    descricao: ['DESCRICAO'],
    dep: ['DEP'],
    preco: ['PRECO UNIT', 'PRECO'],
  });

  const iOrdem = cab?.idx.ordem ?? 1;
  const iDesc = cab?.idx.descricao ?? -1;
  const iDep = cab?.idx.dep ?? -1;
  const inicio = (cab?.linha ?? 4) + 1;

  const itens: NaoContadoInput[] = [];
  let atual: NaoContadoInput | null = null;

  for (let i = inicio; i < matriz.length; i++) {
    const l = matriz[i];
    if (!Array.isArray(l)) continue;

    const ordem = parseNumeroBr(l[iOrdem]);
    const ehProduto = ordem > 0 && Number.isInteger(ordem);

    if (ehProduto) {
      // As colunas do Crystal saem desalinhadas entre cabeçalho e dados — no
      // L2601 a descrição fica uma coluna à esquerda do rótulo e o preço, uma à
      // direita. Por isso se procura PERTO do índice do cabeçalho, em vez de
      // confiar nele ou de apostar na "maior célula de texto".
      //
      // A maior célula era a regra antiga e estava errada no dado real: o nome
      // do departamento ("COMPLEMENTOS VITAMINICOS") é mais longo que a
      // descrição do produto ("MOTILEX HA C/ 60 CAPS") e vencia. A inferência
      // por marca passava a rodar em cima do nome do departamento.
      const textoEm = (c: number) => (l[c] ?? '').toString().trim();
      const ehTexto = (v: string) => v.length > 0 && !/^[\d.,\s-]+$/.test(v);

      let departamento = '';
      let iCodigoDep = -1;
      const janelaDep = iDep >= 0 ? [iDep, iDep - 1, iDep + 1] : [];
      for (const c of janelaDep) {
        const v = textoEm(c);
        if (/^\d{3}$/.test(v)) {
          departamento = v;
          iCodigoDep = c;
          break;
        }
      }

      // O nome do departamento vem logo depois do código — nunca é a descrição.
      let departamentoNome = '';
      if (iCodigoDep >= 0) {
        for (let c = iCodigoDep + 1; c <= iCodigoDep + 5 && c < l.length; c++) {
          const v = textoEm(c);
          if (ehTexto(v)) {
            departamentoNome = v;
            break;
          }
        }
      }

      let descricao = '';
      const janelaDesc =
        iDesc >= 0 ? [iDesc, iDesc - 1, iDesc + 1, iDesc - 2, iDesc + 2] : [];
      for (const c of janelaDesc) {
        const v = textoEm(c);
        if (ehTexto(v) && v !== departamentoNome) {
          descricao = v;
          break;
        }
      }
      if (!descricao) {
        // Sem cabeçalho utilizável: maior texto que não seja o departamento.
        l.forEach((celula, c) => {
          if (c === iOrdem || c === iCodigoDep) return;
          const v = (celula ?? '').toString().trim();
          if (!ehTexto(v) || v === departamentoNome) return;
          if (v.length > descricao.length) descricao = v;
        });
      }

      let valor = 0;
      l.forEach((celula, c) => {
        if (c === iOrdem || c === iCodigoDep) return;
        const v = (celula ?? '').toString().trim();
        if (!v || !/^[\d.,\s-]+$/.test(v)) return;
        const n = parseNumeroBr(v);
        if (n > 0 && !/^0*\d{12,15}$/.test(v.replace(/\D/g, ''))) valor = n;
      });

      if (!descricao) continue;
      atual = {
        descricao,
        eans: [],
        situacao: 'NAO_ENCONTRADO',
        valor,
        departamento,
        departamentoNome: departamentoNome || undefined,
      };
      itens.push(atual);
      continue;
    }

    // Linha só de EAN: pertence ao produto imediatamente acima.
    if (!atual) continue;
    for (const celula of l) {
      const v = (celula ?? '').toString().trim();
      if (/^\d{12,15}$/.test(v) && !atual.eans.includes(v)) atual.eans.push(v);
    }
  }

  return itens.filter((i) => i.descricao);
}

// ---------------------------------------------------------------------------
// Auditoria dirigida — transcrição da folha assinada
// ---------------------------------------------------------------------------

/**
 * A auditoria dirigida chega em papel assinado, então a entrada é texto colado.
 * Uma linha por produto, campos separados por ponto e vírgula, tabulação ou
 * vírgula, na ordem: EAN, descrição, quantidade e preço unitário.
 *
 *   007896585628206;COLIDIS 10ML;14;111,59
 *
 * Linhas em branco e cabeçalho são ignorados. Sem preço unitário, o item entra
 * com valor zero e não pesa na cobertura — mas continua sendo listado.
 */
export function parseAuditoriaDirigida(texto: string): NaoContadoInput[] {
  const itens: NaoContadoInput[] = [];

  for (const linha of texto.split(/\r?\n/)) {
    const l = linha.trim();
    if (!l) continue;
    if (/^(EAN|C[OÓ]D)/i.test(l)) continue;

    const sep = l.includes(';') ? ';' : l.includes('\t') ? '\t' : ',';
    const campos = l.split(sep).map((c) => c.trim());
    if (campos.length < 3) continue;

    const ean = campos[0].replace(/\D/g, '');
    const descricao = campos[1];
    const quantidade = parseNumeroBr(campos[2]);
    const precoUnit = campos.length >= 4 ? parseNumeroBr(campos[3]) : 0;
    if (!descricao || quantidade <= 0) continue;

    itens.push({
      descricao,
      eans: ean ? [ean] : [],
      situacao: 'RECUPERADO',
      quantidade,
      valor: Math.round(quantidade * precoUnit * 100) / 100,
    });
  }
  return itens;
}

// ---------------------------------------------------------------------------
// CadProd — custo unitário e família por EAN
// ---------------------------------------------------------------------------

export interface CadastroProduto {
  custoPorEan: Map<string, number>;
  familiaPorEan: Map<string, string>;
}

/**
 * Monta as tabelas de custo e família cruzando os dois arquivos do CadProd:
 *
 *   INVENT_DSP...old   →  PLU ; EAN ; descrição
 *   ...AUDITORIA...old →  UN;PLU;descrição;subclasse;família;desc.família;fornecedor;qtd;custo
 *
 * O EAN é a chave de saída porque é o que o ACURACIDADE e o `.prc` carregam;
 * o PLU serve só de ponte entre os dois arquivos.
 */
export function montarCadastroProduto(
  inventDspTexto: string,
  saldoAuditoriaTexto: string,
): CadastroProduto {
  const pluCusto = new Map<string, number>();
  const pluFamilia = new Map<string, string>();

  for (const linha of saldoAuditoriaTexto.split(/\r?\n/)) {
    const p = linha.split(';');
    if (p.length < 9) continue;
    const plu = p[1]?.trim();
    if (!plu || !/^\d+$/.test(plu)) continue;
    const custo = parseNumeroBr(p[8]);
    if (custo > 0) pluCusto.set(plu, custo);
    const familia = p[5]?.trim();
    if (familia) pluFamilia.set(plu, familia);
  }

  const custoPorEan = new Map<string, number>();
  const familiaPorEan = new Map<string, string>();

  for (const linha of inventDspTexto.split(/\r?\n/)) {
    const p = linha.split(';');
    if (p.length < 2) continue;
    const plu = p[0]?.trim();
    const ean = p[1]?.trim();
    if (!plu || !ean || !/^\d+$/.test(plu)) continue;

    const custo = pluCusto.get(plu);
    const familia = pluFamilia.get(plu);
    // grava nas duas formas: com e sem zeros à esquerda
    for (const chave of new Set([ean, ean.replace(/^0+/, ''), ean.padStart(15, '0')])) {
      if (!chave) continue;
      if (custo !== undefined) custoPorEan.set(chave, custo);
      if (familia) familiaPorEan.set(chave, familia);
    }
  }

  return { custoPorEan, familiaPorEan };
}

// ---------------------------------------------------------------------------
// CONTROLADOS.xls — EANs sujeitos a penalidade agravada
// ---------------------------------------------------------------------------

/**
 * O relatório é agrupado por departamento e por PLU, com o EAN em posições
 * que variam conforme o nível do agrupamento. Varrer a matriz atrás de células
 * que sejam só dígitos, com 12 a 15 posições, é mais robusto do que apostar
 * numa coluna fixa — e o custo de um falso positivo aqui é baixo.
 */
export function parseControladosMatrix(matriz: any[][]): Set<string> {
  const eans = new Set<string>();
  for (const linha of matriz) {
    if (!Array.isArray(linha)) continue;
    for (const celula of linha) {
      const v = (celula ?? '').toString().trim();
      if (/^\d{12,15}$/.test(v)) {
        eans.add(v.padStart(15, '0'));
        eans.add(v);
      }
    }
  }
  return eans;
}

/**
 * Converte as linhas do PROD_SEÇÃO para o formato que o motor v2.1 consome,
 * de modo que um único arquivo alimente os dois motores. O `bloco_pct` fica
 * de fora de propósito: quem o calcula é `enriquecerSecoesComBloco`, a partir
 * das contagens do `.prc`.
 */
export function prodSecaoParaSecoes(linhas: ProdSecaoRow[]): SectionAccuracyRecord[] {
  return linhas.map((l) => {
    const ajusteAbs =
      Math.abs(l.ajusteA1 ?? 0) + Math.abs(l.ajusteA2 ?? 0) + Math.abs(l.ajusteA3 ?? 0);
    return {
      area_nome: l.area,
      area: l.area,
      matricula: l.matricula,
      nome: l.nome,
      secoes_contadas: l.secoes,
      qtd_c1: l.qtdC1,
      totalC1: l.qtdC1,
      ajuste_a1: l.ajusteA1 ?? 0,
      ajuste_a2: l.ajusteA2 ?? 0,
      ajuste_a3: l.ajusteA3 ?? 0,
      qtd_final: l.qtdFinal ?? l.qtdC1,
      ajusteAbsoluto: ajusteAbs,
      acuracidade: l.qtdC1 > 0 ? Math.max(0, (1 - ajusteAbs / l.qtdC1) * 100) : 100,
    };
  });
}

// ---------------------------------------------------------------------------
// DOBRO.xls — itens coletados em duplicidade
// ---------------------------------------------------------------------------

/** Uma bipada repetida do mesmo produto na mesma seção. */
export interface DobroRow {
  secao: string;
  ean: string;
  descricao: string;
  familia: string;
  qtde: number;
}

/**
 * O relatório alterna uma linha de produto (com o total) e várias linhas de
 * detalhe, uma por bipada repetida. Só as de detalhe interessam: elas trazem
 * seção e código coletado, que é o par que liga ao conferente pelo `.prc`.
 *
 * A linha de produto não tem seção — é justamente assim que as duas se separam.
 */
export function parseDobroMatrix(matriz: any[][]): DobroRow[] {
  const cab = localizarCabecalho(matriz, ['SECAO', 'COD.COLETADO'], {
    ean: ['COD.COLETADO', 'COD COLETADO'],
    descricao: ['DESCRICAO'],
    familia: ['FAMILIA'],
    secao: ['SECAO'],
    qtde: ['QTDE(INV)', 'QTDE (INV)'],
  });

  const idx = cab?.idx ?? {};
  const iEan = idx.ean ?? 5;
  const iDesc = idx.descricao ?? 8;
  const iFam = idx.familia ?? 10;
  const iSecao = idx.secao ?? 15;
  const iQtde = idx.qtde ?? 22;
  const inicio = (cab?.linha ?? 4) + 1;

  const linhas: DobroRow[] = [];
  for (let i = inicio; i < matriz.length; i++) {
    const l = matriz[i];
    if (!Array.isArray(l)) continue;

    const secao = (l[iSecao] ?? '').toString().trim();
    const ean = (l[iEan] ?? '').toString().trim();
    if (!/^\d{3,4}$/.test(secao) || !/^\d{8,15}$/.test(ean)) continue;

    linhas.push({
      secao: secao.padStart(4, '0'),
      ean,
      descricao: (l[iDesc] ?? '').toString().trim(),
      familia: (l[iFam + 1] ?? l[iFam] ?? '').toString().trim(),
      qtde: parseNumeroBr(l[iQtde]) || 1,
    });
  }
  return linhas;
}

// ---------------------------------------------------------------------------
// BLOCO.xls — itens coletados em bloco, com CPF
// ---------------------------------------------------------------------------

/**
 * Linha do BLOCO.xls. É o único relatório do sistema que publica seção, CPF e
 * código coletado na mesma linha — o que faz dele a conferência independente
 * do decodificador de seção do `.prc` e da regra de bloco.
 */
export interface BlocoRow {
  secao: string;
  cpf: string;
  nome: string;
  ean: string;
  descricao: string;
  familia: string;
  qtde: number;
}

/**
 * As colunas de CPF e nome não têm rótulo no relatório (o cabeçalho traz uma
 * linha pontilhada no lugar), então são localizadas pela posição relativa à
 * coluna "Seção": CPF duas à frente, nome cinco. O parser valida o formato de
 * cada uma antes de aceitar a linha.
 *
 * O relatório repete linhas idênticas; a deduplicação fica a cargo de quem
 * consome, porque a repetição às vezes é bipada real.
 */
export function parseBlocoMatrix(matriz: any[][]): BlocoRow[] {
  const cab = localizarCabecalho(matriz, ['SECAO', 'CODIGO COLETADO'], {
    secao: ['SECAO'],
    ean: ['CODIGO COLETADO', 'COD. COLETADO'],
    descricao: ['DESCRICAO'],
    familia: ['FAMILIA'],
    qtde: ['QTDE (C FINAL)', 'QTDE(C FINAL)', 'QTDE'],
  });

  const idx = cab?.idx ?? {};
  const iSecao = idx.secao ?? 3;
  const iCpf = iSecao + 2;
  const iNome = iSecao + 5;
  const iEan = idx.ean ?? 14;
  const iDesc = idx.descricao ?? 19;
  const iFam = idx.familia ?? 23;
  const iQtde = idx.qtde ?? 30;
  const inicio = (cab?.linha ?? 7) + 1;

  const linhas: BlocoRow[] = [];
  for (let i = inicio; i < matriz.length; i++) {
    const l = matriz[i];
    if (!Array.isArray(l)) continue;

    const secao = (l[iSecao] ?? '').toString().trim();
    const cpf = (l[iCpf] ?? '').toString().replace(/\D/g, '');
    const ean = (l[iEan] ?? '').toString().trim();
    if (!/^\d{3,4}$/.test(secao) || cpf.length < 11 || !/^\d{8,15}$/.test(ean)) continue;

    linhas.push({
      secao: secao.padStart(4, '0'),
      cpf,
      nome: (l[iNome] ?? '').toString().trim(),
      ean,
      descricao: (l[iDesc] ?? '').toString().trim(),
      familia: (l[iFam + 4] ?? l[iFam] ?? '').toString().trim(),
      qtde: parseNumeroBr(l[iQtde]),
    });
  }
  return linhas;
}
