interface ProdutoInfo {
  nome:   string;
  ean:    string;
  classe: string;  // 'A2', 'C1', '-B2'... ou ''
}

/** Indexa cadastro.txt: 15d código | 20d descrição | 3d flag (latin-1) */
export function buildCatalogoIndex(conteudo: string): Map<string, ProdutoInfo> {
  const index = new Map<string, ProdutoInfo>();
  for (const linha of conteudo.split(/\r?\n/)) {
    if (linha.length < 35) continue;
    const codigo = linha.substring(0, 15).replace(/^0+/, '') || '0';
    const nome   = linha.substring(15, 35).trim();
    index.set(codigo, { nome, ean: '', classe: '' });
  }
  return index;
}

/** Indexa invent_DSP_[DATA].old: CSV (;) código;EAN;descrição+classe (latin-1) */
export function buildInventDspIndex(conteudo: string): Map<string, ProdutoInfo> {
  const index = new Map<string, ProdutoInfo>();
  for (const linha of conteudo.split(/\r?\n/)) {
    const partes = linha.split(';');
    if (partes.length < 3) continue;
    const codigo      = partes[0].trim();
    const ean         = partes[1].trim();
    const descRaw     = partes[2].trim();
    const classeMatch = descRaw.match(/\s(-?[ABC]\d)$/);
    const classe      = classeMatch ? classeMatch[1] : '';
    const nome        = descRaw.replace(/\s(-?[ABC]\d)$/, '').trim();
    if (codigo) index.set(codigo, { nome, ean, classe });
  }
  return index;
}

/**
 * Resolve produto preferindo invent_DSP (EAN real + classe legal).
 * Cai para cadastro.txt. Se não encontrado, retorna placeholder.
 */
export function resolverProduto(
  codigo: string,
  inventDsp: Map<string, ProdutoInfo>,
  catalogo: Map<string, ProdutoInfo>
): ProdutoInfo {
  return inventDsp.get(codigo)
      ?? catalogo.get(codigo)
      ?? { nome: `Produto ${codigo}`, ean: '', classe: '' };
}
