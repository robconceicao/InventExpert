import { generateInventExpIndividualReportText } from '../inventExpReports';
import type {
  InventoryCheckerEvaluation,
  ModalidadeContratoCanonico,
} from '../../types';

/**
 * O relatório individual muda de linguagem conforme o vínculo do conferente.
 *
 * O motivo não é estético: um documento que fala em medida disciplinar, Código
 * de Conduta ou convocação, entregue a quem presta serviço sem contrato,
 * sugere subordinação onde ela não existe. Estes testes travam as palavras que
 * não podem aparecer — se alguém reescrever uma frase do gerador sem se dar
 * conta da modalidade, a suíte acusa.
 */

function avaliacao(modalidade: ModalidadeContratoCanonico): InventoryCheckerEvaluation {
  return {
    input: {
      nome: 'AMARILDO DA SILVA',
      matricula: '29291408875',
      modalidadeContrato: modalidade,
      qtde: 4798,
      qtde1a1: 857,
      produtividade: 1151.52,
      erro: 153,
      itensPulados: 2,
      itensDuplicados: 1,
    },
    operationType: 'FARMACIA',
    pctErro: 3.19,
    pctBloco: 10.8,
    scoreQualidade: 80,
    scoreProdutividade: 100,
    scoreAderencia: 100,
    scoreFinal: 88,
    nivel: 'BOM',
    nivelColor: '#2563eb',
    tags: [],
    secoes: [],
    perfil: 'EQUILIBRADO',
    violacoes: [],
  } as InventoryCheckerEvaluation;
}

const gerar = (m: ModalidadeContratoCanonico) =>
  generateInventExpIndividualReportText('FARMACIA', avaliacao(m), 9, 15, '06/08/2026');

describe('relatório individual — CLT', () => {
  const r = gerar('CLT');

  it('trata como conferente', () => {
    expect(r).toContain('CONFERENTE: AMARILDO');
  });

  it('mostra a posição no ranking', () => {
    expect(r).toContain('Posição no ranking: 9º de 15');
  });

  it('orienta o trabalho', () => {
    expect(r).toContain('DIRECIONAMENTO');
    expect(r).toContain('revisar bipagem unitária');
  });
});

describe('relatório individual — intermitente', () => {
  const r = gerar('INTERMITENTE');

  it('identifica o vínculo por convocação', () => {
    expect(r).toContain('COLABORADOR INTERMITENTE');
    expect(r).toContain('convocação intermitente');
  });

  it('mantém a posição no ranking', () => {
    expect(r).toContain('Posição no ranking');
  });
});

describe('relatório individual — prestador de serviço', () => {
  const r = gerar('FREE');

  it('trata como prestador', () => {
    expect(r).toContain('PRESTADOR: AMARILDO');
  });

  it('não compara com a equipe', () => {
    expect(r).not.toContain('Posição no ranking');
  });

  it('constata em vez de orientar', () => {
    expect(r).toContain('CONSTATAÇÕES');
    expect(r).not.toContain('DIRECIONAMENTO');
    expect(r).toContain('divergência(s) de quantidade');
    expect(r).not.toContain('revisar bipagem');
  });

  it.each([
    ['colaborador'],
    ['funcionário'],
    ['medida disciplinar'],
    ['código de conduta'],
    ['convocação'],
  ])('não usa o termo "%s"', (termo) => {
    expect(r.toLowerCase()).not.toContain(termo);
  });

  it('não menciona a CLT', () => {
    expect(r).not.toContain(' CLT');
  });

  it('fecha como prestação de serviço', () => {
    expect(r).toContain('prestação de serviço');
  });
});
