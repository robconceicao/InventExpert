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

describe('parsePrcFile', () => {
  it('parseia 4 linhas de 83 chars', () => {
    const r = parsePrcFile(PRC_83);
    expect(r).toHaveLength(4);
    expect(r[0].matricula).toBe('41712954830');
    expect(r[0].area_codigo).toBe('003029');
    expect(r[0].produto_codigo).toBe('78910041');
    expect(r[0].quantidade).toBe(33);
    expect(r[0].is_bloco).toBe(false);
    expect(r[2].is_bloco).toBe(true);
  });
  it('ignora linhas sem prefixo PI', () => {
    const r = parsePrcFile('linha_invalida\r\n' + PRC_83);
    expect(r).toHaveLength(4);
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
