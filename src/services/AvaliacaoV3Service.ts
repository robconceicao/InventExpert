import { AVALIACAO_V3, FAIXAS_CLASSIFICACAO } from '../config/inventoryEvalConfig';
import {
  normalizeModalidade,
  type AuditoriaAgenteInfo,
  type ContagemDetalhada,
  type InventoryCheckerInput,
  type InventoryOperationType,
  type InventoryScoreLevel,
  type ModalidadeContratoCanonico,
} from '../types';
import { detectarOciosidade, horasPorJanelaDiaria } from '../utils/prcParser';
import { areasDoConferente, type AreaAtribuida, type MapaAreas } from './AreaMappingService';
import { contagensDoConferente, type DivergenciaAtribuida } from './ErroAtribuicaoService';
import { isLeaderExcluded } from './InventoryEvaluationService';
import {
  calcularCobertura,
  type NaoContadoAtribuido,
} from './NaoContadoService';

/**
 * Motor de avaliação v3 — quatro eixos, com área e não contados.
 *
 * O motor v2.1 (InventoryEvaluationService.evaluateChecker) continua sendo a
 * referência para as regras de bloco por área da farmácia e para a exclusão do
 * líder, e segue em uso. O v3 não o substitui: compõe a nota sobre eixos que o
 * v2.1 não tinha como medir, porque dependem de dados que só passaram a ser
 * cruzados a partir do mapa de áreas.
 *
 * Eixos:
 *   Acuracidade  35%  unidades em erro sobre peças contadas
 *   Produtividade 25%  peças/h contra a mediana da equipe
 *   Valor        25%  valor ajustado sobre valor contado
 *   Cobertura    15%  não contados de confiança ALTA sobre valor contado
 *
 * Penalidades: divergência em controlado e não contado de confiança ALTA.
 *
 * A auditoria dirigida sai do cálculo de produtividade. No inventário L2601 a
 * conferente que executou a auditoria aparecia em 11º lugar por ter as horas
 * da auditoria somadas à contagem; separando as duas atividades, subiu para 6º.
 */

export interface ContextoEquipe {
  /** Mediana de peças/h da equipe, base do índice de produtividade. */
  medianaProdutividade: number;
  mapa: MapaAreas;
  /** Datas válidas do inventário no formato YYYYMMDD. */
  datasValidas: Set<string>;
  /**
   * Índice de agentes (agentes.txt ou CadFun.txt), para casar o CPF gravado no
   * coletor com a matrícula do relatório. Sem ele, lojas que usam código ProInv
   * no coletor não cruzam com a produtividade.
   */
  agentes?: Map<string, AuditoriaAgenteInfo>;
}

export interface EntradaV3 extends InventoryCheckerInput {
  matricula: string;
  /** Vlr (C1) do RProInv_Produtividade. */
  valorContado: number;
  /** Vlr (AJST) do RProInv_Produtividade. */
  valorAjustado: number;
  /** Horas do relatório de produtividade (1ª à última coleta). */
  horas: number;
}

export interface AvaliacaoV3 {
  matricula: string;
  nome: string;
  /**
   * Vínculo do conferente. Define a linguagem do relatório individual: FREE
   * não recebe posição em ranking nem instrução de como executar o trabalho.
   */
  modalidade: ModalidadeContratoCanonico;

  areas: AreaAtribuida[];
  secoes: number;

  /** Peças da contagem regular, sem a auditoria dirigida. */
  pecasContagem: number;
  pecasAuditoria: number;
  horasContagem: number;
  ociosidadeMin: number;
  ociosidade: { inicio: Date; fim: Date; minutos: number }[];
  produtividade: number;

  itensAuditados: number;
  itensComErro: number;
  unidadesEmErro: number;
  acuracidadeUnidades: number;
  acuracidadeItens: number;

  valorContado: number;
  valorAjustado: number;
  pctErroValor: number;
  cobertura: number;

  divergencias: DivergenciaAtribuida[];
  naoContados: NaoContadoAtribuido[];
  naoContadosAlta: number;
  divergenciasControlados: number;

  indiceProdutividade: number;
  penalidade: number;
  nota: number;
  nivel: InventoryScoreLevel;
  faixa: string;

  /** Bipadas com data fora do intervalo do inventário. */
  relogioOk: boolean;
  enderecosForaPadrao: number;
  itensEmDobro: number;
}

function formatarData(d: Date): string {
  if (isNaN(d.getTime())) return '';
  return (
    `${d.getFullYear()}` +
    `${String(d.getMonth() + 1).padStart(2, '0')}` +
    `${String(d.getDate()).padStart(2, '0')}`
  );
}

/** Mediana de peças/h. Usar sempre a mediana, nunca a média: um conferente
 *  muito rápido ou muito lento desloca a média e distorce todo o ranking. */
export function medianaProdutividade(valores: number[]): number {
  if (valores.length === 0) return 0;
  const v = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(v.length / 2);
  return v.length % 2 ? v[meio] : (v[meio - 1] + v[meio]) / 2;
}

function classificar(nota: number): { nivel: InventoryScoreLevel; faixa: string } {
  if (nota >= FAIXAS_CLASSIFICACAO.EXCELENTE) return { nivel: 'EXCELENTE', faixa: 'Excelente' };
  if (nota >= FAIXAS_CLASSIFICACAO.BOM) return { nivel: 'BOM', faixa: 'Bom' };
  if (nota >= FAIXAS_CLASSIFICACAO.REGULAR) return { nivel: 'ATENCAO', faixa: 'Regular' };
  return { nivel: 'CRITICO', faixa: 'Requer treinamento' };
}

/**
 * Avalia um conferente no modelo v3.
 * Devolve `null` quando o conferente é líder — mesma regra do motor v2.1.
 */
export function avaliarConferenteV3(
  entrada: EntradaV3,
  _operationType: InventoryOperationType,
  contagens: ContagemDetalhada[],
  divergencias: DivergenciaAtribuida[],
  naoContados: NaoContadoAtribuido[],
  contexto: ContextoEquipe,
  itensAuditados: number,
  itensEmDobro = 0,
  leaderName?: string,
): AvaliacaoV3 | null {
  if (isLeaderExcluded(entrada, leaderName)) return null;

  const secoesAuditoria = new Set<string>(AVALIACAO_V3.secoesAuditoria);
  const minhas = contagensDoConferente(contagens, entrada.matricula, contexto.agentes);
  const regulares = minhas.filter((c) => !secoesAuditoria.has(c.area_codigo));
  const auditoria = minhas.filter((c) => secoesAuditoria.has(c.area_codigo));

  const pecasAuditoria = Math.round(
    auditoria.reduce((s, c) => s + c.quantidade, 0),
  );
  const pecasContagem = Math.max(entrada.qtde - pecasAuditoria, 0);

  // Com auditoria dirigida no meio do turno, as horas do relatório incluem a
  // auditoria. A janela real da contagem vem das bipadas, somada por dia para
  // não ser destruída por relógio de coletor fora de data.
  const horasContagem =
    pecasAuditoria > 0 ? horasPorJanelaDiaria(regulares) : entrada.horas;

  const ociosidade = detectarOciosidade(regulares, AVALIACAO_V3.limiteOciosidadeMin);
  const ociosidadeMin = ociosidade.reduce((s, g) => s + g.minutos, 0);

  const produtividade = horasContagem > 0 ? pecasContagem / horasContagem : 0;

  const minhasDiv = divergencias.filter((d) => d.matricula === entrada.matricula);
  const meusNC = naoContados.filter((n) => n.matricula === entrada.matricula);

  const unidadesEmErro = entrada.erro;
  const acuracidadeUnidades =
    entrada.qtde > 0 ? 100 * (1 - unidadesEmErro / entrada.qtde) : 0;
  const acuracidadeItens =
    itensAuditados > 0 ? 100 * (1 - minhasDiv.length / itensAuditados) : 0;

  const pctErroValor =
    entrada.valorContado > 0
      ? (entrada.valorAjustado / entrada.valorContado) * 100
      : 0;

  const cobertura = calcularCobertura(naoContados, entrada.matricula, entrada.valorContado);

  const referencia =
    AVALIACAO_V3.referenciaProdutividade === 'MEDIANA_EQUIPE'
      ? contexto.medianaProdutividade
      : contexto.medianaProdutividade;
  const indiceProdutividade =
    referencia > 0 ? Math.min(100, (produtividade / referencia) * 100) : 100;

  const controlados = minhasDiv.filter((d) => d.controlado).length;
  const alta = meusNC.filter((n) => n.nivel === 'ALTA');
  const penalidade =
    controlados * AVALIACAO_V3.penalidadeControlado +
    alta.reduce((s, n) => s + AVALIACAO_V3.penalidadeNaoContadoAlta * n.peso, 0);

  const { pesos } = AVALIACAO_V3;
  const bruto =
    pesos.acuracidade * acuracidadeUnidades +
    pesos.produtividade * indiceProdutividade +
    pesos.valor * (100 - pctErroValor) +
    pesos.cobertura * cobertura -
    penalidade;

  const nota = Math.round(Math.max(0, Math.min(100, bruto)) * 10) / 10;
  const { nivel, faixa } = classificar(nota);

  return {
    matricula: entrada.matricula,
    nome: entrada.nome,
    modalidade: normalizeModalidade(entrada.modalidadeContrato ?? entrada.modalidade),
    areas: areasDoConferente(contexto.mapa, entrada.matricula),
    secoes: new Set(regulares.map((c) => c.area_codigo)).size,
    pecasContagem,
    pecasAuditoria,
    horasContagem: Math.round(horasContagem * 100) / 100,
    ociosidadeMin,
    ociosidade,
    produtividade: Math.round(produtividade * 10) / 10,
    itensAuditados,
    itensComErro: minhasDiv.length,
    unidadesEmErro,
    acuracidadeUnidades: Math.round(acuracidadeUnidades * 1000) / 1000,
    acuracidadeItens: Math.round(acuracidadeItens * 100) / 100,
    valorContado: entrada.valorContado,
    valorAjustado: entrada.valorAjustado,
    pctErroValor: Math.round(pctErroValor * 1000) / 1000,
    cobertura: Math.round(cobertura * 1000) / 1000,
    divergencias: [...minhasDiv].sort((a, b) => b.valor - a.valor),
    naoContados: meusNC,
    naoContadosAlta: alta.length,
    divergenciasControlados: controlados,
    indiceProdutividade: Math.round(indiceProdutividade * 10) / 10,
    penalidade: Math.round(penalidade * 10) / 10,
    nota,
    nivel,
    faixa,
    relogioOk: minhas.every((c) => contexto.datasValidas.has(formatarData(c.data_hora))),
    enderecosForaPadrao: minhas.filter((c) => c.endereco_fora_padrao).length,
    itensEmDobro,
  };
}

/** Ordena o ranking: nota, depois menor erro em valor, depois produtividade. */
export function ordenarRankingV3(lista: AvaliacaoV3[]): AvaliacaoV3[] {
  return [...lista].sort((a, b) => {
    if (b.nota !== a.nota) return b.nota - a.nota;
    if (a.pctErroValor !== b.pctErroValor) return a.pctErroValor - b.pctErroValor;
    if (b.produtividade !== a.produtividade) return b.produtividade - a.produtividade;
    return a.nome.localeCompare(b.nome);
  });
}
