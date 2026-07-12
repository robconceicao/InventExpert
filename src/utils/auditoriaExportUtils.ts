import { AuditoriaNivel1Result, DivergenciaProdutoSetor } from '../types';

function formatarDivergenciasProprias(itens: DivergenciaProdutoSetor[] | undefined): string {
  if (!itens || itens.length === 0) return '';
  let bloco = `#### Erros de Contagem no Setor (Divergências Próprias)\n`;
  itens.forEach(d => {
    const produto = d.descricao ? `${d.descricao} (EAN ${d.ean})` : `EAN ${d.ean}`;
    bloco += `- Seção ${d.secao} | ${produto}: Divergência de ${d.ajst} un (Contado: ${d.c1} | Final: ${d.final})\n`;
  });
  bloco += `\n`;
  return bloco;
}

export function gerarRelatorioAuditoriaTexto(resultados: AuditoriaNivel1Result[], loja: string, dataInventario: string): string {
  let r = `# AUDITORIA DE ATRIBUIÇÃO DE ERROS (AAE)\n`;
  r += `## Loja: ${loja}\n`;
  r += `## Data: ${dataInventario}\n\n`;
  r += `---\n\n`;

  const comDivergencia = resultados.filter(res => res.status !== 'OK');
  const integros = resultados.filter(res => res.status === 'OK');

  r += `## RESUMO DA INTEGRIDADE\n`;
  r += `- Total de conferentes auditados: ${resultados.length}\n`;
  r += `- Conferentes com divergência de atribuição: ${comDivergencia.length}\n`;
  r += `- Conferentes íntegros (Erro Real == Atribuído): ${integros.length}\n\n`;
  r += `---\n\n`;

  if (comDivergencia.length > 0) {
    r += `## ⚠️ DIVERGÊNCIAS ENCONTRADAS\n\n`;
    comDivergencia.forEach(res => {
      r += `### Conferente: ${res.nome} (Cód: ${res.codigo_conferente})\n`;
      r += `- Status: ${res.status === 'ERRO_DE_TERCEIRO_RECEBIDO' ? 'Recebeu divergência atribuída a terceiro' : 'Divergência própria atribuída a terceiro'}\n`;
      r += `- Erro Real (apurado fisicamente no coletor): ${res.erro_real}\n`;
      r += `- Erro Atribuído (sistema ProInv): ${res.erro_atribuido}\n`;
      r += `- Diferença: ${Math.abs(res.diferenca)}\n\n`;

      r += formatarDivergenciasProprias(res.divergencias_detalhadas);

      if (res.secoes_divergentes && res.secoes_divergentes.length > 0) {
        r += `#### Evidências de Seções (erros de terceiros / seções alheias)\n`;
        res.secoes_divergentes.forEach(sec => {
          r += `   - Seção ${sec.secao} (EAN: ${sec.ean}) apresentou divergência de ${sec.ajst} atribuída ao dispositivo que a contou: ${sec.quem_contou_matricula}\n`;
        });
        r += `\n`;
      }
    });
    r += `---\n\n`;
  }

  r += `## ✅ CONFERENTES ÍNTEGROS\n\n`;
  if (integros.length > 0) {
    integros.forEach(res => {
      r += `- ${res.nome} (Cód: ${res.codigo_conferente}) | Erro apurado: ${res.erro_real}\n`;
      if (res.divergencias_detalhadas && res.divergencias_detalhadas.length > 0) {
        r += formatarDivergenciasProprias(res.divergencias_detalhadas);
      }
    });
  } else {
    r += `Nenhum conferente íntegro nesta auditoria.\n`;
  }

  r += `\n---\n`;
  r += `*Relatório gerado automaticamente pelo Módulo de Auditoria de Atribuição (AAE) do InventExpert*\n`;

  return r;
}
