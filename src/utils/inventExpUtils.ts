/**
 * De-para de nomes abreviados (XLS / .prc) para nomes canônicos
 * da tabela `limites_bloco_area` e do seed em inventoryEvalConfig.
 *
 * Obrigatório em todo ponto de leitura de nome de área externo.
 */
const AREA_ALIASES: Record<string, string> = {
  'F CAIXA':            'FRENTE DE CAIXA',
  'GELADEIRAS CAIXA':   'GELADEIRAS FRENTE CAIXA',
  'AVARIAS':            'AVARIAS E VENCIDOS',
  'B ATENDIMENTO':      'BALCÃO DE ATENDIMENTO',
  'P OTC':              'MEDICAMENTOS OTC',
  // Alias legado da config antiga / planilhas de campo
  'OTC / MIP (CAIXA)':  'MEDICAMENTOS OTC',
  'OTC/MIP (CAIXA)':    'MEDICAMENTOS OTC',
};

export function normalizarNomeArea(nome: string): string {
  if (!nome) return '';
  const upper = nome.trim().toUpperCase();
  return AREA_ALIASES[upper] ?? upper;
}

/**
 * Chave de comparação de área: maiúsculas, sem acento e sem espaço duplicado.
 *
 * A tabela de limites usa acento ("ANTIBIÓTICOS", "TERMOLÁBEIS", "ATRÁS DE
 * CAIXA") e o relatório do sistema não usa ("ANTIBIOTICOS"). Comparar as duas
 * strings literalmente fazia área crítica de limite 0% passar sem verificação
 * nenhuma — conferido no L2601, onde só 3 das 25 áreas casavam.
 */
export function chaveArea(nome: string): string {
  return (nome ?? '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** true quando os dois nomes designam a mesma área. */
export function mesmaArea(a: string, b: string): boolean {
  const ka = chaveArea(a);
  return ka.length > 0 && ka === chaveArea(b);
}


/**
 * Áreas do inventário que não têm limite de bloco cadastrado.
 *
 * Sem registro na tabela, o bloco daquela área **não é verificado** — a decisão
 * do projeto é não punir área desconhecida. O risco é isso passar despercebido:
 * no L2601 só 3 das 25 áreas casavam, e entre as que faltavam estavam
 * ANTIBIÓTICOS, PSICOTRÓPICOS e TERMOLÁBEIS, todas críticas com limite 0%.
 *
 * Por isso a lacuna precisa aparecer na tela e no relatório do líder, não só
 * num `console.warn`.
 */
export function areasSemLimiteCadastrado(
  areasDoInventario: string[],
  limites: { nome_area: string }[],
): string[] {
  const cadastradas = new Set(limites.map((l) => chaveArea(l.nome_area)));
  const vistas = new Set<string>();
  const faltando: string[] = [];

  for (const area of areasDoInventario) {
    const k = chaveArea(area);
    if (!k || vistas.has(k)) continue;
    vistas.add(k);
    if (!cadastradas.has(k)) faltando.push(area.trim());
  }
  return faltando.sort((a, b) => a.localeCompare(b, 'pt-BR'));
}
