import type { ConferrerEvaluation } from "../types";

/** Pesos do score (qualidade, produtividade, método) para exibição - ex.: Farmácia 60%, 25%, 15% */
export type PesosExibicao = { qualidade: number; produtividade: number; metodo: number };

const PESOS_FARMACIA: PesosExibicao = { qualidade: 0.6, produtividade: 0.25, metodo: 0.15 };

export function generateIndividualReportText(
  ev: ConferrerEvaluation,
  rank: number,
  totalConferentes: number,
  metaDinamica: number,
  mediaProdutividade: number,
  mediaTaxaErro: number,
  dataInventario?: string,
  pesos: PesosExibicao = PESOS_FARMACIA
): string {
  const d = ev.input;
  const data = dataInventario ?? new Date().toLocaleDateString("pt-BR");
  const pctMeta = metaDinamica > 0 ? (ev.produtividadeReal / metaDinamica) * 100 : 0;
  const vsMediaProd =
    mediaProdutividade > 0
      ? ((ev.produtividadeReal - mediaProdutividade) / mediaProdutividade) * 100
      : 0;
  const vsMediaErro = mediaTaxaErro > 0 ? ev.taxaErroPercentual - mediaTaxaErro : 0;

  let report = "";

  report += `# RELATÓRIO INDIVIDUAL DE DESEMPENHO\n`;
  report += `## Inventário: ${data}\n\n`;
  report += `---\n\n`;
  report += `## 👤 CONFERENTE: ${d.nome}\n\n`;
  report += `### ${ev.badge} CLASSIFICAÇÃO GERAL: ${rank}º de ${totalConferentes} conferentes\n\n`;
  report += `Score Final: ${ev.scoreFinal} / 100 - ${ev.classificacaoGeral}\n\n`;
  report += `---\n\n`;
  report += `## 📊 RESUMO EXECUTIVO\n\n`;
  report += `| Métrica | Valor | Classificação |\n`;
  report += `|---------|-------|---------------|\n`;
  report += `| Produtividade | ${ev.produtividadeReal} itens/h | ${pctMeta >= 100 ? "BOM" : pctMeta >= 80 ? "ATENÇÃO" : "CRÍTICO"} |\n`;
  report += `| Taxa de Erro | ${ev.taxaErroPercentual}% | ${ev.taxaErroPercentual <= 5 ? "BOM" : ev.taxaErroPercentual <= 15 ? "ATENÇÃO" : "CRÍTICO"} |\n`;
  report += `| Acurácia | ${ev.acuracia}% | - |\n`;
  report += `| Aderência ao Método | ${ev.percentual1a1}% 1a1 | ${ev.percentualBloco <= 30 ? "OK" : "ATENÇÃO"} |\n`;
  report += `| Posição no Ranking | ${rank}º de ${totalConferentes} | - |\n\n`;
  report += `---\n\n`;

  report += `## 📈 PRODUTIVIDADE\n\n`;
  report += `- Itens contados: ${d.qtde}\n`;
  report += `- Horas trabalhadas: ${d.horas}\n`;
  report += `- Produtividade real: ${ev.produtividadeReal} itens/h\n`;
  report += `- Meta do time: ${metaDinamica} itens/h\n`;
  report += `- Performance: ${Math.round(pctMeta)}% da meta\n\n`;
  report += `---\n\n`;

  report += `## ✅ QUALIDADE\n\n`;
  report += `- Erros registrados: ${d.erro}\n`;
  report += `- Taxa de erro: ${ev.taxaErroPercentual}%\n`;
  report += `- Erros por 1.000 itens: ${ev.taxaErroPor1000}\n`;
  report += `- Acurácia: ${ev.acuracia}%\n\n`;
  report += `---\n\n`;

  report += `## 🎯 ADERÊNCIA AO MÉTODO\n\n`;
  report += `- Contagem 1a1: ${d.umAum} (${ev.percentual1a1}%)\n`;
  report += `- Contagem Bloco: ${d.bloco} (${ev.percentualBloco}%)\n`;
  report += `- IRB (Risco de Bloco): ${ev.irb} - ${ev.irbClassificacao}\n\n`;
  report += `---\n\n`;

  const q = (pesos.qualidade * 100).toFixed(0);
  const p = (pesos.produtividade * 100).toFixed(0);
  const m = (pesos.metodo * 100).toFixed(0);
  report += `## 🎯 COMPOSIÇÃO DO SCORE (POP 5.3)\n\n`;
  report += `Qualidade: ${q}% × ${ev.pontosQualidade} = ${(pesos.qualidade * ev.pontosQualidade).toFixed(1)}\n`;
  report += `Produtividade: ${p}% × ${ev.pontosProdutividade} = ${(pesos.produtividade * ev.pontosProdutividade).toFixed(1)}\n`;
  report += `Método: ${m}% × ${ev.pontosMetodo} = ${(pesos.metodo * ev.pontosMetodo).toFixed(1)}\n`;
  if (ev.bonificacoes > 0) report += `Bonificações: +${ev.bonificacoes}\n`;
  if (ev.penalidades > 0) report += `Penalidades: -${ev.penalidades}\n`;
  report += `\nScore Final: ${ev.scoreFinal}\n\n`;
  report += `---\n\n`;

  report += `## 📊 COMPARAÇÃO COM O TIME\n\n`;
  report += `${d.nome} vs Média do Time\n\n`;
  report += `Produtividade: ${ev.produtividadeReal} vs ${mediaProdutividade} (${vsMediaProd >= 0 ? "+" : ""}${Math.round(vsMediaProd)}%)\n`;
  report += `Taxa de Erro: ${ev.taxaErroPercentual}% vs ${mediaTaxaErro}% (${vsMediaErro >= 0 ? "+" : ""}${vsMediaErro.toFixed(1)}%)\n`;
  report += `% Bloco: ${ev.percentualBloco}%\n\n`;
  report += `---\n\n`;

  report += `## 📌 PONTOS FORTES E OPORTUNIDADES\n\n`;
  const pontosFortes: string[] = [];
  const oportunidades: string[] = [];
  if (ev.taxaErroPercentual < 1) pontosFortes.push("Baixa taxa de erro");
  if (ev.acuracia >= 98) pontosFortes.push("Alta acurácia");
  if (pctMeta >= 100) pontosFortes.push("Produtividade na meta ou acima");
  if (ev.percentual1a1 >= 70) pontosFortes.push("Boa aderência ao método 1a1");
  if (d.erro === 0 && d.qtde >= 100) pontosFortes.push("Zero erros com volume relevante");
  if (ev.taxaErroPercentual > 2) oportunidades.push("Reduzir taxa de erro");
  if (pctMeta < 80) oportunidades.push("Elevar produtividade em relação à meta");
  if (ev.percentualBloco > 30) oportunidades.push("Aumentar uso de contagem 1a1");
  if (ev.irb > 0.8) oportunidades.push("Reduzir risco de bloco (IRB)");
  if (pontosFortes.length === 0) pontosFortes.push("—");
  if (oportunidades.length === 0) oportunidades.push("Manter padrão atual");
  report += `**Pontos fortes:** ${pontosFortes.join("; ")}\n\n`;
  report += `**Oportunidades de melhoria:** ${oportunidades.join("; ")}\n\n`;
  report += `---\n\n`;

  if (ev.alertas.length > 0) {
    report += `## ⚠️ ALERTAS\n\n`;
    ev.alertas.forEach((a) => {
      report += `• ${a.mensagem}\n`;
    });
    report += `\n`;
  }

  report += `## 🎯 METAS PARA PRÓXIMO INVENTÁRIO\n\n`;
  report += `- Taxa de erro: ≤ 5% (ideal ≤ 2%)\n`;
  report += `- Produtividade: ≥ ${metaDinamica} itens/h\n`;
  report += `- Score alvo: ≥ 70 (Bom)\n`;
  report += `- Aderência 1a1: manter ou aumentar % 1a1\n\n`;
  report += `---\n\n`;

  report += `## 📋 PLANO DE DESENVOLVIMENTO INDIVIDUAL\n\n`;
  if (ev.alertas.length > 0) {
    if (ev.alertas.some((a) => a.tipo === "erroCritico"))
      report += `- Participar de treinamento sobre pontos críticos de contagem e revisão de divergências.\n`;
    if (ev.alertas.some((a) => a.tipo === "blocoAlto"))
      report += `- Reforçar política de contagem 1a1 e uso de bloco apenas com anuência.\n`;
    if (ev.alertas.some((a) => a.tipo === "irbAlto"))
      report += `- Revisar contagens em bloco e alinhar com supervisor.\n`;
    if (ev.alertas.some((a) => a.tipo === "produtividadeBaixa"))
      report += `- Identificar causas da baixa produtividade (setor, equipamento, processo) com o gestor.\n`;
    if (ev.alertas.some((a) => a.tipo === "scoreCritico"))
      report += `- Reunião com gestor para plano de reciclagem ou metas de melhoria com acompanhamento.\n`;
  } else {
    report += `- Manter padrão de desempenho; considerar como referência para o time.\n`;
  }
  report += `\n---\n\n`;

  report += `*Relatório gerado pelo InventExp - POP-INV-001 Avaliação de Desempenho de Conferentes*\n`;
  report += `Data: ${new Date().toLocaleDateString("pt-BR")}\n`;

  return report;
}
