import { INVENTORY_PROFILES } from "../config/inventoryEvalConfig";
import type {
    InventoryCheckerEvaluation,
    InventoryOperationType,
    SectionAccuracyRecord,
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


  r += `## 2. RANKING COMPLETO\n\n`;
  r += `| # | Nome | Nível Exp. | Score | Nível | Prod | % Erro | ICV | Tags |\n`;
  r += `|---|------|------------|-------|------|------|--------|-----|------|\n`;
  evaluations.forEach((e, i) => {
    const icvStr = e.icv !== undefined ? Math.round(e.icv) + '%' : '-';
    const expStr = e.input.experiencia ? e.input.experiencia.toUpperCase() : '-';
    r += `| ${i + 1} | ${e.input.nome} | ${expStr} | ${e.scoreFinal} | ${e.nivel} | ${
      e.input.produtividade
    } | ${e.pctErro.toFixed(2)} | ${icvStr} | ${
      e.tags.join(" · ") || "-"
    } |\n`;
  });
  r += `\n---\n\n`;

  r += `## 3. TOP 5 MELHORES\n\n`;
  top5.forEach((e, i) => {
    const icvStr = e.icv !== undefined ? Math.round(e.icv) + '%' : '-';
    const expStr = e.input.experiencia ? e.input.experiencia.toUpperCase() : '-';
    r += `**${i + 1}º - ${e.input.nome}** (Score: ${e.scoreFinal} - ${
      e.nivel
    })\n`;
    r += `- Experiência: ${expStr} | Produtividade: ${e.input.produtividade} itens/h | % Erro: ${e.pctErro.toFixed(
      2,
    )}% | ICV: ${icvStr}\n`;
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

  // MAPA DE ACURÁCIA DE SEÇÕES (opcional — só quando dados estendidos estão disponíveis)
  if (sectionAccuracy && sectionAccuracy.length > 0) {
    r += `\n---\n\n`;
    r += `## 7. MAPA DE ACURÁCIA DE SEÇÕES FÍSICAS\n\n`;
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

  r += `## 🔍 RAIO-X DA SUA QUALIDADE OPERACIONAL\n`;
  r += `Para te ajudar a entender seus pontos fortes e onde precisamos redobrar a atenção, mapeamos o comportamento das suas seções:\n\n`;
  
  r += `- **Erros de Execução (Quantidade direta)**: ${d.erro} erros.\n`;
  r += `  _(Produto bipado, mas a quantidade digitada na tela foi maior/menor que o real)_\n\n`;
  
  r += `- **Itens Esquecidos na Gôndola (Omissão)**: ${d.itensPulados || 0} produtos.\n`;
  r += `  _(Prateleira pulada ou produto sem bip. Afeta diretamente a quebra física da loja!)_\n\n`;

  r += `- **Contagens Duplicadas (Excesso)**: ${d.itensDuplicados || 0} produtos.\n`;
  r += `  _(Produto bipado por engano ou gancho repetido que já havia sido contado)_\n\n`;

  if (d.erroSecao !== undefined) {
    r += `- **Erro de Seção (Σ|Ajuste Área|)**: ${d.erroSecao} unidades.\n`;
    r += `  _(Soma dos ajustes modulares após recontagem das seções físicas)_\n\n`;
    if (ev.icsi !== undefined) {
      const icsiPct = Math.round(ev.icsi * 100);
      r += `- **ICSI (Índice de Consistência Seção/Item)**: ${icsiPct}%\n`;
      if (icsiPct >= 80) {
        r += `  _(Alto: seus erros são diretos e identificáveis — mais fácil de corrigir com treinamento)_\n\n`;
      } else if (icsiPct >= 50) {
        r += `  _(Médio: parte dos erros se compensou internamente nas seções)_\n\n`;
      } else {
        r += `  _(Baixo: erros em direções opostas dentro das seções — risco oculto na gôndola)_\n\n`;
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

  r += `## 📌 DIRECIONAMENTO PARA O PRÓXIMO INVENTÁRIO\n\n`;
  
  const pulados = d.itensPulados || 0;
  const duplicados = d.itensDuplicados || 0;

  if (pulados > 15) {
    r += `💡 **Foco em Varredura:** No próximo inventário, sua atenção deve ser voltada para a varredura visual completa da prateleira (da esquerda para a direita, de cima para baixo), garantindo que nenhum produto ou gancho fique para trás sem o bip.\n\n`;
  } else if (duplicados > 20) {
    r += `💡 **Foco em Demarcação:** Certifique-se de marcar visualmente ou usar as etiquetas de marcação nas seções para nunca recontar uma área que você ou seu colega já finalizaram.\n\n`;
  } else if (ev.nivel === "EXCELENTE" || ev.nivel === "BOM") {
    r += `✅ **Manter o Padrão:** Continue mantendo o equilíbrio atual entre velocidade e qualidade. Seus números de atenção visual estão muito bons!\n\n`;
  } else {
    r += `⚠️ **Ajuste de Qualidade:** Priorize reduzir o % de erro bruto digitado. Revise junto à liderança os principais tipos de erros ocorridos hoje e reduza o uso de contagem em bloco quando não for estritamente necessário.\n\n`;
  }

  r += `Contamos com sua atenção e evolução no próximo processo!\n`;
  r += `\n---\n\n`;

  r += `*Relatório gerado pela Avaliação - Módulo Avaliação (Qualidade · Produtividade · Aderência)*\n`;
  r += `Data: ${new Date().toLocaleDateString("pt-BR")}\n`;

  return r;
}
