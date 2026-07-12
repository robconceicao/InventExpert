import { AuditoriaReconciliacaoService } from '../AuditoriaReconciliacaoService';
import { ContagemDetalhada, AuditoriaAcuracidadeRow } from '../../types';

describe('AuditoriaReconciliacaoService Nível 2', () => {
  const criarBip = (matricula: string, secao: string): ContagemDetalhada => ({
    matricula, area_codigo: secao, area_nome: 'TESTE', produto_codigo: '123',
    produto_nome: 'PROD', produto_ean: '123', produto_classe: '', quantidade: 10,
    is_bloco: false, data_hora: new Date()
  });

  const criarAcuracidade = (secao: string, ean: string, c1: number, final: number): AuditoriaAcuracidadeRow => ({
    secao, ean, descricao: 'DRAMIN', c1, a1: 0, a2: 0, a3: 0, final, ajst: final - c1
  });

  it('(c) Deve retornar veredito COERENTE se ajuste aproximar do contábil', () => {
    // DRAMIN: nao_ajust 52, ajustado 112, contábil 112
    const acuracidade = [
      criarAcuracidade('1', '7890001', 52, 112)
    ];
    const prcs = [criarBip('111', '1')];

    const resultado = AuditoriaReconciliacaoService.calcularNivel2('7890001', acuracidade, prcs, 112);
    
    expect(resultado.fisico_nao_ajustado).toBe(52);
    expect(resultado.fisico_ajustado).toBe(112);
    expect(resultado.contabil).toBe(112);
    expect(resultado.veredito).toBe('COERENTE');
  });

  it('(d) Deve retornar veredito SUSPEITO se ajuste afastar do contábil', () => {
    const acuracidade = [
      criarAcuracidade('2', '7890002', 100, 50) // C1 = 100, FINAL = 50 (alguém tirou 50)
    ];
    const prcs = [criarBip('222', '2')];

    // O contábil é 100.
    // nao_ajustado (100) - contabil (100) = 0 de diferença
    // ajustado (50) - contabil (100) = -50 de diferença
    // Logo, o ajuste AFASTOU do contábil. É SUSPEITO.
    const resultado = AuditoriaReconciliacaoService.calcularNivel2('7890002', acuracidade, prcs, 100);
    
    expect(resultado.fisico_nao_ajustado).toBe(100);
    expect(resultado.fisico_ajustado).toBe(50);
    expect(resultado.veredito).toBe('SUSPEITO');
  });
});
