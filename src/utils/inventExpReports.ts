import { INVENTORY_PROFILES } from "../config/inventoryEvalConfig";
import type {
    InventoryCheckerEvaluation,
    InventoryOperationType,
    PerfilComportamental,
    SectionAccuracyRecord,
} from "../types";
import { getDistribuicaoPerfilComportamental } from "../services/InventoryEvaluationService";


// =============================================================================
// RELATÓRIO GERENCIAL
// =============================================================================

export function generateInventExpGerencialReportText(
  operationType: InventoryOperationType,
  evaluations: InventoryCheckerEvaluation[],
  resumo: {
    totalConferentes: number;
    totalItens: number;
    taxaMediaErro: number;
    produtividadeMedia: number;
    scoreMedio: number;
  },
  dataInventario?: string,
  sectionAccuracy?: SectionAccuracyRecord[],
): string {
  const data = dataInventario ?? new Date().toLocaleDateString("pt-BR");
  const perfil = INVENTORY_PROFILES[operationType];
  const top5 = evaluations.slice(0, 5);
  const bottom5 = evaluations.slice(-5).reverse();

  const risco = evaluations.filter(
    (e) =>
      e.nivel === "CRITICO" ||
      e.tags.includes("🚨 Risco de Contagem Superficial"),
  );

  // Verifica se há dados de perfil comportamental disponíveis
  const temDadosComportamentais = evaluations.some(
    e => e.perfilComportamental !== undefined,
  );

  let r = "";
  r += `# RELATÓRIO GERENCIAL - Avaliação\n`;
  r += `## Operação: ${operationType}\n`;
  r += `## Data: ${data}\n\n`;
  r += `---\n\n`;

  r += `## 1. RESUMO EXECUTIVO\n\n`;
  r += `| Indicador | Valor |\n`;
  r += `|-----------|-------|\n`;
  r += `| Total de conferentes | ${resumo.totalConferentes} |\n`;
  r += `| Total de itens contados | ${resumo.totalItens} |\n`;
  r += `| Taxa média de erro | ${resumo.taxaMediaErro}% |\n`;
  r += `| Produtividade média | ${resumo.produtividadeMedia} itens/h |\n`;
  r += `| Score médio | ${resumo.scoreMedio} |\n`;
  r += `| Meta de produtividade | ${perfil.targets.productivity} itens/h |\n`;
  r += `| Limite de bloco | ${perfil.targets.maxBlockLimit}% |\n`;
  r += `\n`;

  // Distribuição de níveis de performance
  const distNiveis = {
    EXCELENTE: evaluations.filter(e => e.nivel === "EXCELENTE").length,
    BOM:       evaluations.filter(e => e.nivel === "BOM").length,
    ATENCAO:   evaluations.filter(e => e.nivel === "ATENCAO").length,
    CRITICO:   evaluations.filter(e => e.nivel === "CRITICO").length,
  };
  r += `### Distribuição de Performance\n`;
  r += `| Nível | Conferentes | % do time |\n`;
  r += `|-------|-------------|-----------|\n`;
  r += `| ✅ EXCELENTE | ${distNiveis.EXCELENTE} | ${Math.round(distNiveis.EXCELENTE/resumo.totalConferentes*100)}% |\n`;
  r += `| 🔵 BOM | ${distNiveis.BOM} | ${Math.round(distNiveis.BOM/resumo.totalConferentes*100)}% |\n`;
  r += `| 🟠 ATENÇÃO | ${distNiveis.ATENCAO} | ${Math.round(distNiveis.ATENCAO/resumo.totalConferentes*100)}% |\n`;
  r += `| 🔴 CRÍTICO | ${distNiveis.CRITICO} | ${Math.round(distNiveis.CRITICO/resumo.totalConferentes*100)}% |\n`;
  r += `\n---\n\n`;

  // Distribuição de perfil comportamental (somente quando tags estendidos disponíveis)
  if (temDadosComportamentais) {
    const distPerfil = getDistribuicaoPerfilComportamental(evaluations);
    r += `## 2. RAIO-X COMPORTAMENTAL DA EQUIPE\n\n`;
    r += `> Análise derivada da planilha produtividade_tag (separação de sinais do Qtd(A1)).\n`;
    r += `> Qtd(A1) > 0 = produto pulado (omissão) | Qtd(A1) < 0 = produto duplicado (excesso)\n\n`;
    r += `| Perfil | Conferentes | Significado |\n`;
    r += `|--------|-------------|-------------|\n`;
    r += `| 🚨 PULA ITENS | ${distPerfil.PULA_ITENS} | Alto índice de omissão — gera perda financeira invisível |\n`;
    r += `| 🔄 FANTASMA | ${distPerfil.FANTASMA} | Alto índice de duplicação — capturado pela auditoria |\n`;
    r += `| ⚠️ DESATENTO GERAL | ${distPerfil.DESATENTO_GERAL} | Omissão E excesso elevados — atenção dispersa |\n`;
    r += `| ✅ EQUILIBRADO | ${distPerfil.EQUILIBRADO} | Ambos baixos — perfil de qualidade operacional |\n`;
    r += `\n`;

    // Destaque dos conferentes "Pula Itens" (maior risco oculto)
    const pulaItens = evaluations.filter(e => e.perfilComportamental === "PULA_ITENS");
    if (pulaItens.length > 0) {
      r += `### ⚠️ Atenção — Conferentes com Alto Índice de Omissão\n\n`;
      r += `> Esses colaboradores não recebem erro bruto individual pelo produto pulado,\n`;
      r += `> mas cada omissão gera furo real no estoque da loja.\n\n`;
      pulaItens.forEach(e => {
        r += `• **${e.input.nome}** — ${e.input.itensPulados} itens pulados | Score: ${e.scoreFinal} (${e.nivel})\n`;
      });
      r += `\n`;
    }
    r += `---\n\n`;
  }

  const secaoRanking = temDadosComportamentais ? "3" : "2";
  r += `## ${secaoRanking}. RANKING COMPLETO\n\n`;
  r += `| # | Nome | Nível Exp. | Score | Nível | Prod | % Erro | ICV | Perfil | Tags |\n`;
  r += `|---|------|------------|-------|-------|------|--------|-----|--------|------|\n`;
  evaluations.forEach((e, i) => {
    const icvStr = e.icv !== undefined ? Math.round(e.icv) + '%' : '-';
    const expStr = e.input.experiencia ? e.input.experiencia.toUpperCase() : '-';
    const perfilStr = e.perfilComportamental ?? '-';
    r += `| ${i + 1} | ${e.input.nome} | ${expStr} | ${e.scoreFinal} | ${e.nivel} | ${
      e.input.produtividade
    } | ${e.pctErro.toFixed(2)} | ${icvStr} | ${perfilStr} | ${
      e.tags.join(" · ") || "-"
    } |\n`;
  });
  r += `\n---\n\n`;

  const secaoTop = String(Number(secaoRanking) + 1);
  r += `## ${secaoTop}. TOP 5 MELHORES\n\n`;
  top5.forEach((e, i) => {
    const icvStr = e.icv !== undefined ? Math.round(e.icv) + '%' : '-';
    const expStr = e.input.experiencia ? e.input.experiencia.toUpperCase() : '-';
    r += `**${i + 1}º - ${e.input.nome}** (Score: ${e.scoreFinal} - ${e.nivel})\n`;
    r += `- Experiência: ${expStr} | Produtividade: ${e.input.produtividade} itens/h | % Erro: ${e.pctErro.toFixed(2)}% | ICV: ${icvStr}\n`;
    if (e.perfilComportamental) {
      r += `- Perfil Comportamental: ${e.perfilComportamental}\n`;
    }
    if (e.tags.length > 0) {
      r += `- Tags: ${e.tags.join(" · ")}\n`;
    }
    r += `\n`;
  });
  r += `---\n\n`;

  const secaoAlerta = String(Number(secaoTop) + 1);
  r += `## ${secaoAlerta}. CONFERENTES EM ALERTA / CRÍTICO\n\n`;
  if (bottom5.length === 0) {
    r += `Nenhum conferente em nível crítico.\n\n`;
  } else {
    bottom5.forEach((e, i) => {
      const pos = evaluations.length - 5 + i;
      r += `**${pos + 1}º - ${e.input.nome}** (Score: ${e.scoreFinal} - ${e.nivel})\n`;
      r += `- Produtividade: ${e.input.produtividade} itens/h | % Erro: ${e.pctErro.toFixed(2)}% | % Bloco: ${e.pctBloco.toFixed(1)}%\n`;
      if (e.perfilComportamental) {
        r += `- Perfil Comportamental: ${e.perfilComportamental}\n`;
      }
      if (e.tags.length > 0) {
        r += `- Tags: ${e.tags.join(" · ")}\n`;
      }
      r += `\n`;
    });
  }
  r += `---\n\n`;

  const secaoRisco = String(Number(secaoAlerta) + 1);
  r += `## ${secaoRisco}. RADAR DE RISCO\n\n`;
  if (risco.length === 0) {
    r += `Nenhum conferente classificado como risco elevado.\n\n`;
  } else {
    risco.forEach((e) => {
      r += `• ${e.input.nome} — Score ${e.scoreFinal} (${e.nivel}) | % Erro: ${e.pctErro.toFixed(2)}% | % Bloco: ${e.pctBloco.toFixed(1)}% | Tags: ${
        e.tags.join(" · ") || "-"
      }\n`;
    });
    r += `\n`;
  }
  r += `---\n\n`;

  const secaoPlano = String(Number(secaoRisco) + 1);
  r += `## ${secaoPlano}. PLANO DE AÇÃO SUGERIDO\n\n`;
  r += `- Reforçar reconhecimento dos Top 3 MVPs da operação.\n`;
  r += `- Para conferentes com score abaixo de 70: realizar feedback individual e plano de melhoria.\n`;
  r += `- Para casos com tag "🚨 Risco de Contagem Superficial": revisar amostras de contagem, reforçar limite de bloco.\n`;
  if (temDadosComportamentais) {
    r += `- Para perfil "PULA_ITENS": treinar varredura visual completa (esq→dir, cima→baixo) e uso de marcadores de seção.\n`;
    r += `- Para perfil "FANTASMA": treinar demarcação de seções já contadas para evitar bipagem duplicada.\n`;
    r += `- Para perfil "DESATENTO_GERAL": acompanhar individualmente no próximo inventário, considerar reposicionamento em seções de menor complexidade.\n`;
  }
  r += `- Revisar meta de produtividade e aderência à política de contagem 1a1 conforme perfil da operação.\n\n`;

  r += `---\n\n`;
  r += `*Relatório gerado pela Avaliação - Módulo Avaliação (score Qualidade/Produtividade/Aderência)*\n`;
  r += `Data: ${new Date().toLocaleDateString("pt-BR")}\n`;

  // MAPA DE ACURÁCIA DE SEÇÕES (opcional — só quando dados estendidos disponíveis)
  if (sectionAccuracy && sectionAccuracy.length > 0) {
    const secaoMapa = String(Number(secaoPlano) + 1);
    r += `\n---\n\n`;
    r += `## ${secaoMapa}. MAPA DE ACURÁCIA DE SEÇÕES FÍSICAS\n\n`;
    r += `> **Como interpretar:** Acurácia = 1 - (Σ|Ajuste| / Σ Contado). \n`;
    r += `> 🚨 Crítico (<97.5%) | ⚠️ Atenção (97.5-99%) | ✅ OK (≥99%) | ⭐ Perfeito (100%)\n\n`;
    r += `| Seção | Contado | Ajuste Absoluto | Saldo Líquido | Acurácia | Status |\n`;
    r += `|-------|---------|-----------------|---------------|----------|--------|\n`;
    for (const s of sectionAccuracy) {
      const acc = s.acuracidade.toFixed(2);
      const status =
        s.acuracidade === 100 ? "⭐ Perfeito" :
        s.acuracidade >= 99   ? "✅ OK" :
        s.acuracidade >= 97.5 ? "⚠️ Atenção" :
                                "🚨 Crítico";
      const saldo = s.ajusteLiquido >= 0 ? `+${s.ajusteLiquido.toFixed(0)}` : s.ajusteLiquido.toFixed(0);
      r += `| ${s.area} | ${s.totalC1.toFixed(0)} | ${s.ajusteAbsoluto.toFixed(0)} | ${saldo} | ${acc}% | ${status} |\n`;
    }
    r += `\n`;
    const criticas = sectionAccuracy.filter(s => s.acuracidade < 97.5);
    if (criticas.length > 0) {
      r += `### 🚨 Seções Críticas — Ação Imediata Recomendada\n\n`;
      criticas.forEach(s => {
        r += `**${s.area}** — Acurácia: ${s.acuracidade.toFixed(2)}% | Colaboradores: ${s.colaboradores.join(", ")}\n`;
        if (s.ajusteLiquido === 0 && s.ajusteAbsoluto > 20) {
          r += `  ⚠️ Saldo zero com ajuste alto = produtos trocados/mal etiquetados na gôndola.\n`;
        } else if (s.ajusteLiquido < 0) {
          r += `  📦 Saldo negativo = provável sobre-contagem ou reposição após contagem.\n`;
        } else {
          r += `  📋 Saldo positivo = provável sub-contagem ou produto sem bip.\n`;
        }
        r += `\n`;
      });
    }
  }

  return r;
}


// =============================================================================
// RELATÓRIO INDIVIDUAL
// =============================================================================

/**
 * Labels e descrições por perfil comportamental — usados no relatório individual
 * para transformar a análise técnica em feedback educativo para o colaborador.
 */
const PERFIL_LABELS: Record<PerfilComportamental, {
  badge: string;
  titulo: string;
  descricao: string;
  diretriz: string;
}> = {
  PULA_ITENS: {
    badge: "🚨 PULA ITENS",
    titulo: "Foco em Varredura Completa",
    descricao: "Seu maior desafio é garantir que nenhum produto ou gancho fique sem o bip. Produtos pulados não aparecem como erro individual para você, mas geram furo real no estoque da loja — e o auditor vai atrás deles na recontagem.",
    diretriz: "💡 **No próximo inventário:** faça a varredura de cada prateleira da esquerda para a direita e de cima para baixo, linha por linha, antes de avançar para o próximo espaço. Se a seção tiver múltiplos níveis de gôndola, confira cada um de forma independente.",
  },
  FANTASMA: {
    badge: "🔄 DUPLICADOR",
    titulo: "Foco em Demarcação de Seções",
    descricao: "Você bipa com atenção e raramente esquece produtos, mas tende a recontar espaços que já foram contados — por você ou por um colega. Isso gera sobra virtual que a auditoria precisa corrigir.",
    diretriz: "💡 **No próximo inventário:** use os marcadores/etiquetas de demarcação em cada seção que você finalizar. Antes de bipar qualquer área, verifique se já há marca de contagem naquele espaço.",
  },
  DESATENTO_GERAL: {
    badge: "⚠️ DESATENTO GERAL",
    titulo: "Ajuste de Processo Necessário",
    descricao: "Seus números mostram dois padrões simultâneos: produtos esquecidos na gôndola E contagens duplicadas. Isso indica que o ritmo de contagem pode estar descompassado com o método. Qualidade é mais importante que velocidade.",
    diretriz: "💡 **No próximo inventário:** reduza o ritmo e priorize a varredura metódica de cada seção. Use os marcadores de área para saber onde você está e onde já passou. Converse com a liderança para alinhar o processo antes de começar.",
  },
  EQUILIBRADO: {
    badge: "✅ EQUILIBRADO",
    titulo: "Manter o Padrão",
    descricao: "Seus índices de omissão e duplicação estão dentro do esperado. Você demonstra atenção consistente tanto na varredura das prateleiras quanto no controle de seções já contadas.",
    diretriz: "✅ **Continue assim:** mantenha o equilíbrio atual entre velocidade e qualidade. Seus números de atenção visual são muito bons!",
  },
};

export function generateInventExpIndividualReportText(
  operationType: InventoryOperationType,
  ev: InventoryCheckerEvaluation,
  rank: number,
  totalConferentes: number,
  dataInventario?: string,
): string {
  const modalidade = ev.input.modalidadeContrato ?? "CLT";
  const isFreelance = modalidade === "FREELANCE";

  return isFreelance
    ? _generateFreelanceTechnicalReport(operationType, ev, rank, totalConferentes, dataInventario)
    : _generateFullReport(operationType, ev, rank, totalConferentes, dataInventario);
}

// =============================================================================
// RELATÓRIO COMPLETO (CLT / INTERMITENTE)
// =============================================================================
function _generateFullReport(
  operationType: InventoryOperationType,
  ev: InventoryCheckerEvaluation,
  rank: number,
  totalConferentes: number,
  dataInventario?: string,
): string {
  const data = dataInventario ?? new Date().toLocaleDateString("pt-BR");
  const perfil = INVENTORY_PROFILES[operationType];
  const d = ev.input;

  const perfilInfo = ev.perfilComportamental
    ? PERFIL_LABELS[ev.perfilComportamental]
    : null;

  let r = "";
  r += `# RELATÓRIO INDIVIDUAL - Avaliação\n`;
  r += `## Inventário: ${data}\n`;
  r += `## Operação: ${operationType}\n\n`;
  r += `---\n\n`;

  r += `## 👤 CONFERENTE: ${d.nome}\n\n`;
  r += `Score Final: ${ev.scoreFinal} / 100 — ${ev.nivel}\n`;
  r += `Posição no ranking: ${rank}º de ${totalConferentes}\n`;
  if (perfilInfo) {
    r += `Perfil Operacional: **${perfilInfo.badge}**\n`;
  }
  r += `\n---\n\n`;

  r += `## 📊 OS SEUS NÚMEROS GERAIS\n\n`;
  r += `- Experiência reconhecida: **${(d.experiencia || 'Pleno').toUpperCase()}**\n`;
  r += `- Total de peças contadas: ${d.qtde}\n`;
  if (ev.minimoEsperado && ev.minimoEsperado > 0) {
    r += `- Meta de volume estimada para seu nível: ${ev.minimoEsperado} peças\n`;
    r += `- **ICV (Índice de Cumprimento de Volume): ${Math.round(ev.icv || 0)}%**\n`;
  }
  r += `- Ritmo médio: ${d.produtividade} itens/h (meta do perfil: ${perfil.targets.productivity} itens/h)\n`;
  r += `- % Erro: ${ev.pctErro.toFixed(2)}%\n`;
  r += `- % Bloco: ${ev.pctBloco.toFixed(1)}% (limite recomendado: ${perfil.targets.maxBlockLimit}%)\n\n`;
  r += `---\n\n`;

  // =========================================================================
  // RAIO-X DA QUALIDADE OPERACIONAL
  // Estrutura inspirada na análise de separação de sinais do Qtd(A1):
  //   Erros de Execução  → planilha produtividade (erro bruto individual)
  //   Itens Esquecidos   → produtividade_tag Qtd(A1) > 0 (omissão)
  //   Contagens Duplic.  → produtividade_tag Qtd(A1) < 0 (excesso)
  // =========================================================================
  r += `## 🔍 RAIO-X DA SUA QUALIDADE OPERACIONAL\n`;
  r += `Para te ajudar a entender seus pontos fortes e onde precisamos redobrar a atenção, mapeamos o comportamento das suas seções:\n\n`;

  r += `**1. Erros de Execução (Quantidade direta):** ${d.erro} erros\n`;
  r += `   _(Produto bipado, mas a quantidade digitada na tela foi maior ou menor do que o real)_\n\n`;

  const pulados = d.itensPulados || 0;
  const duplicados = d.itensDuplicados || 0;

  r += `**2. Itens Esquecidos na Gôndola (Omissão):** ${pulados} produto(s)\n`;
  r += `   _(Prateleira ou gancho sem bip algum — o auditor encontrou esses produtos depois, na recontagem)_\n`;
  if (pulados > 0) {
    r += `   ⚠️ _Atenção: produto pulado não gera erro no seu indicador individual, mas gera furo real no estoque da loja!_\n`;
  }
  r += `\n`;

  r += `**3. Contagens Duplicadas (Excesso):** ${duplicados} produto(s)\n`;
  r += `   _(Produto ou gancho bipado a mais — área já contada que foi recontada por engano)_\n\n`;

  if (d.erroSecao !== undefined) {
    r += `**4. Erro de Seção (Σ|Ajuste Área|):** ${d.erroSecao} unidades\n`;
    r += `   _(Soma dos ajustes modulares após recontagem das seções físicas)_\n\n`;
    if (ev.icsi !== undefined) {
      const icsiPct = Math.round(ev.icsi * 100);
      r += `**5. ICSI (Índice de Consistência Seção/Item):** ${icsiPct}%\n`;
      if (icsiPct >= 80) {
        r += `   _(Alto: seus erros são diretos e identificáveis — mais fácil de corrigir com treinamento)_\n\n`;
      } else if (icsiPct >= 50) {
        r += `   _(Médio: parte dos erros se compensou internamente nas seções)_\n\n`;
      } else {
        r += `   _(Baixo: erros em direções opostas dentro das seções — risco oculto na gôndola)_\n\n`;
      }
    }
  }
  r += `---\n\n`;

  r += `## 🎯 COMO A SUA NOTA FOI CALCULADA\n\n`;
  r += `- Qualidade: ${Math.round(ev.scoreQualidade)} pts\n`;
  r += `- Produtividade: ${Math.round(ev.scoreProdutividade)} pts\n`;
  r += `- Aderência ao método: ${Math.round(ev.scoreAderencia)} pts\n`;
  if (ev.pontosVolume !== undefined) {
    r += `- Volume (ICV): ${Math.round(ev.pontosVolume)} pts\n`;
  }
  if (ev.bonusVolume) r += `  + Bônus Volume: ${ev.bonusVolume} pts\n`;
  if (ev.penalidadeVolume) r += `  - Penalidade Volume: ${ev.penalidadeVolume} pts\n`;
  r += `\n`;

  // Notas de ajuste
  if (ev.pctErro > perfil.targets.erroCritico) {
    r += `• A sua taxa de erro ficou acima do limite crítico do perfil, reduzindo parte da nota de produtividade.\n`;
  }
  if (ev.pctBloco > perfil.targets.maxBlockLimit) {
    r += `• O uso de contagem em Bloco acima do limite recomendado reduziu a nota de aderência ao método.\n`;
  }
  if (d.produtividade > perfil.targets.productivity && ev.pctErro <= perfil.targets.erroTolerancia) {
    r += `• Você recebeu bônus por manter boa qualidade mesmo com produtividade acima da meta.\n`;
  }
  if (ev.tags.includes("🚨 Risco de Contagem Superficial")) {
    r += `• Foi identificado risco de contagem superficial (erro alto combinado com muito bloco). Revise os critérios de quando usar bloco.\n`;
  }
  if (pulados > 0) {
    r += `• Foram identificados ${pulados} item(s) pulado(s) na sua área, gerando penalidade de qualidade. Veja o direcionamento abaixo.\n`;
  }
  if (duplicados > 0) {
    r += `• Foram identificadas ${duplicados} contagem(ns) duplicada(s), gerando penalidade de qualidade.\n`;
  }
  if (
    ev.pctErro <= perfil.targets.erroTolerancia &&
    ev.pctBloco <= perfil.targets.maxBlockLimit &&
    pulados === 0 &&
    duplicados === 0
  ) {
    r += `• A sua atuação está dentro dos parâmetros esperados de qualidade e aderência ao método para este perfil.\n`;
  }
  r += `\n---\n\n`;

  if (ev.tags.length > 0) {
    r += `## 🏅 TAGS E DESTAQUES\n\n`;
    ev.tags.forEach((tag) => {
      r += `• ${tag}\n`;
    });
    r += `\n---\n\n`;
  }

  // =========================================================================
  // DIRECIONAMENTO — baseado no perfil comportamental
  // =========================================================================
  r += `## 📌 DIRECIONAMENTO PARA O PRÓXIMO INVENTÁRIO\n\n`;

  if (perfilInfo) {
    r += `### ${perfilInfo.titulo}\n\n`;
    r += `${perfilInfo.descricao}\n\n`;
    r += `${perfilInfo.diretriz}\n\n`;
  } else {
    // Fallback para quando não há dados de tags estendidos
    if (pulados > 15) {
      r += `💡 **Foco em Varredura:** No próximo inventário, sua atenção deve ser voltada para a varredura visual completa da prateleira (da esquerda para a direita, de cima para baixo), garantindo que nenhum produto ou gancho fique para trás sem o bip.\n\n`;
    } else if (duplicados > 20) {
      r += `💡 **Foco em Demarcação:** Certifique-se de marcar visualmente ou usar as etiquetas de marcação nas seções para nunca recontar uma área que você ou seu colega já finalizaram.\n\n`;
    } else if (ev.nivel === "EXCELENTE" || ev.nivel === "BOM") {
      r += `✅ **Manter o Padrão:** Continue mantendo o equilíbrio atual entre velocidade e qualidade. Seus números de atenção visual estão muito bons!\n\n`;
    } else {
      r += `⚠️ **Ajuste de Qualidade:** Priorize reduzir o % de erro bruto digitado. Revise junto à liderança os principais tipos de erros ocorridos hoje e reduza o uso de contagem em bloco quando não for estritamente necessário.\n\n`;
    }
  }

  r += `Contamos com sua atenção e evolução no próximo processo!\n`;
  r += `\n---\n\n`;

  r += `*Relatório gerado pela Avaliação - Módulo Avaliação (Qualidade · Produtividade · Aderência)*\n`;
  r += `Data: ${new Date().toLocaleDateString("pt-BR")}\n`;

  return r;
}

// =============================================================================
// RELATÓRIO TÉCNICO INFORMATIVO (FREELANCE)
//
// Finalidade: Preservar a natureza informativa do documento para prestadores
// de serviço sem vínculo empregatício (freelancers / autônomos / MEI).
//
// O que este relatório NÃO contém (para não caracterizar subordinação):
//   ✗ Metas obrigatórias ("você deve atingir X")
//   ✗ Penalidades explícitas e sua pontuação
//   ✗ Direcionamentos imperativos ("faça assim no próximo inventário")
//   ✗ Score final como "nota" de gestão de pessoal
//
// O que contém (apenas dados técnicos do serviço prestado):
//   ✓ Indicadores de qualidade da contagem realizada (referência de mercado)
//   ✓ Perfil de comportamento operacional observado (omissão/excesso)
//   ✓ Posição comparativa informativa (sem ranqueamento punitivo)
//   ✓ Observações técnicas em linguagem neutra
//   ✓ Rodapé com disclaimer jurídico
// =============================================================================
function _generateFreelanceTechnicalReport(
  operationType: InventoryOperationType,
  ev: InventoryCheckerEvaluation,
  rank: number,
  totalConferentes: number,
  dataInventario?: string,
): string {
  const data = dataInventario ?? new Date().toLocaleDateString("pt-BR");
  const perfil = INVENTORY_PROFILES[operationType];
  const d = ev.input;
  const pulados = d.itensPulados || 0;
  const duplicados = d.itensDuplicados || 0;

  let r = "";
  r += `# RELATÓRIO TÉCNICO DE QUALIDADE — PRESTAÇÃO DE SERVIÇO\n`;
  r += `## Inventário: ${data}\n`;
  r += `## Tipo de Operação: ${operationType}\n\n`;
  r += `---\n\n`;

  r += `## 👤 PRESTADOR: ${d.nome}\n\n`;
  r += `Posição comparativa no grupo: ${rank}º de ${totalConferentes} prestadores nesta operação.\n`;
  r += `Referência de qualidade da operação: **${ev.nivel}**\n\n`;
  r += `---\n\n`;

  // Indicadores técnicos — sem framing de "meta obrigatória"
  r += `## 📊 INDICADORES TÉCNICOS DA CONTAGEM\n\n`;
  r += `> Os valores abaixo são indicadores técnicos do serviço realizado.\n`;
  r += `> As referências de mercado indicadas são parâmetros do segmento, não metas vinculantes.\n\n`;
  r += `- Total de itens contabilizados: **${d.qtde}**\n`;
  r += `- Ritmo de contagem: **${d.produtividade} itens/h**\n`;
  r += `  _(Referência do segmento ${operationType}: ${perfil.targets.productivity} itens/h)_\n`;
  r += `- Taxa de ajuste de quantidade: **${ev.pctErro.toFixed(2)}%**\n`;
  r += `  _(Referência de baixa variação do segmento: abaixo de ${perfil.targets.erroTolerancia}%)_\n`;
  r += `- Uso de contagem agrupada (bloco): **${ev.pctBloco.toFixed(1)}%**\n\n`;
  r += `---\n\n`;

  // Análise de comportamento — neutra, sem imperativos
  r += `## 🔍 ANÁLISE DE COMPORTAMENTO OPERACIONAL\n\n`;
  r += `**Ajustes de quantidade registrados (erros de execução):** ${d.erro}\n`;
  r += `_(Itens contabilizados com discrepância de quantidade em relação ao físico)_\n\n`;

  r += `**Itens não registrados identificados na recontagem (omissão):** ${pulados}\n`;
  if (pulados > 0) {
    r += `_(Produtos localizados na gôndola que não foram bipados durante a contagem)_\n\n`;
  } else {
    r += `_(Nenhuma omissão identificada na recontagem — indicador dentro do esperado)_\n\n`;
  }

  r += `**Registros duplicados identificados na recontagem (excesso):** ${duplicados}\n`;
  if (duplicados > 0) {
    r += `_(Produtos registrados mais de uma vez na mesma área de contagem)_\n\n`;
  } else {
    r += `_(Nenhuma duplicação identificada — indicador dentro do esperado)_\n\n`;
  }

  // Perfil comportamental — apenas informativo
  if (ev.perfilComportamental && ev.perfilComportamental !== "EQUILIBRADO") {
    const PERFIL_DESCRICAO_NEUTRA: Record<string, string> = {
      PULA_ITENS:      "O padrão observado indica maior ocorrência de omissões do que de duplicações na operação realizada.",
      FANTASMA:        "O padrão observado indica maior ocorrência de registros duplicados do que de omissões na operação realizada.",
      DESATENTO_GERAL: "O padrão observado indica ocorrências simultâneas de omissões e registros duplicados na operação realizada.",
    };
    const desc = PERFIL_DESCRICAO_NEUTRA[ev.perfilComportamental];
    if (desc) {
      r += `**Padrão operacional identificado:** ${desc}\n\n`;
    }
  }

  // Tags técnicas — apenas as informativas, sem as punitivas
  const tagsInformativas = ev.tags.filter(t =>
    !t.includes("🚨") && !t.includes("Risco") && !t.includes("Fraude") && !t.includes("Impossível")
  );
  if (tagsInformativas.length > 0) {
    r += `**Destaques técnicos observados:**\n`;
    tagsInformativas.forEach(tag => { r += `• ${tag}\n`; });
    r += `\n`;
  }

  if (d.erroSecao !== undefined) {
    r += `**Variação de seção (Σ|Ajuste por área|):** ${d.erroSecao} unidades\n\n`;
  }

  r += `---\n\n`;

  // Observações técnicas — linguagem neutra, sem imperativos
  r += `## 📋 OBSERVAÇÕES TÉCNICAS\n\n`;

  if (pulados === 0 && duplicados === 0 && ev.pctErro <= perfil.targets.erroTolerancia) {
    r += `Os indicadores desta operação estão dentro dos parâmetros de referência do segmento para o tipo de contagem realizada.\n\n`;
  } else {
    r += `Os indicadores desta operação foram registrados para fins de histórico e acompanhamento técnico da qualidade do serviço prestado.\n\n`;
    if (pulados > 5) {
      r += `• Foram identificadas omissões na contagem desta operação. A referência técnica do segmento indica que a varredura sequencial de prateleiras (esquerda-direita, cima-baixo) reduz significativamente este tipo de ocorrência.\n\n`;
    }
    if (duplicados > 10) {
      r += `• Foram identificadas duplicações de registros nesta operação. A referência técnica do segmento indica que a demarcação visual de áreas já contadas reduz significativamente este tipo de ocorrência.\n\n`;
    }
    if (ev.pctErro > perfil.targets.erroTolerancia) {
      r += `• A taxa de ajuste de quantidade observada ficou acima da referência de baixa variação do segmento (${perfil.targets.erroTolerancia}%). Este indicador é registrado para histórico de qualidade do serviço.\n\n`;
    }
  }

  r += `---\n\n`;

  // Rodapé com disclaimer jurídico
  r += `*Este documento é um relatório técnico informativo referente ao serviço de contagem de inventário realizado.*\n`;
  r += `*Não caracteriza relação de emprego, subordinação ou vínculo empregatício de qualquer natureza.*\n`;
  r += `*Os indicadores apresentados são de caráter exclusivamente técnico e informativo.*\n`;
  r += `Data: ${new Date().toLocaleDateString("pt-BR")}\n`;

  return r;
}
