import type { AuditoriaAgenteInfo, ContagemDetalhada } from '../types';
import type { MapaAreas } from './AreaMappingService';

/**
 * Atribuição de divergências de quantidade ao conferente que as cometeu.
 *
 * O relatório ACURACIDADE informa, por SEÇÃO + EAN, a quantidade da 1ª contagem,
 * as auditorias A1/A2/A3, a quantidade final e o ajuste. O que ele não informa
 * é quem contou. As bipadas brutas do .prc informam: cada linha carrega a
 * matrícula de quem bipou, a seção e o EAN.
 *
 * O par SEÇÃO + EAN é a chave que liga os dois. No inventário DPSP L2601 as
 * 56 divergências apontaram, cada uma, um único conferente — nenhuma exigiu
 * rateio. A soma por pessoa reproduziu exatamente a coluna Erro (Qtde) do
 * relatório de produtividade do sistema, e o valor calculado item a item pelo
 * custo de cadastro reproduziu Vlr(AJST) até o centavo.
 *
 * Quando o par apontar mais de um conferente, o serviço marca a divergência
 * como compartilhada e devolve todos os candidatos. Regra da casa: nunca
 * atribuir por chute — divergência sem dono é declarada como tal.
 */

/** Linha do RELATORIOS/ACURACIDADE.xls. */
export interface AcuracidadeRow {
  secao: string;
  ean: string;
  descricao: string;
  qtdC1: number;
  qtdA1: number;
  qtdA2: number;
  qtdA3: number;
  qtdFinal: number;
  /** AJST(QTD): positivo = contou a menos; negativo = contou a mais. */
  ajuste: number;
}

export type TipoDivergencia = 'FALTA' | 'SOBRA';
export type ModoContagem = 'BLOCO' | '1a1';

export interface DivergenciaAtribuida {
  secao: string;
  area: string;
  ean: string;
  descricao: string;
  qtdC1: number;
  qtdFinal: number;
  ajuste: number;
  tipo: TipoDivergencia;
  modo: ModoContagem;
  /** Custo unitário do cadastro; 0 quando o produto não foi localizado. */
  custoUnitario: number;
  /** |ajuste| × custo unitário. */
  valor: number;
  controlado: boolean;
  matricula: string;
  /** Hora da primeira bipada do par; null se o relógio do coletor estava errado. */
  hora: Date | null;
  /** true quando o par SEÇÃO+EAN foi bipado por mais de um conferente. */
  compartilhada: boolean;
  candidatos: string[];
}

export interface ResultadoAtribuicao {
  divergencias: DivergenciaAtribuida[];
  /** Divergências sem nenhuma bipada correspondente — não atribuíveis. */
  orfas: AcuracidadeRow[];
  /** Itens auditados por matrícula, base do denominador da acuracidade. */
  auditadosPorMatricula: Map<string, number>;
}

export interface OpcoesAtribuicao {
  /** EAN → custo unitário (BKP/CadProd). */
  custoPorEan?: Map<string, number>;
  /** EANs de medicamentos controlados (RELATORIOS/CONTROLADOS.xls). */
  eansControlados?: Set<string>;
  /** Datas válidas do inventário (YYYYMMDD) para validar o relógio. */
  datasValidas?: Set<string>;
  /** Seções de auditoria dirigida, excluídas da atribuição. */
  secoesAuditoria?: string[];
}

function chave(secao: string, ean: string): string {
  return `${secao}|${normalizarEan(ean)}`;
}

/** Remove tudo que não é dígito e os zeros à esquerda. */
export function normalizarEan(ean: string): string {
  return (ean || '').replace(/\D/g, '').replace(/^0+/, '');
}

/**
 * Indexa por seção e EAN normalizado. Cada bipada entra sob o código de barras
 * e sob o código interno, porque o `.prc` grava ora um, ora outro, conforme o
 * que o coletor leu — e o ACURACIDADE publica só o código de barras.
 */
function indexarContagens(
  contagens: ContagemDetalhada[],
  excluir: Set<string>,
): Map<string, ContagemDetalhada[]> {
  const idx = new Map<string, ContagemDetalhada[]>();
  for (const c of contagens) {
    if (excluir.has(c.area_codigo)) continue;
    const codigos = new Set(
      [c.produto_ean, c.produto_codigo].map(normalizarEan).filter(Boolean),
    );
    for (const codigo of codigos) {
      const k = chave(c.area_codigo, codigo);
      const lista = idx.get(k);
      if (lista) {
        if (!lista.includes(c)) lista.push(c);
      } else idx.set(k, [c]);
    }
  }
  return idx;
}

/**
 * Busca as bipadas de um par seção + EAN, com fallback por sufixo.
 *
 * Regra herdada do módulo de Auditoria (`bipMatchesEan`): quando os dois
 * códigos têm 8 dígitos ou mais e um termina com o outro, é o mesmo produto.
 * Cobre o prefixo que o arquivo final acrescenta e a diferença entre EAN-13 e
 * EAN-14. O piso de 8 dígitos evita casar produtos distintos por acaso.
 */
function buscarBipadas(
  idx: Map<string, ContagemDetalhada[]>,
  secao: string,
  ean: string,
): ContagemDetalhada[] | undefined {
  const direto = idx.get(chave(secao, ean));
  if (direto) return direto;

  const alvo = normalizarEan(ean);
  if (alvo.length < 8) return undefined;

  const prefixo = `${secao}|`;
  for (const [k, lista] of idx) {
    if (!k.startsWith(prefixo)) continue;
    const codigo = k.slice(prefixo.length);
    if (codigo.length < 8) continue;
    if (alvo.endsWith(codigo) || codigo.endsWith(alvo)) return lista;
  }
  return undefined;
}

/**
 * Busca o custo unitário tolerando variação de zeros à esquerda entre o EAN
 * do ACURACIDADE (15 dígitos) e o do cadastro.
 */
function buscarCusto(ean: string, tabela?: Map<string, number>): number {
  if (!tabela) return 0;
  const variantes = [ean, ean.replace(/^0+/, ''), `0${ean}`, ean.slice(1)];
  for (const v of variantes) {
    const c = tabela.get(v);
    if (c !== undefined) return c;
  }
  return 0;
}

export function atribuirDivergencias(
  acuracidade: AcuracidadeRow[],
  contagens: ContagemDetalhada[],
  mapa: MapaAreas,
  opcoes: OpcoesAtribuicao = {},
): ResultadoAtribuicao {
  const excluir = new Set(opcoes.secoesAuditoria ?? ['9999']);
  const idx = indexarContagens(contagens, excluir);

  const divergencias: DivergenciaAtribuida[] = [];
  const orfas: AcuracidadeRow[] = [];
  const auditadosPorMatricula = new Map<string, number>();

  for (const linha of acuracidade) {
    const bipadas = buscarBipadas(idx, linha.secao, linha.ean);
    if (!bipadas || bipadas.length === 0) {
      if (linha.ajuste !== 0) orfas.push(linha);
      continue;
    }

    const candidatos = [...new Set(bipadas.map((b) => b.matricula))];
    const dono = candidatos[0];
    auditadosPorMatricula.set(dono, (auditadosPorMatricula.get(dono) ?? 0) + 1);

    if (linha.ajuste === 0) continue;

    const primeira = [...bipadas].sort(
      (a, b) => a.data_hora.getTime() - b.data_hora.getTime(),
    )[0];

    const relogioOk =
      !opcoes.datasValidas ||
      opcoes.datasValidas.has(formatarData(primeira.data_hora));

    const custo = buscarCusto(linha.ean, opcoes.custoPorEan);

    divergencias.push({
      secao: linha.secao,
      area: mapa.secaoParaArea.get(linha.secao) ?? '—',
      ean: linha.ean,
      descricao: linha.descricao,
      qtdC1: linha.qtdC1,
      qtdFinal: linha.qtdFinal,
      ajuste: linha.ajuste,
      tipo: linha.ajuste > 0 ? 'FALTA' : 'SOBRA',
      modo: primeira.is_bloco ? 'BLOCO' : '1a1',
      custoUnitario: custo,
      valor: Math.abs(linha.ajuste) * custo,
      controlado: opcoes.eansControlados?.has(linha.ean) ?? false,
      matricula: dono,
      hora: relogioOk ? primeira.data_hora : null,
      compartilhada: candidatos.length > 1,
      candidatos,
    });
  }

  return { divergencias, orfas, auditadosPorMatricula };
}

/**
 * Resolve a identidade do conferente entre as três formas que circulam:
 * CPF gravado no coletor, código ProInv de 6 dígitos e matrícula do relatório.
 *
 * Usa o índice construído por `buildAgentesIndex` (agentes.txt ou CadFun.txt).
 * Sem esse índice, o cruzamento entre o `.prc` e o relatório de produtividade
 * falha silenciosamente sempre que a loja usa código no lugar de CPF.
 */
export function resolverIdentidades(
  matricula: string,
  agentes?: Map<string, AuditoriaAgenteInfo>,
): Set<string> {
  const ids = new Set<string>();
  const bruto = (matricula || '').trim();
  const digitos = bruto.replace(/\D/g, '');
  if (bruto) ids.add(bruto);
  if (digitos) ids.add(digitos);

  const info = agentes?.get(digitos) ?? agentes?.get(bruto);
  if (info) {
    for (const v of [info.cpf, info.codigo]) {
      const d = (v || '').replace(/\D/g, '');
      if (v) ids.add(v);
      if (d) ids.add(d);
    }
  }
  return ids;
}

/** Contagens de um conferente, aceitando qualquer forma da identidade dele. */
export function contagensDoConferente(
  contagens: ContagemDetalhada[],
  matricula: string,
  agentes?: Map<string, AuditoriaAgenteInfo>,
): ContagemDetalhada[] {
  const ids = resolverIdentidades(matricula, agentes);
  return contagens.filter((c) => {
    const m = (c.matricula || '').trim();
    return ids.has(m) || ids.has(m.replace(/\D/g, ''));
  });
}

function formatarData(d: Date): string {
  if (isNaN(d.getTime())) return '';
  return (
    `${d.getFullYear()}` +
    `${String(d.getMonth() + 1).padStart(2, '0')}` +
    `${String(d.getDate()).padStart(2, '0')}`
  );
}

/** Agrupa as divergências por conferente, da mais cara para a mais barata. */
export function divergenciasPorConferente(
  resultado: ResultadoAtribuicao,
): Map<string, DivergenciaAtribuida[]> {
  const m = new Map<string, DivergenciaAtribuida[]>();
  for (const d of resultado.divergencias) {
    const lista = m.get(d.matricula);
    if (lista) lista.push(d);
    else m.set(d.matricula, [d]);
  }
  for (const lista of m.values()) lista.sort((a, b) => b.valor - a.valor);
  return m;
}

/**
 * Confere se a soma dos ajustes atribuídos bate com a coluna Erro (Qtde) do
 * relatório de produtividade. Divergência aqui significa que a cadeia de
 * atribuição quebrou — nunca publicar a avaliação sem esta checagem.
 */
export function conferirReconciliacao(
  resultado: ResultadoAtribuicao,
  erroPorMatricula: Map<string, number>,
): { matricula: string; esperado: number; apurado: number }[] {
  const apurado = new Map<string, number>();
  for (const d of resultado.divergencias) {
    apurado.set(d.matricula, (apurado.get(d.matricula) ?? 0) + Math.abs(d.ajuste));
  }
  const falhas: { matricula: string; esperado: number; apurado: number }[] = [];
  for (const [matricula, esperado] of erroPorMatricula) {
    const a = apurado.get(matricula) ?? 0;
    if (Math.abs(a - esperado) > 0.01) {
      falhas.push({ matricula, esperado, apurado: a });
    }
  }
  return falhas;
}

// ---------------------------------------------------------------------------
// DOBRO e BLOCO — indicadores e conferência independente
// ---------------------------------------------------------------------------

/** Item coletado em duplicidade, no formato do relatório DOBRO. */
export interface DobroLinha {
  secao: string;
  ean: string;
}

/**
 * Conta, por conferente, quantas bipadas em duplicidade o sistema registrou.
 *
 * Não é erro de quantidade — o sistema consolida a duplicidade antes de fechar
 * o inventário. É indicador de método: volume alto significa que a pessoa
 * rebipou o mesmo endereço, sinal de que a marcação do que já foi contado não
 * está funcionando.
 */
export function contarDobroPorConferente(
  dobro: DobroLinha[],
  contagens: ContagemDetalhada[],
  secoesAuditoria: string[] = ['9999'],
): Map<string, number> {
  const idx = indexarContagens(contagens, new Set(secoesAuditoria));
  const contagem = new Map<string, number>();
  for (const d of dobro) {
    const bipadas = buscarBipadas(idx, d.secao, d.ean);
    if (!bipadas || bipadas.length === 0) continue;
    const dono = bipadas[0].matricula;
    contagem.set(dono, (contagem.get(dono) ?? 0) + 1);
  }
  return contagem;
}

/** Linha do BLOCO.xls: seção, CPF e código coletado na mesma linha. */
export interface BlocoLinha {
  secao: string;
  cpf: string;
  ean: string;
}

export interface ConferenciaBloco {
  /** Trios (seção, CPF, EAN) distintos no relatório. */
  totalRelatorio: number;
  /** Quantos foram encontrados nas bipadas com quantidade maior que 1. */
  casados: number;
  /** Quantos existem no `.prc` mas com quantidade 1 — contradizem a regra. */
  comQuantidadeUm: number;
  /** Quantos não têm bipada correspondente em nenhuma quantidade. */
  semBipada: number;
  /** Percentual de cobertura da regra `is_bloco = quantidade > 1`. */
  coberturaPct: number;
  /** CPF do relatório diferente do CPF da bipada, no mesmo par seção+EAN. */
  cpfDivergente: number;
}

/**
 * Confere o decodificador de seção e a regra de bloco contra o relatório do
 * próprio sistema.
 *
 * O BLOCO.xls é a única fonte que publica seção de 4 dígitos, CPF e código
 * coletado juntos. Se a seção extraída do `.prc` estivesse errada, ou se bloco
 * não fosse quantidade maior que 1, a cobertura despencaria — foi assim que a
 * regra antiga (flag `X`) se revelou: cobria 0,9% do relatório.
 *
 * Rodar isto a cada inventário é barato e detecta mudança de layout do coletor
 * antes que ela contamine uma avaliação inteira.
 */
export function conferirBloco(
  bloco: BlocoLinha[],
  contagens: ContagemDetalhada[],
): ConferenciaBloco {
  const idx = indexarContagens(contagens, new Set());

  const trios = new Map<string, BlocoLinha>();
  for (const b of bloco) {
    trios.set(`${b.secao}|${normalizarEan(b.ean)}|${b.cpf}`, b);
  }

  let casados = 0;
  let comQuantidadeUm = 0;
  let semBipada = 0;
  let cpfDivergente = 0;

  for (const b of trios.values()) {
    const bipadas = buscarBipadas(idx, b.secao, b.ean);
    if (!bipadas || bipadas.length === 0) {
      semBipada++;
      continue;
    }
    if (bipadas.some((x) => x.is_bloco)) casados++;
    else comQuantidadeUm++;

    const cpfs = new Set(bipadas.map((x) => x.matricula.replace(/\D/g, '')));
    if (!cpfs.has(b.cpf.replace(/\D/g, ''))) cpfDivergente++;
  }

  const total = trios.size;
  return {
    totalRelatorio: total,
    casados,
    comQuantidadeUm,
    semBipada,
    coberturaPct: total > 0 ? Math.round((casados / total) * 1000) / 10 : 0,
    cpfDivergente,
  };
}
