import type { ConferrerEvaluation } from "../types";
import type { LimitesErroRef } from "./evaluation";

/** Gera o Relatório Gerencial Completo (POP 8.1) */
export function generateGerencialReportText(
  evaluations: ConferrerEvaluation[],
  resumo: {
    totalConferentes: number;
    totalItens: number;
    taxaMediaErro: number;
    produtividadeMedia: number;
    scoreMedio: number;
  },
  metaDinamica: number,
  referencias?: { limitesErro: LimitesErroRef; limitesDinamicos: boolean },
  dataInventario?: string
): string {
  const data = dataInventario ?? new Date().toLocaleDateString("pt-BR");
  const top5 = evaluations.slice(0, 5);
  const bottom5 = evaluations.slice(-5).reverse();
  const criticos = evaluations.filter((e) => e.classificacaoGeral === "CRITICO");
  const alertasFlat = evaluations.flatMap((e) =>
    e.alertas.map((a) => ({ nome: e.input.nome, ...a }))
  );
  const alertasCriticos = alertasFlat.filter(
    (a) =>
      a.tipo === "erroCritico" ||
      a.tipo === "irbAlto" ||
      a.tipo === "scoreCritico"
  );

  let r = "";
  r += `# RELATÓRIO GERENCIAL - AVALIAÇÃO DE CONFERENTES\n`;
  r += `## Inventário: ${data}\n\n`;
  r += `---\n\n`;

  r += `## 1. RESUMO EXECUTIVO DO INVENTÁRIO\n\n`;
  r += `| Indicador | Valor |\n`;
  r += `|-----------|-------|\n`;
  r += `| Total de conferentes | ${resumo.totalConferentes} |\n`;
  r += `| Total de itens contados | ${resumo.totalItens} |\n`;
  r += `| Taxa média de erro | ${resumo.taxaMediaErro}% |\n`;
  r += `| Produtividade média | ${resumo.produtividadeMedia} itens/h |\n`;
  r += `| Score médio | ${resumo.scoreMedio} |\n`;
  r += `| Meta de produtividade (P50) | ${metaDinamica} itens/h |\n`;
  if (referencias?.limitesDinamicos) {
    r += `| Limites de erro | Dinâmicos (P50: ${referencias.limitesErro.bom}%; P75: ${referencias.limitesErro.atencao}%) |\n`;
  }
  r += `\n---\n\n`;

  r += `## 2. RANKING COMPLETO\n\n`;
  r += `| # | Nome | Score | Classificação | Prod (itens/h) | Erro % | 1a1 % | Bloco % | IRB |\n`;
  r += `|---|------|-------|--------------|----------------|--------|-------|---------|-----|\n`;
  evaluations.forEach((e, i) => {
    r += `| ${i + 1} | ${e.input.nome} | ${e.scoreFinal} | ${e.badge} ${e.classificacaoGeral} | ${e.produtividadeReal} | ${e.taxaErroPercentual} | ${e.percentual1a1} | ${e.percentualBloco} | ${e.irb} |\n`;
  });
  r += `\n---\n\n`;

  r += `## 3. TOP 5 MELHORES\n\n`;
  top5.forEach((e, i) => {
    r += `**${i + 1}º - ${e.input.nome}** (Score: ${e.scoreFinal})\n`;
    r += `- Produtividade: ${e.produtividadeReal} itens/h | Erro: ${e.taxaErroPercentual}% | 1a1: ${e.percentual1a1}%\n\n`;
  });
  r += `---\n\n`;

  r += `## 4. CINCO PIORES / CRÍTICOS\n\n`;
  if (bottom5.length === 0) r += `Nenhum.\n\n`;
  else
    bottom5.forEach((e, i) => {
      const pos = evaluations.length - 5 + i;
      r += `**${pos + 1}º - ${e.input.nome}** (Score: ${e.scoreFinal} - ${e.classificacaoGeral})\n`;
      r += `- Produtividade: ${e.produtividadeReal} itens/h | Erro: ${e.taxaErroPercentual}% | Bloco: ${e.percentualBloco}%\n`;
      if (e.alertas.length > 0)
        r += `- Alertas: ${e.alertas.map((a) => a.mensagem).join("; ")}\n`;
      r += `\n`;
    });
  r += `---\n\n`;

  r += `## 5. ALERTAS CRÍTICOS IDENTIFICADOS\n\n`;
  if (alertasCriticos.length === 0)
    r += `Nenhum alerta crítico (erro > limite, IRB > 1,5 ou score < 50).\n\n`;
  else {
    alertasCriticos.forEach((a) => {
      r += `• **${a.nome}**: ${a.mensagem}\n`;
    });
    r += `\n`;
  }
  if (criticos.length > 0) {
    r += `Conferentes com classificação CRÍTICA (score < 50): ${criticos.map((e) => e.input.nome).join(", ")}.\n\n`;
  }
  r += `---\n\n`;

  r += `## 6. PLANO DE AÇÃO RECOMENDADO\n\n`;
  if (alertasCriticos.length === 0 && criticos.length === 0)
    r += `- Manter acompanhamento rotineiro e reconhecer os melhores desempenhos.\n\n`;
  else {
    if (alertasFlat.some((a) => a.tipo === "erroCritico"))
      r += `- **Erro crítico (> 5%)**: Treinamento urgente; acompanhamento no próximo inventário; revisão de amostra das divergências.\n`;
    if (alertasFlat.some((a) => a.tipo === "blocoAlto"))
      r += `- **Bloco excessivo (farmácia)**: Revisar manual de contagens; reforçar política 1a1; verificar anuência do supervisor.\n`;
    if (alertasFlat.some((a) => a.tipo === "irbAlto"))
      r += `- **IRB crítico (> 1,5)**: Investigação das contagens em bloco; possível recontagem do setor; entrevista com conferente e supervisor.\n`;
    if (alertasFlat.some((a) => a.tipo === "produtividadeBaixa"))
      r += `- **Produtividade muito baixa**: Investigar causa (novo? setor difícil? técnico?); verificar equipamento e sistema.\n`;
    if (alertasFlat.some((a) => a.tipo === "scoreCritico"))
      r += `- **Score crítico (< 50)**: Reunião individual com gestor; investigação completa; decisão sobre reciclagem ou remoção da função; se reciclagem: treinamento intensivo e metas claras.\n`;
    r += `\n`;
  }
  r += `---\n\n`;

  r += `*Relatório gerado pelo InventExp - POP-INV-001 Avaliação de Desempenho de Conferentes*\n`;
  r += `Data: ${new Date().toLocaleDateString("pt-BR")}\n`;

  return r;
}
