import { evaluateChecker } from '../../services/InventoryEvaluationService';
import type { InventoryCheckerInput } from '../../types';
import { generateInventExpIndividualReportText } from '../inventExpReports';

// ─── CENÁRIO 1 ────────────────────────────────────────────────────────────────
// Everaldo — zero erro, produtividade muito baixa, bloco muito alto

const EVERALDO: InventoryCheckerInput = {
  nome: 'EVERALDO FERREIRA DA',
  // matricula, modalidadeContrato, itensPulados, etc. removidos
  qtde: 752,
  qtde1a1: 222,        // pctBloco = (752-222)/752 ≈ 70.5%
  produtividade: 146,
  erro: 0,
};

// ─── CENÁRIO 2 ────────────────────────────────────────────────────────────────
// Elen — vários tipos de erro, bloco baixo

const ELEN: InventoryCheckerInput = {
  nome: 'ELEN CRISTINA COSTA',
  qtde: 4731,
  qtde1a1: 2886,       // pctBloco = (4731-2886)/4731 ≈ 39.0%
  produtividade: 1118,
  erro: 10,
};

// ─── CENÁRIO 3 ────────────────────────────────────────────────────────────────
// Tania — erro e bloco

const TANIA: InventoryCheckerInput = {
  nome: 'TANIA DE FATIMA CAMP',
  qtde: 1360,
  qtde1a1: 1154,       // pctBloco ≈ 15.1%
  produtividade: 800,
  erro: 20, // Aumentado para cair em erro crítico
};

// =============================================================================

describe('relatorioOutput — Cenário 1: Everaldo (zero erro, bloco alto)', () => {
  const ev = evaluateChecker(EVERALDO, 'FARMACIA');
  const report = generateInventExpIndividualReportText(
    'FARMACIA', ev, 8, 10, '01/01/2025'
  );

  it('scoreQualidade < 100 não ocorre aqui pois erro é zero, mas score final é penalizado pelo bloco', () => {
    expect(ev.scoreQualidade).toBe(100);
  });

  it('nivel CRITICO por produtividade muito abaixo da meta e bloco excessivo', () => {
    expect(ev.nivel).toBe('CRITICO');
  });

  it('"Perfil Operacional" não aparece no relatório', () => {
    expect(report).not.toContain('Perfil Operacional');
  });

  it('OS SEUS NÚMEROS menciona a produtividade', () => {
    expect(report).toContain('146 itens/h');
  });

  it('COMO A SUA NOTA FOI CALCULADA — menciona aderência reduzida', () => {
    expect(report).toContain('reduziu a nota de aderência');
  });

  it('PRÓXIMOS PASSOS RECOMENDADOS pede para reduzir bloco e rever ritmo', () => {
    expect(report).toContain('Reduzir o uso de contagem em bloco');
  });
});

describe('relatorioOutput — Cenário 2: Elen (erros, bloco não-crítico)', () => {
  const ev = evaluateChecker(ELEN, 'FARMACIA');
  const report = generateInventExpIndividualReportText(
    'FARMACIA', ev, 2, 10, '01/01/2025'
  );

  it('scoreQualidade < 100 por conta dos erros', () => {
    expect(ev.scoreQualidade).toBeLessThan(100);
  });

  it('"Perfil Operacional" não aparece no relatório', () => {
    expect(report).not.toContain('Perfil Operacional');
  });

  it('OS SEUS NÚMEROS mostra a quantidade contada', () => {
    expect(report).toContain('4731');
  });
});

describe('relatorioOutput — Cenário 3: Tania (erro acima do crítico)', () => {
  const ev = evaluateChecker(TANIA, 'FARMACIA');
  const report = generateInventExpIndividualReportText(
    'FARMACIA', ev, 5, 10, '01/01/2025'
  );

  it('A taxa de erro acima do crítico penaliza a produtividade', () => {
    expect(report).toContain('taxa de erro ficou acima do limite crítico');
  });

  it('"Perfil Operacional" não aparece no relatório', () => {
    expect(report).not.toContain('Perfil Operacional');
  });

  it('PRÓXIMOS PASSOS RECOMENDADOS com foco em qualidade', () => {
    expect(report).toContain('Rever junto ao líder');
  });
});
