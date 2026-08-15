import {
  montarCadastroProduto,
  parseBlocoMatrix,
  parseDobroMatrix,
  parseAcuracidadeMatrix,
  parseAuditoriaDirigida,
  parseControladosMatrix,
  parseNaoContadosMatrix,
  parseNumeroBr,
  parseProdSecaoMatrix,
  prodSecaoParaSecoes,
} from '../avaliacaoV3Parsers';

/**
 * As matrizes abaixo reproduzem o formato real dos relatórios do Crystal
 * Reports: título e filtros antes do cabeçalho, colunas espalhadas por
 * posições vazias e área preenchida só na primeira linha do grupo.
 */

const vazio = (n: number) => new Array(n).fill(null);
function linha(pares: Record<number, any>, largura = 40): any[] {
  const l = vazio(largura);
  for (const [i, v] of Object.entries(pares)) l[Number(i)] = v;
  return l;
}

describe('parseNumeroBr', () => {
  it.each([
    ['1.234,56', 1234.56],
    ['1234.56', 1234.56],
    ['27,6249', 27.6249],
    ['R$ 111,59', 111.59],
    ['', 0],
    [null, 0],
    [42, 42],
  ])('converte %p em %p', (entrada, esperado) => {
    expect(parseNumeroBr(entrada)).toBeCloseTo(esperado as number, 4);
  });
});

describe('parseProdSecaoMatrix', () => {
  const matriz = [
    linha({ 0: 'RProInv_Produtiviadade' }),
    linha({ 9: 'Capa:', 11: '2915', 24: 'Unidade/Loja:', 27: 'L2601' }),
    linha({ 21: 'Seções Contadas' }),
    linha({
      1: 'AREA', 6: 'MATRICULA', 9: 'NOME', 21: 'Seções Contadas',
      26: 'Qtd(C1)', 29: 'Qtd(A1)', 32: 'Qtd(A2)', 34: 'Qtd(A3)', 37: 'QTD(FINAL)',
    }),
    linha({ 1: 'MEDICAMENTOS', 6: '48779594832', 9: 'DIEGO DA SILVA SOUTO', 21: 28, 26: 972, 29: 1, 37: 973 }),
    // área em branco: mesma área da linha anterior (célula mesclada)
    linha({ 6: '26580259809', 9: 'ELIANA CRISTINA CUST', 21: 27, 26: 1317, 29: -2, 37: 1315 }),
    // linha de subtotal, sem matrícula
    linha({ 26: 2289, 37: 2288 }),
    linha({ 1: 'F CAIXA', 6: '43427459845', 9: 'BIANKA ANASTACIO BEZ', 21: 24, 26: 1725, 37: 1725 }),
  ];

  it('lê as combinações e arrasta a área mesclada para baixo', () => {
    const linhas = parseProdSecaoMatrix(matriz);
    expect(linhas).toHaveLength(3);
    expect(linhas[0]).toMatchObject({ area: 'MEDICAMENTOS', matricula: '48779594832', secoes: 28, qtdC1: 972 });
    expect(linhas[1].area).toBe('MEDICAMENTOS');
    expect(linhas[1].nome).toBe('ELIANA CRISTINA CUST');
  });

  it('descarta linha de subtotal', () => {
    expect(parseProdSecaoMatrix(matriz).some((l) => !l.matricula)).toBe(false);
  });

  it('normaliza o nome da área', () => {
    const linhas = parseProdSecaoMatrix(matriz);
    expect(linhas[2].area).toBe('FRENTE DE CAIXA');
  });

  it('converte para o formato do motor v2.1 preservando os ajustes', () => {
    const secoes = prodSecaoParaSecoes(parseProdSecaoMatrix(matriz));
    expect(secoes[0]).toMatchObject({
      area_nome: 'MEDICAMENTOS',
      matricula: '48779594832',
      qtd_c1: 972,
      ajuste_a1: 1,
    });
    expect(secoes[1].ajuste_a1).toBe(-2);
  });
});

describe('parseAcuracidadeMatrix', () => {
  const matriz = [
    linha({ 1: 'ACURACIDADE DA CONTAGEM' }),
    linha({ 1: 'Page 1 of 392' }),
    vazio(35),
    linha({
      1: 'CAPA', 3: 'SECAO', 5: 'BARRA (EAN)', 10: 'DESCRIÇÃO',
      15: 'QTD(C1)', 18: 'QTD(A1)', 19: 'QTD(A2)', 20: 'QTD(A3)',
      22: 'QTD(FINAL)', 24: 'AJST(QTD)',
    }),
    linha({ 1: '2915', 3: '2312', 5: '007896658027796', 10: 'COLIDIS 5 ML', 15: 16, 18: -14, 22: 2, 24: -14 }),
    linha({ 1: '2915', 3: '217', 5: '007891721201806', 10: 'GLIFAGE XR 500MG', 15: 172, 18: -33, 22: 139, 24: -33 }),
    linha({ 1: '2915', 3: '0001', 5: '007500435132602', 10: 'FR IN PAM CO SE XG', 15: 1, 22: 1, 24: 0 }),
    linha({ 3: 'TOTAL' }),
  ];

  it('extrai as linhas e ignora o total', () => {
    const linhas = parseAcuracidadeMatrix(matriz);
    expect(linhas).toHaveLength(3);
  });

  it('normaliza a seção para 4 dígitos, igual ao prcParser', () => {
    const linhas = parseAcuracidadeMatrix(matriz);
    expect(linhas.map((l) => l.secao)).toEqual(['2312', '0217', '0001']);
  });

  it('preserva o sinal do ajuste', () => {
    const [sobra] = parseAcuracidadeMatrix(matriz);
    expect(sobra.ajuste).toBe(-14);
    expect(sobra.qtdC1).toBe(16);
    expect(sobra.qtdFinal).toBe(2);
  });

  it('falha alto quando o cabeçalho não existe', () => {
    expect(() => parseAcuracidadeMatrix([linha({ 1: 'qualquer coisa' })])).toThrow(/Cabeçalho/);
  });
});

describe('parseNaoContadosMatrix', () => {
  const matriz = [
    linha({ 1: 'RProInv_NaoCntCodEANVlr', 10: 'Produtos Não Contados' }),
    linha({ 1: 'Cliente:', 4: 'DPSP', 9: 'L2601' }),
    vazio(30),
    linha({ 1: 'ORDEM', 4: 'COD. INTERNO', 7: 'DESCRIÇÃO', 13: 'DEP', 21: 'Preço Unit.', 22: 'VLR(SIS)' }),
    linha({ 1: 1, 2: '000000000738522', 6: 'MOTILEX HA C/ 60 CAPS', 13: '027', 22: 157.03 }),
    linha({ 13: '007896637031844' }),
    linha({ 13: '017896637031844' }),
    linha({ 1: 2, 2: '000000000778788', 6: 'BLANCY CIS BISNAGA 30G', 13: '383', 22: 142.32 }),
    linha({ 13: '017891142205312' }),
  ];

  it('agrupa os EANs sob o produto imediatamente acima', () => {
    const itens = parseNaoContadosMatrix(matriz);
    expect(itens).toHaveLength(2);
    expect(itens[0].descricao).toBe('MOTILEX HA C/ 60 CAPS');
    expect(itens[0].eans).toEqual(['007896637031844', '017896637031844']);
    expect(itens[1].eans).toEqual(['017891142205312']);
  });

  it('marca todos como não encontrados e lê o valor em sistema', () => {
    const itens = parseNaoContadosMatrix(matriz);
    expect(itens.every((i) => i.situacao === 'NAO_ENCONTRADO')).toBe(true);
    expect(itens[0].valor).toBeCloseTo(157.03, 2);
    expect(itens[1].valor).toBeCloseTo(142.32, 2);
  });

  it('captura o departamento do produto', () => {
    expect(parseNaoContadosMatrix(matriz)[0].departamento).toBe('027');
  });
});

describe('parseAuditoriaDirigida', () => {
  const texto = [
    'EAN;DESCRIÇÃO;QTDE;PU',
    '007896585628206;COLIDIS 10ML;14;111,59',
    '007896094606600;TAMARINE 12MG 4CS;18;12,88',
    '',
    '017908271311712;SACOLA EVER;27;2,95',
  ].join('\n');

  it('transcreve a folha e calcula o valor recuperado', () => {
    const itens = parseAuditoriaDirigida(texto);
    expect(itens).toHaveLength(3);
    expect(itens[0]).toMatchObject({
      descricao: 'COLIDIS 10ML',
      quantidade: 14,
      situacao: 'RECUPERADO',
    });
    expect(itens[0].valor).toBeCloseTo(1562.26, 2);
  });

  it('ignora cabeçalho e linhas em branco', () => {
    expect(parseAuditoriaDirigida(texto).some((i) => i.descricao === 'DESCRIÇÃO')).toBe(false);
  });

  it('aceita tabulação e vírgula como separador', () => {
    expect(parseAuditoriaDirigida('007896585628206\tCOLIDIS 10ML\t14\t111,59')).toHaveLength(1);
    expect(parseAuditoriaDirigida('007896585628206,COLIDIS 10ML,14,111.59')).toHaveLength(1);
  });

  it('aceita item sem preço, com valor zero', () => {
    const [i] = parseAuditoriaDirigida('007896585628206;COLIDIS 10ML;14');
    expect(i.valor).toBe(0);
    expect(i.quantidade).toBe(14);
  });
});

describe('montarCadastroProduto', () => {
  const inventDsp = ['54429; 007896658027796; COLIDIS 5 ML', '10006; 007891721201806; GLIFAGE XR'].join('\n');
  const saldo = [
    'Saldo da Loja antes Balanco;  12366 ;;;;;;;;;;;;',
    'UN;Item;Descrição;SubClass;Família;Descrição;Nome;Qtd;Custo Unidade;Loc',
    'L2601;54429;COLIDIS 5 ML;MEDI;011;MEDICAMENTOS EM GERAL;LAB;3,0000;73,3400;ESTOQ',
    'L2601;10006;GLIFAGE XR;MEDI;011;MEDICAMENTOS EM GERAL;LAB;10,0000;27,6249;ESTOQ',
  ].join('\n');

  it('liga EAN ao custo unitário passando pelo PLU', () => {
    const { custoPorEan } = montarCadastroProduto(inventDsp, saldo);
    expect(custoPorEan.get('007896658027796')).toBeCloseTo(73.34, 4);
    expect(custoPorEan.get('007891721201806')).toBeCloseTo(27.6249, 4);
  });

  it('indexa também sem os zeros à esquerda', () => {
    const { custoPorEan } = montarCadastroProduto(inventDsp, saldo);
    expect(custoPorEan.get('7896658027796')).toBeCloseTo(73.34, 4);
  });

  it('traz a família para a inferência de não contados', () => {
    const { familiaPorEan } = montarCadastroProduto(inventDsp, saldo);
    expect(familiaPorEan.get('007896658027796')).toBe('MEDICAMENTOS EM GERAL');
  });

  it('devolve tabelas vazias quando falta um dos arquivos', () => {
    const { custoPorEan } = montarCadastroProduto(inventDsp, '');
    expect(custoPorEan.size).toBe(0);
  });
});

describe('parseControladosMatrix', () => {
  it('varre a matriz atrás de códigos de barras', () => {
    const eans = parseControladosMatrix([
      linha({ 2: 'DEPTO:', 6: '014', 10: 'MEDICAMENTOS ANTIBIOTICOS' }),
      linha({ 1: 'PLU:', 4: '000000000044202' }),
      linha({ 26: '7896658027796' }),
      linha({ 26: '007891721201806' }),
    ]);
    expect(eans.has('007891721201806')).toBe(true);
    expect(eans.has('007896658027796')).toBe(true);
  });

  it('não confunde valor monetário com EAN', () => {
    expect(parseControladosMatrix([linha({ 1: '27,70' }), linha({ 1: '1234' })]).size).toBe(0);
  });
});

describe('parseDobroMatrix', () => {
  const matriz = [
    linha({ 6: 'ITENS COLETADOS EM "DOBRO"' }),
    linha({ 19: 'Page 1 of 13' }),
    vazio(23),
    linha({
      1: 'CAPA', 3: 'COD.INTERNO', 5: 'COD.COLETADO', 8: 'DESCRIÇÃO',
      10: 'FAMÍLIA', 15: 'SEÇÃO', 18: 'QTDE(INFO)', 22: 'QTDE(INV)',
    }),
    vazio(23),
    // linha de produto: traz o total, não tem seção
    linha({ 1: '2915', 3: '000000000005681', 8: 'TAMOXIFE SDZ 20MG 30CP', 18: 1, 22: 2 }),
    // linhas de detalhe: uma por bipada repetida
    linha({ 5: '007897595601834', 8: 'TAMOXIFE SDZ 20MG 30CP', 10: '983', 11: 'ESPECIALIDADE EM GERAL', 15: '0342', 22: 1 }),
    linha({ 5: '007897595601834', 8: 'TAMOXIFE SDZ 20MG 30CP', 10: '983', 11: 'ESPECIALIDADE EM GERAL', 15: '0342', 22: 1 }),
    linha({ 1: '2915', 3: '000000000009130', 8: 'PURAN T4 150MCG 30CP', 18: 4, 22: 8 }),
    linha({ 5: '007897595901330', 8: 'PURAN T4 150MCG 30CP', 10: '011', 11: 'MEDICAMENTOS EM GERAL', 15: '0255', 22: 1 }),
  ];

  it('lê só as linhas de detalhe, que são as que têm seção', () => {
    const linhas = parseDobroMatrix(matriz);
    expect(linhas).toHaveLength(3);
    expect(linhas[0]).toMatchObject({ secao: '0342', ean: '007897595601834' });
    expect(linhas[2].secao).toBe('0255');
  });

  it('traz o nome da família, não o código', () => {
    expect(parseDobroMatrix(matriz)[0].familia).toBe('ESPECIALIDADE EM GERAL');
  });

  it('descarta a linha de produto, que não tem seção', () => {
    expect(parseDobroMatrix(matriz).some((l) => !l.secao)).toBe(false);
  });
});

describe('parseBlocoMatrix', () => {
  const matriz = [
    linha({ 9: 'ITENS COLETADOS EM "BLOCO"' }, 33),
    linha({ 31: 'Page 1 of 77' }, 33),
    linha({ 8: 'Cliente:', 10: 'DPSP', 15: 'Loja:', 17: 'L2601' }, 33),
    vazio(33),
    vazio(33),
    vazio(33),
    vazio(33),
    // o cabeçalho não rotula CPF nem nome — traz uma linha pontilhada no lugar
    linha({
      1: 'Capa', 3: 'Seção', 5: '........................', 14: 'Código Coletado',
      19: 'Descrição', 23: 'Família', 30: 'Qtde (C Final)', 32: 'Confirmação/Ajuste',
    }, 33),
    linha({
      1: '2915', 3: '0039', 5: '29291408875', 8: 'AMARILDO DA SILVA',
      14: '007894900530001', 19: 'AGUA CRYSTAL S/G 500ML', 23: '976', 27: 'BEBIDAS', 30: 12,
    }, 33),
    linha({
      1: '2915', 3: '0040', 5: '29291408875', 8: 'AMARILDO DA SILVA',
      14: '000000078939301', 19: 'BOMBOM SONHO DE VALSA', 23: '135', 27: 'CEREAIS', 30: 32,
    }, 33),
  ];

  it('localiza CPF e nome pela posição relativa à seção', () => {
    const linhas = parseBlocoMatrix(matriz);
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toMatchObject({
      secao: '0039',
      cpf: '29291408875',
      nome: 'AMARILDO DA SILVA',
      ean: '007894900530001',
      qtde: 12,
    });
  });

  it('exige CPF de 11 dígitos e EAN para aceitar a linha', () => {
    const semCpf = [...matriz.slice(0, 8), linha({ 1: '2915', 3: '0039', 14: '007894900530001' }, 33)];
    expect(parseBlocoMatrix(semCpf)).toHaveLength(0);
  });

  it('traz o nome da família', () => {
    expect(parseBlocoMatrix(matriz)[1].familia).toBe('CEREAIS');
  });
});
