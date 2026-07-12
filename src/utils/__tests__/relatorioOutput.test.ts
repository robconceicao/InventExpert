import { evaluateChecker } from '../../services/InventoryEvaluationService';
import type {
  InventoryCheckerInput,
  SectionAccuracyRecord,
  ViolacaoBloco,
} from '../../types';
import { generateInventExpIndividualReportText } from '../inventExpReports';

// ─── CENÁRIO 1 ────────────────────────────────────────────────────────────────
// Everaldo — INTERMITENTE, zero erro, produtividade muito baixa, bloco em G 5
// G 5 viola limite de 15% (real=70.5%, excesso_fator≈4.7 > 2)

const EVERALDO: InventoryCheckerInput = {
  nome: 'EVERALDO FERREIRA DA',
  matricula: '00127218599',
  modalidadeContrato: 'INTERMITENTE',
  qtde: 752,
  qtde1a1: 222,        // pctBloco = (752-222)/752 ≈ 70.5%
  produtividade: 146,
  erro: 0,
  itensPulados: 0,
  itensDuplicados: 0,
  erroSecao: 0,
  experiencia: 'pleno',
};

const EVERALDO_VIOLACOES: ViolacaoBloco[] = [
  { area_nome: 'G 5', limite_pct: 15, real_pct: 70.5, area_critica: false, excesso_fator: 70.5 / 15 },
];

const EVERALDO_SECTIONS: SectionAccuracyRecord[] = [
  {
    area: 'FRENTE DE CAIXA',
    totalC1: 1068,
    ajusteAbsoluto: 0,
    ajusteLiquido: 0,
    acuracidade: 100,
    colaboradores: ['EVERALDO FERREIRA DA'],
    secoes_contadas: 12,
    qtd_final: 1068,
    bloco_pct: 70.5,
    limite_bloco: 90,
    violacao_bloco: false,
    area_critica: false,
  },
];

// ─── CENÁRIO 2 ────────────────────────────────────────────────────────────────
// Elen — FREELANCE, vários tipos de erro, bloco em G 3 (não-crítico)

const ELEN: InventoryCheckerInput = {
  nome: 'ELEN CRISTINA COSTA',
  matricula: '50317111833',
  modalidadeContrato: 'FREELANCE',
  qtde: 4731,
  qtde1a1: 2886,       // pctBloco = (4731-2886)/4731 ≈ 39.0%
  produtividade: 1118,
  erro: 10,
  itensPulados: 1,
  itensDuplicados: 3,
  erroSecao: 4,
  experiencia: 'pleno',
};

const ELEN_VIOLACOES: ViolacaoBloco[] = [
  { area_nome: 'G 3', limite_pct: 15, real_pct: 39, area_critica: false, excesso_fator: 39 / 15 },
];

const ELEN_SECTIONS: SectionAccuracyRecord[] = [
  {
    area: 'G 3',
    totalC1: 579,
    ajusteAbsoluto: 7,
    ajusteLiquido: 7,
    acuracidade: (1 - 7 / 579) * 100,
    colaboradores: ['ELEN CRISTINA COSTA'],
    bloco_pct: 39,
    limite_bloco: 15,
    violacao_bloco: true,
    area_critica: false,
  },
  {
    area: 'G 2',
    totalC1: 2199,
    ajusteAbsoluto: 31,
    ajusteLiquido: -31,
    acuracidade: (1 - 31 / 2199) * 100,
    colaboradores: ['ELEN CRISTINA COSTA'],
    bloco_pct: 12,
    limite_bloco: 15,
    violacao_bloco: false,
    area_critica: false,
  },
];

// ─── CENÁRIO 3 ────────────────────────────────────────────────────────────────
// Tania — CLT, MEDICAMENTOS área crítica (limite 0%, real 15.2%)

const TANIA: InventoryCheckerInput = {
  nome: 'TANIA DE FATIMA CAMP',
  matricula: '32574433823',
  modalidadeContrato: 'CLT',
  qtde: 1360,
  qtde1a1: 1154,       // pctBloco ≈ 15.1%
  produtividade: 800,
  erro: 2,
  itensPulados: 0,
  itensDuplicados: 0,
  erroSecao: 2,
  experiencia: 'pleno',
};

const TANIA_VIOLACOES: ViolacaoBloco[] = [
  { area_nome: 'MEDICAMENTOS', limite_pct: 0, real_pct: 15.2, area_critica: true, excesso_fator: Infinity },
];

const TANIA_SECTIONS: SectionAccuracyRecord[] = [
  {
    area: 'MEDICAMENTOS',
    totalC1: 574,
    ajusteAbsoluto: 0,
    ajusteLiquido: 0,
    acuracidade: 100,
    colaboradores: ['TANIA DE FATIMA CAMP'],
    bloco_pct: 15.2,
    limite_bloco: 0,
    violacao_bloco: true,
    area_critica: true,
  },
  {
    area: 'ANTIBIÓTICOS',
    totalC1: 786,
    ajusteAbsoluto: 2,
    ajusteLiquido: -2,
    acuracidade: (1 - 2 / 786) * 100,
    colaboradores: ['TANIA DE FATIMA CAMP'],
    bloco_pct: 0,
    limite_bloco: 0,
    violacao_bloco: false,
    area_critica: true,
  },
];

// =============================================================================

describe('relatorioOutput — Cenário 1: Everaldo (INTERMITENTE, zero erro, bloco alto)', () => {
  const ev = evaluateChecker(EVERALDO, 'FARMACIA', 0, 5, 1, EVERALDO_VIOLACOES)!;
  const report = generateInventExpIndividualReportText(
    'FARMACIA', ev, 8, 10, '01/01/2025', EVERALDO_SECTIONS,
  );

  it('scoreQualidade < 100 por penalidade de bloco em G 5 (excesso_fator > 2)', () => {
    expect(ev.scoreQualidade).toBeLessThan(100);
  });

  it('nivel CRITICO por produtividade muito abaixo da meta', () => {
    expect(ev.nivel).toBe('CRITICO');
  });

  it('"Perfil Operacional" não aparece no relatório', () => {
    expect(report).not.toContain('Perfil Operacional');
  });

  it('RAIO-X mostra "Nenhuma ocorrência" quando todos os indicadores de erro são zero', () => {
    expect(report).toContain('Nenhuma ocorrência de qualidade registrada');
  });

  it('DIRECIONAMENTO contém seção "⚠️ O que precisa melhorar"', () => {
    expect(report).toContain('⚠️ O que precisa melhorar');
  });

  it('DIRECIONAMENTO menciona bloco excessivo na área G 5', () => {
    expect(report).toContain('G 5');
  });

  it('DIRECIONAMENTO menciona produtividade abaixo da meta', () => {
    expect(report).toContain('146');
    expect(report).toContain('800 itens/h');
  });

  it('"COMO A NOTA FOI CALCULADA" — Qualidade: mostra Motivo da pontuação', () => {
    expect(report).toContain('Motivo da pontuação');
  });

  it('"COMO A NOTA FOI CALCULADA" — Produtividade: mostra Motivo com ritmo abaixo da meta', () => {
    expect(report).toContain('146 itens/h abaixo da meta de 800 itens/h');
  });

  it('Sem alerta formal 🚨 para G 5 (não-crítica, limite > 5%)', () => {
    expect(report).not.toContain('🚨 ALERTA — USO DE BLOCO EM ÁREA RESTRITA');
  });

  it('SUAS SEÇÕES exibe FRENTE DE CAIXA sem violação (70.5% < limite 90%)', () => {
    expect(report).toContain('FRENTE DE CAIXA');
    // status ✅ porque violacao_bloco = false
    const frcIdx = report.indexOf('FRENTE DE CAIXA');
    const rowEnd = report.indexOf('\n', frcIdx);
    const row = report.substring(frcIdx, rowEnd);
    expect(row).toContain('✅');
    expect(row).not.toContain('🚨');
  });
});

describe('relatorioOutput — Cenário 2: Elen (FREELANCE, erros, bloco G 3 não-crítico)', () => {
  const ev = evaluateChecker(ELEN, 'FARMACIA', 0, 5, 1, ELEN_VIOLACOES)!;
  const report = generateInventExpIndividualReportText(
    'FARMACIA', ev, 2, 10, '01/01/2025', ELEN_SECTIONS,
  );

  it('scoreQualidade < 100 por penalidade de bloco em G 3', () => {
    expect(ev.scoreQualidade).toBeLessThan(100);
  });

  it('"Perfil Operacional" não aparece no relatório', () => {
    expect(report).not.toContain('Perfil Operacional');
  });

  it('Cabeçalho usa "PRESTADOR" para modalidade FREELANCE', () => {
    expect(report).toContain('PRESTADOR');
    expect(report).not.toContain('CONFERENTE: ELEN');
  });

  it('RAIO-X mostra Erros de Execução (10 erros)', () => {
    expect(report).toContain('Erros de Execução');
    expect(report).toContain('10 erro(s)');
  });

  it('RAIO-X mostra Itens Não Contados na Gôndola (1 omissão)', () => {
    expect(report).toContain('Itens Não Contados na Gôndola');
    expect(report).toContain('1 produto(s)');
  });

  it('RAIO-X mostra Contagens Duplicadas (3 duplicações)', () => {
    expect(report).toContain('Contagens Duplicadas');
    expect(report).toContain('3 produto(s)');
  });

  it('RAIO-X mostra Erro de Seção (4 unidades)', () => {
    expect(report).toContain('Erro de Seção');
    expect(report).toContain('4 unidade(s)');
  });

  it('RAIO-X mostra ICSI com valor baixo (erros compensados)', () => {
    expect(report).toContain('ICSI');
    expect(report).toContain('40%');
    expect(report).toContain('erros em direções opostas');
  });

  it('Sem alerta formal 🚨 para G 3 (não-crítica, limite 15% > 5%)', () => {
    expect(report).not.toContain('🚨 ALERTA — USO DE BLOCO EM ÁREA RESTRITA');
  });

  it('SUAS SEÇÕES mostra G 3 com status ⚠️ (violação não-crítica)', () => {
    expect(report).toContain('G 3');
    const g3Idx = report.indexOf('| G 3 |');
    const g3RowEnd = report.indexOf('\n', g3Idx);
    const g3Row = report.substring(g3Idx, g3RowEnd);
    expect(g3Row).toContain('⚠️');
  });

  it('Rodapé FREELANCE usa linguagem de prestação de serviço', () => {
    expect(report).toContain('prestação de serviço');
    expect(report).toContain('Evento:');
  });

  it('Rodapé FREELANCE não usa termos de vínculo empregatício', () => {
    expect(report).not.toContain('medida disciplinar');
    expect(report).not.toContain(' equipe');
  });
});

describe('relatorioOutput — Cenário 3: Tania (CLT, MEDICAMENTOS área crítica)', () => {
  const ev = evaluateChecker(TANIA, 'FARMACIA', 0, 5, 1, TANIA_VIOLACOES)!;
  const report = generateInventExpIndividualReportText(
    'FARMACIA', ev, 5, 10, '01/01/2025', TANIA_SECTIONS,
  );

  it('scoreQualidade < 100 por PENALIDADE_BLOCO_AREA_CRITICA (−20 pts)', () => {
    expect(ev.scoreQualidade).toBeLessThan(100);
    // pctErro = 2/1360 ≈ 0.147% → base = 100*e^(-1.5*0.147) ≈ 80.2
    // PENALIDADE_BLOCO_AREA_CRITICA = 20 → scoreQualidade ≈ 60.2
    expect(ev.scoreQualidade).toBeCloseTo(60, 0);
  });

  it('"Perfil Operacional" não aparece no relatório', () => {
    expect(report).not.toContain('Perfil Operacional');
  });

  it('Alerta 🚨 aparece no relatório para violação em MEDICAMENTOS', () => {
    expect(report).toContain('🚨 ALERTA — USO DE BLOCO EM ÁREA RESTRITA');
    expect(report).toContain('MEDICAMENTOS');
  });

  it('Alerta aparece ANTES do bloco de números gerais (posição no relatório)', () => {
    const alertIdx = report.indexOf('🚨 ALERTA');
    const numerosIdx = report.indexOf('OS SEUS NÚMEROS GERAIS');
    expect(alertIdx).toBeGreaterThan(-1);
    expect(alertIdx).toBeLessThan(numerosIdx);
  });

  it('Linguagem do alerta é CLT ("medida disciplinar", "CLT")', () => {
    expect(report).toContain('medida disciplinar');
    expect(report).toContain('CLT');
  });

  it('SUAS SEÇÕES mostra MEDICAMENTOS com status 🚨', () => {
    const medIdx = report.indexOf('| MEDICAMENTOS |');
    expect(medIdx).toBeGreaterThan(-1);
    const medRowEnd = report.indexOf('\n', medIdx);
    const medRow = report.substring(medIdx, medRowEnd);
    expect(medRow).toContain('🚨');
  });

  it('SUAS SEÇÕES mostra ANTIBIÓTICOS sem violação de bloco (bloco 0%)', () => {
    const antiIdx = report.indexOf('| ANTIBIÓTICOS |');
    expect(antiIdx).toBeGreaterThan(-1);
    const antiRowEnd = report.indexOf('\n', antiIdx);
    const antiRow = report.substring(antiIdx, antiRowEnd);
    expect(antiRow).toContain('✅');
    expect(antiRow).not.toContain('🚨');
  });

  it('"COMO A NOTA FOI CALCULADA" — Qualidade: Motivo menciona MEDICAMENTOS', () => {
    expect(report).toContain('Bloco acima do limite em MEDICAMENTOS');
  });

  it('DIRECIONAMENTO menciona MEDICAMENTOS como ocorrência com registro formal', () => {
    expect(report).toContain('MEDICAMENTOS');
    expect(report).toContain('registrada formalmente');
  });

  it('DIRECIONAMENTO contém "⚠️ O que precisa melhorar" com violação crítica', () => {
    expect(report).toContain('⚠️ O que precisa melhorar');
  });
});
