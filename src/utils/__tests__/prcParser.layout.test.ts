import {
  detectarOciosidade,
  extrairSecao,
  horasPorJanelaDiaria,
  parsePrcFile,
  parsePrcFileDetalhado,
  parsePrcFiles,
} from '../prcParser';

/**
 * Fixtures copiadas de registros reais do inventário DPSP L2601 (BKP/CNT).
 * Cada linha tem exatamente 83 caracteres.
 *
 *          1         2         3         4         5         6         7         8
 * 0123456789012345678901234567890123456789012345678901234567890123456789012345678901234
 * 000001000001000001 2026 08 06 21 30 46 46028992852 ' ' 0000000 PI000195 007896181907176 000001000
 */
const UNITARIA =
  '0000010000010000012026080621304646028992852 0000000PI000195007896181907176000001000';

/** Bipada em bloco: quantidade 16 (COLIDIS 5ML, seção 2312, AMARILDO). */
const BLOCO =
  '0000010000010000012026080700153629291408875P0000000PI002312007896658027796000016000';

/** Endereço digitado à mão, com letra no meio. */
const ENDERECO_SUJO =
  '0000010000010000022022052107403626580259809 0000000PI0G0228007896026305310000001000';

/** Quantidade acima de 999 — quebrava no parser de 6 dígitos. */
const QUANTIDADE_GRANDE =
  '0000010000010000012026080622120043427459845P0000000PI000217007891721201806001250000';

const LINHA_SEM_PI =
  '0000010000010000012026080621304646028992852 0000000XX000195007896181907176000001000';

describe('prcParser — layout de 83 posições', () => {
  it('tem fixtures com o tamanho do layout real', () => {
    for (const l of [UNITARIA, BLOCO, ENDERECO_SUJO, QUANTIDADE_GRANDE, LINHA_SEM_PI]) {
      expect(l).toHaveLength(83);
    }
  });

  it('extrai matrícula, seção de 4 dígitos, produto e quantidade', () => {
    const [c] = parsePrcFile(UNITARIA);
    expect(c.matricula).toBe('46028992852');
    expect(c.area_codigo).toBe('0195');
    expect(c.produto_codigo).toBe('7896181907176');
    expect(c.quantidade).toBe(1);
  });

  it('lê a seção pelos últimos 4 dígitos do endereço, não pelos 6', () => {
    expect(extrairSecao('0000000PI002312')).toBe('2312');
    expect(extrairSecao('0000000PI009057')).toBe('9057');
    expect(extrairSecao('0000000PI000195')).toBe('0195');
  });

  it('marca bloco pela quantidade, não pela flag da posição 43', () => {
    const [unit] = parsePrcFile(UNITARIA);
    const [bloco] = parsePrcFile(BLOCO);

    expect(unit.is_bloco).toBe(false);
    expect(bloco.is_bloco).toBe(true);
    expect(bloco.quantidade).toBe(16);

    // a flag da unitária é espaço e a do bloco é 'P': nenhuma das duas é 'X'
    expect(unit.flag_origem).toBe(' ');
    expect(bloco.flag_origem).toBe('P');
  });

  it('lê quantidade de 9 dígitos com 3 casas implícitas', () => {
    const [c] = parsePrcFile(QUANTIDADE_GRANDE);
    expect(c.quantidade).toBe(1250);
    expect(c.is_bloco).toBe(true);
  });

  it('normaliza endereço digitado à mão e sinaliza a ocorrência', () => {
    const r = parsePrcFileDetalhado(ENDERECO_SUJO);
    expect(r.contagens[0].area_codigo).toBe('0228');
    expect(r.contagens[0].endereco_fora_padrao).toBe(true);
    expect(r.enderecosForaPadrao).toBe(1);
  });

  it('ignora linha sem o prefixo PI', () => {
    const r = parsePrcFileDetalhado(LINHA_SEM_PI);
    expect(r.contagens).toHaveLength(0);
    expect(r.linhasIgnoradas).toBe(1);
  });

  it('acumula vários arquivos e reporta as datas encontradas', () => {
    const r = parsePrcFiles([UNITARIA, BLOCO, ENDERECO_SUJO]);
    expect(r.contagens).toHaveLength(3);
    expect(r.datasDistintas).toEqual(['20220521', '20260806', '20260807']);
    expect(r.enderecosForaPadrao).toBe(1);
  });
});

describe('prcParser — tempo de trabalho', () => {
  const emDia = (dia: string, hora: string) =>
    `000001000001000001${dia}${hora}46028992852 0000000PI000195007896181907176000001000`;

  it('soma janelas por dia em vez de medir da primeira à última bipada', () => {
    // Duas janelas de 1h em datas distintas: relógio do coletor desconfigurado.
    const c = parsePrcFiles([
      emDia('20260806', '220000'),
      emDia('20260806', '230000'),
      emDia('20220531', '120000'),
      emDia('20220531', '130000'),
    ]).contagens;

    expect(horasPorJanelaDiaria(c)).toBeCloseTo(2, 3);
  });

  it('não conta o salto entre datas como ociosidade', () => {
    const c = parsePrcFiles([
      emDia('20260806', '220000'),
      emDia('20260806', '222000'),
      emDia('20220531', '120000'),
    ]).contagens;

    const gaps = detectarOciosidade(c, 15);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].minutos).toBe(20);
  });
});
