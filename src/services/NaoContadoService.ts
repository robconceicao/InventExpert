import type { ContagemDetalhada } from '../types';
import type { MapaAreas } from './AreaMappingService';
import type { AcuracidadeRow, DivergenciaAtribuida } from './ErroAtribuicaoService';

/**
 * Atribuição de produtos não contados a uma área e a um responsável provável.
 *
 * O problema
 * ----------
 * Nem o relatório NAO CONTADOS nem a folha de auditoria dirigida trazem a
 * seção — só EAN, descrição, departamento e valor. Sem seção não existe
 * vínculo direto com quem passou por ali.
 *
 * A saída
 * -------
 * Um produto fica na prateleira ao lado dos seus semelhantes. Localizar onde
 * produtos da MESMA MARCA foram contados aponta a área e o conferente.
 *
 * Três níveis de confiança, e só o primeiro pesa na nota:
 *
 *   ALTA  — troca de EAN comprovada (existe sobra de produto da mesma linha,
 *           na mesma quantidade), ou marca com 3+ itens contados e um único
 *           conferente concentrando 70% ou mais.
 *   MÉDIA — marca localizada, mas com poucos itens de referência ou
 *           responsável dividido. Serve para dirigir recontagem.
 *   BAIXA — nenhum item da marca foi contado; só a família aponta a área.
 *
 * Caso que originou a regra ALTA por troca de EAN, no inventário DPSP L2601:
 * COLIDIS 10ML teve 14 unidades não contadas (R$ 1.562,26) e nenhuma bipada no
 * inventário inteiro. Na mesma área, uma única bipada de COLIDIS 5ML registrou
 * 16 unidades onde havia 2. Uma bipada com o código errado produziu ao mesmo
 * tempo a sobra e o não contado.
 */

export type NivelConfianca = 'ALTA' | 'MEDIA' | 'BAIXA';
export type SituacaoNaoContado = 'RECUPERADO' | 'NAO_ENCONTRADO';

/** Produto sem contagem, vindo do NAO CONTADOS ou da auditoria dirigida. */
export interface NaoContadoInput {
  descricao: string;
  eans: string[];
  situacao: SituacaoNaoContado;
  /** Unidades recuperadas na auditoria; ausente quando nunca foi encontrado. */
  quantidade?: number;
  /** Valor em sistema (não encontrado) ou recuperado (auditoria). */
  valor: number;
  /** Código do departamento, quando disponível. */
  departamento?: string;
  familia?: string;
}

export interface NaoContadoAtribuido extends NaoContadoInput {
  nivel: NivelConfianca | null;
  area: string;
  matricula: string | null;
  /** Frase curta que sustenta a atribuição, para o relatório e a conversa. */
  base: string;
  secoesReferencia: string[];
  /** Peso na nota: 1 para não encontrado, 0,5 para recuperado, 0 fora de ALTA. */
  peso: number;
}

export interface OpcoesNaoContado {
  /** EAN → nome da família do produto (BKP/CadProd). */
  familiaPorEan?: Map<string, string>;
  secoesAuditoria?: string[];
  /** Mínimo de itens da marca para sustentar confiança ALTA. */
  minItensAlta?: number;
  /** Concentração mínima em um conferente para confiança ALTA. */
  concentracaoAlta?: number;
}

const MIN_ITENS_ALTA = 3;
const CONCENTRACAO_ALTA = 0.7;
const TAMANHO_MINIMO_TOKEN = 4;

/** Tokens úteis da descrição: marca e linha, ignorando números e medidas. */
export function tokensDescricao(desc: string): string[] {
  return desc
    .toUpperCase()
    .split(/[\s./,;-]+/)
    .filter((t) => t.length >= TAMANHO_MINIMO_TOKEN && !/^\d+$/.test(t));
}

function maisFrequente<T>(c: Map<T, number>): [T, number] | null {
  let melhor: [T, number] | null = null;
  for (const par of c) if (!melhor || par[1] > melhor[1]) melhor = par;
  return melhor;
}

function contar<T>(itens: T[]): Map<T, number> {
  const m = new Map<T, number>();
  for (const i of itens) m.set(i, (m.get(i) ?? 0) + 1);
  return m;
}

/**
 * Procura uma troca de código: sobra de produto da mesma marca, na mesma
 * quantidade que o não contado. É a evidência mais forte disponível.
 */
function detectarTrocaEan(
  item: NaoContadoInput,
  divergencias: DivergenciaAtribuida[],
): DivergenciaAtribuida | null {
  const marca = tokensDescricao(item.descricao)[0];
  if (!marca || item.quantidade === undefined) return null;

  for (const d of divergencias) {
    if (d.tipo !== 'SOBRA') continue;
    if (item.eans.includes(d.ean)) continue;
    if (!d.descricao.toUpperCase().startsWith(marca)) continue;
    if (Math.abs(Math.abs(d.ajuste) - item.quantidade) < 0.01) return d;
  }
  return null;
}

export function atribuirNaoContados(
  itens: NaoContadoInput[],
  acuracidade: AcuracidadeRow[],
  contagens: ContagemDetalhada[],
  mapa: MapaAreas,
  divergencias: DivergenciaAtribuida[],
  opcoes: OpcoesNaoContado = {},
): NaoContadoAtribuido[] {
  const excluir = new Set(opcoes.secoesAuditoria ?? ['9999']);
  const minItens = opcoes.minItensAlta ?? MIN_ITENS_ALTA;
  const concentracao = opcoes.concentracaoAlta ?? CONCENTRACAO_ALTA;

  const contados = acuracidade
    .filter((a) => !excluir.has(a.secao))
    .map((a) => ({ secao: a.secao, desc: a.descricao.toUpperCase() }));

  // família → seções onde produtos daquela família foram bipados
  const familiaSecoes = new Map<string, Map<string, number>>();
  if (opcoes.familiaPorEan) {
    for (const c of contagens) {
      if (excluir.has(c.area_codigo)) continue;
      const f = opcoes.familiaPorEan.get(c.produto_ean || c.produto_codigo);
      if (!f) continue;
      if (!familiaSecoes.has(f)) familiaSecoes.set(f, new Map());
      const m = familiaSecoes.get(f)!;
      m.set(c.area_codigo, (m.get(c.area_codigo) ?? 0) + 1);
    }
  }

  const resolverPorSecoes = (secoes: Map<string, number>) => {
    const areas = new Map<string, number>();
    const mats = new Map<string, number>();
    for (const [sec, n] of secoes) {
      const a = mapa.secaoParaArea.get(sec);
      if (a) areas.set(a, (areas.get(a) ?? 0) + n);
      const m = mapa.secaoParaMatricula.get(sec);
      if (m) mats.set(m, (mats.get(m) ?? 0) + n);
    }
    const totalMat = [...mats.values()].reduce((s, v) => s + v, 0);
    const topArea = maisFrequente(areas);
    const topMat = maisFrequente(mats);
    return {
      area: topArea?.[0] ?? '—',
      matricula: topMat?.[0] ?? null,
      concentracao: topMat && totalMat > 0 ? topMat[1] / totalMat : 0,
      secoes: [...secoes.keys()].slice(0, 4),
    };
  };

  const saida: NaoContadoAtribuido[] = [];

  for (const item of itens) {
    const pesoBase = item.situacao === 'RECUPERADO' ? 0.5 : 1;

    // 1) troca de EAN comprovada
    const troca = detectarTrocaEan(item, divergencias);
    if (troca) {
      saida.push({
        ...item,
        nivel: 'ALTA',
        area: troca.area,
        matricula: troca.matricula,
        base:
          `troca de código: sobra de ${Math.abs(troca.ajuste)} un de ` +
          `${troca.descricao} na seção ${troca.secao}`,
        secoesReferencia: [troca.secao],
        peso: pesoBase,
      });
      continue;
    }

    // 2) marca: prefixo de dois tokens, depois de um
    const tk = tokensDescricao(item.descricao);
    let resolvido: NaoContadoAtribuido | null = null;

    for (const profundidade of [2, 1]) {
      if (tk.length < profundidade) continue;
      const prefixo = tk.slice(0, profundidade).join(' ');
      const hits = contados.filter((c) => c.desc.startsWith(prefixo));
      if (hits.length === 0) continue;

      const r = resolverPorSecoes(contar(hits.map((h) => h.secao)));
      const alta = hits.length >= minItens && r.concentracao >= concentracao;
      resolvido = {
        ...item,
        nivel: alta ? 'ALTA' : 'MEDIA',
        area: r.area,
        matricula: r.matricula,
        base: `marca "${prefixo}" · ${hits.length} ${hits.length === 1 ? 'item contado' : 'itens contados'}`,
        secoesReferencia: r.secoes,
        peso: alta ? pesoBase : 0,
      };
      if (alta || hits.length >= minItens) break;
    }
    if (resolvido) {
      saida.push(resolvido);
      continue;
    }

    // 3) família do produto
    let porFamilia: NaoContadoAtribuido | null = null;
    for (const ean of item.eans) {
      const f = opcoes.familiaPorEan?.get(ean);
      const secoes = f ? familiaSecoes.get(f) : undefined;
      if (!f || !secoes) continue;
      const r = resolverPorSecoes(secoes);
      porFamilia = {
        ...item,
        nivel: 'BAIXA',
        area: r.area,
        matricula: r.matricula,
        base: `família "${f}"`,
        secoesReferencia: r.secoes,
        peso: 0,
      };
      break;
    }

    saida.push(
      porFamilia ?? {
        ...item,
        nivel: null,
        area: '—',
        matricula: null,
        base: 'sem produto da mesma marca ou família contado — não atribuível',
        secoesReferencia: [],
        peso: 0,
      },
    );
  }

  return saida;
}

/**
 * Cobertura de um conferente: 100 menos a fatia do valor contado que ficou de
 * fora por não contados de confiança ALTA. Recuperado na auditoria entra com
 * metade do peso — a falha de contagem foi a mesma, o prejuízo não.
 */
export function calcularCobertura(
  naoContados: NaoContadoAtribuido[],
  matricula: string,
  valorContado: number,
): number {
  if (valorContado <= 0) return 100;
  const perdido = naoContados
    .filter((n) => n.matricula === matricula && n.nivel === 'ALTA')
    .reduce((s, n) => s + n.valor * n.peso, 0);
  return 100 * (1 - Math.min(perdido / valorContado, 1));
}

export function naoContadosPorConferente(
  naoContados: NaoContadoAtribuido[],
): Map<string, NaoContadoAtribuido[]> {
  const m = new Map<string, NaoContadoAtribuido[]>();
  for (const n of naoContados) {
    if (!n.matricula) continue;
    const lista = m.get(n.matricula);
    if (lista) lista.push(n);
    else m.set(n.matricula, [n]);
  }
  for (const lista of m.values()) lista.sort((a, b) => b.valor - a.valor);
  return m;
}
