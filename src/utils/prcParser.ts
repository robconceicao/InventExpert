import { ContagemDetalhada } from '../types';

/**
 * Parser de arquivos .prc / CNT do sistema de coleta (fixed-width, 83 chars).
 *
 * Layout confirmado contra 38.588 registros reais do inventário DPSP L2601
 * (1.035 arquivos em BKP/CNT, 06–07/08/2026):
 *
 * [00-05] Código evento          [43]    Flag de origem (' ', 'P' ou 'X')
 * [06-11] Código coletor         [44-58] Endereço: '0000000' + 'PI' + 6 dígitos
 * [12-17] Seq. sessão            [59-73] Código produto / EAN (15d, zero-padded)
 * [18-31] Data/hora YYYYMMDDHHMMSS
 * [32-42] Matrícula / CPF (11d)  [74-82] Quantidade (9d, 3 casas implícitas)
 *
 * Três correções em relação à v2.1, todas verificadas contra os relatórios do sistema:
 *
 * 1. SEÇÃO — o campo de endereço traz 6 dígitos após 'PI', mas a seção é
 *    formada pelos ÚLTIMOS 4. Conferido contra RELATORIOS/BLOCO.xls, que
 *    publica a seção de 4 dígitos ao lado do CPF e do EAN.
 *
 * 2. QUANTIDADE — o campo tem 9 dígitos com 3 casas decimais implícitas
 *    ('000014000' = 14). Ler 6 dígitos funcionava por acidente até 999 e
 *    truncava a partir de 1.000.
 *
 * 3. IS_BLOCO — não é a flag da posição 43. Bloco é toda bipada com
 *    quantidade maior que 1. Conferido contra RELATORIOS/BLOCO.xls:
 *    a regra `quantidade > 1` cobre 99,7% dos registros que o sistema
 *    classifica como bloco, contra 0,9% da regra antiga (flag === 'X').
 *    A coluna "Bloco" do RProInv_Produtividade conta bipadas em bloco,
 *    e a coluna "Contagem 1a1" conta bipadas de quantidade 1.
 *
 * Endereços fora do padrão (0,43% dos registros: 'PI0G0233', 'PI0022Z',
 * '000000000PI0003') vêm de digitação manual no coletor. São normalizados
 * pelos últimos 4 dígitos e sinalizados em `endereco_fora_padrao`.
 */

/** Endereço no formato esperado: 7 zeros + 'PI' + 6 dígitos. */
const ENDERECO_PADRAO = /^0{7}PI\d{6}$/;

/** Quantidade gravada com 3 casas decimais implícitas. */
const QUANTIDADE_ESCALA = 1000;

export interface PrcParseResult {
  contagens: ContagemDetalhada[];
  /** Linhas descartadas por tamanho, prefixo ou quantidade inválida. */
  linhasIgnoradas: number;
  /** Bipadas com endereço fora do padrão (digitação manual). */
  enderecosForaPadrao: number;
  /** Datas distintas encontradas — mais de uma indica relógio desconfigurado. */
  datasDistintas: string[];
}

/**
 * Extrai a seção de 4 dígitos do campo de endereço.
 * Tolera letras e dígitos extras vindos de digitação manual.
 */
export function extrairSecao(endereco: string): string {
  const aposPI = endereco.includes('PI')
    ? endereco.slice(endereco.indexOf('PI') + 2)
    : endereco;
  const digitos = aposPI.replace(/\D/g, '');
  if (!digitos) return '0000';
  return digitos.slice(-4).padStart(4, '0');
}

/** Parser completo, com diagnóstico da qualidade do arquivo. */
export function parsePrcFileDetalhado(conteudo: string): PrcParseResult {
  const linhas = conteudo.split(/\r?\n/);
  const contagens: ContagemDetalhada[] = [];
  const datas = new Set<string>();
  let linhasIgnoradas = 0;
  let enderecosForaPadrao = 0;

  for (const linha of linhas) {
    if (linha.length < 83) {
      if (linha.trim().length > 0) linhasIgnoradas++;
      continue;
    }

    // Variante de 84 chars: campo interno com 1 dígito a mais a partir da 44.
    const offset = linha.length >= 84 ? 1 : 0;

    // O prefixo 'PI' não fica sempre na mesma posição: endereço digitado à mão
    // desloca o campo em um ou dois caracteres ('00000000PI0022Z',
    // '000000000PI0003'). Exigir 'PI' numa posição fixa descartava justamente
    // as bipadas com problema de digitação — 0,2% do inventário L2601.
    const endereco = linha.substring(44 + offset, 59 + offset);
    if (!endereco.includes('PI')) {
      linhasIgnoradas++;
      continue;
    }
    const foraPadrao = !ENDERECO_PADRAO.test(endereco);
    if (foraPadrao) enderecosForaPadrao++;

    const quantidadeRaw = parseInt(linha.substring(74 + offset, 83 + offset), 10);
    if (isNaN(quantidadeRaw) || quantidadeRaw <= 0) {
      linhasIgnoradas++;
      continue;
    }
    const quantidade = quantidadeRaw / QUANTIDADE_ESCALA;

    const dataStr = linha.substring(18, 26);
    const horaStr = linha.substring(26, 32);
    datas.add(dataStr);

    contagens.push({
      matricula: linha.substring(32, 43).trim(),
      area_codigo: extrairSecao(endereco),
      area_nome: '',
      produto_codigo: linha.substring(59 + offset, 74 + offset).replace(/^0+/, '') || '0',
      produto_nome: '',
      produto_ean: '',
      produto_classe: '',
      quantidade,
      is_bloco: quantidade > 1,
      data_hora: parsePrcDateTime(dataStr, horaStr),
      endereco,
      endereco_fora_padrao: foraPadrao,
      flag_origem: linha.substring(43, 44),
    });
  }

  return {
    contagens,
    linhasIgnoradas,
    enderecosForaPadrao,
    datasDistintas: [...datas].sort(),
  };
}

/** Assinatura mantida por compatibilidade com telas e testes existentes. */
export function parsePrcFile(conteudo: string): ContagemDetalhada[] {
  return parsePrcFileDetalhado(conteudo).contagens;
}

/**
 * Acumula vários arquivos .prc preservando o diagnóstico agregado.
 * Nunca processar um arquivo só — o inventário é fatiado por coletor/sessão.
 */
export function parsePrcFiles(conteudos: string[]): PrcParseResult {
  const total: PrcParseResult = {
    contagens: [],
    linhasIgnoradas: 0,
    enderecosForaPadrao: 0,
    datasDistintas: [],
  };
  const datas = new Set<string>();

  for (const conteudo of conteudos) {
    const r = parsePrcFileDetalhado(conteudo);
    total.contagens.push(...r.contagens);
    total.linhasIgnoradas += r.linhasIgnoradas;
    total.enderecosForaPadrao += r.enderecosForaPadrao;
    r.datasDistintas.forEach((d) => datas.add(d));
  }
  total.datasDistintas = [...datas].sort();
  return total;
}

function parsePrcDateTime(data: string, hora: string): Date {
  return new Date(
    `${data.slice(0, 4)}-${data.slice(4, 6)}-${data.slice(6, 8)}` +
      `T${hora.slice(0, 2)}:${hora.slice(2, 4)}:${hora.slice(4, 6)}`,
  );
}

/**
 * Soma das janelas de trabalho por data, em horas.
 *
 * Quando o relógio do coletor está desconfigurado, as bipadas caem em datas
 * diferentes e a diferença entre a primeira e a última vira milhares de horas.
 * Somar as janelas de cada dia preserva o tempo real de contagem.
 */
export function horasPorJanelaDiaria(contagens: ContagemDetalhada[]): number {
  const porDia = new Map<string, { min: number; max: number }>();
  for (const c of contagens) {
    const t = c.data_hora.getTime();
    if (isNaN(t)) continue;
    const dia = c.data_hora.toISOString().slice(0, 10);
    const atual = porDia.get(dia);
    if (!atual) porDia.set(dia, { min: t, max: t });
    else {
      atual.min = Math.min(atual.min, t);
      atual.max = Math.max(atual.max, t);
    }
  }
  let ms = 0;
  for (const { min, max } of porDia.values()) ms += max - min;
  return ms / 3_600_000;
}

/**
 * Intervalos sem bipada acima de um limiar, dentro do mesmo dia.
 * Cruzamentos de data são ignorados: são artefato de relógio, não ociosidade.
 */
export function detectarOciosidade(
  contagens: ContagemDetalhada[],
  limiteMinutos = 15,
): { inicio: Date; fim: Date; minutos: number }[] {
  const ts = contagens
    .map((c) => c.data_hora)
    .filter((d) => !isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  const gaps: { inicio: Date; fim: Date; minutos: number }[] = [];
  for (let i = 1; i < ts.length; i++) {
    if (ts[i].toDateString() !== ts[i - 1].toDateString()) continue;
    const minutos = (ts[i].getTime() - ts[i - 1].getTime()) / 60000;
    if (minutos > limiteMinutos) {
      gaps.push({ inicio: ts[i - 1], fim: ts[i], minutos: Math.round(minutos) });
    }
  }
  return gaps;
}
