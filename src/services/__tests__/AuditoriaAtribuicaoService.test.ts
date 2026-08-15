import { AuditoriaAtribuicaoService, bipMatchesEan } from '../AuditoriaAtribuicaoService';
import { ContagemDetalhada, AuditoriaAcuracidadeRow, AuditoriaAgenteInfo, InventoryCheckerInput } from '../../types';
import { parsePrcFile } from '../../utils/prcParser';

describe('AuditoriaAtribuicaoService Nível 1', () => {
  const criarBip = (
    matricula: string,
    secao: string,
    opts?: { produto_ean?: string; produto_codigo?: string },
  ): ContagemDetalhada => ({
    matricula,
    area_codigo: secao,
    area_nome: 'TESTE',
    produto_codigo: opts?.produto_codigo ?? '123',
    produto_nome: 'PROD',
    // curto de propósito: não match EAN ≥8 (mantém rateio por seção nos testes legados)
    produto_ean: opts?.produto_ean ?? '123',
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

  it('(i) Rateia |AJST| quando dois agentes biparam a mesma seção', () => {
    const agentes = new Map<string, AuditoriaAgenteInfo>([
      ['11111111111', { codigo: '000001', nome: 'João', cpf: '11111111111' }],
      ['22222222222', { codigo: '000002', nome: 'Maria', cpf: '22222222222' }],
    ]);
    const prcs = [
      criarBip('11111111111', 'SHARED'),
      criarBip('22222222222', 'SHARED'),
    ];
    // |AJST| = 10 na seção compartilhada → cada um recebe 5
    const acuracidade = [criarAcuracidade('SHARED', 'EANX', 10)];
    const producao = [
      criarProducao('11111111111', 5),
      criarProducao('22222222222', 5),
    ];

    const resultado = AuditoriaAtribuicaoService.calcularNivel1(
      prcs,
      acuracidade,
      producao,
      agentes,
    );
    expect(resultado).toHaveLength(2);
    for (const r of resultado) {
      expect(r.erro_real).toBe(5);
      expect(r.status).toBe('OK');
    }
    // Soma das contribuições = AJST total da seção
    const somaReais = resultado.reduce((s, r) => s + r.erro_real, 0);
    expect(somaReais).toBe(10);
  });

  it('(j) Com EAN no bip, só o agente que contou o produto recebe o AJST', () => {
    const ean = '7891234567890';
    const agentes = new Map<string, AuditoriaAgenteInfo>([
      ['11111111111', { codigo: '000001', nome: 'João', cpf: '11111111111' }],
      ['22222222222', { codigo: '000002', nome: 'Maria', cpf: '22222222222' }],
    ]);
    const prcs = [
      criarBip('11111111111', 'SEC1', { produto_ean: ean }),
      criarBip('22222222222', 'SEC1', { produto_ean: '7899999999999' }),
    ];
    const acuracidade = [criarAcuracidade('SEC1', ean, 8)];
    const producao = [
      criarProducao('11111111111', 8),
      criarProducao('22222222222', 0),
    ];

    const resultado = AuditoriaAtribuicaoService.calcularNivel1(
      prcs,
      acuracidade,
      producao,
      agentes,
    );
    const joao = resultado.find((r) => r.cpf === '11111111111')!;
    const maria = resultado.find((r) => r.cpf === '22222222222')!;
    expect(joao.erro_real).toBe(8);
    expect(maria.erro_real).toBe(0);
    expect(joao.status).toBe('OK');
  });
});

describe('bipMatchesEan', () => {
  const bip = (ean: string, codigo = ''): ContagemDetalhada => ({
    matricula: '1',
    area_codigo: '1',
    area_nome: '',
    produto_codigo: codigo,
    produto_nome: '',
    produto_ean: ean,
    produto_classe: '',
    quantidade: 1,
    is_bloco: false,
    data_hora: new Date(),
  });

  it('não faz match curto (evita 123 ⊂ 789123)', () => {
    expect(bipMatchesEan(bip('123'), '789123')).toBe(false);
  });

  it('match exact EAN', () => {
    expect(bipMatchesEan(bip('7891234567890'), '7891234567890')).toBe(true);
  });
});

/**
 * Regressão do formato da seção.
 *
 * Até a v3 o `prcParser` guardava a seção com 6 dígitos ('002312') enquanto o
 * ACURACIDADE publica 4 ('2312'). Com arquivos reais o cruzamento nunca casava,
 * `erro_real` saía zero para todo mundo e todos apareciam como
 * ERRO_DE_TERCEIRO_RECEBIDO. As fixtures antigas escondiam a falha porque
 * usavam o mesmo valor dos dois lados.
 *
 * Este teste amarra as duas pontas ao parser de verdade.
 */
describe('AuditoriaAtribuicaoService — seção do prcParser casa com o ACURACIDADE', () => {
  const LINHA_PRC =
    '0000010000010000012026080700153629291408875P0000000PI002312007896658027796000016000';

  it('a seção extraída do .prc tem 4 dígitos e bate com a do relatório', () => {
    const [bip] = parsePrcFile(LINHA_PRC);
    expect(bip.area_codigo).toBe('2312');
  });

  it('calcula erro_real diferente de zero com dados no formato real', () => {
    const bips = parsePrcFile(LINHA_PRC);
    const acuracidade: AuditoriaAcuracidadeRow[] = [
      {
        secao: '2312',
        ean: '007896658027796',
        descricao: 'COLIDIS 5 ML',
        c1: 16,
        a1: -14,
        a2: 0,
        a3: 0,
        final: 2,
        ajst: -14,
      },
    ];
    const producao: InventoryCheckerInput[] = [
      {
        nome: 'AMARILDO DA SILVA',
        matricula: '29291408875',
        qtde: 4798,
        qtde1a1: 857,
        produtividade: 1151,
        erro: 14,
      },
    ];

    const [r] = AuditoriaAtribuicaoService.calcularNivel1(
      bips,
      acuracidade,
      producao,
      new Map(),
    );

    expect(r.erro_real).toBeCloseTo(14, 2);
    expect(r.status).toBe('OK');
  });
});
