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

/**
 * Gôndola escrita de três jeitos pela mesma rede: `RUA 3 FRENTE`, `R 3 FRENTE`,
 * `G3`. Todas designam a mesma gôndola e devem cair no mesmo limite de bloco.
 *
 * O lado (frente/fundo) é descartado **só na comparação com a tabela**: a
 * tabela cadastra a gôndola inteira (`G 3`), e os dois lados herdam o limite
 * dela. O nome de exibição nunca muda — a ficha do conferente continua dizendo
 * "RUA 3 FRENTE", que é como ele conhece o lugar.
 */
const PADRAO_GONDOLA = /^(?:RUA|R|G)\s*0*(\d{1,2})(?:\s+(?:FRENTE|FUNDO))?$/;

/** `RUA 3 FRENTE` | `R3` | `G 03 FUNDO` → `GONDOLA 3`. Null se não for gôndola. */
export function canonizarGondola(nome: string): string | null {
  const m = chaveArea(nome).match(PADRAO_GONDOLA);
  return m ? `GONDOLA ${m[1]}` : null;
}

/** Chave usada para casar com a tabela de limites (gôndola equivale a gôndola). */
function chaveParaLimite(nome: string): string {
  return canonizarGondola(nome) ?? chaveArea(nome);
}

/**
 * Nome canônico de exibição. **Não** canoniza gôndola de propósito: o
 * conferente conhece a área como "RUA 3 FRENTE" e é assim que ela deve aparecer
 * na ficha e no consolidado.
 */
export function normalizarNomeArea(nome: string): string {
  if (!nome) return '';
  const upper = nome.trim().toUpperCase();
  return AREA_ALIASES[upper] ?? upper;
}


/**
 * true quando os dois nomes designam a mesma área.
 *
 * Casa por chave sem acento e, para gôndola, aceita as três nomenclaturas da
 * rede — `RUA 3 FRENTE`, `R3` e `G 3` são a mesma gôndola para efeito de limite.
 */
export function mesmaArea(a: string, b: string): boolean {
  const ka = chaveArea(a);
  if (!ka) return false;
  if (ka === chaveArea(b)) return true;
  const ga = canonizarGondola(a);
  return ga !== null && ga === canonizarGondola(b);
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
  const cadastradas = new Set(limites.map((l) => chaveParaLimite(l.nome_area)));
  const vistas = new Set<string>();
  const faltando: string[] = [];

  for (const area of areasDoInventario) {
    const k = chaveParaLimite(area);
    if (!k || vistas.has(k)) continue;
    vistas.add(k);
    if (!cadastradas.has(k)) faltando.push(area.trim());
  }
  return faltando.sort((a, b) => a.localeCompare(b, 'pt-BR'));
}
