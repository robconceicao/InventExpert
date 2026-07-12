import { generateInventExpIndividualReportText } from "./inventExpReports";
import type {
  InventoryCheckerEvaluation,
  InventoryOperationType,
  SectionAccuracyRecord,
  ViolacaoBloco,
} from "../types";

/**
 * Converte o relatório individual em HTML fiel ao texto
 * (mesmas seções e ordem — para expo-print / PDF).
 */
export function inventExpTextToHtml(text: string, title = "Relatório Individual"): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const withBreaks = escaped
    .split("\n")
    .map((line) => {
      if (line.startsWith("# ")) {
        return `<h1>${line.slice(2)}</h1>`;
      }
      if (line.startsWith("## ")) {
        return `<h2>${line.slice(3)}</h2>`;
      }
      if (line.startsWith("### ")) {
        return `<h3>${line.slice(4)}</h3>`;
      }
      if (line.startsWith("---")) {
        return `<hr/>`;
      }
      if (line.startsWith("|") && line.includes("|")) {
        return `<div class="table-line">${line}</div>`;
      }
      if (line.startsWith("**") && line.endsWith("**")) {
        return `<p><strong>${line.slice(2, -2)}</strong></p>`;
      }
      if (line.trim() === "") {
        return `<br/>`;
      }
      // negrito markdown simples **x**
      const bolded = line.replace(
        /\*\*([^*]+)\*\*/g,
        "<strong>$1</strong>",
      );
      return `<p>${bolded}</p>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      font-size: 12px;
      line-height: 1.45;
      color: #0f172a;
      padding: 24px;
      max-width: 800px;
      margin: 0 auto;
    }
    h1 { font-size: 18px; margin: 0 0 8px; }
    h2 { font-size: 14px; margin: 16px 0 8px; color: #1e293b; }
    h3 { font-size: 13px; margin: 12px 0 6px; color: #334155; }
    p { margin: 2px 0; white-space: pre-wrap; }
    hr { border: none; border-top: 1px solid #e2e8f0; margin: 12px 0; }
    .table-line {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 10px;
      white-space: pre;
    }
    .alerta {
      background: #fef2f2;
      border-left: 4px solid #dc2626;
      padding: 8px 12px;
      margin: 8px 0;
    }
  </style>
</head>
<body>
${withBreaks}
</body>
</html>`;
}

export function generateInventExpIndividualReportHtml(
  operationType: InventoryOperationType | string,
  ev: InventoryCheckerEvaluation,
  rank: number,
  totalConferentes: number,
  dataInventario?: string,
  secoesLegacy?: SectionAccuracyRecord[],
  violacoesLegacy?: ViolacaoBloco[],
): string {
  const text = generateInventExpIndividualReportText(
    operationType,
    ev,
    rank,
    totalConferentes,
    dataInventario,
    secoesLegacy,
    violacoesLegacy,
  );
  return inventExpTextToHtml(
    text,
    `Avaliação — ${ev.input.nome}`,
  );
}
