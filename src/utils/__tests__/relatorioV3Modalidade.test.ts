import { gerarRelatorioV3Texto, type ContextoRelatorioV3 } from '../inventExpReportV3';
import type { AvaliacaoV3 } from '../../services/AvaliacaoV3Service';
import type { ModalidadeContratoCanonico } from '../../types';

/**
 * A ficha do motor v3 é o documento que vai para a mão do conferente, com área
 * física, erro localizado até o produto e produtos sem contagem.
 *
 * Para quem presta serviço sem contrato, ela não pode comparar com a equipe nem
 * instruir como executar o trabalho — ambos são indícios de subordinação. Estes
 * testes travam as palavras e as seções que não podem aparecer.
 */

const ctx: ContextoRelatorioV3 = {
  operacao: 'FARMACIA',
  dataInventario: '06/08/2026',
  loja: 'L2601',
  capa: '2915',
  posicao: 9,
  totalConferentes: 15,
  medianaEquipe: 877.4,
};

function avaliacao(modalidade: ModalidadeContratoCanonico): AvaliacaoV3 {
  return {
    matricula: '29291408875',
    nome: 'AMARILDO DA SILVA',
    modalidade,
    areas: [
      {
        area: 'RUA 4 FUNDO',
        matricula: '29291408875',
        nome: 'AMARILDO DA SILVA',
        secoes: ['2301', '2302'],
        qtdDeclarada: 2370,
        qtdApurada: 2370,
        conforme: true,
      },
    ],
    secoes: 63,
    pecasContagem: 4798,
    pecasAuditoria: 0,
    horasContagem: 4.17,
    ociosidadeMin: 45,
    ociosidade: [{ inicio: new Date(), fim: new Date(), minutos: 45 }],
    produtividade: 1150.6,
    itensAuditados: 737,
    itensComErro: 10,
    unidadesEmErro: 153,
    acuracidadeUnidades: 96.811,
    acuracidadeItens: 98.64,
    valorContado: 75184.52,
    valorAjustado: 2684.51,
    pctErroValor: 3.571,
    cobertura: 98.81,
    divergencias: [
      {
        secao: '2312',
        area: 'RUA 4 FUNDO',
        ean: '007896658027796',
        descricao: 'COLIDIS 5 ML',
        qtdC1: 16,
        qtdFinal: 2,
        ajuste: -14,
        tipo: 'SOBRA',
        modo: 'BLOCO',
        custoUnitario: 73.34,
        valor: 1026.72,
        controlado: false,
        matricula: '29291408875',
        hora: new Date(),
        compartilhada: false,
        candidatos: ['29291408875'],
      },
    ],
    naoContados: [
      {
        descricao: 'COLIDIS 10ML',
        eans: ['007896585628206'],
        situacao: 'RECUPERADO',
        quantidade: 14,
        valor: 1562.26,
        nivel: 'ALTA',
        area: 'RUA 4 FUNDO',
        matricula: '29291408875',
        base: 'troca de código: sobra de 14 un de COLIDIS 5 ML na seção 2312',
        secoesReferencia: ['2312'],
        peso: 0.5,
      },
    ],
    naoContadosAlta: 1,
    divergenciasControlados: 0,
    indiceProdutividade: 100,
    penalidade: 1,
    nota: 95.8,
    nivel: 'EXCELENTE',
    faixa: 'Excelente',
    relogioOk: true,
    enderecosForaPadrao: 0,
    itensEmDobro: 26,
  };
}

const gerar = (m: ModalidadeContratoCanonico) => gerarRelatorioV3Texto(avaliacao(m), ctx);

describe('ficha v3 — conteúdo comum às três modalidades', () => {
  it.each<[ModalidadeContratoCanonico]>([['CLT'], ['INTERMITENTE'], ['FREE']])(
    'traz área, divergência e nota em %s',
    (m) => {
      const r = gerar(m);
      expect(r).toContain('RUA 4 FUNDO');
      expect(r).toContain('COLIDIS 5 ML');
      expect(r).toContain('seção 2312');
      expect(r).toContain('95,8');
    },
  );
});

describe('ficha v3 — CLT', () => {
  const r = gerar('CLT');

  it('trata como conferente e mostra a posição', () => {
    expect(r).toContain('CONFERENTE: AMARILDO');
    expect(r).toContain('Posição: 9º de 15');
  });

  it('compara com a mediana da equipe', () => {
    expect(r).toContain('Mediana da equipe');
  });

  it('orienta o trabalho', () => {
    expect(r).toContain('DIRECIONAMENTO');
    expect(r).toContain('Conferir o código na tela do coletor');
  });

  it('cobra a ociosidade', () => {
    expect(r).toContain('Ociosidade de 45 minutos');
  });
});

describe('ficha v3 — intermitente', () => {
  const r = gerar('INTERMITENTE');

  it('identifica o vínculo por convocação', () => {
    expect(r).toContain('COLABORADOR INTERMITENTE');
    expect(r).toContain('convocação intermitente');
  });

  it('mantém a posição no ranking', () => {
    expect(r).toContain('Posição: 9º de 15');
  });
});

describe('ficha v3 — prestador de serviço', () => {
  const r = gerar('FREE');

  it('trata como prestador', () => {
    expect(r).toContain('PRESTADOR: AMARILDO');
  });

  it('não compara com a equipe', () => {
    expect(r).not.toContain('Posição:');
    expect(r).not.toContain('Mediana da equipe');
  });

  it('constata em vez de orientar', () => {
    expect(r).toContain('CONSTATAÇÕES');
    expect(r).not.toContain('DIRECIONAMENTO');
    expect(r).toContain('Registro de troca de código');
    expect(r).not.toContain('Conferir o código na tela do coletor');
  });

  it('não cobra ociosidade, que é controle de jornada', () => {
    expect(r).not.toContain('Ociosidade');
    expect(r).not.toContain('Alinhar as pausas');
  });

  it.each([
    ['colaborador'],
    ['funcionário'],
    ['medida disciplinar'],
    ['código de conduta'],
    ['convocação'],
    ['sob sua responsabilidade'],
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
