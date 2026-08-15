import { parsePrcFile } from '../prcParser';
import { buildCatalogoIndex, buildInventDspIndex, resolverProduto } from '../catalogoLookup';
import { normalizarNomeArea } from '../inventExpUtils';

const PRC_83 = [
  '0000010000010000022022050720041441712954830P0000000PI003029000000078910041000033000',
  '0000010000010000022022050720043741712954830P0000000PI003029007895144299549000019000',
  '0000010000010000022022050720062641712954830X0000000PI003029000000078945449000009000',
  '0000010000010000022022050720063541712954830X0000000PI003029000000078945470000009000',
].join('\r\n');

const CADASTRO   = '000000000695815COD PAR 500MG 12CP  NNN\r\n000000078910041GRT PAST.HORTELA17G NNN\r\n';
const INVENT_DSP = '695815; 7899420506918; COD PAR 500MG 12CP  A2\r\n311910; 7891317481629; SIBUTR.15 EU.30CS  -B2\r\n';

/**
 * As expectativas de `area_codigo` e `is_bloco` mudaram na v3, depois da
 * conferência do layout contra 38.588 registros reais do inventário DPSP L2601:
 *
 *   area_codigo — a seção são os ÚLTIMOS 4 dígitos do endereço, não os 6.
 *                 Confirmado contra RELATORIOS/BLOCO.xls.
 *   is_bloco    — bloco é quantidade > 1, não a flag da posição 43. A regra
 *                 antiga (flag === 'X') cobria 0,9% dos registros que o sistema
 *                 classifica como bloco; a nova cobre 99,7%.
 *
 * Todas as 4 linhas da fixture têm quantidade acima de 1, logo todas são bloco.
 */
describe('parsePrcFile', () => {
  it('parseia 4 linhas de 83 chars', () => {
    const r = parsePrcFile(PRC_83);
    expect(r).toHaveLength(4);
    expect(r[0].matricula).toBe('41712954830');
    expect(r[0].area_codigo).toBe('3029');
    expect(r[0].produto_codigo).toBe('78910041');
    expect(r[0].quantidade).toBe(33);
    expect(r[0].is_bloco).toBe(true);
    expect(r[2].quantidade).toBe(9);
    expect(r[2].is_bloco).toBe(true);
  });

  it('não usa a flag da posição 43 para decidir bloco', () => {
    // linha com flag 'P' e quantidade 1 → unitária
    const unitariaComFlagP =
      '0000010000010000022022050720041441712954830P0000000PI003029000000078910041000001000';
    const [c] = parsePrcFile(unitariaComFlagP);
    expect(c.flag_origem).toBe('P');
    expect(c.quantidade).toBe(1);
    expect(c.is_bloco).toBe(false);
  });
  it('ignora linhas sem prefixo PI', () => {
    const r = parsePrcFile('linha_invalida\r\n' + PRC_83);
    expect(r).toHaveLength(4);
  });
  it('rejeita quantidade zero ou negativa', () => {
    // mesma linha base com qty 000000 no campo 74-79
    const zeroQty =
      '0000010000010000022022050720041441712954830P0000000PI003029000000078910041000000000';
    const r = parsePrcFile(zeroQty + '\r\n' + PRC_83);
    expect(r).toHaveLength(4);
    expect(r.every((c) => c.quantidade > 0)).toBe(true);
  });
});

describe('catalogoLookup', () => {
  it('resolve produto via cadastro', () => {
    const idx  = buildCatalogoIndex(CADASTRO);
    const prod = resolverProduto('695815', new Map(), idx);
    expect(prod.nome).toBe('COD PAR 500MG 12CP');
  });
  it('prefere invent_DSP (tem EAN e classe)', () => {
    const dsp  = buildInventDspIndex(INVENT_DSP);
    const cat  = buildCatalogoIndex(CADASTRO);
    const prod = resolverProduto('695815', dsp, cat);
    expect(prod.ean).toBe('7899420506918');
    expect(prod.classe).toBe('A2');
  });
  it('extrai classe legal do sufixo', () => {
    const dsp = buildInventDspIndex(INVENT_DSP);
    expect(dsp.get('311910')?.classe).toBe('-B2');
  });
  it('placeholder para código inexistente', () => {
    const prod = resolverProduto('9999999', new Map(), new Map());
    expect(prod.nome).toContain('9999999');
  });
});

describe('normalizarNomeArea', () => {
  test.each([
    ['F CAIXA',          'FRENTE DE CAIXA'],
    ['f caixa',          'FRENTE DE CAIXA'],
    ['GELADEIRAS CAIXA', 'GELADEIRAS FRENTE CAIXA'],
    ['AVARIAS',          'AVARIAS E VENCIDOS'],
    ['B ATENDIMENTO',    'BALCÃO DE ATENDIMENTO'],
    ['P OTC',            'MEDICAMENTOS OTC'],
    ['G 1',              'G 1'],
    ['  g 3  ',          'G 3'],
  ])('normaliza "%s" → "%s"', (input, expected) => {
    expect(normalizarNomeArea(input)).toBe(expected);
  });
});
