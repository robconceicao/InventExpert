import type { ConferrerEvaluation } from "../types";

export function generateIndividualReportText(
  ev: ConferrerEvaluation,
  rank: number,
  totalConferentes: number,
  metaDinamica: number,
  mediaProdutividade: number,
  mediaTaxaErro: number,
  dataInventario?: string
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

  report += `## 🎯 COMPOSIÇÃO DO SCORE\n\n`;
  report += `Qualidade: 60% × ${ev.pontosQualidade} = ${((0.6 * ev.pontosQualidade)).toFixed(1)}\n`;
  report += `Produtividade: 25% × ${ev.pontosProdutividade} = ${((0.25 * ev.pontosProdutividade)).toFixed(1)}\n`;
  report += `Método: 15% × ${ev.pontosMetodo} = ${((0.15 * ev.pontosMetodo)).toFixed(1)}\n`;
  if (ev.bonificacoes > 0) report += `Bônus: +${ev.bonificacoes}\n`;
  if (ev.penalidades > 0) report += `Penalidades: -${ev.penalidades}\n`;
  report += `\nScore Final: ${ev.scoreFinal}\n\n`;
  report += `---\n\n`;

  report += `## 📊 COMPARAÇÃO COM O TIME\n\n`;
  report += `${d.nome} vs Média do Time\n\n`;
  report += `Produtividade: ${ev.produtividadeReal} vs ${mediaProdutividade} (${vsMediaProd >= 0 ? "+" : ""}${Math.round(vsMediaProd)}%)\n`;
  report += `Taxa de Erro: ${ev.taxaErroPercentual}% vs ${mediaTaxaErro}% (${vsMediaErro >= 0 ? "+" : ""}${vsMediaErro.toFixed(1)}%)\n`;
  report += `% Bloco: ${ev.percentualBloco}%\n`;
  report += `\n---\n\n`;

  if (ev.alertas.length > 0) {
    report += `## ⚠️ ALERTAS\n\n`;
    ev.alertas.forEach((a) => {
      report += `• ${a.mensagem}\n`;
    });
    report += `\n`;
  }

  report += `## 🎯 META PARA PRÓXIMO INVENTÁRIO\n\n`;
  report += `- Reduzir taxa de erro para ≤ 5%\n`;
  report += `- Manter produtividade ≥ ${metaDinamica} itens/h\n`;
  report += `- Score alvo: ≥ 70\n\n`;
  report += `---\n\n`;
  report += `*Relatório gerado pelo InventExp - Avaliação de Conferentes*\n`;
  report += `Data: ${new Date().toLocaleDateString("pt-BR")}\n`;

  return report;
}
