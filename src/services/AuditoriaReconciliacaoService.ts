import { AuditoriaAcuracidadeRow, ContagemDetalhada } from '../types';

export interface AuditoriaReconciliacaoResult {
  ean: string;
  descricao: string;
  fisico_nao_ajustado: number;
  fisico_ajustado: number;
  contabil: number | null;
  dif_nao_ajustado: number | null;
  dif_ajustado: number | null;
  veredito: 'COERENTE' | 'SUSPEITO' | 'INDETERMINADO';
  detalhes: {
    secao: string;
    c1: number;
    final: number;
    ajst: number;
    quem_contou_matricula: string;
  }[];
}

export class AuditoriaReconciliacaoService {
  /**
   * Calcula a reconciliação de Nível 2 para um EAN específico.
   * @param ean EAN do produto selecionado.
   * @param acuracidade Todas as linhas do arquivo de acuracidade.
   * @param prcs Array com todos os bips lidos do .prc.
   * @param contabil Saldo teórico do produto (opcional).
   */
  static calcularNivel2(
    ean: string,
    acuracidade: AuditoriaAcuracidadeRow[],
    prcs: ContagemDetalhada[],
    contabil?: number
  ): AuditoriaReconciliacaoResult {
    // Normalizar o EAN: remover zeros à esquerda para o match, se necessário.
    // Mas no caso, vamos fazer match terminando com, ou igual. 
    // O prefixo "3" do ArqFinal as vezes entra. O match fuzzy é ideal.
    const eanNorm = ean.replace(/^0+/, '');
    
    const linhasProduto = acuracidade.filter(row => 
      row.ean === ean || row.ean.replace(/^0+/, '') === eanNorm || row.ean.endsWith(eanNorm)
    );

    let fisico_nao_ajustado = 0;
    let fisico_ajustado = 0;
    const detalhes: AuditoriaReconciliacaoResult['detalhes'] = [];

    let descricaoProduto = '';

    for (const row of linhasProduto) {
      fisico_nao_ajustado += row.c1;
      fisico_ajustado += row.final;
      if (!descricaoProduto) descricaoProduto = row.descricao;

      // Descobrir quem contou
      const bipsDaSecao = prcs.filter(p => p.area_codigo === row.secao);
      const quemContouSet = new Set(bipsDaSecao.map(b => b.matricula));
      const quemContouStr = Array.from(quemContouSet).join(', ') || 'DESCONHECIDO';

      detalhes.push({
        secao: row.secao,
        c1: row.c1,
        final: row.final,
        ajst: row.ajst,
        quem_contou_matricula: quemContouStr
      });
    }

    let veredito: AuditoriaReconciliacaoResult['veredito'] = 'INDETERMINADO';
    let dif_nao_ajustado: number | null = null;
    let dif_ajustado: number | null = null;

    if (contabil !== undefined && contabil !== null) {
      dif_nao_ajustado = fisico_nao_ajustado - contabil;
      dif_ajustado = fisico_ajustado - contabil;

      const modNaoAjst = Math.abs(dif_nao_ajustado);
      const modAjst = Math.abs(dif_ajustado);

      if (modAjst < modNaoAjst) {
        veredito = 'COERENTE';
      } else {
        veredito = 'SUSPEITO';
      }
    }

    return {
      ean,
      descricao: descricaoProduto,
      fisico_nao_ajustado,
      fisico_ajustado,
      contabil: contabil ?? null,
      dif_nao_ajustado,
      dif_ajustado,
      veredito,
      detalhes
    };
  }
}
