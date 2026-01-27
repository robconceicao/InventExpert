import type { AttendanceData, AttendanceCollaborator, ReportA, ReportB } from '@/src/types';

export function formatTimeNow(date = new Date()): string {
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function formatDateNow(date = new Date()): string {
  const day = `${date.getDate()}`.padStart(2, '0');
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export function formatTimeInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  const hours = digits.slice(0, 2);
  const minutes = digits.slice(2, 4);
  if (digits.length <= 2) {
    return hours;
  }
  return `${hours}:${minutes}`;
}

export function formatDateInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);
  if (digits.length <= 2) {
    return day;
  }
  if (digits.length <= 4) {
    return `${day}/${month}`;
  }
  return `${day}/${month}/${year}`;
}

export function formatCurrencyInput(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) {
    return '';
  }
  const asNumber = Number(digits) / 100;
  return asNumber.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function parseCurrencyInput(value: string): number {
  const digits = value.replace(/\D/g, '');
  if (!digits) {
    return 0;
  }
  return Number(digits) / 100;
}

export function formatFloatInput(value: string, maxDecimals = 2): string {
  const normalized = value.replace(',', '.').replace(/[^0-9.]/g, '');
  const parts = normalized.split('.');
  const intPart = parts[0] ?? '';
  const decPart = parts[1]?.slice(0, maxDecimals) ?? '';
  if (!intPart && !decPart) {
    return '';
  }
  return decPart ? `${intPart}.${decPart}`.replace('.', ',') : intPart;
}

export function parseFloatInput(value: string): number {
  const normalized = value.replace(',', '.').replace(/[^0-9.]/g, '');
  if (!normalized) {
    return 0;
  }
  const parsed = Number.parseFloat(normalized);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function formatPercentInput(value: string, min = 0, max = 100, maxDecimals = 2): string {
  const cleaned = value.replace('%', '').trim();
  const normalized = cleaned.replace(',', '.').replace(/[^0-9.]/g, '');
  if (!normalized) {
    return '';
  }
  const [intRaw, decRaw] = normalized.split('.');
  const intPart = (intRaw ?? '').slice(0, 3);
  const decPart = (decRaw ?? '').slice(0, maxDecimals);

  if (normalized.endsWith('.') && decPart.length === 0) {
    return `${intPart},`;
  }

  const numeric = Number.parseFloat(decPart ? `${intPart || '0'}.${decPart}` : intPart || '0');
  if (Number.isNaN(numeric)) {
    return '';
  }
  const clamped = Math.min(max, Math.max(min, numeric));
  const formatted = decPart.length > 0 ? clamped.toFixed(decPart.length) : `${clamped}`;
  return formatted.replace('.', ',');
}

export function parsePercentInput(value: string, min = 0, max = 100): number {
  const normalized = value.replace(',', '.').replace(/[^0-9.]/g, '');
  if (!normalized) {
    return 0;
  }
  const parsed = Number.parseFloat(normalized);
  if (Number.isNaN(parsed)) {
    return 0;
  }
  return Math.min(max, Math.max(min, parsed));
}

export function isValidTime(value: string): boolean {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) {
    return false;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

export function isValidDate(value: string): boolean {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) {
    return false;
  }
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export function parseWhatsAppScale(text: string): AttendanceData {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const data = lines[0] ?? '';
  const loja = lines[1] ?? '';
  const enderecoLoja = lines[2] ?? '';
  const colaboradores: AttendanceCollaborator[] = [];

  lines.slice(3).forEach((line) => {
    const match = line.match(/^(\d+)\s+(.+)$/);
    if (match) {
      colaboradores.push({
        id: match[1],
        nome: match[2].trim(),
        status: 'NAO_DEFINIDO',
        substituto: '',
      });
    }
  });

  return { data, loja, enderecoLoja, colaboradores };
}

export function formatReportA(report: ReportA): string {
  return [
    '*ACOMPANHAMENTO DE INVENTÁRIO*',
    ` Nº da loja: ${report.lojaNum}`,
    ` Nome da Loja: ${report.lojaNome}`,
    ` Qtd. de colaboradores: ${report.qtdColaboradores}`,
    ` Líder do Inventário: ${report.lider}`,
    ` Horário de chegada em loja: ${report.hrChegada}`,
    ` Início da contagem de estoque: ${report.inicioEstoque}`,
    ` Término da contagem de estoque: ${report.terminoEstoque}`,
    ` Início da contagem da loja: ${report.inicioLoja}`,
    ` Término da contagem da loja: ${report.terminoLoja}`,
    ` Avanço do inventário (22:00): %: ${report.avanco22h}`,
    ` Avanço do inventário (00:00): %: ${report.avanco00h}`,
    ` Avanço do inventário (01:00): %: ${report.avanco01h}`,
    ` Avanço do inventário (03:00): %: ${report.avanco03h}`,
    ` Avanço do inventário (04:00): %: ${report.avanco04h}`,
    ` Início da divergência: ${report.inicioDivergencia}`,
    ` Término da divergência: ${report.terminoDivergencia}`,
    ` Avaliação do estoque (%): ${report.avalEstoque}`,
    ` Avaliação da loja (%): ${report.avalLoja}`,
    ` Envio do 1º arquivo (hora): ${report.arquivo1}`,
    ` Envio do 2º arquivo (hora): ${report.arquivo2}`,
    ` Envio do 3º arquivo (hora): ${report.arquivo3}`,
    ` Término do inventário: ${report.terminoInventario}`,
    ` PH: ${report.ph}`,
    ` Contagem antecipada (Sim/Não): ${report.contagemAntecipada}`,
    ` Satisfação (1 a 5): ${report.satisfacao}`,
    ` Acuracidade (%): ${report.acuracidade}`,
    ` Percentual de auditoria: ${report.percentualAuditoria}`,
    ` Produtividade (PH): ${report.ph}`,
  ].join('\n');
}

export function formatReportB(report: ReportB): string {
  return [
    '*RESUMO FINAL DO INVENTÁRIO*',
    ` Número da Loja: ${report.lojaNum}`,
    ` Nome da Loja: ${report.cliente}`,
    ` Data do Inventário: ${report.data}`,
    ` PIV Programado: ${report.pivProgramado}`,
    ` PIV Realizado: ${report.pivRealizado}`,
    ` HR de chegada da equipe: ${report.chegadaEquipe}`,
    ` Início da contagem do Deposito: ${report.inicioDeposito}`,
    ` Término da contagem do Deposito: ${report.terminoDeposito}`,
    ` Início da contagem da Loja: ${report.inicioLoja}`,
    ` Término da contagem da Loja: ${report.terminoLoja}`,
    ` Início da divergência dos controlados: ${report.inicioAuditoriaCliente}`,
    ` Início da divergência: ${report.inicioDivergencia}`,
    ` Término da divergência: ${report.terminoDivergencia}`,
    ` Qtd. de itens alterados na divergência: ${report.qtdAlterados}`,
    ` Qtd. de itens “não contados”: ${report.qtdNaoContados}`,
    ` Qtd. de itens encontrados no “não contados”: ${report.qtdEncontradosNaoContados}`,
    ` Horário do Envio do 1 Arquivo: ${report.arquivo1}`,
    ` Horário do Envio do 2 Arquivo: ${report.arquivo2}`,
    ` Horário do Envio do 3 Arquivo: ${report.arquivo3}`,
    ` Término do Inventario: ${report.terminoInventario}`,
    ` Total de Peças na Loja: ${report.totalPecas}`,
    ` Valor Financeiro total dos Itens: ${report.valorFinanceiro.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })}`,
    ` Avaliação de Preparação Deposito: ${report.avalPrepDeposito}`,
    ` Avaliação de Preparação da Loja: ${report.avalPrepLoja}`,
    ` Satisfação: ${report.satisfacao}`,
    ` Responsável pelo Inventário: ${report.responsavel}`,
    ` Acuracidade Cliente: ${report.acuracidadeCliente}`,
    ` Acuracidade terceirizada: ${report.acuracidadeTerceirizada}`,
    ` Houve solicitação de suporte: ${report.suporteSolicitado}`,
  ].join('\n');
}

export function formatAttendanceMessage(data: AttendanceData): string {
  let nextSubstitutionIndex =
    data.colaboradores.reduce((max, item) => {
      const num = Number(item.id);
      return Number.isNaN(num) ? max : Math.max(max, num);
    }, 0) + 1;

  const linhas = data.colaboradores.flatMap((item) => {
    const baseLine = `${item.id} ${item.nome}${item.status === 'PRESENTE' ? '✅' : '❌'}`;
    if (item.status === 'AUSENTE' && item.substituto) {
      const subLine = `${nextSubstitutionIndex} ${item.substituto}✅(SUBSTITUIÇÃO)`;
      nextSubstitutionIndex += 1;
      return [baseLine, subLine];
    }
    return [baseLine];
  });

  return [
    data.data,
    data.loja,
    data.enderecoLoja,
    '',
    ...linhas,
  ].join('\n');
}
