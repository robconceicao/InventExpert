import { ContagemDetalhada } from '../types';

/**
 * Parser de arquivos .prc do sistema de coleta (fixed-width).
 *
 * Layout padrão (83 chars/linha):
 * [00-05] Código evento    [32-42] Matrícula (11d)
 * [06-11] Código loja      [43]    Flag: P=unitário X=bloco
 * [12-17] Seq. sessão      [44-50] Campo interno (7d)
 * [18-25] Data YYYYMMDD    [51-52] Prefixo 'PI'
 * [26-31] Hora HHMMSS      [53-58] Código seção (6d)
 *                          [59-73] Código produto (15d, zero-padded)
 *                          [74-79] Quantidade (6d)
 *                          [80-82] Reservado
 *
 * Variante 84 chars: campo interno com 8d → offset +1 a partir da posição 44.
 */
export function parsePrcFile(conteudo: string): ContagemDetalhada[] {
  const linhas = conteudo.split(/\r?\n/).filter(l => l.length >= 83);
  const resultado: ContagemDetalhada[] = [];

  for (const linha of linhas) {
    const offset = linha.length >= 84 ? 1 : 0;

    const prefixoTipo = linha.substring(51 + offset, 53 + offset);
    if (prefixoTipo !== 'PI') continue;

    const matricula     = linha.substring(32, 43);
    const flag          = linha.substring(43, 44);
    const codigoSecao   = linha.substring(53 + offset, 59 + offset);
    const codigoProduto = linha.substring(59 + offset, 74 + offset).replace(/^0+/, '') || '0';
    const quantidade    = parseInt(linha.substring(74 + offset, 80 + offset), 10);
    const dataStr       = linha.substring(18, 26);
    const horaStr       = linha.substring(26, 32);

    if (isNaN(quantidade)) continue;

    resultado.push({
      matricula,
      area_codigo:    codigoSecao,
      area_nome:      '',
      produto_codigo: codigoProduto,
      produto_nome:   '',
      produto_ean:    '',
      produto_classe: '',
      quantidade,
      is_bloco:       flag === 'X',
      data_hora:      parsePrcDateTime(dataStr, horaStr),
    });
  }
  return resultado;
}

function parsePrcDateTime(data: string, hora: string): Date {
  return new Date(
    `${data.slice(0,4)}-${data.slice(4,6)}-${data.slice(6,8)}` +
    `T${hora.slice(0,2)}:${hora.slice(2,4)}:${hora.slice(4,6)}`
  );
}
