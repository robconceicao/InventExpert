import type { ContagemDetalhada } from '../types';
import { normalizarNomeArea } from '../utils/inventExpUtils';

/**
 * Reconstrução do mapa Seção → Área física → Conferente.
 *
 * O problema
 * ----------
 * O .prc informa a seção de cada bipada, mas não a área física da loja.
 * O PROD_SEÇÃO.xlsx informa, para cada par (área, conferente), QUANTAS seções
 * foram cobertas e quantas peças foram contadas — mas não QUAIS seções.
 *
 * A solução
 * ---------
 * A numeração das seções acompanha o percurso físico da loja: as seções de uma
 * mesma área, para um mesmo conferente, ficam próximas. Então:
 *
 *   1. ordenar as seções que o conferente bipou;
 *   2. recortar essa lista em blocos do tamanho declarado no PROD_SEÇÃO;
 *   3. escolher a ordem dos blocos que minimiza a diferença entre as peças do
 *      bloco e as peças declaradas, com preferência por blocos numericamente
 *      próximos de seções já atribuídas à mesma área por outro conferente.
 *
 * Validado no inventário DPSP L2601: 68 das 72 combinações (área × conferente)
 * fecharam exatamente em número de seções e em peças; as 4 restantes ficaram
 * dentro da margem de rebipagem. As 1.045 seções foram mapeadas.
 *
 * Conferentes são processados do menor para o maior número de áreas: quem tem
 * poucas áreas produz âncoras confiáveis para quem tem muitas.
 */

/** Linha do PROD_SEÇÃO.xlsx. */
export interface ProdSecaoRow {
  area: string;
  matricula: string;
  nome: string;
  /** Nº de seções contadas pelo conferente naquela área. */
  secoes: number;
  /** Peças da 1ª contagem (Qtd C1). */
  qtdC1: number;
  qtdFinal?: number;
  /** Ajustes das auditorias, preservados para o motor v2.1. */
  ajusteA1?: number;
  ajusteA2?: number;
  ajusteA3?: number;
}

export interface AreaAtribuida {
  area: string;
  matricula: string;
  nome: string;
  secoes: string[];
  qtdDeclarada: number;
  qtdApurada: number;
  /** true quando nº de seções e peças fecharam dentro da tolerância. */
  conforme: boolean;
}

export interface MapaAreas {
  /** seção (4 dígitos) → nome canônico da área */
  secaoParaArea: Map<string, string>;
  /** seção (4 dígitos) → matrícula do conferente */
  secaoParaMatricula: Map<string, string>;
  atribuicoes: AreaAtribuida[];
  /** Combinações que não fecharam — exibir como ressalva, nunca esconder. */
  naoConformes: AreaAtribuida[];
}

/** Tolerância em peças: rebipagem faz o CNT ficar acima do declarado. */
const TOLERANCIA_PECAS_ABS = 10;
const TOLERANCIA_PECAS_PCT = 0.08;

/** Peso da proximidade numérica com seções já atribuídas à mesma área. */
const PESO_ANCORA = 0.4;
const DISTANCIA_MAXIMA = 600;
const PENALIDADE_SEM_ANCORA = 150;

/** Acima disso, busca exaustiva por permutação sai de cogitação. */
const LIMITE_PERMUTACAO = 8;
const LARGURA_BEAM = 400;

function pecasPorSecao(
  contagens: ContagemDetalhada[],
  matricula: string,
): Map<string, number> {
  const m = new Map<string, number>();
  for (const c of contagens) {
    if (c.matricula !== matricula) continue;
    m.set(c.area_codigo, (m.get(c.area_codigo) ?? 0) + c.quantidade);
  }
  return m;
}

function* permutacoes<T>(itens: T[]): Generator<T[]> {
  if (itens.length <= 1) {
    yield itens;
    return;
  }
  for (let i = 0; i < itens.length; i++) {
    const resto = [...itens.slice(0, i), ...itens.slice(i + 1)];
    for (const p of permutacoes(resto)) yield [itens[i], ...p];
  }
}

function custoBloco(
  secoes: string[],
  pecas: number,
  alvo: ProdSecaoRow,
  ancoras: Map<string, Set<number>>,
): number {
  let custo = Math.abs(pecas - alvo.qtdC1);
  const ancora = ancoras.get(alvo.area);
  if (!ancora || ancora.size === 0) return custo + PENALIDADE_SEM_ANCORA;
  const inicio = parseInt(secoes[0], 10);
  let menor = DISTANCIA_MAXIMA;
  for (const s of ancora) menor = Math.min(menor, Math.abs(inicio - s));
  return custo + menor * PESO_ANCORA;
}

/**
 * Resolve as áreas de um conferente recortando suas seções ordenadas.
 * `folga` = seções bipadas a mais do que o PROD_SEÇÃO declara (bipada perdida
 * na seção de outro conferente); vai para o bloco em que causar menos ruído.
 */
function resolverConferente(
  alvos: ProdSecaoRow[],
  secoesOrdenadas: string[],
  pecas: Map<string, number>,
  ancoras: Map<string, Set<number>>,
): Map<string, string[]> {
  const folga = secoesOrdenadas.length - alvos.reduce((s, a) => s + a.secoes, 0);

  const avaliar = (ordem: number[], folgaEm: number) => {
    let i = 0;
    let custo = 0;
    const saida = new Map<string, string[]>();
    for (let k = 0; k < ordem.length; k++) {
      const alvo = alvos[ordem[k]];
      const n = alvo.secoes + (k === folgaEm ? folga : 0);
      const bloco = secoesOrdenadas.slice(i, i + n);
      i += n;
      if (bloco.length === 0) return { custo: Infinity, saida };
      const q = bloco.reduce((s, sec) => s + (pecas.get(sec) ?? 0), 0);
      custo += custoBloco(bloco, q, alvo, ancoras);
      saida.set(alvo.area, bloco);
    }
    return { custo, saida };
  };

  const indices = alvos.map((_, i) => i);
  let melhor: { custo: number; saida: Map<string, string[]> } = {
    custo: Infinity,
    saida: new Map(),
  };
  const posicoesFolga = folga > 0 ? indices : [-1];

  if (alvos.length <= LIMITE_PERMUTACAO) {
    for (const ordem of permutacoes(indices)) {
      for (const f of posicoesFolga) {
        const r = avaliar(ordem, f);
        if (r.custo < melhor.custo) melhor = r;
      }
    }
    return melhor.saida;
  }

  // Muitas áreas: busca em feixe sobre a ordem dos blocos.
  let feixe: { custo: number; ordem: number[]; resto: number[] }[] = [
    { custo: 0, ordem: [], resto: indices },
  ];
  for (let passo = 0; passo < alvos.length; passo++) {
    const proximo: typeof feixe = [];
    for (const { custo, ordem, resto } of feixe) {
      for (const a of resto) {
        const i = ordem.reduce((s, x) => s + alvos[x].secoes, 0);
        const bloco = secoesOrdenadas.slice(i, i + alvos[a].secoes);
        if (bloco.length === 0) continue;
        const q = bloco.reduce((s, sec) => s + (pecas.get(sec) ?? 0), 0);
        proximo.push({
          custo: custo + custoBloco(bloco, q, alvos[a], ancoras),
          ordem: [...ordem, a],
          resto: resto.filter((x) => x !== a),
        });
      }
    }
    proximo.sort((x, y) => x.custo - y.custo);
    feixe = proximo.slice(0, LARGURA_BEAM);
  }
  if (feixe.length === 0) return new Map();
  for (const f of posicoesFolga) {
    const r = avaliar(feixe[0].ordem, f);
    if (r.custo < melhor.custo) melhor = r;
  }
  return melhor.saida;
}

/**
 * Constrói o mapa Seção → Área → Conferente.
 *
 * @param prodSecao linhas do PROD_SEÇÃO.xlsx
 * @param contagens todas as bipadas acumuladas dos arquivos .prc
 * @param secoesAuditoria seções de auditoria dirigida a excluir do mapa
 *                        (a seção 9999 do padrão DPSP não é área física)
 */
export function construirMapaAreas(
  prodSecao: ProdSecaoRow[],
  contagens: ContagemDetalhada[],
  secoesAuditoria: string[] = ['9999'],
): MapaAreas {
  const excluir = new Set(secoesAuditoria);
  const linhas = prodSecao.map((p) => ({ ...p, area: normalizarNomeArea(p.area) }));

  // Quem tem menos áreas primeiro: produz âncoras confiáveis para quem tem mais.
  // A matrícula desempata para o resultado ser reproduzível de uma execução para
  // outra — avaliação que muda sozinha entre duas rodadas não se defende.
  const matriculas = [...new Set(linhas.map((l) => l.matricula))].sort((a, b) => {
    const na = linhas.filter((l) => l.matricula === a).length;
    const nb = linhas.filter((l) => l.matricula === b).length;
    return na !== nb ? na - nb : a.localeCompare(b);
  });

  const secaoParaArea = new Map<string, string>();
  const secaoParaMatricula = new Map<string, string>();
  const ancoras = new Map<string, Set<number>>();
  const atribuicoes: AreaAtribuida[] = [];

  for (const matricula of matriculas) {
    const alvos = linhas.filter((l) => l.matricula === matricula);
    if (alvos.length === 0) continue;

    const pecas = pecasPorSecao(contagens, matricula);
    const secoes = [...pecas.keys()].filter((s) => !excluir.has(s)).sort();
    if (secoes.length === 0) continue;

    const areasComSecao = alvos.filter((a) => !excluir.has(String(a.secoes)));
    const resultado = resolverConferente(areasComSecao, secoes, pecas, ancoras);

    for (const alvo of alvos) {
      const lista = resultado.get(alvo.area) ?? [];
      const qtdApurada = lista.reduce((s, sec) => s + (pecas.get(sec) ?? 0), 0);
      const tolerancia = Math.max(
        TOLERANCIA_PECAS_ABS,
        TOLERANCIA_PECAS_PCT * Math.max(alvo.qtdC1, 1),
      );
      const conforme =
        lista.length === alvo.secoes &&
        Math.abs(qtdApurada - alvo.qtdC1) <= tolerancia;

      atribuicoes.push({
        area: alvo.area,
        matricula,
        nome: alvo.nome,
        secoes: lista,
        qtdDeclarada: alvo.qtdC1,
        qtdApurada: Math.round(qtdApurada),
        conforme,
      });

      if (!ancoras.has(alvo.area)) ancoras.set(alvo.area, new Set());
      for (const s of lista) {
        secaoParaArea.set(s, alvo.area);
        secaoParaMatricula.set(s, matricula);
        ancoras.get(alvo.area)!.add(parseInt(s, 10));
      }
    }
  }

  return {
    secaoParaArea,
    secaoParaMatricula,
    atribuicoes,
    naoConformes: atribuicoes.filter((a) => !a.conforme),
  };
}

/** Áreas de um conferente, da que teve mais peças para a que teve menos. */
export function areasDoConferente(
  mapa: MapaAreas,
  matricula: string,
): AreaAtribuida[] {
  return mapa.atribuicoes
    .filter((a) => a.matricula === matricula && a.secoes.length > 0)
    .sort((a, b) => b.qtdApurada - a.qtdApurada);
}
