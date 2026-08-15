import { AVALIACAO_V3 } from '../config/inventoryEvalConfig';
import type { AvaliacaoV3 } from '../services/AvaliacaoV3Service';
import type { ModalidadeContratoCanonico } from '../types';
import { inventExpTextToHtml } from './inventExpReportHtml';

/**
 * Ficha individual do motor v3 — a que traz área física, erro localizado até o
 * produto e produtos não contados.
 *
 * Linguagem por modalidade
 * ------------------------
 * Quem presta serviço sem contrato não pode receber documento que sugira
 * subordinação. Três diferenças, além do vocabulário:
 *
 *   1. sem posição em ranking e sem comparação com a mediana da equipe —
 *      isso trata o resultado como desempenho dentro de um time;
 *   2. o capítulo de fechamento vira CONSTATAÇÕES, com as frases em forma de
 *      registro do que foi observado, nunca de instrução de como executar;
 *   3. nada de "colaborador", "funcionário", "medida disciplinar", "Código de
 *      Conduta", "convocação" ou menção à CLT.
 *
 * Para CLT e intermitente a ficha mantém o tom de orientação, que é o que faz
 * sentido em relação de emprego.
 *
 * `src/utils/__tests__/relatorioV3Modalidade.test.ts` trava os termos proibidos.
 */

export interface ContextoRelatorioV3 {
  operacao: string;
  dataInventario: string;
  loja?: string;
  capa?: string;
  posicao: number;
  totalConferentes: number;
  medianaEquipe: number;
}

const br = (n: number, casas = 1) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
const inteiro = (n: number) => n.toLocaleString('pt-BR');
const reais = (n: number) => `R$ ${br(n, 2)}`;

function tratamento(m: ModalidadeContratoCanonico): string {
  if (m === 'FREE') return 'PRESTADOR';
  if (m === 'INTERMITENTE') return 'COLABORADOR INTERMITENTE';
  return 'CONFERENTE';
}

/**
 * Frases de fechamento.
 *
 * A mesma constatação técnica é redigida de dois jeitos: como orientação para
 * quem tem vínculo, e como registro do observado para o prestador. A diferença
 * está no verbo — "reforce a conferência" instrui; "foi observada divergência"
 * relata.
 */
function fechamento(a: AvaliacaoV3, free: boolean, mediana: number): string[] {
  const frases: string[] = [];

  const trocaEan = a.naoContados.find(
    (n) => n.nivel === 'ALTA' && n.base.includes('troca de código'),
  );
  if (trocaEan) {
    frases.push(
      free
        ? `Registro de troca de código: ${trocaEan.descricao} não teve nenhuma leitura no inventário, e há sobra de mesma quantidade em produto da mesma linha, na área ${trocaEan.area}.`
        : `Conferir o código na tela do coletor antes de digitar a quantidade quando houver versões diferentes do mesmo produto lado a lado. Foi o que gerou o maior impacto individual deste inventário.`,
    );
  }

  const emBloco = a.divergencias.filter((d) => d.modo === 'BLOCO').length;
  if (a.unidadesEmErro > 50 && emBloco > 0) {
    frases.push(
      free
        ? `${a.unidadesEmErro} unidades em divergência, ${emBloco} delas em contagem por bloco, modo em que um engano multiplica a quantidade.`
        : `Reforçar a conferência em contagem por bloco: revisar a quantidade digitada antes de confirmar, sobretudo em caixas fechadas e itens de alto giro.`,
    );
  }

  if (!free && mediana > 0 && a.produtividade < mediana * 0.75) {
    frases.push(
      'Produtividade abaixo da mediana da equipe. Acompanhar em campo no próximo inventário para separar causa de método, equipamento ou complexidade da área.',
    );
  }

  const altaSemTroca = a.naoContados.filter(
    (n) => n.nivel === 'ALTA' && !n.base.includes('troca de código'),
  );
  if (altaSemTroca.length > 0) {
    const area = altaSemTroca[0].area;
    frases.push(
      free
        ? `Produtos sem contagem localizados em ${area}: ${altaSemTroca.map((n) => n.descricao).join(', ')}.`
        : `Produtos não contados em ${area} com alta probabilidade de estarem sob sua responsabilidade. Vale checar se a prateleira foi varrida por inteiro, incluindo fundo e reposição.`,
    );
  }

  if (a.itensEmDobro > 15) {
    frases.push(
      free
        ? `${a.itensEmDobro} leituras registradas em duplicidade.`
        : `Rever a marcação de endereço já contado para reduzir a rebipagem do mesmo ponto.`,
    );
  }

  if (a.ociosidadeMin > 30 && !free) {
    frases.push(
      `Ociosidade de ${a.ociosidadeMin} minutos em ${a.ociosidade.length} intervalo(s) acima de ${AVALIACAO_V3.limiteOciosidadeMin} min. Alinhar as pausas com a liderança.`,
    );
  }

  if (!a.relogioOk) {
    frases.push(
      free
        ? 'O coletor utilizado registrou data fora do período do inventário, o que impede a leitura de horário das contagens.'
        : 'Coletor com relógio desconfigurado. Ajustar data e hora no início do turno — sem isso não há rastreabilidade de horário.',
    );
  }

  if (frases.length === 0) {
    frases.push(
      free
        ? 'Serviço entregue dentro do padrão de qualidade esperado, sem ocorrências a registrar.'
        : 'Desempenho dentro do esperado em produtividade e acuracidade. Manter o padrão.',
    );
  }
  return frases;
}

export function gerarRelatorioV3Texto(
  a: AvaliacaoV3,
  ctx: ContextoRelatorioV3,
): string {
  const free = a.modalidade === 'FREE';
  let r = '';

  r += `# FICHA DE AVALIAÇÃO\n`;
  r += `## Inventário: ${ctx.dataInventario}\n`;
  if (ctx.loja) r += `## Loja: ${ctx.loja}${ctx.capa ? ` — Capa ${ctx.capa}` : ''}\n`;
  r += `## Operação: ${ctx.operacao}\n\n---\n\n`;

  r += `## ${tratamento(a.modalidade)}: ${a.nome}\n\n`;
  r += `Matrícula: ${a.matricula}\n`;
  r += `Nota: ${br(a.nota)} / 100 — ${a.faixa}\n`;
  // Ranking e comparação com a equipe ficam fora da ficha do prestador.
  if (!free) {
    r += `Posição: ${ctx.posicao}º de ${ctx.totalConferentes}\n`;
  }
  r += `\n---\n\n`;

  // --- áreas ---
  r += `## 📍 ÁREAS ATENDIDAS\n\n`;
  if (a.areas.length === 0) {
    r += `Não foi possível mapear as áreas a partir dos arquivos deste inventário.\n\n`;
  } else {
    for (const area of a.areas) {
      const pct = a.pecasContagem > 0 ? (area.qtdApurada / a.pecasContagem) * 100 : 0;
      r += `- ${area.area}: ${area.secoes.length} seção(ões), ${inteiro(area.qtdApurada)} peças (${br(pct)}%)\n`;
    }
    r += `\n`;
  }

  // --- números ---
  r += `## 📊 NÚMEROS DO INVENTÁRIO\n\n`;
  r += `- Peças contadas: ${inteiro(a.pecasContagem)}\n`;
  r += `- Seções atendidas: ${a.secoes}\n`;
  r += `- Horas de contagem: ${br(a.horasContagem, 2)} h\n`;
  r += `- Peças por hora: ${br(a.produtividade)}\n`;
  if (!free && ctx.medianaEquipe > 0) {
    const desvio = (a.produtividade / ctx.medianaEquipe - 1) * 100;
    r += `- Mediana da equipe: ${br(ctx.medianaEquipe)} (${desvio >= 0 ? '+' : '−'}${br(Math.abs(desvio))}%)\n`;
  }
  if (a.pecasAuditoria > 0) {
    r += `- Peças em auditoria dirigida: ${inteiro(a.pecasAuditoria)} (fora do cálculo de ritmo)\n`;
  }
  r += `\n`;

  // --- acuracidade ---
  r += `## 🎯 ACURACIDADE\n\n`;
  r += `- Itens auditados: ${inteiro(a.itensAuditados)}\n`;
  r += `- Itens com divergência: ${a.itensComErro}\n`;
  r += `- Unidades em divergência: ${a.unidadesEmErro}\n`;
  r += `- Acuracidade em unidades: ${br(a.acuracidadeUnidades, 3)}%\n`;
  r += `- Valor da 1ª contagem: ${reais(a.valorContado)}\n`;
  r += `- Valor ajustado: ${reais(a.valorAjustado)} (${br(a.pctErroValor, 3)}%)\n`;
  if (a.itensEmDobro > 0) r += `- Leituras em duplicidade: ${a.itensEmDobro}\n`;
  if (a.divergenciasControlados > 0) {
    r += `- Divergências em produto controlado: ${a.divergenciasControlados}\n`;
  }
  r += `\n`;

  // --- divergências ---
  r += `## 🔎 DIVERGÊNCIAS DE QUANTIDADE\n\n`;
  if (a.divergencias.length === 0) {
    r += `Nenhuma divergência registrada.\n\n`;
  } else {
    for (const d of a.divergencias) {
      const sinal = d.ajuste > 0 ? '+' : '';
      r += `- ${d.descricao} — ${d.area}, seção ${d.secao}\n`;
      r += `  contou ${br(d.qtdC1, 0)}, havia ${br(d.qtdFinal, 0)} (${sinal}${br(d.ajuste, 0)}) · ${d.tipo} · ${reais(d.valor)} · ${d.modo}\n`;
    }
    const total = a.divergencias.reduce((s, d) => s + d.valor, 0);
    r += `\nTotal: ${reais(total)}\n\n`;
  }

  // --- não contados ---
  const ncAlta = a.naoContados.filter((n) => n.nivel === 'ALTA');
  if (a.naoContados.length > 0) {
    r += `## 📦 PRODUTOS SEM CONTAGEM\n\n`;
    for (const n of a.naoContados) {
      const marca = n.nivel === 'ALTA' ? '' : ' (indicativo, não pesa na nota)';
      r += `- ${n.descricao} — ${n.area} · ${reais(n.valor)}${marca}\n`;
      r += `  ${n.base}\n`;
    }
    r += `\n`;
    if (ncAlta.length === 0) {
      r += `Nenhum destes itens tem localização confirmada; servem para dirigir recontagem.\n\n`;
    }
  }

  // --- nota ---
  r += `## 🧮 COMO A NOTA FOI CALCULADA\n\n`;
  const p = AVALIACAO_V3.pesos;
  r += `- Acuracidade em unidades (${p.acuracidade * 100}%): ${br(a.acuracidadeUnidades, 3)}\n`;
  r += free
    ? `- Índice de produtividade (${p.produtividade * 100}%): ${br(a.indiceProdutividade)}\n`
    : `- Índice de produtividade vs. equipe (${p.produtividade * 100}%): ${br(a.indiceProdutividade)}\n`;
  r += `- Valor (${p.valor * 100}%): ${br(100 - a.pctErroValor, 2)}\n`;
  r += `- Cobertura (${p.cobertura * 100}%): ${br(a.cobertura, 2)}\n`;
  if (a.penalidade > 0) r += `- Penalidades: −${br(a.penalidade)}\n`;
  r += `\n**Nota final: ${br(a.nota)} — ${a.faixa}**\n\n---\n\n`;

  // --- fechamento ---
  r += free ? `## 📌 CONSTATAÇÕES\n\n` : `## 📌 DIRECIONAMENTO\n\n`;
  for (const f of fechamento(a, free, ctx.medianaEquipe)) r += `• ${f}\n`;
  r += `\n---\n\n`;

  // --- rodapé ---
  if (free) {
    r += `Avaliação de qualidade referente à prestação de serviço\n`;
    r += `Evento: ${ctx.dataInventario} — Operação: ${ctx.operacao}\n`;
  } else if (a.modalidade === 'INTERMITENTE') {
    r += `Relatório de qualidade da convocação intermitente\n`;
    r += `Data: ${ctx.dataInventario}\n`;
  } else {
    r += `Relatório do módulo Avaliação — InventExpert\n`;
    r += `Data: ${ctx.dataInventario}\n`;
  }
  r += `\nDivergências atribuídas pelo cruzamento de seção e código de barras com as leituras\n`;
  r += `brutas dos coletores. A soma por pessoa reproduz o erro apurado pelo sistema.\n`;

  return r;
}

export function gerarRelatorioV3Html(
  a: AvaliacaoV3,
  ctx: ContextoRelatorioV3,
): string {
  return inventExpTextToHtml(
    gerarRelatorioV3Texto(a, ctx),
    `Avaliação — ${a.nome}`,
  );
}
