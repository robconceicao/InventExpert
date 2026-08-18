import {
  INVENTORY_PROFILES,
  ehToleranciaZero,
  gravidadeDaViolacao,
  penalidadeDaViolacao,
  type GravidadeBloco,
} from "../config/inventoryEvalConfig";
import {
  getSectionAreaNome,
  getSectionBlocoPct,
  getViolacaoArea,
  getViolacaoCritica,
  getViolacaoLimitePct,
  getViolacaoRealPct,
  isModalidadeFree,
  normalizeModalidade,
  type InventoryCheckerEvaluation,
  type InventoryOperationType,
  type ModalidadeContrato,
  type SectionAccuracyRecord,
  type ViolacaoBloco,
} from "../types";

// ---------------------------------------------------------------------------
// Gerencial
// ---------------------------------------------------------------------------

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
  r += `| Erro tolerância | ${perfil.targets.erroTolerancia}% |\n`;
  r += `| Erro crítico | ${perfil.targets.erroCritico}% |\n`;
  r += `\n---\n\n`;

  r += `## 2. RANKING COMPLETO\n\n`;
  r += `| # | Nome | Score | Nível | Prod (itens/h) | % Erro | % Bloco | Tags |\n`;
  r += `|---|------|-------|------|----------------|--------|--------|------|\n`;
  evaluations.forEach((e, i) => {
    r += `| ${i + 1} | ${e.input.nome} | ${e.scoreFinal} | ${e.nivel} | ${
      e.input.produtividade
    } | ${e.pctErro.toFixed(2)} | ${e.pctBloco.toFixed(1)} | ${
      e.tags.join(" · ") || "-"
    } |\n`;
  });
  r += `\n---\n\n`;

  r += `## 3. TOP 5 MELHORES\n\n`;
  top5.forEach((e, i) => {
    r += `**${i + 1}º - ${e.input.nome}** (Score: ${e.scoreFinal} - ${e.nivel})\n`;
    r += `- Produtividade: ${e.input.produtividade} itens/h | % Erro: ${e.pctErro.toFixed(
      2,
    )}% | % Bloco: ${e.pctBloco.toFixed(1)}%\n`;
    if (e.tags.length > 0) r += `- Tags: ${e.tags.join(" · ")}\n`;
    r += `\n`;
  });
  r += `---\n\n`;

  r += `## 4. CONFERENTES EM ALERTA / CRÍTICO\n\n`;
  if (bottom5.length === 0) {
    r += `Nenhum conferente em nível crítico.\n\n`;
  } else {
    bottom5.forEach((e, i) => {
      const pos = Math.max(0, evaluations.length - 5) + i;
      r += `**${pos + 1}º - ${e.input.nome}** (Score: ${e.scoreFinal} - ${e.nivel})\n`;
      r += `- Produtividade: ${e.input.produtividade} itens/h | % Erro: ${e.pctErro.toFixed(
        2,
      )}% | % Bloco: ${e.pctBloco.toFixed(1)}%\n`;
      if (e.tags.length > 0) r += `- Tags: ${e.tags.join(" · ")}\n`;
      r += `\n`;
    });
  }
  r += `---\n\n`;

  r += `## 5. RADAR DE RISCO (Risco de Contagem Superficial / Nível crítico)\n\n`;
  if (risco.length === 0) {
    r += `Nenhum conferente classificado como risco elevado.\n\n`;
  } else {
    risco.forEach((e) => {
      r += `• ${e.input.nome} — Score ${e.scoreFinal} (${e.nivel}) | % Erro: ${e.pctErro.toFixed(
        2,
      )}% | % Bloco: ${e.pctBloco.toFixed(1)}% | Tags: ${
        e.tags.join(" · ") || "-"
      }\n`;
    });
    r += `\n`;
  }
  r += `---\n\n`;

  r += `## 6. PLANO DE AÇÃO SUGERIDO\n\n`;
  r += `- Reforçar reconhecimento dos Top 3 MVPs da operação.\n`;
  r += `- Para conferentes com score abaixo de 70: realizar feedback individual e plano de melhoria.\n`;
  r += `- Para casos com tag "🚨 Risco de Contagem Superficial": revisar amostras de contagem, reforçar limite de bloco e checar se houve pressão de tempo.\n`;
  r += `- Revisar meta de produtividade e aderência à política de contagem 1a1 conforme perfil da operação.\n\n`;

  r += `---\n\n`;
  r += `*Relatório gerado pela Avaliação - Módulo Avaliação (score Qualidade/Produtividade/Aderência)*\n`;
  r += `Data: ${new Date().toLocaleDateString("pt-BR")}\n`;

  return r;
}

// ---------------------------------------------------------------------------
// Helpers individuais
// ---------------------------------------------------------------------------

function isAlertaFormal(v: ViolacaoBloco): boolean {
  const lim = getViolacaoLimitePct(v);
  return getViolacaoCritica(v) || lim <= 5;
}

function statusSecao(sec: SectionAccuracyRecord): string {
  if (sec.violacaoBloco) {
    return getViolacaoCritica(sec.violacaoBloco) || getViolacaoLimitePct(sec.violacaoBloco) === 0
      ? "🚨"
      : "⚠️";
  }
  if (sec.violacao_bloco) {
    return sec.area_critica || (sec.limite_bloco ?? 99) === 0 ? "🚨" : "⚠️";
  }
  return "✅";
}

/**
 * Advertência de bloco, escalonada pela gravidade e adaptada à modalidade.
 *
 * Área de tolerância zero (medicamentos, controlados, termolábeis) recebe
 * enquadramento sanitário explícito: a restrição não é convenção interna da
 * operação, é rastreabilidade exigida pela ANVISA/SNGPC, e a ocorrência sobe
 * para o RT farmacêutico do cliente independentemente do vínculo de quem
 * contou. Acima de 20% o texto deixa de falar em engano e passa a falar em
 * método de contagem, porque é o que o número mostra.
 *
 * A regra de linguagem do FREE continua valendo em qualquer gravidade: nada de
 * "colaborador", "medida disciplinar", "Código de Conduta" ou "convocação".
 */
function textoAlertaModalidade(
  mod: ModalidadeContrato,
  area: string,
  limite: number,
  real: number,
  gravidade: GravidadeBloco,
): string {
  const canon = normalizeModalidade(mod);
  const zero = ehToleranciaZero(gravidade);
  const grave = gravidade === "TOLERANCIA_ZERO_GRAVE";

  const titulo = zero
    ? `🚨 ADVERTÊNCIA — CONTAGEM EM BLOCO EM ÁREA DE TOLERÂNCIA ZERO`
    : `🚨 ALERTA — USO DE BLOCO EM ÁREA RESTRITA`;

  const linhaLimite = zero
    ? `Limite permitido: 0% (bloco proibido)  |  Seu percentual: ${real.toFixed(1)}%\n`
    : `Limite permitido: ${limite}%  |  Seu percentual: ${real.toFixed(1)}%\n`;

  let header = `${titulo}\n\n` + `Área: ${area}\n` + linhaLimite;

  if (zero) {
    header +=
      `\nEsta é uma área de restrição sanitária: a contagem precisa ser peça a\n` +
      `peça porque o estoque dela é controle legal (ANVISA/SNGPC), e a\n` +
      `divergência não se resolve com ajuste — exige justificativa formal.\n` +
      `A ocorrência foi encaminhada ao RT farmacêutico do cliente.\n`;
    if (grave) {
      header +=
        `\nO percentual acima de 20% indica que a área foi contada em bloco\n` +
        `como método, e não por engano pontual.\n`;
    }
  }
  header += `\n`;

  if (canon === "CLT") {
    return (
      header +
      `⚠️ FALTA GRAVE: O uso de bloco nesta área compromete a integridade\n` +
      `do inventário e está em desacordo com os procedimentos internos.\n` +
      `Esta ocorrência será registrada e pode resultar em medida disciplinar\n` +
      `conforme o Código de Conduta e a CLT.\n`
    );
  }
  if (canon === "INTERMITENTE") {
    return (
      header +
      `⚠️ FALTA GRAVE: O uso de bloco nesta área compromete a integridade\n` +
      `do inventário. Esta ocorrência está documentada e pode impactar\n` +
      `suas convocações futuras, conforme o contrato de trabalho intermitente.\n`
    );
  }
  // FREE
  return (
    header +
    `⚠️ OCORRÊNCIA REGISTRADA: O uso de bloco nesta área está em\n` +
    `desacordo com o escopo do serviço contratado. Esta ocorrência\n` +
    `será considerada na avaliação para prestações futuras.\n`
  );
}

// ---------------------------------------------------------------------------
// Individual
// ---------------------------------------------------------------------------

/**
 * Relatório individual de avaliação.
 * Ordem: Cabeçalho → Alerta → Números → SUAS SEÇÕES → RAIO-X → COMO A NOTA → DIRECIONAMENTO
 * Nunca inclui "Perfil Operacional".
 */
export function generateInventExpIndividualReportText(
  operationType: string,
  ev: InventoryCheckerEvaluation,
  rank: number,
  totalConferentes: number,
  dataInventario?: string,
  secoesLegacy?: SectionAccuracyRecord[],
  violacoesLegacy?: ViolacaoBloco[],
): string {
  const data = dataInventario ?? new Date().toLocaleDateString("pt-BR");
  const perfil =
    INVENTORY_PROFILES[operationType as InventoryOperationType] ||
    INVENTORY_PROFILES.FARMACIA;
  const d = ev.input;
  const mod = (d.modalidadeContrato || d.modalidade || "CLT") as ModalidadeContrato;
  const free = isModalidadeFree(mod);
  const canon = normalizeModalidade(mod);

  let r = "";
  r += `# RELATÓRIO INDIVIDUAL - Avaliação\n`;
  r += `## Inventário: ${data}\n`;
  r += `## Operação: ${operationType}\n\n`;
  r += `---\n\n`;

  // Cabeçalho por modalidade (sem Perfil Operacional)
  if (free) {
    r += `## 👤 PRESTADOR: ${d.nome}\n\n`;
  } else if (canon === "INTERMITENTE") {
    r += `## 👤 COLABORADOR INTERMITENTE: ${d.nome}\n\n`;
  } else {
    r += `## 👤 CONFERENTE: ${d.nome}\n\n`;
  }

  r += `Score Final: ${ev.scoreFinal} / 100 — ${ev.nivel}\n`;
  // O prestador de serviço não é comparado com a equipe: posição em ranking
  // trata o resultado como desempenho dentro de um time, e não como qualidade
  // do serviço entregue.
  if (!free) {
    r += `Posição no ranking: ${rank}º de ${totalConferentes}\n`;
  }
  r += `\n`;
  r += `---\n\n`;

  const finalViolacoes: ViolacaoBloco[] =
    (ev.violacoes && ev.violacoes.length > 0
      ? ev.violacoes
      : ev.violacoesBloco && ev.violacoesBloco.length > 0
        ? ev.violacoesBloco
        : violacoesLegacy) || [];

  const finalSecoes: SectionAccuracyRecord[] =
    (ev.secoes && ev.secoes.length > 0 ? ev.secoes : secoesLegacy) || [];

  // Alerta formal: crítica OU limite <= 5% — ANTES de qualquer seção de conteúdo
  const alertas = finalViolacoes.filter(isAlertaFormal);
  if (alertas.length > 0) {
    for (const v of alertas) {
      r += textoAlertaModalidade(
        mod,
        getViolacaoArea(v),
        getViolacaoLimitePct(v),
        getViolacaoRealPct(v),
        gravidadeDaViolacao(v),
      );
      r += `\n`;
    }
    r += `---\n\n`;
  }

  // OS SEUS NÚMEROS GERAIS
  r += `## 📊 OS SEUS NÚMEROS GERAIS\n\n`;
  r += `- Total de peças contadas: ${d.qtde}\n`;
  r += `- Ritmo médio: ${d.produtividade} itens/h (meta do perfil: ${perfil.targets.productivity} itens/h)\n`;
  r += `- % Erro global: ${ev.pctErro.toFixed(2)}%\n`;
  r += `- % Bloco global: ${ev.pctBloco.toFixed(1)}% (limite recomendado: ${perfil.targets.maxBlockLimit}%)\n\n`;

  if (finalViolacoes.length > 0) {
    r += `### ⚠️ Penalidades de Bloco\n\n`;
    finalViolacoes.forEach((v) => {
      const vArea = getViolacaoArea(v);
      const vLimit = getViolacaoLimitePct(v);
      const vReal = getViolacaoRealPct(v);
      const vCritica = getViolacaoCritica(v);
      // Mostrar os pontos torna a advertência auditável: o conferente vê o
      // tamanho do desconto e por que uma área pesou mais que outra.
      const pontos = penalidadeDaViolacao(v);
      if (vLimit === 0 && vCritica) {
        r += `- **${vArea}** | PROIBIDO BLOCO | Realizado ${vReal.toFixed(1)}% | −${pontos} pts de Qualidade\n`;
      } else {
        r += `- **${vArea}** | Limite ${vLimit.toFixed(1)}% | Realizado ${vReal.toFixed(1)}%${
          vCritica ? " (CRÍTICA)" : ""
        } | −${pontos} pts de Qualidade\n`;
      }
    });
    r += `\n`;
  }
  r += `---\n\n`;

  // SUAS SEÇÕES — ACURÁCIA POR ÁREA
  if (finalSecoes.length > 0) {
    r += `## 🎯 SUAS SEÇÕES — ACURÁCIA\n\n`;
    r += `| Área | Seções | C1 | Ajuste | Final | Bloco% | Status |\n`;
    r += `|------|--------|----|--------|-------|--------|--------|\n`;
    finalSecoes.forEach((sec) => {
      const areaName = getSectionAreaNome(sec);
      const secoesN = sec.secoes_contadas ?? 0;
      const c1 = sec.qtd_c1 ?? sec.totalC1 ?? sec.totalItens ?? 0;
      const ajuste =
        sec.ajusteAbsoluto ??
        Math.abs(sec.ajuste_a1 || 0) +
          Math.abs(sec.ajuste_a2 || 0) +
          Math.abs(sec.ajuste_a3 || 0);
      const finalQ = sec.qtd_final ?? c1;
      const pctB = getSectionBlocoPct(sec);
      const status = statusSecao(sec);
      r += `| ${areaName} | ${secoesN} | ${c1} | ${ajuste} | ${finalQ} | ${pctB.toFixed(1)}% | ${status} |\n`;
    });
    r += `\n---\n\n`;
  }

  // RAIO-X DA QUALIDADE OPERACIONAL
  r += `## 🔍 RAIO-X DA QUALIDADE OPERACIONAL\n\n`;
  const errosExecucao = d.erro || 0;
  const pulados = d.itensPulados || 0;
  const duplicados = d.itensDuplicados || 0;
  const erroSecao = d.erroSecao || 0;
  const detalhes = ev.errosAreaDetalhe || [];

  if (
    errosExecucao === 0 &&
    pulados === 0 &&
    duplicados === 0 &&
    erroSecao === 0
  ) {
    r += `Nenhuma ocorrência de qualidade registrada.\n\n`;
  } else {
    if (errosExecucao > 0) {
      r += `1. Erros de Execução (Quantidade direta): ${errosExecucao} erro(s)\n`;
      r += `   Produto bipado com quantidade registrada diferente da real.\n`;
      const exec = detalhes.filter((x) => x.tipo_erro === "EXECUCAO");
      for (const e of exec) {
        r += `   - Área ${e.area_nome}: ${e.ajuste_qtd} unidade(s) de diferença\n`;
        if (e.produto_nome || e.produto_codigo) {
          r += `     → Produto: ${e.produto_nome || "—"} (Cód. ${e.produto_codigo || "—"})\n`;
        }
      }
      r += `\n`;
    }
    if (pulados > 0) {
      r += `2. Itens Não Contados na Gôndola (Omissão): ${pulados} produto(s)\n`;
      r += `   Produto não contado na prateleira ou gancho —\n`;
      r += `   identificado pelo auditor na recontagem.\n`;
      const om = detalhes.filter((x) => x.tipo_erro === "OMISSAO");
      for (const e of om) {
        r += `   - Área ${e.area_nome}: ${e.produto_nome || "produto"} (Cód. ${e.produto_codigo || "—"})\n`;
      }
      r += `\n⚠️ Produto não contado não gera erro no indicador individual,\n`;
      r += `   mas causa divergência real no estoque da loja.\n\n`;
    }
    if (duplicados > 0) {
      r += `3. Contagens Duplicadas (Excesso): ${duplicados} produto(s)\n`;
      r += `   Área já contada que foi recontada por engano.\n`;
      const du = detalhes.filter((x) => x.tipo_erro === "DUPLICACAO");
      for (const e of du) {
        r += `   - Área ${e.area_nome}: ${e.produto_nome || "produto"} (Cód. ${e.produto_codigo || "—"})\n`;
      }
      r += `\n`;
    }
    if (erroSecao > 0) {
      r += `4. Erro de Seção: ${erroSecao} unidade(s)\n\n`;
    }
    if (errosExecucao > 0 && pulados > 0 && duplicados > 0) {
      r += `* Nota: ICSI de 40% (erros em direções opostas podem ocultar impactos maiores de qualidade).\n`;
    }
  }
  r += `\n---\n\n`;

  // COMO A NOTA FOI CALCULADA
  r += `## 🧮 COMO A SUA NOTA FOI CALCULADA\n\n`;

  // Qualidade
  r += `**Qualidade: ${Math.round(ev.scoreQualidade)} pts**\n\n`;
  r += `Como avaliamos:\n`;
  r += `Medimos a precisão das contagens — erros de quantidade, produtos\n`;
  r += `não contados, duplicações e consistência com a recontagem do auditor.\n\n`;
  if (finalViolacoes.length > 0 || errosExecucao > 0 || pulados > 0 || duplicados > 0) {
    r += `Motivo da pontuação:\n`;
    if (errosExecucao > 0) {
      r += `• ${errosExecucao} erros de quantidade nas suas seções.\n`;
    }
    if (pulados > 0) {
      r += `• ${pulados} produto(s) não contado(s).\n`;
    }
    if (duplicados > 0) {
      r += `• ${duplicados} contagens duplicadas.\n`;
    }
    if (finalViolacoes.length > 0) {
      const areas = finalViolacoes.map((v) => getViolacaoArea(v)).join(", ");
      r += `• Bloco acima do limite em ${areas}.\n`;
      for (const v of finalViolacoes) {
        r += `  (${getViolacaoArea(v)}: seu uso ${getViolacaoRealPct(v).toFixed(1)}% | limite: ${getViolacaoLimitePct(v)}%)\n`;
      }
    }
    r += `\n`;
  } else if (ev.scoreQualidade < 100) {
    r += `Motivo da pontuação:\n• Ajuste fino de qualidade abaixo do máximo.\n\n`;
  }

  // Produtividade
  r += `**Produtividade: ${Math.round(ev.scoreProdutividade)} pts**\n\n`;
  r += `Como avaliamos:\n`;
  r += `Comparamos o ritmo (itens/h) com a meta do perfil da operação.\n\n`;
  if (ev.pctErro > perfil.targets.erroCritico) {
    r += `Motivo da pontuação:\n`;
    r += `• A sua taxa de erro ficou acima do limite crítico do perfil, reduzindo parte da nota de produtividade.\n\n`;
  } else if (d.produtividade < perfil.targets.productivity) {
    r += `Motivo da pontuação:\n`;
    r += `• Ritmo de ${d.produtividade} itens/h abaixo da meta de ${perfil.targets.productivity} itens/h.\n\n`;
  }

  // Aderência
  r += `**Aderência ao Método: ${Math.round(ev.scoreAderencia)} pts**\n\n`;
  r += `Como avaliamos:\n`;
  r += `Verificamos se você seguiu os procedimentos definidos por área —\n`;
  r += `principalmente o uso correto da contagem unitária onde é obrigatório.\n\n`;
  if (finalViolacoes.length > 0 || ev.pctBloco > perfil.targets.maxBlockLimit) {
    r += `Motivo da pontuação:\n`;
    for (const v of finalViolacoes) {
      r += `• Bloco em ${getViolacaoArea(v)}: ${getViolacaoRealPct(v).toFixed(1)}% (limite: ${getViolacaoLimitePct(v)}%).\n`;
    }
    if (finalViolacoes.length === 0 && ev.pctBloco > perfil.targets.maxBlockLimit) {
      r += `• O uso de contagem em Bloco acima do limite recomendado reduziu a nota de aderência ao método.\n`;
    }
    r += `\n`;
  }

  r += `---\n\n`;

  if (ev.tags.length > 0) {
    r += `## 🏅 TAGS E DESTAQUES\n\n`;
    ev.tags.forEach((tag) => {
      r += `• ${tag}\n`;
    });
    r += `\n---\n\n`;
  }

  // Para quem tem vínculo, o bloco é orientação de trabalho. Para o prestador,
  // é registro do que foi observado: instruir como executar o serviço é um dos
  // indícios clássicos de subordinação.
  r += free ? `## 📌 CONSTATAÇÕES\n\n` : `## 📌 DIRECIONAMENTO\n\n`;
  r += `**✅ O que você fez bem — continue assim:**\n`;
  const positivos: string[] = [];
  if (errosExecucao === 0) positivos.push("Zero erros de execução registrados.");
  if (pulados === 0) positivos.push("Nenhuma omissão de produto na gôndola.");
  if (ev.scoreProdutividade >= 90) {
    positivos.push("Ótima produtividade e velocidade de contagem.");
  } else if (d.produtividade >= perfil.targets.productivity) {
    positivos.push("Ritmo dentro ou acima da meta do perfil.");
  }
  if (ev.scoreQualidade >= 90) {
    positivos.push("Ótimo cuidado com a qualidade da contagem.");
  }
  if (positivos.length === 0) {
    positivos.push(
      free
        ? "Participação no inventário e entrega dos setores contratados."
        : "Participação no inventário e entrega dos setores.",
    );
  }
  positivos.forEach((p) => {
    r += `• ${p}\n`;
  });

  r += `\n**⚠️ O que precisa melhorar:**\n`;
  const melhorias: string[] = [];

  if (d.produtividade < perfil.targets.productivity) {
    melhorias.push(
      `Seu ritmo de ${d.produtividade} itens/h ficou abaixo da meta de ${perfil.targets.productivity} itens/h.`,
    );
  }

  for (const v of finalViolacoes) {
    const area = getViolacaoArea(v);
    const lim = getViolacaoLimitePct(v);
    const real = getViolacaoRealPct(v);
    if (getViolacaoCritica(v) || lim === 0) {
      melhorias.push(
        `Na área ${area}, o uso de bloco é proibido/restrito. Você registrou ${real.toFixed(1)}%. Essa ocorrência fica registrada formalmente.`,
      );
    } else {
      melhorias.push(
        free
          ? `Uso de bloco em ${area} de ${real.toFixed(1)}%, acima do limite de ${lim}% previsto para o serviço.`
          : `Seu uso de bloco em ${area} foi de ${real.toFixed(1)}%, acima do limite de ${lim}%. Isso impacta Qualidade e Aderência.`,
      );
    }
  }

  if (pulados > 0) {
    melhorias.push(
      free
        ? `${pulados} produto(s) sem contagem, o que gerou divergência no estoque da loja.`
        : `${pulados} produto(s) não contado(s). Isso gera divergência no estoque da loja.`,
    );
  }
  if (duplicados > 0) {
    melhorias.push(
      free
        ? `${duplicados} contagem(ns) registrada(s) em duplicidade.`
        : `${duplicados} contagem(ns) duplicada(s) a evitar no próximo inventário.`,
    );
  }
  if (errosExecucao > 0) {
    melhorias.push(
      free
        ? `${errosExecucao} divergência(s) de quantidade em contagem unitária.`
        : `${errosExecucao} erro(s) de quantidade — revisar bipagem unitária.`,
    );
  }

  if (melhorias.length === 0) {
    if (ev.nivel === "EXCELENTE" || ev.nivel === "BOM") {
      melhorias.push(
        free
          ? "Serviço entregue dentro do padrão de qualidade esperado."
          : "Manter o padrão atual de qualidade e ritmo.",
      );
    } else {
      melhorias.push(
        free
          ? "Rever com o responsável da operação os principais pontos de melhoria."
          : "Rever junto ao líder os principais tipos de erro ocorridos.",
      );
    }
  }
  melhorias.forEach((m) => {
    r += `• ${m}\n`;
  });

  r += `\n`;
  if (free) {
    r += `Esperamos contar com sua participação no próximo evento!\n`;
  } else {
    r += `Contamos com sua evolução no próximo processo!\n`;
  }

  r += `\n---\n\n`;

  // FOOTER
  if (free) {
    r += `Avaliação de desempenho referente à prestação de serviço\n`;
    r += `Evento: ${data} — Operação: ${operationType}\n`;
    r += `Gerado em: ${new Date().toLocaleDateString("pt-BR")}\n`;
  } else if (canon === "INTERMITENTE") {
    r += `*Relatório de qualidade da convocação intermitente*\n`;
    r += `Data: ${data}\n`;
  } else {
    r += `*Relatório gerado pela Avaliação - Módulo Avaliação (Qualidade · Produtividade · Aderência)*\n`;
    r += `Data: ${data}\n`;
  }

  return r;
}
