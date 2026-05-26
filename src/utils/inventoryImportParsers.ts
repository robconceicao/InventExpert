/**
 * inventoryImportParsers.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Parser genérico para importação de arquivos de inventário de sistemas
 * externos (DPSP/ProInv, Sysled, RMS, etc.).
 *
 * ARQUITETURA — padrão Adapter/Strategy:
 *   1. Tipos compartilhados: `ImportedProduct`, `ImportedCountLine`, `StockRecord`
 *   2. Interface `InventoryImportAdapter` — contrato que todo adaptador deve cumprir
 *   3. Adaptadores concretos: `DpspAdapter`, `GenericCsvAdapter`
 *   4. `InventoryImportRegistry` — registro central de adaptadores
 *   5. `detectAndParse()` — ponto único de entrada; detecta o formato e delega
 *
 * Para adicionar suporte a uma nova empresa:
 *   • Implemente `InventoryImportAdapter`
 *   • Registre com `InventoryImportRegistry.register()`
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Tipos compartilhados ────────────────────────────────────────────────────

/** Um produto do catálogo / saldo do sistema (estoque esperado) */
export interface StockRecord {
  itemCode: string;       // código interno do sistema
  ean: string;            // código de barras EAN-13 (sem prefixo)
  description: string;
  family?: string;
  subclass?: string;
  supplier?: string;
  section?: string;       // seção/gôndola onde está alocado
  systemQty: number;      // quantidade que o sistema esperava encontrar
  unitCost: number;       // custo unitário (R$)
}

/** Uma linha do arquivo de contagem (o que foi efetivamente contado) */
export interface ImportedCountLine {
  ean: string;            // EAN como veio no arquivo de contagem
  countedQty: number;
  section?: string;
  operator?: string;      // agente/conferente que bipou (quando disponível)
}

/** Resultado final do cruzamento: divergência por produto */
export interface ProductVariance {
  ean: string;
  itemCode: string;
  description: string;
  family: string;
  subclass: string;
  supplier: string;
  section: string;
  systemQty: number;
  countedQty: number;
  difference: number;     // countedQty - systemQty  (negativo = perda)
  unitCost: number;
  valueVariance: number;  // difference * unitCost
  status: 'PERDA' | 'SOBRA' | 'OK';
}

/** Resultado completo de uma importação */
export interface InventoryImportResult {
  adapterUsed: string;
  storeCode: string;
  inventoryDate: string;
  totalLinesCount: number;  // linhas no arquivo de contagem
  totalMatched: number;     // linhas que encontraram correspondência no saldo
  unmatched: number;        // sem correspondência
  variances: ProductVariance[];
  summary: {
    totalLoss: number;      // R$ total de perdas
    totalSurplus: number;   // R$ total de sobras
    netBalance: number;     // totalSurplus - totalLoss
    lossUnits: number;
    surplusUnits: number;
    lossCount: number;      // nº de SKUs com perda
    surplusCount: number;   // nº de SKUs com sobra
  };
}

// ─── Interface do adaptador ──────────────────────────────────────────────────

export interface InventoryImportAdapter {
  /** Nome legível da empresa/sistema */
  readonly name: string;
  /** Identificador único — usado no registro */
  readonly id: string;

  /**
   * Retorna `true` se este adaptador reconhece os arquivos recebidos.
   * Cada arquivo é passado como string de texto já decodificado.
   */
  detect(files: Record<string, string>): boolean;

  /**
   * Extrai o saldo do sistema a partir dos arquivos de catálogo/estoque.
   * Chave do mapa: EAN normalizado (sem prefixo extra, sem zeros à esquerda).
   */
  parseStock(files: Record<string, string>): Map<string, StockRecord>;

  /**
   * Extrai as linhas de contagem a partir do arquivo final de inventário.
   */
  parseCount(files: Record<string, string>): ImportedCountLine[];

  /**
   * Metadados extraídos dos arquivos (loja, data, etc.)
   */
  parseMetadata(files: Record<string, string>): { storeCode: string; inventoryDate: string };
}

// ─── Adaptador DPSP / ProInv ─────────────────────────────────────────────────

/**
 * Adaptador para o sistema ProInv da DPSP (Raia Drogasil / Drogarias São Paulo).
 *
 * Arquivos esperados (passados via `files`):
 *   - "arqFinal"    → L<loja>.txt  (arquivo final de contagem, largura fixa)
 *   - "inventDsp"   → INVENT_DSP*.old  (catálogo EAN→item, delimitado por ";")
 *   - "saldoLoja"   → INVENT_L*_SALDO*.old  (saldo sistema, delimitado por ";")
 *   - "prodOld"     → PROD-*.old  (mapa EAN→seção, delimitado por ";") [opcional]
 *
 * Peculiaridades do formato DPSP:
 *   • ArqFinal usa largura fixa: EAN (15 chars) + qtd (6 chars)
 *   • Os EANs no ArqFinal têm um dígito "3" extra como prefixo interno
 *   • INVENT_DSP faz a ponte: código interno ↔ EAN real
 */
export class DpspAdapter implements InventoryImportAdapter {
  readonly name = 'DPSP / ProInv';
  readonly id   = 'dpsp_proinv';

  detect(files: Record<string, string>): boolean {
    const arqFinal = files['arqFinal'] ?? '';
    // Linha de cabeçalho: "1" + código loja (4 chars) + espaços + data "DD/MM/YY"
    return /^1\d{4}\s+\d{2}\/\d{2}\/\d{2}/.test(arqFinal.trimStart());
  }

  parseMetadata(files: Record<string, string>) {
    const header = (files['arqFinal'] ?? '').split('\n')[0].trim();
    // "1L2465       26/05/26"
    const storeCode     = header.substring(1, 5).trim();
    const rawDate       = header.substring(header.length - 8).trim(); // "26/05/26"
    const [d, m, y]     = rawDate.split('/');
    const inventoryDate = `20${y}-${m}-${d}`;
    return { storeCode, inventoryDate };
  }

  parseStock(files: Record<string, string>): Map<string, StockRecord> {
    const stock = new Map<string, StockRecord>();

    // 1. INVENT_DSP → item_code ↔ EAN
    const eanToItem = new Map<string, string>();
    const itemToEan = new Map<string, string>();
    for (const line of (files['inventDsp'] ?? '').split('\n')) {
      const p = line.split(';').map(s => s.trim());
      if (p.length >= 2 && p[0] && p[1]) {
        const item = p[0];
        const ean  = p[1];
        eanToItem.set(ean, item);
        eanToItem.set(`3${ean}`, item); // variante com prefixo DPSP
        itemToEan.set(item, ean);
      }
    }

    // 2. Seções do PROD.old (opcional)
    const eanToSection = new Map<string, string>();
    for (const line of (files['prodOld'] ?? '').split('\n')) {
      const p = line.split(';');
      if (p.length >= 9) {
        const ean    = p[5]?.trim() ?? '';
        const section = p[8]?.trim() ?? '';
        if (ean && section) eanToSection.set(ean, section);
      }
    }

    // 3. SALDO_LOJA → item_code → StockRecord
    const lines = (files['saldoLoja'] ?? '').split('\n');
    for (let i = 2; i < lines.length; i++) {
      const p = lines[i].split(';');
      if (p.length < 9) continue;
      try {
        const item    = p[1]?.trim() ?? '';
        const ean     = itemToEan.get(item) ?? '';
        const section = eanToSection.get(ean) ?? '';
        const qty     = parseFloat(p[7].replace(',', '.'));
        const cost    = parseFloat(p[8].replace(',', '.')) || 0;
        if (!item || isNaN(qty)) continue;
        stock.set(item, {
          itemCode:    item,
          ean,
          description: p[2]?.trim() ?? '',
          subclass:    p[3]?.trim() ?? '',
          family:      p[5]?.trim() ?? '',
          supplier:    p[6]?.trim() ?? '',
          section,
          systemQty:   qty,
          unitCost:    cost,
        });
      } catch { /* linha malformada */ }
    }

    return stock;
  }

  parseCount(files: Record<string, string>): ImportedCountLine[] {
    const lines = (files['arqFinal'] ?? '').split('\n');
    const result: ImportedCountLine[] = [];
    // INVENT_DSP para resolver prefixo 3
    const eanToItem = new Map<string, string>();
    for (const line of (files['inventDsp'] ?? '').split('\n')) {
      const p = line.split(';').map(s => s.trim());
      if (p.length >= 2) {
        eanToItem.set(p[1], p[0]);
        eanToItem.set(`3${p[1]}`, p[0]);
      }
    }
    for (let i = 1; i < lines.length; i++) {
      const raw = lines[i].replace(/\r/g, '');
      if (raw.length < 20) continue;
      try {
        const ean = raw.substring(0, 15).trim();
        const qty = parseInt(raw.substring(15, 21).trim(), 10);
        if (!ean || isNaN(qty)) continue;
        result.push({ ean, countedQty: qty });
      } catch { /* linha malformada */ }
    }
    return result;
  }
}

// ─── Adaptador CSV Genérico ──────────────────────────────────────────────────

/**
 * Adaptador para arquivos CSV genéricos exportados por qualquer sistema.
 *
 * Detecta automaticamente o delimitador (;  ,  \t).
 *
 * Esperado: arquivo CSV com pelo menos 3 colunas.
 * O sistema tenta mapear as colunas pelos cabeçalhos (case-insensitive):
 *   - EAN / codigo / barcode / ean13
 *   - descricao / description / produto / product / nome
 *   - qtd_sistema / saldo / sistema / estoque / expected_qty / system_qty
 *   - qtd_contada / contagem / contado / counted_qty / count
 *   - custo / cost / preco / price / unit_cost
 *   - secao / section / area / gôndola
 *   - familia / family / categoria / category
 *
 * Arquivo esperado no campo "countCsv" (contagem) e "stockCsv" (saldo).
 * Se apenas "countCsv" for fornecido, a diferença não será calculada.
 */
export class GenericCsvAdapter implements InventoryImportAdapter {
  readonly name = 'CSV Genérico';
  readonly id   = 'generic_csv';

  // Mapeamento de aliases para nomes canônicos
  private readonly ALIASES: Record<string, string[]> = {
    ean:       ['ean', 'codigo', 'barcode', 'ean13', 'cod_barras', 'codbarras', 'cod', 'item'],
    desc:      ['descricao', 'description', 'produto', 'product', 'nome', 'name', 'descr'],
    systemQty: ['qtd_sistema', 'saldo', 'sistema', 'estoque', 'expected_qty', 'system_qty', 'qtd_sis', 'estq'],
    countedQty:['qtd_contada', 'contagem', 'contado', 'counted_qty', 'count', 'qtd_cont', 'qtde'],
    cost:      ['custo', 'cost', 'preco', 'price', 'unit_cost', 'custo_unit', 'vlr_custo'],
    section:   ['secao', 'section', 'area', 'gondola', 'local', 'setor'],
    family:    ['familia', 'family', 'categoria', 'category', 'grupo'],
    supplier:  ['fornecedor', 'supplier', 'fabricante', 'marca'],
  };

  private detectDelimiter(text: string): string {
    const first = text.split('\n')[0] ?? '';
    const counts = {
      ';': (first.match(/;/g) ?? []).length,
      ',': (first.match(/,/g) ?? []).length,
      '\t':(first.match(/\t/g) ?? []).length,
    };
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }

  private mapHeader(headers: string[]): Record<string, number> {
    const map: Record<string, number> = {};
    headers.forEach((h, idx) => {
      const normalized = h.toLowerCase().trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // remove acentos
      for (const [canonical, aliases] of Object.entries(this.ALIASES)) {
        if (aliases.some(a => normalized === a || normalized.startsWith(a))) {
          if (!(canonical in map)) map[canonical] = idx;
        }
      }
    });
    return map;
  }

  detect(files: Record<string, string>): boolean {
    // Qualquer arquivo com cabeçalho CSV que tenha EAN e quantidade
    const text = files['countCsv'] ?? files['stockCsv'] ?? '';
    if (!text) return false;
    const delim   = this.detectDelimiter(text);
    const headers = text.split('\n')[0].split(delim);
    const mapped  = this.mapHeader(headers);
    return 'ean' in mapped && ('countedQty' in mapped || 'systemQty' in mapped);
  }

  parseMetadata(files: Record<string, string>) {
    return {
      storeCode:     files['storeCode']     ?? 'N/A',
      inventoryDate: files['inventoryDate'] ?? new Date().toISOString().slice(0, 10),
    };
  }

  parseStock(files: Record<string, string>): Map<string, StockRecord> {
    const stock = new Map<string, StockRecord>();
    const text  = files['stockCsv'] ?? files['countCsv'] ?? '';
    if (!text) return stock;

    const delim   = this.detectDelimiter(text);
    const lines   = text.split('\n').filter(l => l.trim());
    const headers = lines[0].split(delim);
    const col     = this.mapHeader(headers);

    for (let i = 1; i < lines.length; i++) {
      const p = lines[i].split(delim);
      const ean = p[col['ean'] ?? -1]?.trim().replace(/^0+/, '') ?? '';
      if (!ean) continue;
      const qty  = parseFloat((p[col['systemQty'] ?? -1] ?? '0').replace(',', '.')) || 0;
      const cost = parseFloat((p[col['cost'] ?? -1] ?? '0').replace(',', '.')) || 0;
      stock.set(ean, {
        itemCode:    ean,
        ean,
        description: p[col['desc'] ?? -1]?.trim() ?? '',
        family:      p[col['family'] ?? -1]?.trim() ?? '',
        subclass:    '',
        supplier:    p[col['supplier'] ?? -1]?.trim() ?? '',
        section:     p[col['section'] ?? -1]?.trim() ?? '',
        systemQty:   qty,
        unitCost:    cost,
      });
    }
    return stock;
  }

  parseCount(files: Record<string, string>): ImportedCountLine[] {
    const text = files['countCsv'] ?? '';
    if (!text) return [];

    const delim   = this.detectDelimiter(text);
    const lines   = text.split('\n').filter(l => l.trim());
    const headers = lines[0].split(delim);
    const col     = this.mapHeader(headers);
    const result: ImportedCountLine[] = [];

    for (let i = 1; i < lines.length; i++) {
      const p   = lines[i].split(delim);
      const ean = p[col['ean'] ?? -1]?.trim().replace(/^0+/, '') ?? '';
      if (!ean) continue;
      const qty      = parseFloat((p[col['countedQty'] ?? col['systemQty'] ?? -1] ?? '0').replace(',', '.')) || 0;
      const section  = p[col['section'] ?? -1]?.trim() ?? '';
      const operator = p[col['operator'] ?? -1]?.trim() ?? '';
      result.push({ ean, countedQty: qty, section: section || undefined, operator: operator || undefined });
    }
    return result;
  }
}

// ─── Registro de adaptadores ─────────────────────────────────────────────────

class _InventoryImportRegistry {
  private adapters: InventoryImportAdapter[] = [];

  register(adapter: InventoryImportAdapter) {
    this.adapters.push(adapter);
  }

  /** Retorna o primeiro adaptador que reconhece os arquivos */
  detect(files: Record<string, string>): InventoryImportAdapter | null {
    return this.adapters.find(a => a.detect(files)) ?? null;
  }

  list(): { id: string; name: string }[] {
    return this.adapters.map(a => ({ id: a.id, name: a.name }));
  }

  getById(id: string): InventoryImportAdapter | null {
    return this.adapters.find(a => a.id === id) ?? null;
  }
}

export const InventoryImportRegistry = new _InventoryImportRegistry();

// Registrar adaptadores nativos
InventoryImportRegistry.register(new DpspAdapter());
InventoryImportRegistry.register(new GenericCsvAdapter());

// ─── Função principal de cruzamento ──────────────────────────────────────────

/**
 * Cruza o saldo do sistema com a contagem real e retorna as divergências.
 *
 * @param adapter  Adaptador que fará o parse
 * @param files    Mapa de chave → conteúdo do arquivo (string de texto)
 */
export function crossReferenceInventory(
  adapter: InventoryImportAdapter,
  files: Record<string, string>,
): InventoryImportResult {
  const stock    = adapter.parseStock(files);
  const counted  = adapter.parseCount(files);
  const meta     = adapter.parseMetadata(files);

  // Para DPSP: resolver EAN prefixado → item_code usando INVENT_DSP
  const eanToItem = new Map<string, string>();
  if (files['inventDsp']) {
    for (const line of files['inventDsp'].split('\n')) {
      const p = line.split(';').map(s => s.trim());
      if (p.length >= 2 && p[0] && p[1]) {
        eanToItem.set(p[1], p[0]);
        eanToItem.set(`3${p[1]}`, p[0]);
      }
    }
  }

  const variances: ProductVariance[] = [];
  let unmatched = 0;

  for (const cl of counted) {
    // Tenta encontrar o registro de estoque via EAN direto ou via item_code
    let rec = stock.get(cl.ean);
    if (!rec) {
      const itemCode = eanToItem.get(cl.ean);
      if (itemCode) rec = stock.get(itemCode);
    }
    if (!rec) {
      unmatched++;
      continue;
    }

    const diff  = cl.countedQty - rec.systemQty;
    const value = diff * rec.unitCost;

    variances.push({
      ean:          rec.ean || cl.ean,
      itemCode:     rec.itemCode,
      description:  rec.description,
      family:       rec.family ?? '',
      subclass:     rec.subclass ?? '',
      supplier:     rec.supplier ?? '',
      section:      cl.section ?? rec.section ?? '',
      systemQty:    rec.systemQty,
      countedQty:   cl.countedQty,
      difference:   diff,
      unitCost:     rec.unitCost,
      valueVariance:value,
      status:       diff > 0 ? 'SOBRA' : diff < 0 ? 'PERDA' : 'OK',
    });
  }

  const losses   = variances.filter(v => v.status === 'PERDA');
  const surpluses = variances.filter(v => v.status === 'SOBRA');
  const totalLoss    = losses.reduce((s, v) => s + Math.abs(v.valueVariance), 0);
  const totalSurplus = surpluses.reduce((s, v) => s + v.valueVariance, 0);

  return {
    adapterUsed:     adapter.name,
    storeCode:       meta.storeCode,
    inventoryDate:   meta.inventoryDate,
    totalLinesCount: counted.length,
    totalMatched:    variances.length,
    unmatched,
    variances,
    summary: {
      totalLoss,
      totalSurplus,
      netBalance:   totalSurplus - totalLoss,
      lossUnits:    losses.reduce((s, v) => s + Math.abs(v.difference), 0),
      surplusUnits: surpluses.reduce((s, v) => s + v.difference, 0),
      lossCount:    losses.length,
      surplusCount: surpluses.length,
    },
  };
}

/**
 * Detecta automaticamente o adaptador, faz o parse e retorna as divergências.
 * Ponto único de entrada para a UI.
 */
export function detectAndImport(
  files: Record<string, string>,
  forceAdapterId?: string,
): InventoryImportResult | null {
  const adapter = forceAdapterId
    ? InventoryImportRegistry.getById(forceAdapterId)
    : InventoryImportRegistry.detect(files);

  if (!adapter) return null;
  return crossReferenceInventory(adapter, files);
}
