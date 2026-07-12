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

