import {
  ContagemDetalhada,
  AuditoriaAcuracidadeRow,
  AuditoriaAgenteInfo,
  AuditoriaNivel1Result,
  AuditoriaSecaoDivergente,
  DivergenciaProdutoSetor,
  InventoryCheckerInput
} from '../types';

/** Match produto seguro: exact após strip zeros, ou suffix só se ambos ≥ 8 dígitos (EAN). */
export function bipMatchesEan(bip: ContagemDetalhada, ean: string): boolean {
  const eanNorm = (ean || '').replace(/\D/g, '').replace(/^0+/, '') || '';
  if (!eanNorm) return false;
  const candidates = [bip.produto_ean, bip.produto_codigo]
    .map((s) => (s || '').replace(/\D/g, '').replace(/^0+/, '') || '')
    .filter(Boolean);
  for (const c of candidates) {
    if (c === eanNorm) return true;
    if (
      c.length >= 8 &&
      eanNorm.length >= 8 &&
      (eanNorm.endsWith(c) || c.endsWith(eanNorm))
    ) {
      return true;
    }
  }
  return false;
}

export class AuditoriaAtribuicaoService {
  /**
   * Executa a auditoria de Nível 1.
   * @param prcs Array contendo todos os bips lidos e parseados pelo `prcParser`.
   * @param acuracidade Dados extraídos do arquivo ACURACIDADE.xls.
   * @param producao Dados extraídos do PRODUÇÃO.xls (produtividade por conferente via parseInventoryCheckersCsv).
   * @param agentes Mapa de agentes (CadFun/agentes.txt) para resolver CPF -> Matrícula -> Nome.
   */
  static calcularNivel1(
    prcs: ContagemDetalhada[],
    acuracidade: AuditoriaAcuracidadeRow[],
    producao: InventoryCheckerInput[],
    agentes: Map<string, AuditoriaAgenteInfo>
  ): AuditoriaNivel1Result[] {
    const resultados: AuditoriaNivel1Result[] = [];

    // Mapeia todas as seções e seus ajustes a partir do arquivo de acuracidade
    const acuracidadeMap = new Map<string, AuditoriaAcuracidadeRow[]>();
    for (const row of acuracidade) {
      if (!acuracidadeMap.has(row.secao)) {
        acuracidadeMap.set(row.secao, []);
      }
      acuracidadeMap.get(row.secao)!.push(row);
    }

    // Quantos agentes distintos biparam cada seção (fallback rateio)
    const agentesPorSecao = new Map<string, Set<string>>();
    for (const prc of prcs) {
      const id = (prc.matricula || '').replace(/\D/g, '');
      if (!id) continue;
      const set = agentesPorSecao.get(prc.area_codigo) ?? new Set<string>();
      set.add(id);
      agentesPorSecao.set(prc.area_codigo, set);
    }

    for (const prod of producao) {
      const prodMatricula = prod.matricula || '';
      
      // Resolve identidade
      // Pode ser que prod.matricula seja o código ProInv ou o CPF
      const agenteInfo = agentes.get(prodMatricula.replace(/\D/g, '')) || 
                         agentes.get(prodMatricula) || 
                         { codigo: prodMatricula, nome: prod.nome, cpf: prodMatricula };

      const possiveisIdsDispositivo = new Set([
        agenteInfo.cpf, 
        agenteInfo.codigo, 
        prodMatricula
      ].map(id => (id || '').replace(/\D/g, '')).filter(Boolean));

      // 2. Seções contadas pelo conferente (via .prc)
      // O .prc tem 'matricula' (que geralmente é o CPF de 11 dígitos digitado no coletor)
      const bipsDoAgente = prcs.filter(prc => 
        possiveisIdsDispositivo.has((prc.matricula || '').replace(/\D/g, ''))
      );

      const secoesContadas = new Set<string>();
      bipsDoAgente.forEach(bip => secoesContadas.add(bip.area_codigo));

      // 3. Erro Real:
      //    - Se existir bip de produto (EAN/código ≥8) na seção → só agentes com match no produto
      //    - Senão → rateio igual entre agentes da seção
      let erro_real = 0;
      const divergencias_detalhadas: DivergenciaProdutoSetor[] = [];
      for (const secao of secoesContadas) {
        const nAgentesSecao = Math.max(1, agentesPorSecao.get(secao)?.size ?? 1);
        const bipsSecao = prcs.filter((p) => p.area_codigo === secao);
        const itensDaSecao = acuracidadeMap.get(secao) || [];
        for (const item of itensDaSecao) {
          if (item.ajst === 0) continue;

          const productBips = bipsSecao.filter((b) => bipMatchesEan(b, item.ean));
          let share: number;
          if (productBips.length > 0) {
            const agentesProduto = new Set(
              productBips
                .map((b) => (b.matricula || '').replace(/\D/g, ''))
                .filter(Boolean),
            );
            const agenteNoProduto = [...possiveisIdsDispositivo].some((id) =>
              agentesProduto.has(id),
            );
            if (!agenteNoProduto) continue; // outro contou este EAN
            share = 1 / Math.max(1, agentesProduto.size);
          } else {
            share = 1 / nAgentesSecao;
          }

          const ajstShare = item.ajst * share;
          erro_real += Math.abs(ajstShare);
          divergencias_detalhadas.push({
            secao,
            ean: item.ean,
            descricao: item.descricao,
            c1: item.c1,
            final: item.final,
            ajst: ajstShare,
          });
        }
      }

      // Ordenar por |ajst| decrescente para priorizar maiores divergências
      divergencias_detalhadas.sort((a, b) => Math.abs(b.ajst) - Math.abs(a.ajst));

      // 4. Erro Atribuído
      const erro_atribuido = prod.erro || 0;

      // 5. Diferença
      const diferenca = erro_atribuido - erro_real;

      let status: 'OK' | 'ERRO_DE_TERCEIRO_RECEBIDO' | 'ERRO_PROPRIO_EM_OUTRO' = 'OK';
      if (Math.abs(diferenca) < 0.01) {
        status = 'OK';
      } else if (diferenca > 0) {
        status = 'ERRO_DE_TERCEIRO_RECEBIDO';
      } else if (diferenca < 0) {
        status = 'ERRO_PROPRIO_EM_OUTRO';
      }

      // 6. Evidência (de quem / para quem)
      const secoes_divergentes: AuditoriaSecaoDivergente[] = [];
      
      if (status !== 'OK') {
        // Se recebeu erro de terceiro, o erro atribuído é maior. 
        // Provavelmente ele foi cobrado por uma seção que ele NÃO contou.
        // Vamos procurar nas outras seções se tem erro que completa essa diferença.
        // Como não sabemos exatamente qual seção foi atribuída a ele no ProInv (apenas o total),
        // listamos todas as seções do inventário com |AJST| > 0 que não são dele,
        // mas indicando quem REALMENTE contou no .prc.
        // No front-end isso pode ser filtrado melhor.
        for (const [secao, itens] of acuracidadeMap.entries()) {
          if (!secoesContadas.has(secao)) {
            let erroNaSecao = 0;
            itens.forEach(item => { erroNaSecao += Math.abs(item.ajst); });
            
            if (erroNaSecao > 0) {
              // Descobrir quem contou essa seção no .prc
              const bipsDaSecao = prcs.filter(p => p.area_codigo === secao);
              const quemContouSet = new Set(bipsDaSecao.map(b => b.matricula));
              
              const quemContouStr = Array.from(quemContouSet).join(', ') || 'DESCONHECIDO';

              itens.forEach(item => {
                if (Math.abs(item.ajst) > 0) {
                  secoes_divergentes.push({
                    secao,
                    ean: item.ean,
                    descricao: item.descricao,
                    erro_secao: erroNaSecao,
                    ajst: item.ajst,
                    quem_contou_matricula: quemContouStr
                  });
                }
              });
            }
          }
        }
      }

      resultados.push({
        codigo_conferente: agenteInfo.codigo,
        nome: agenteInfo.nome || prod.nome,
        cpf: agenteInfo.cpf,
        erro_real,
        erro_atribuido,
        diferenca,
        status,
        secoes_divergentes,
        divergencias_detalhadas
      });
    }

    // Ordenar por |diferenca| decrescente
    resultados.sort((a, b) => Math.abs(b.diferenca) - Math.abs(a.diferenca));

    return resultados;
  }
}
