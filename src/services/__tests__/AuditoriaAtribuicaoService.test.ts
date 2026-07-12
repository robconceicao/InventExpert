import { AuditoriaAtribuicaoService } from '../AuditoriaAtribuicaoService';
import { ContagemDetalhada, AuditoriaAcuracidadeRow, AuditoriaAgenteInfo, InventoryCheckerInput } from '../../types';

describe('AuditoriaAtribuicaoService Nível 1', () => {
  const criarBip = (matricula: string, secao: string): ContagemDetalhada => ({
    matricula,
    area_codigo: secao,
    area_nome: 'TESTE',
    produto_codigo: '123',
    produto_nome: 'PROD',
    produto_ean: '123',
    produto_classe: '',
    quantidade: 10,
    is_bloco: false,
    data_hora: new Date()
  });

  const criarAcuracidade = (secao: string, ean: string, ajst: number): AuditoriaAcuracidadeRow => ({
    secao, ean, descricao: 'PROD', c1: 10, a1: 0, a2: 0, a3: 0, final: 10 + ajst, ajst
  });

  const criarProducao = (matricula: string, erroQtde: number): InventoryCheckerInput => ({
    nome: 'Conferente ' + matricula,
    matricula,
    qtde: 100, qtde1a1: 100, produtividade: 100, erro: erroQtde
  });

  it('(a) Deve retornar status OK quando o erro real for igual ao atribuído', () => {
    const agentes = new Map<string, AuditoriaAgenteInfo>([
      ['11111111111', { codigo: '000001', nome: 'João', cpf: '11111111111' }]
    ]);
    const prcs = [
      criarBip('11111111111', '000001'),
      criarBip('11111111111', '000002')
    ];
    const acuracidade = [
      criarAcuracidade('000001', '789123', -5), // |AJST| = 5
      criarAcuracidade('000002', '789456', 3)   // |AJST| = 3. Erro Real = 8
    ];
    const producao = [
      criarProducao('11111111111', 8)
    ];

    const resultado = AuditoriaAtribuicaoService.calcularNivel1(prcs, acuracidade, producao, agentes);
    expect(resultado).toHaveLength(1);
    expect(resultado[0].erro_real).toBe(8);
    expect(resultado[0].erro_atribuido).toBe(8);
    expect(resultado[0].status).toBe('OK');
    expect(resultado[0].diferenca).toBe(0);
  });

  it('(b) Deve sinalizar ERRO_DE_TERCEIRO_RECEBIDO se erro_atribuido > erro_real', () => {
    const agentes = new Map<string, AuditoriaAgenteInfo>([
      ['22222222222', { codigo: '000002', nome: 'Maria', cpf: '22222222222' }]
    ]);
    const prcs = [
      criarBip('22222222222', '000010')
    ];
    const acuracidade = [
      criarAcuracidade('000010', 'EAN1', 2), // Erro real da Maria = 2
      criarAcuracidade('000099', 'EAN2', 5)  // Outra seção que ela NÃO contou
    ];
    const producao = [
      criarProducao('22222222222', 7) // Cobraram 7 dela (2 dela + 5 de outro)
    ];

    const resultado = AuditoriaAtribuicaoService.calcularNivel1(prcs, acuracidade, producao, agentes);
    expect(resultado[0].status).toBe('ERRO_DE_TERCEIRO_RECEBIDO');
    expect(resultado[0].diferenca).toBe(5);
    // Deve listar a seção 99 como suspeita de ser o erro recebido indevidamente
    expect(resultado[0].secoes_divergentes).toHaveLength(1);
    expect(resultado[0].secoes_divergentes[0].secao).toBe('000099');
  });

  it('(e) Deve somar corretamente se o conferente usou múltiplos dispositivos (várias matrículas)', () => {
    // Digamos que no producao a chave vem como o Codigo
    const agentes = new Map<string, AuditoriaAgenteInfo>([
      ['000003', { codigo: '000003', nome: 'Pedro', cpf: '33333333333' }],
      ['33333333333', { codigo: '000003', nome: 'Pedro', cpf: '33333333333' }]
    ]);
    const prcs = [
      criarBip('33333333333', '100'), // Usou o CPF real num coletor
      criarBip('000003', '101')       // Digitou apenas o código de 6 dígitos no outro coletor
    ];
    const acuracidade = [
      criarAcuracidade('100', 'EAN1', 1), // erro 1
      criarAcuracidade('101', 'EAN2', 1)  // erro 1. total real = 2
    ];
    const producao = [
      criarProducao('000003', 2) // Veio pelo código 000003 do sistema de prod
    ];

    const resultado = AuditoriaAtribuicaoService.calcularNivel1(prcs, acuracidade, producao, agentes);
    expect(resultado[0].status).toBe('OK');
    expect(resultado[0].erro_real).toBe(2);
  });

  it('(f) Deve lidar corretamente com zeros no CPF e resolução da matrícula', () => {
    const agentes = new Map<string, AuditoriaAgenteInfo>([
      ['01234567890', { codigo: '000004', nome: 'Ana', cpf: '01234567890' }]
    ]);
    const prcs = [
      criarBip('01234567890', '200')
    ];
    const acuracidade = [
      criarAcuracidade('200', '0003123456', 4) // EAN com prefixo "3" e zeros
    ];
    const producao = [
      criarProducao('01234567890', 4)
    ];

    const resultado = AuditoriaAtribuicaoService.calcularNivel1(prcs, acuracidade, producao, agentes);
    expect(resultado[0].status).toBe('OK');
    expect(resultado[0].erro_real).toBe(4);
  });

  it('(g) Deve detalhar divergências por produto/setor e a soma |ajst| deve igualar erro_real', () => {
    const agentes = new Map<string, AuditoriaAgenteInfo>([
      ['11111111111', { codigo: '000001', nome: 'João', cpf: '11111111111' }]
    ]);
    const prcs = [
      criarBip('11111111111', '000001'),
      criarBip('11111111111', '000002')
    ];
    const acuracidade = [
      criarAcuracidade('000001', '789123', -5), // perda
      criarAcuracidade('000001', '789999', 0),  // sem ajuste — não entra no detalhe
      criarAcuracidade('000002', '789456', 3),  // sobra
    ];
    const producao = [
      criarProducao('11111111111', 8)
    ];

    const resultado = AuditoriaAtribuicaoService.calcularNivel1(prcs, acuracidade, producao, agentes);
    const item = resultado[0];

    expect(item.erro_real).toBe(8);
    expect(item.divergencias_detalhadas).toBeDefined();
    expect(item.divergencias_detalhadas).toHaveLength(2);

    const somaAbs = item.divergencias_detalhadas!.reduce((s, d) => s + Math.abs(d.ajst), 0);
    expect(somaAbs).toBe(item.erro_real);

    // Ordenado por |ajst| desc: -5 primeiro, depois +3
    expect(item.divergencias_detalhadas![0]).toMatchObject({
      secao: '000001',
      ean: '789123',
      ajst: -5,
      c1: 10,
      final: 5
    });
    expect(item.divergencias_detalhadas![1]).toMatchObject({
      secao: '000002',
      ean: '789456',
      ajst: 3,
      c1: 10,
      final: 13
    });
  });

  it('(h) Deve retornar divergencias_detalhadas vazia quando não houver AJST nas seções contadas', () => {
    const agentes = new Map<string, AuditoriaAgenteInfo>([
      ['99999999999', { codigo: '000099', nome: 'Zero', cpf: '99999999999' }]
    ]);
    const prcs = [criarBip('99999999999', '500')];
    const acuracidade = [criarAcuracidade('500', 'EAN0', 0)];
    const producao = [criarProducao('99999999999', 0)];

    const resultado = AuditoriaAtribuicaoService.calcularNivel1(prcs, acuracidade, producao, agentes);
    expect(resultado[0].erro_real).toBe(0);
    expect(resultado[0].divergencias_detalhadas).toEqual([]);
  });
});
