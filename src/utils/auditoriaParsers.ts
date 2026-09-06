import { AuditoriaAcuracidadeRow, AuditoriaAgenteInfo } from '../types';
import { parseNumeroBr } from './avaliacaoV3Parsers';

/**
 * Lê o conteúdo do arquivo de agentes (agentes.txt ou CadFun.txt)
 * e retorna um mapa de agentes com CPF como chave principal (se disponível),
 * ou Código como chave se CPF não existir.
 * 
 * Formatos suportados:
 * 1. agentes.txt: POSICIONAL. [0-5] código 6 dígitos, [6-30] nome. Sem delimitador.
 * 2. CadFun.txt: DELIMITADO por pipe '|'. Campos: CPF | Nome | ID | CPF | Cargo.
 */
export function buildAgentesIndex(conteudoTxt: string): Map<string, AuditoriaAgenteInfo> {
  const index = new Map<string, AuditoriaAgenteInfo>();
  const linhas = conteudoTxt.split(/\r?\n/);

  for (const linha of linhas) {
    if (!linha.trim()) continue;

    if (linha.includes('|')) {
      // CadFun.txt (CPF | Nome | ID | CPF | Cargo)
      const partes = linha.split('|').map(p => p.trim());
      if (partes.length >= 4) {
        // As vezes o primeiro é vazio e o quarto tem CPF
        const cpf = (partes[0] && partes[0].length > 5) ? partes[0] : partes[3]; 
        const nome = partes[1];
        const codigo = partes[2];
        if (cpf) {
          index.set(cpf.replace(/\D/g, ''), { codigo, nome, cpf: cpf.replace(/\D/g, '') });
        }
        if (codigo) {
           index.set(codigo, { codigo, nome, cpf: cpf ? cpf.replace(/\D/g, '') : '' });
        }
      }
    } else {
      // agentes.txt (posicional 0-5 codigo, 6-30 nome)
      if (linha.length >= 6) {
        const codigo = linha.substring(0, 6).trim();
        const nome = linha.substring(6, 31).trim();
        // Não tem CPF neste formato, então usamos o código como chave
        if (codigo) {
          index.set(codigo, { codigo, nome, cpf: '' });
        }
      }
    }
  }
  return index;
}

/**
 * Faz o parse da matriz de dados (array de arrays) extraída do ACURACIDADE.xls.
 * Detecta a linha de cabeçalho dinamicamente procurando por "SECAO" ou "SEÇÃO" e "C1".
 * Valida a integridade (AJST == FINAL - C1) e retorna as linhas extraídas.
 */
export function parseAcuracidadeXlsMatrix(matriz: any[][]): AuditoriaAcuracidadeRow[] {
  let headerRowIndex = -1;
  const colMap = new Map<string, number>();

  const norm = (s: any) => (s || '').toString().toUpperCase().replace(/\s+/g, '').replace(/[Ç]/g, 'C').replace(/[ÃÁÀÂ]/g, 'A');

  // Encontrar o cabeçalho
  for (let i = 0; i < Math.min(matriz.length, 50); i++) {
    const row = matriz[i];
    if (!Array.isArray(row)) continue;

    const rowStr = row.map(norm).join(';');
    if (rowStr.includes('SECAO') && rowStr.includes('C1')) {
      headerRowIndex = i;
      row.forEach((cell, idx) => {
        const cellNorm = norm(cell);
        if (cellNorm.includes('SECAO')) colMap.set('SECAO', idx);
        else if (cellNorm.includes('BARRA') || cellNorm.includes('EAN')) colMap.set('EAN', idx);
        else if (cellNorm.includes('DESCRI')) colMap.set('DESCRICAO', idx);
        else if (cellNorm === 'C1') colMap.set('C1', idx);
        else if (cellNorm === 'A1') colMap.set('A1', idx);
        else if (cellNorm === 'A2') colMap.set('A2', idx);
        else if (cellNorm === 'A3') colMap.set('A3', idx);
        else if (cellNorm === 'FINAL') colMap.set('FINAL', idx);
        else if (cellNorm === 'AJST' || cellNorm === 'AJUSTE') colMap.set('AJST', idx);
      });
      break;
    }
  }

  if (headerRowIndex === -1) {
    throw new Error('Cabeçalho não encontrado no arquivo ACURACIDADE. (Esperado "SECAO" e "C1").');
  }

  const result: AuditoriaAcuracidadeRow[] = [];

  for (let i = headerRowIndex + 1; i < matriz.length; i++) {
    const row = matriz[i];
    if (!Array.isArray(row) || row.length === 0) continue;

    const secao = (row[colMap.get('SECAO')!] || '').toString().trim();
    if (!secao || secao.toUpperCase().includes('TOTAL')) continue; // ignora linhas vazias ou de totais

    const c1Str = row[colMap.get('C1')!];
    const finalStr = row[colMap.get('FINAL')!];
    const ajstStr = row[colMap.get('AJST')!];

    // `pickSheetAsMatrix` lê com `raw: true` justamente para preservar o pt-BR,
    // então estas células chegam como "1.234,00" quando o Crystal exporta em
    // HTML/CSV. `parseFloat` cru lia 1.234 ali e 395 em "395,33": quantidade
    // truncada, e a validação AJST = FINAL - C1 acusando divergência inexistente.
    const c1 = parseNumeroBr(c1Str);
    const final = parseNumeroBr(finalStr);
    const ajst = parseNumeroBr(ajstStr);
    
    // Opcional: validação (AJST == FINAL - C1).
    if (Math.abs(ajst - (final - c1)) > 0.01) {
      console.warn(`[AAE] Divergência aritmética na linha ${i + 1}: C1=${c1}, FINAL=${final}, AJST=${ajst} (Esperado ${final - c1})`);
    }

    result.push({
      secao,
      ean: (row[colMap.get('EAN')!] || '').toString().trim(),
      descricao: (row[colMap.get('DESCRICAO')!] || '').toString().trim(),
      c1,
      a1: parseNumeroBr(row[colMap.get('A1')!]),
      a2: parseNumeroBr(row[colMap.get('A2')!]),
      a3: parseNumeroBr(row[colMap.get('A3')!]),
      final,
      ajst,
    });
  }

  return result;
}
