import {
  construirMapaAreas,
  areasDoConferente,
  type ProdSecaoRow,
} from '../AreaMappingService';
import {
  atribuirDivergencias,
  conferirBloco,
  conferirReconciliacao,
  contarDobroPorConferente,
  type AcuracidadeRow,
} from '../ErroAtribuicaoService';
import {
  atribuirNaoContados,
  calcularCobertura,
  tokensDescricao,
  type NaoContadoInput,
} from '../NaoContadoService';
import {
  avaliarConferenteV3,
  medianaProdutividade,
  ordenarRankingV3,
  type ContextoEquipe,
  type EntradaV3,
} from '../AvaliacaoV3Service';
import type { ContagemDetalhada } from '../../types';

const AMARILDO = '29291408875';
const BIANKA = '43427459845';

function bip(
  matricula: string,
  secao: string,
  ean: string,
  quantidade: number,
  iso = '2026-08-07T00:15:36',
): ContagemDetalhada {
  return {
    matricula,
    area_codigo: secao,
    area_nome: '',
    produto_codigo: ean.replace(/^0+/, ''),
    produto_nome: '',
    produto_ean: ean,
    produto_classe: '',
    quantidade,
    is_bloco: quantidade > 1,
    data_hora: new Date(iso),
    endereco: `0000000PI00${secao}`,
    endereco_fora_padrao: false,
    flag_origem: quantidade > 1 ? 'P' : ' ',
  };
}

/** Duas áreas contíguas para o Amarildo e uma para a Bianka. */
function cenario() {
  const contagens: ContagemDetalhada[] = [];
  // RUA 4 FUNDO: seções 2301..2303, 40 peças cada
  for (const s of ['2301', '2302', '2303']) {
    contagens.push(bip(AMARILDO, s, `00789600000${s}`, 40));
  }
  // MEDICAMENTOS: seções 0217..0218, 10 peças cada
  for (const s of ['0217', '0218']) {
    contagens.push(bip(AMARILDO, s, `00789610000${s}`, 10));
  }
  // PAREDE DERMO da Bianka: seções 0047..0048
  for (const s of ['0047', '0048']) {
    contagens.push(bip(BIANKA, s, `00400580000${s}`, 25));
  }

  const prodSecao: ProdSecaoRow[] = [
    { area: 'MEDICAMENTOS', matricula: AMARILDO, nome: 'AMARILDO', secoes: 2, qtdC1: 20 },
    { area: 'RUA 4 FUNDO', matricula: AMARILDO, nome: 'AMARILDO', secoes: 3, qtdC1: 120 },
    { area: 'PAREDE DERMO', matricula: BIANKA, nome: 'BIANKA', secoes: 2, qtdC1: 50 },
  ];
  return { contagens, prodSecao };
}

describe('AreaMappingService', () => {
  it('recorta as seções de cada conferente nas áreas declaradas', () => {
    const { contagens, prodSecao } = cenario();
    const mapa = construirMapaAreas(prodSecao, contagens);

    expect(mapa.secaoParaArea.get('0217')).toBe('MEDICAMENTOS');
    expect(mapa.secaoParaArea.get('2301')).toBe('RUA 4 FUNDO');
    expect(mapa.secaoParaArea.get('0047')).toBe('PAREDE DERMO');

    expect(mapa.secaoParaMatricula.get('2303')).toBe(AMARILDO);
    expect(mapa.secaoParaMatricula.get('0048')).toBe(BIANKA);
  });

  it('fecha em nº de seções e peças em todas as combinações do cenário', () => {
    const { contagens, prodSecao } = cenario();
    const mapa = construirMapaAreas(prodSecao, contagens);
    expect(mapa.naoConformes).toHaveLength(0);
  });

  it('exclui a seção de auditoria dirigida do mapa de áreas', () => {
    const { contagens, prodSecao } = cenario();
    contagens.push(bip(AMARILDO, '9999', '007896585628206', 14));
    const mapa = construirMapaAreas(prodSecao, contagens);
    expect(mapa.secaoParaArea.has('9999')).toBe(false);
  });

  it('lista as áreas do conferente da maior para a menor', () => {
    const { contagens, prodSecao } = cenario();
    const mapa = construirMapaAreas(prodSecao, contagens);
    const areas = areasDoConferente(mapa, AMARILDO);
    expect(areas.map((a) => a.area)).toEqual(['RUA 4 FUNDO', 'MEDICAMENTOS']);
  });
});

describe('ErroAtribuicaoService', () => {
  const acuracidade: AcuracidadeRow[] = [
    {
      secao: '2301',
      ean: '007896000002301',
      descricao: 'COLIDIS 5 ML',
      qtdC1: 40,
      qtdA1: -14,
      qtdA2: 0,
      qtdA3: 0,
      qtdFinal: 26,
      ajuste: -14,
    },
    {
      secao: '0217',
      ean: '007896100000217',
      descricao: 'GLIFAGE XR 500MG',
      qtdC1: 10,
      qtdA1: 2,
      qtdA2: 0,
      qtdA3: 0,
      qtdFinal: 12,
      ajuste: 2,
    },
    {
      secao: '0047',
      ean: '004005800000047',
      descricao: 'EUCERIN ANT PIG',
      qtdC1: 25,
      qtdA1: 0,
      qtdA2: 0,
      qtdA3: 0,
      qtdFinal: 25,
      ajuste: 0,
    },
  ];

  function montar() {
    const { contagens, prodSecao } = cenario();
    const mapa = construirMapaAreas(prodSecao, contagens);
    return atribuirDivergencias(acuracidade, contagens, mapa, {
      custoPorEan: new Map([['007896000002301', 73.34]]),
      datasValidas: new Set(['20260807']),
    });
  }

  it('liga a divergência ao conferente pelo par seção + EAN', () => {
    const r = montar();
    expect(r.divergencias).toHaveLength(2);
    expect(r.divergencias.every((d) => d.matricula === AMARILDO)).toBe(true);
    expect(r.orfas).toHaveLength(0);
  });

  it('classifica sobra e falta pelo sinal do ajuste', () => {
    const r = montar();
    const sobra = r.divergencias.find((d) => d.ean === '007896000002301');
    const falta = r.divergencias.find((d) => d.ean === '007896100000217');
    expect(sobra?.tipo).toBe('SOBRA');
    expect(falta?.tipo).toBe('FALTA');
  });

  it('traz a área da seção e o modo de contagem', () => {
    const r = montar();
    const sobra = r.divergencias.find((d) => d.ean === '007896000002301');
    expect(sobra?.area).toBe('RUA 4 FUNDO');
    expect(sobra?.modo).toBe('BLOCO');
  });

  it('valoriza a divergência pelo custo unitário do cadastro', () => {
    const r = montar();
    const sobra = r.divergencias.find((d) => d.ean === '007896000002301');
    expect(sobra?.valor).toBeCloseTo(14 * 73.34, 2);
  });

  it('conta como órfã a divergência sem bipada correspondente', () => {
    const { contagens, prodSecao } = cenario();
    const mapa = construirMapaAreas(prodSecao, contagens);
    const r = atribuirDivergencias(
      [{ ...acuracidade[0], secao: '5555' }],
      contagens,
      mapa,
    );
    expect(r.divergencias).toHaveLength(0);
    expect(r.orfas).toHaveLength(1);
  });

  it('acusa quebra quando a soma não bate com o Erro (Qtde) do sistema', () => {
    const r = montar();
    expect(conferirReconciliacao(r, new Map([[AMARILDO, 16]]))).toHaveLength(0);
    expect(conferirReconciliacao(r, new Map([[AMARILDO, 99]]))).toHaveLength(1);
  });
});

describe('NaoContadoService', () => {
  it('extrai a marca ignorando números e medidas', () => {
    expect(tokensDescricao('COLIDIS 10ML')).toEqual(['COLIDIS', '10ML']);
    expect(tokensDescricao('CR LIPIK BAUME AP 400')).toEqual(['LIPIK', 'BAUME']);
  });

  it('detecta troca de EAN quando existe sobra da mesma marca na mesma quantidade', () => {
    const { contagens, prodSecao } = cenario();
    const mapa = construirMapaAreas(prodSecao, contagens);
    const divergencias = atribuirDivergencias(
      [
        {
          secao: '2301',
          ean: '007896000002301',
          descricao: 'COLIDIS 5 ML',
          qtdC1: 40,
          qtdA1: -14,
          qtdA2: 0,
          qtdA3: 0,
          qtdFinal: 26,
          ajuste: -14,
        },
      ],
      contagens,
      mapa,
    ).divergencias;

    const itens: NaoContadoInput[] = [
      {
        descricao: 'COLIDIS 10ML',
        eans: ['007896585628206'],
        situacao: 'RECUPERADO',
        quantidade: 14,
        valor: 1562.26,
      },
    ];

    const [r] = atribuirNaoContados(itens, [], contagens, mapa, divergencias);
    expect(r.nivel).toBe('ALTA');
    expect(r.matricula).toBe(AMARILDO);
    expect(r.area).toBe('RUA 4 FUNDO');
    expect(r.base).toContain('troca de código');
    // recuperado na auditoria: falha de contagem provada, pesa cheio
    expect(r.peso).toBe(1);
  });

  it('atribui por marca com alta confiança quando um conferente concentra as seções', () => {
    const { contagens, prodSecao } = cenario();
    const mapa = construirMapaAreas(prodSecao, contagens);
    const acuracidade: AcuracidadeRow[] = ['0047', '0047', '0048'].map((secao, i) => ({
      secao,
      ean: `00400580000004${i}`,
      descricao: 'EUCERIN ANT PIG N 50ML',
      qtdC1: 1,
      qtdA1: 0,
      qtdA2: 0,
      qtdA3: 0,
      qtdFinal: 1,
      ajuste: 0,
    }));

    const [r] = atribuirNaoContados(
      [
        {
          descricao: 'EUCERIN ANT PIG N 50ML',
          eans: ['004005805477121'],
          situacao: 'NAO_ENCONTRADO',
          valor: 156.99,
        },
      ],
      acuracidade,
      contagens,
      mapa,
      [],
    );

    expect(r.nivel).toBe('ALTA');
    expect(r.matricula).toBe(BIANKA);
    // atribuído com confiança ALTA, mas permaneceu não encontrado: sem
    // prova de que estava na prateleira, ninguém é penalizado
    expect(r.peso).toBe(0);
  });

  it('declara não atribuível quando não há marca nem família contada', () => {
    const { contagens, prodSecao } = cenario();
    const mapa = construirMapaAreas(prodSecao, contagens);
    const [r] = atribuirNaoContados(
      [{ descricao: 'SACOLA EVER', eans: ['017908271311712'], situacao: 'NAO_ENCONTRADO', valor: 79.65 }],
      [],
      contagens,
      mapa,
      [],
    );
    expect(r.nivel).toBeNull();
    expect(r.matricula).toBeNull();
    expect(r.peso).toBe(0);
  });

  it('cobertura só desconta o que tem confiança ALTA', () => {
    const base = {
      descricao: 'X',
      eans: [],
      situacao: 'NAO_ENCONTRADO' as const,
      valor: 1000,
      area: 'A',
      matricula: AMARILDO,
      base: '',
      secoesReferencia: [],
    };
    const alta = { ...base, nivel: 'ALTA' as const, peso: 1 };
    const media = { ...base, nivel: 'MEDIA' as const, peso: 0 };

    expect(calcularCobertura([media], AMARILDO, 100_000)).toBe(100);
    expect(calcularCobertura([alta], AMARILDO, 100_000)).toBeCloseTo(99, 3);
  });
});

describe('AvaliacaoV3Service', () => {
  it('usa mediana, não média, como referência da equipe', () => {
    expect(medianaProdutividade([100, 200, 5000])).toBe(200);
    expect(medianaProdutividade([100, 200])).toBe(150);
  });

  function avaliar(over: Partial<EntradaV3> = {}, contagensExtra: ContagemDetalhada[] = []) {
    const { contagens, prodSecao } = cenario();
    const todas = [...contagens, ...contagensExtra];
    const mapa = construirMapaAreas(prodSecao, todas);
    const contexto: ContextoEquipe = {
      medianaProdutividade: 900,
      mapa,
      datasValidas: new Set(['20260806', '20260807']),
    };
    const entrada: EntradaV3 = {
      nome: 'AMARILDO DA SILVA',
      matricula: AMARILDO,
      qtde: 4798,
      qtde1a1: 857,
      produtividade: 1151.52,
      erro: 153,
      valorContado: 75184.52,
      valorAjustado: 2684.51,
      horas: 4.17,
      ...over,
    };
    return avaliarConferenteV3(entrada, 'FARMACIA', todas, [], [], contexto, 737);
  }

  it('compõe a nota nos quatro eixos', () => {
    const r = avaliar();
    expect(r).not.toBeNull();
    expect(r!.acuracidadeUnidades).toBeCloseTo(96.811, 2);
    expect(r!.pctErroValor).toBeCloseTo(3.571, 2);
    expect(r!.cobertura).toBe(100);
    expect(r!.indiceProdutividade).toBe(100);
    expect(r!.nota).toBeGreaterThan(90);
    expect(r!.faixa).toBe('Excelente');
  });

  it('devolve null para o líder', () => {
    expect(avaliar({ role: 'LIDER' })).toBeNull();
    expect(avaliar({ nome: 'JOAO LIDER DA SILVA' })).toBeNull();
  });

  it('separa a auditoria dirigida da contagem regular', () => {
    const auditoria = [
      bip(AMARILDO, '9999', '007896585628206', 14, '2026-08-07T03:39:34'),
      bip(AMARILDO, '9999', '007896094606600', 18, '2026-08-07T03:39:43'),
    ];
    const r = avaliar({ qtde: 4798 }, auditoria);
    expect(r!.pecasAuditoria).toBe(32);
    expect(r!.pecasContagem).toBe(4798 - 32);
    // as seções contadas não incluem a 9999
    expect(r!.secoes).toBe(5);
  });

  it('sinaliza relógio de coletor fora das datas do inventário', () => {
    const fora = [bip(AMARILDO, '2301', '007896000002301', 1, '2022-05-31T12:38:02')];
    const r = avaliar({}, fora);
    expect(r!.relogioOk).toBe(false);
  });

  it('ordena o ranking por nota e desempata pelo erro em valor', () => {
    const base = { nota: 90, pctErroValor: 1, produtividade: 100, nome: 'A' } as never;
    const lista = [
      { ...(base as object), nome: 'A', nota: 90, pctErroValor: 2 },
      { ...(base as object), nome: 'B', nota: 90, pctErroValor: 1 },
      { ...(base as object), nome: 'C', nota: 95 },
    ] as never as Parameters<typeof ordenarRankingV3>[0];
    expect(ordenarRankingV3(lista).map((x) => x.nome)).toEqual(['C', 'B', 'A']);
  });
});

describe('DOBRO e BLOCO', () => {
  it('atribui cada bipada repetida ao conferente da seção', () => {
    const { contagens, prodSecao } = cenario();
    construirMapaAreas(prodSecao, contagens);
    const dobro = [
      { secao: '2301', ean: '007896000002301' },
      { secao: '2301', ean: '007896000002301' },
      { secao: '0047', ean: '004005800000047' },
    ];
    const contagem = contarDobroPorConferente(dobro, contagens);
    expect(contagem.get(AMARILDO)).toBe(2);
    expect(contagem.get(BIANKA)).toBe(1);
  });

  it('ignora item em dobro sem bipada correspondente', () => {
    const { contagens } = cenario();
    expect(contarDobroPorConferente([{ secao: '5555', ean: '999' }], contagens).size).toBe(0);
  });

  /**
   * O BLOCO.xls é a conferência independente: publica seção de 4 dígitos, CPF e
   * código coletado na mesma linha. Se o decodificador de seção ou a regra
   * `is_bloco = quantidade > 1` estivessem errados, a cobertura despencaria.
   */
  it('confirma o decodificador de seção e a regra de bloco', () => {
    const { contagens } = cenario();
    const bloco = [
      { secao: '2301', cpf: AMARILDO, ean: '007896000002301' },
      { secao: '0047', cpf: BIANKA, ean: '004005800000047' },
    ];
    const c = conferirBloco(bloco, contagens);
    expect(c.totalRelatorio).toBe(2);
    expect(c.casados).toBe(2);
    expect(c.comQuantidadeUm).toBe(0);
    expect(c.cpfDivergente).toBe(0);
    expect(c.coberturaPct).toBe(100);
  });

  it('acusa quando o relatório aponta bloco e a bipada tem quantidade 1', () => {
    const contagens = [bip(AMARILDO, '2301', '007896000002301', 1)];
    const c = conferirBloco([{ secao: '2301', cpf: AMARILDO, ean: '007896000002301' }], contagens);
    expect(c.casados).toBe(0);
    expect(c.comQuantidadeUm).toBe(1);
    expect(c.coberturaPct).toBe(0);
  });

  it('acusa CPF divergente entre relatório e bipada', () => {
    const { contagens } = cenario();
    const c = conferirBloco([{ secao: '2301', cpf: BIANKA, ean: '007896000002301' }], contagens);
    expect(c.cpfDivergente).toBe(1);
  });

  it('deduplica trios repetidos do relatório', () => {
    const { contagens } = cenario();
    const linha = { secao: '2301', cpf: AMARILDO, ean: '007896000002301' };
    expect(conferirBloco([linha, linha, linha], contagens).totalRelatorio).toBe(1);
  });
});

describe('não contado: só a falha comprovada penaliza', () => {
  /**
   * Regra de 08/2026: produto que permaneceu não encontrado pode ser erro de
   * saldo do cliente — não há prova de que alguém passou por ele. Já o item
   * recuperado na auditoria dirigida estava na prateleira e ninguém bipou.
   */
  function itens(situacao: 'RECUPERADO' | 'NAO_ENCONTRADO') {
    const { contagens, prodSecao } = cenario();
    const mapa = construirMapaAreas(prodSecao, contagens);
    // Três itens da marca contados nas seções da Bianka: base para ALTA.
    const acuracidade: AcuracidadeRow[] = ['0047', '0047', '0048'].map((secao, i) => ({
      secao,
      ean: `00400580000004${i}`,
      descricao: 'EUCERIN ANT PIG N 50ML',
      qtdC1: 1,
      qtdA1: 0,
      qtdA2: 0,
      qtdA3: 0,
      qtdFinal: 1,
      ajuste: 0,
    }));

    return atribuirNaoContados(
      [
        {
          descricao: 'EUCERIN ANT PIG N 50ML',
          eans: ['004005805477121'],
          situacao,
          valor: 156.99,
          quantidade: situacao === 'RECUPERADO' ? 1 : undefined,
        },
      ],
      acuracidade,
      contagens,
      mapa,
      [],
    );
  }

  it('recuperado na auditoria pesa cheio', () => {
    const [r] = itens('RECUPERADO');
    expect(r.peso).toBe(1);
  });

  it('não encontrado não penaliza, mesmo com confiança ALTA', () => {
    const [r] = itens('NAO_ENCONTRADO');
    expect(r.peso).toBe(0);
  });

  it('o não encontrado continua atribuído e visível no relatório', () => {
    const [r] = itens('NAO_ENCONTRADO');
    expect(r.area).toBeTruthy();
    expect(r.base).toBeTruthy();
  });

  it('cobertura só desconta a falha comprovada', () => {
    const [recuperado] = itens('RECUPERADO');
    const [perdido] = itens('NAO_ENCONTRADO');
    const mat = recuperado.matricula!;

    expect(calcularCobertura([recuperado], mat, 10000)).toBeLessThan(100);
    expect(calcularCobertura([perdido], mat, 10000)).toBe(100);
  });
});

describe('não contado: atribuição pelo departamento', () => {
  /**
   * Casos vindos do NAO_CONTADOS.xls real do L2601, onde a marca do produto
   * não aparece em nenhum item contado e só o departamento localiza a área.
   */
  function cenarioDep(departamentoNome?: string) {
    const { contagens, prodSecao } = cenario();
    const mapa = construirMapaAreas(prodSecao, contagens);
    // A família do CadProd usa o mesmo vocabulário do departamento.
    const familiaPorEan = new Map(
      contagens
        .filter((c) => c.matricula === BIANKA)
        .map((c) => [c.produto_ean, 'Dermocosméticos'] as const),
    );

    return atribuirNaoContados(
      [
        {
          descricao: 'HYA-FIL ELAST 3D SERUM',
          eans: ['003337875930338'],
          situacao: 'NAO_ENCONTRADO',
          valor: 172.29,
          departamento: '383',
          departamentoNome,
        },
      ],
      [],
      contagens,
      mapa,
      [],
      { familiaPorEan },
    );
  }

  it('localiza a área pelo departamento quando a marca não resolve', () => {
    const [r] = cenarioDep('DERMOCOSMETICOS');
    expect(r.area).toBe('PAREDE DERMO');
    expect(r.matricula).toBe(BIANKA);
    expect(r.base).toContain('departamento "DERMOCOSMETICOS"');
  });

  it('casa o rótulo ignorando acento e caixa', () => {
    const [r] = cenarioDep('Dermocosmeticos');
    expect(r.matricula).toBe(BIANKA);
  });

  it('nunca sobe a ALTA: é vínculo de rótulo, não de produto', () => {
    const [r] = cenarioDep('DERMOCOSMETICOS');
    expect(r.nivel).not.toBe('ALTA');
    expect(r.peso).toBe(0);
  });

  it('declara não atribuível quando o departamento não casa com nada', () => {
    const [r] = cenarioDep('PERFUMARIA IMPORTADA');
    expect(r.matricula).toBeNull();
    expect(r.base).toContain('não atribuível');
  });

  it('sem nome de departamento, o comportamento anterior é preservado', () => {
    const [r] = cenarioDep(undefined);
    expect(r.matricula).toBeNull();
  });
});
