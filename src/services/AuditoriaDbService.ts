import { supabase } from './supabase';
import { AuditoriaNivel1Result } from '../types';
import { AuditoriaReconciliacaoResult } from './AuditoriaReconciliacaoService';

export class AuditoriaDbService {
  static async salvarAuditoria(
    loja: string,
    capa: string,
    dataInventario: string | null,
    resultadosNivel1: AuditoriaNivel1Result[]
  ): Promise<string> {
    if (!supabase) throw new Error('Supabase não configurado');

    const totalConferentes = resultadosNivel1.length;
    const totalDivergentes = resultadosNivel1.filter(r => r.status !== 'OK').length;

    const { data: auditoria, error: errorAuditoria } = await supabase
      .from('auditoria_atribuicao')
      .insert({
        loja,
        capa,
        data_inventario: dataInventario,
        total_conferentes: totalConferentes,
        total_divergentes: totalDivergentes,
        resumo_json: { executado_em: new Date().toISOString() }
      })
      .select('id')
      .single();

    if (errorAuditoria) {
      console.error('[AuditoriaDbService] Erro ao salvar cabeçalho:', errorAuditoria);
      throw errorAuditoria;
    }

    const auditoriaId = auditoria.id;

    const itensParaInserir = resultadosNivel1.map(r => ({
      auditoria_id: auditoriaId,
      codigo_conferente: r.codigo_conferente,
      nome: r.nome,
      cpf: r.cpf,
      erro_real: r.erro_real,
      erro_atribuido: r.erro_atribuido,
      diferenca: r.diferenca,
      status: r.status,
      // Evidências de terceiros + erros próprios por produto/setor
      detalhe_json: {
        secoes_divergentes: r.secoes_divergentes,
        divergencias_detalhadas: r.divergencias_detalhadas ?? []
      }
    }));

    if (itensParaInserir.length > 0) {
      const { error: errorItens } = await supabase
        .from('auditoria_atribuicao_item')
        .insert(itensParaInserir);

      if (errorItens) {
        console.error('[AuditoriaDbService] Erro ao salvar itens:', errorItens);
      }
    }

    return auditoriaId;
  }

  static async salvarReconciliacao(
    auditoriaId: string,
    reconciliacao: AuditoriaReconciliacaoResult
  ): Promise<void> {
    if (!supabase) throw new Error('Supabase não configurado');
    const { error } = await supabase
      .from('auditoria_reconciliacao')
      .insert({
        auditoria_id: auditoriaId,
        ean: reconciliacao.ean,
        descricao: reconciliacao.descricao,
        fisico_nao_ajustado: reconciliacao.fisico_nao_ajustado,
        fisico_ajustado: reconciliacao.fisico_ajustado,
        contabil: reconciliacao.contabil,
        dif_nao_ajustado: reconciliacao.dif_nao_ajustado,
        dif_ajustado: reconciliacao.dif_ajustado,
        veredito: reconciliacao.veredito,
        detalhe_json: reconciliacao.detalhes
      });

    if (error) {
      console.error('[AuditoriaDbService] Erro ao salvar reconciliação:', error);
      throw error;
    }
  }
}
