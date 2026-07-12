import {
  ContagemDetalhada,
  AuditoriaAcuracidadeRow,
  AuditoriaAgenteInfo,
  AuditoriaNivel1Result,
  AuditoriaSecaoDivergente,
  DivergenciaProdutoSetor,
  InventoryCheckerInput
} from '../types';

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
    // Como a reconciliação é por seção e produto, podemos agrupar por seção.
    // Mas o erro da seção é a soma de |AJST| de todos os produtos dessa seção.
    // E precisamos rastrear o de/para.
    const acuracidadeMap = new Map<string, AuditoriaAcuracidadeRow[]>();
    for (const row of acuracidade) {
      if (!acuracidadeMap.has(row.secao)) {
        acuracidadeMap.set(row.secao, []);
      }
      acuracidadeMap.get(row.secao)!.push(row);
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

      // 3. Erro Real = soma de |AJST| de ACURACIDADE nas seções contadas
      //    + detalhamento por produto/setor (ajst !== 0)
      let erro_real = 0;
      const divergencias_detalhadas: DivergenciaProdutoSetor[] = [];
      for (const secao of secoesContadas) {
        const itensDaSecao = acuracidadeMap.get(secao) || [];
        for (const item of itensDaSecao) {
          erro_real += Math.abs(item.ajst);
          if (item.ajst !== 0) {
            divergencias_detalhadas.push({
              secao,
              ean: item.ean,
              descricao: item.descricao,
              c1: item.c1,
              final: item.final,
              ajst: item.ajst
            });
          }
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
