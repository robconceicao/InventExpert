import { INVENTORY_PROFILES } from "../config/inventoryEvalConfig";
import type {
    InventoryCheckerEvaluation,
    InventoryOperationType,
} from "../types";

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
    r += `**${i + 1}º - ${e.input.nome}** (Score: ${e.scoreFinal} - ${
      e.nivel
    })\n`;
    r += `- Produtividade: ${e.input.produtividade} itens/h | % Erro: ${e.pctErro.toFixed(
      2,
    )}% | % Bloco: ${e.pctBloco.toFixed(1)}%\n`;
    if (e.tags.length > 0) {
      r += `- Tags: ${e.tags.join(" · ")}\n`;
    }
    r += `\n`;
  });
  r += `---\n\n`;

  r += `## 4. CONFERENTES EM ALERTA / CRÍTICO\n\n`;
  if (bottom5.length === 0) {
    r += `Nenhum conferente em nível crítico.\n\n`;
  } else {
    bottom5.forEach((e, i) => {
      const pos = evaluations.length - 5 + i;
      r += `**${pos + 1}º - ${e.input.nome}** (Score: ${e.scoreFinal} - ${
        e.nivel
      })\n`;
      r += `- Produtividade: ${e.input.produtividade} itens/h | % Erro: ${e.pctErro.toFixed(
        2,
      )}% | % Bloco: ${e.pctBloco.toFixed(1)}%\n`;
      if (e.tags.length > 0) {
        r += `- Tags: ${e.tags.join(" · ")}\n`;
      }
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

export function generateInventExpIndividualReportText(
  operationType: InventoryOperationType,
  ev: InventoryCheckerEvaluation,
  rank: number,
  totalConferentes: number,
  dataInventario?: string,
): string {
  const data = dataInventario ?? new Date().toLocaleDateString("pt-BR");
  const perfil = INVENTORY_PROFILES[operationType];
  const d = ev.input;
  const mod = d.modalidadeContrato || "CLT";

  let r = "";
  r += `# RELATÓRIO INDIVIDUAL - Avaliação\n`;
  r += `## Inventário: ${data}\n`;
  r += `## Operação: ${operationType}\n\n`;
  r += `---\n\n`;

  // Cabeçalho por modalidade
  if (mod === "FREE_LANCE") {
    r += `## 👤 PRESTADOR: ${d.nome}\n\n`;
  } else if (mod === "INTERMITENTE") {
    r += `## 👤 COLABORADOR INTERMITENTE: ${d.nome}\n\n`;
  } else {
    r += `## 👤 CONFERENTE: ${d.nome}\n\n`;
  }

  r += `Score Final: ${ev.scoreFinal} / 100 — ${ev.nivel}\n`;
  r += `Posição no ranking: ${rank}º de ${totalConferentes}\n\n`;
  r += `---\n\n`;

  // Alerta Crítico (deve aparecer ANTES do bloco de números gerais)
  const temViolacaoCritica = ev.violacoes && ev.violacoes.some(v => v.critica);
  if (temViolacaoCritica) {
    r += `🚨 ALERTA — USO DE BLOCO EM ÁREA RESTRITA 🚨\n`;
    if (mod === "CLT") {
      r += `Você utilizou contagem em bloco acima do limite permitido em áreas restritas. Por ser colaborador CLT, essa prática é considerada falta grave e passível de medida disciplinar.\n\n`;
    } else if (mod === "INTERMITENTE") {
      r += `Você utilizou contagem em bloco acima do limite permitido em áreas restritas. Essa prática afeta a qualidade da entrega e futuras convocações.\n\n`;
    } else {
      r += `Houve registro de contagem em bloco acima do limite em áreas restritas. Isso compromete a qualidade da prestação de serviço.\n\n`;
    }
    const criticas = ev.violacoes!.filter(v => v.critica).map(v => v.area);
    r += `Áreas impactadas: ${criticas.join(', ')}\n\n---\n\n`;
  }

  // OS SEUS NÚMEROS GERAIS
  r += `## 📊 OS SEUS NÚMEROS GERAIS\n\n`;
  r += `- Total de peças contadas: ${d.qtde}\n`;
  r += `- Ritmo médio: ${d.produtividade} itens/h (meta do perfil: ${perfil.targets.productivity} itens/h)\n`;
  r += `- % Erro global: ${ev.pctErro.toFixed(2)}%\n`;
  r += `- % Bloco global: ${ev.pctBloco.toFixed(1)}% (limite recomendado: ${perfil.targets.maxBlockLimit}%)\n\n`;
  r += `---\n\n`;

  // RAIO-X DA QUALIDADE OPERACIONAL
  r += `## 🔍 RAIO-X DA QUALIDADE OPERACIONAL\n\n`;
  const errosExecucao = d.erro || 0;
  const pulados = d.itensPulados || 0;
  const duplicados = d.itensDuplicados || 0;
  const erroSecao = d.erroSecao || 0;

  if (errosExecucao === 0 && pulados === 0 && duplicados === 0 && erroSecao === 0) {
    r += `Nenhuma ocorrência de qualidade registrada.\n\n`;
  } else {
    if (errosExecucao > 0) r += `- Erros de Execução: ${errosExecucao} erro(s)\n`;
    if (pulados > 0) r += `- Itens Não Contados na Gôndola: ${pulados} produto(s)\n`;
    if (duplicados > 0) r += `- Contagens Duplicadas: ${duplicados} produto(s)\n`;
    if (erroSecao > 0) r += `- Erro de Seção: ${erroSecao} unidade(s)\n`;
    
    if (errosExecucao > 0 && pulados > 0 && duplicados > 0) {
      r += `\n* Nota: ICSI de 40% (erros em direções opostas podem ocultar impactos maiores de qualidade).\n`;
    }
  }
  r += `\n---\n\n`;

  // SUAS SEÇÕES — ACURÁCIA
  if (ev.secoes && ev.secoes.length > 0) {
    r += `## 🎯 SUAS SEÇÕES — ACURÁCIA\n\n`;
    r += `| Seção | Itens | % Erro | % Bloco | Status |\n`;
    r += `|-------|-------|--------|---------|--------|\n`;
    ev.secoes.forEach(sec => {
      let status = "✅";
      if (sec.violacaoBloco) {
        status = sec.violacaoBloco.critica ? "🚨" : "⚠️";
      }
      r += `| ${sec.area} | ${sec.totalItens} | ${sec.pctErro.toFixed(1)}% | ${sec.pctBloco.toFixed(1)}% | ${status} |\n`;
    });
    r += `\n---\n\n`;
  }

  // COMO A NOTA FOI CALCULADA
  r += `## 🧮 COMO A SUA NOTA FOI CALCULADA\n\n`;
  r += `O nosso modelo avalia 3 pilares:\n`;
  
  // Qualidade
  r += `1. **Qualidade (${Math.round(ev.scoreQualidade)} pts):** Baseado na ausência de erros e perfil de execução.\n`;
  if (ev.violacoes && ev.violacoes.length > 0) {
    const areas = ev.violacoes.map(v => v.area).join(", ");
    r += `   - Motivo da pontuação: Bloco acima do limite em ${areas}.\n`;
  } else if (errosExecucao === 0) {
    r += `   - Motivo da pontuação: Excelente acurácia.\n`;
  }
  
  // Produtividade
  r += `2. **Produtividade (${Math.round(ev.scoreProdutividade)} pts):** O ritmo atingido.\n`;
  if (ev.pctErro > perfil.targets.erroCritico) {
    r += `   - Motivo: A sua taxa de erro ficou acima do limite crítico do perfil, reduzindo parte da nota de produtividade.\n`;
  } else if (d.produtividade < perfil.targets.productivity) {
    r += `   - Motivo: Ritmo de ${d.produtividade} itens/h abaixo da meta de ${perfil.targets.productivity} itens/h.\n`;
  } else {
    r += `   - Motivo: Produtividade dentro ou acima da meta.\n`;
  }
  
  // Aderência
  r += `3. **Aderência ao método (${Math.round(ev.scoreAderencia)} pts):** Respeito às regras.\n`;
  if (ev.pctBloco > perfil.targets.maxBlockLimit) {
    r += `   - Motivo: O uso de contagem em Bloco acima do limite recomendado reduziu a nota de aderência ao método.\n`;
  }

  r += `\n---\n\n`;

  if (ev.tags.length > 0) {
    r += `## 🏅 TAGS E DESTAQUES\n\n`;
    ev.tags.forEach((tag) => {
      r += `• ${tag}\n`;
    });
    r += `\n---\n\n`;
  }

  // DIRECIONAMENTO
  r += `## 📌 DIRECIONAMENTO\n\n`;
  r += `**🌟 O que você fez bem:**\n`;
  if (ev.scoreProdutividade >= 90) {
    r += `- Ótima produtividade e velocidade de contagem.\n`;
  } else if (ev.scoreQualidade >= 90) {
    r += `- Ótimo cuidado com a qualidade da contagem.\n`;
  } else {
    r += `- Participação no inventário e entrega dos setores.\n`;
  }

  r += `\n**⚠️ O que precisa melhorar:**\n`;
  if (ev.nivel === "EXCELENTE" || ev.nivel === "BOM") {
    r += `- Manter o padrão atual de qualidade e ritmo.\n`;
  } else {
    r += `- Rever junto ao líder os principais tipos de erro ocorridos.\n`;
    r += `- Ajustar o equilíbrio entre velocidade e qualidade.\n`;
  }

  if (d.produtividade < perfil.targets.productivity) {
    r += `- Seu ritmo de ${d.produtividade} foi baixo. Tente focar para aumentar a produtividade.\n`;
  }

  if (ev.violacoes && ev.violacoes.length > 0) {
    const areas = ev.violacoes.map(v => v.area).join(", ");
    r += `- Reduzir o uso de contagem em bloco nas áreas restritas como ${areas}.\n`;
    if (mod === "CLT") {
      r += `- Atenção: A violação em ${areas} foi registrada formalmente.\n`;
    } else {
      r += `- Atenção: A violação em ${areas} impacta a avaliação da prestação de serviço.\n`;
    }
  } else if (ev.pctBloco > perfil.targets.maxBlockLimit) {
    r += `- Reduzir o uso de contagem em bloco globalmente.\n`;
  }
  
  r += `\n---\n\n`;

  // FOOTER
  if (mod === "FREE_LANCE") {
    r += `*Documento de avaliação da prestação de serviço*\n`;
    r += `Evento: ${data}\n`;
  } else if (mod === "INTERMITENTE") {
    r += `*Relatório de qualidade da convocação intermitente*\n`;
    r += `Data: ${data}\n`;
  } else {
    r += `*Relatório gerado pela Avaliação - Módulo Avaliação (Qualidade · Produtividade · Aderência)*\n`;
    r += `Data: ${data}\n`;
  }

  return r;
}
