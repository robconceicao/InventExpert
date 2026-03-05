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

  let r = "";
  r += `# RELATÓRIO INDIVIDUAL - Avaliação\n`;
  r += `## Inventário: ${data}\n`;
  r += `## Operação: ${operationType}\n\n`;
  r += `---\n\n`;

  r += `## 👤 CONFERENTE: ${d.nome}\n\n`;
  r += `Score Final: ${ev.scoreFinal} / 100 — ${ev.nivel}\n`;
  r += `Posição no ranking: ${rank}º de ${totalConferentes}\n\n`;
  r += `---\n\n`;

  r += `## 📊 OS SEUS NÚMEROS\n\n`;
  r += `- Total de peças contadas: ${d.qtde}\n`;
  r += `- Ritmo médio: ${d.produtividade} itens/h (meta do perfil: ${perfil.targets.productivity} itens/h)\n`;
  r += `- % Erro: ${ev.pctErro.toFixed(2)}%\n`;
  r += `- % Bloco: ${ev.pctBloco.toFixed(1)}% (limite recomendado: ${perfil.targets.maxBlockLimit}%)\n\n`;
  r += `---\n\n`;

  r += `## 🎯 COMO A SUA NOTA FOI CALCULADA\n\n`;
  r += `- Qualidade: ${Math.round(ev.scoreQualidade)} pts\n`;
  r += `- Produtividade: ${Math.round(ev.scoreProdutividade)} pts\n`;
  r += `- Aderência ao método: ${Math.round(ev.scoreAderencia)} pts\n\n`;

  if (ev.pctErro > perfil.targets.erroCritico) {
    r += `• A sua taxa de erro ficou acima do limite crítico do perfil, reduzindo parte da nota de produtividade.\n`;
  }
  if (ev.pctBloco > perfil.targets.maxBlockLimit) {
    r += `• O uso de contagem em Bloco acima do limite recomendado reduziu a nota de aderência ao método.\n`;
  }
  if (
    d.produtividade > perfil.targets.productivity &&
    ev.pctErro <= perfil.targets.erroTolerancia
  ) {
    r += `• Você recebeu bônus por manter boa qualidade mesmo com produtividade acima da meta.\n`;
  }
  if (ev.tags.includes("🚨 Risco de Contagem Superficial")) {
    r += `• Foi identificado risco de contagem superficial (erro alto combinado com muito bloco). Revise os critérios de quando usar bloco.\n`;
  }
  if (
    ev.pctErro <= perfil.targets.erroTolerancia &&
    ev.pctBloco <= perfil.targets.maxBlockLimit
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

  r += `## 📌 PRÓXIMOS PASSOS RECOMENDADOS\n\n`;
  if (ev.nivel === "EXCELENTE" || ev.nivel === "BOM") {
    r += `- Manter o padrão atual de qualidade e ritmo.\n`;
    r += `- Compartilhar boas práticas com o time.\n`;
  } else {
    r += `- Rever junto ao líder os principais tipos de erro ocorridos.\n`;
    r += `- Ajustar o equilíbrio entre velocidade e qualidade, priorizando reduzir o % de erro.\n`;
    r += `- Reduzir o uso de contagem em bloco quando não for estritamente necessário.\n`;
  }
  r += `\n---\n\n`;

  r += `*Relatório gerado pela Avaliação - Módulo Avaliação (Qualidade · Produtividade · Aderência)*\n`;
  r += `Data: ${new Date().toLocaleDateString("pt-BR")}\n`;

  return r;
}
