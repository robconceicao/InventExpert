import type {
  InventoryCheckerEvaluation,
  InventoryOperationType,
  SectionAccuracyRecord,
} from "../types";

const nivelCor: Record<string, string> = {
  EXCELENTE: "#16a34a",
  BOM: "#2563eb",
  ATENCAO: "#f97316",
  CRITICO: "#dc2626",
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function generateIndividualReportHtml(
  operationType: InventoryOperationType,
  ev: InventoryCheckerEvaluation,
  rank: number,
  totalConferentes: number,
  dataInventario?: string,
  sectionAccuracy?: SectionAccuracyRecord[],
): string {
  const data = dataInventario ?? new Date().toLocaleDateString("pt-BR");
  const d = ev.input;
  const cor = nivelCor[ev.nivel] ?? "#475569";

  let secoesHtml = "";
  if (sectionAccuracy?.length) {
    const rows = sectionAccuracy
      .filter((s) =>
        s.colaboradores.some((c) =>
          c.toLowerCase().includes(d.nome.toLowerCase().slice(0, 10)),
        ),
      )
      .map(
        (s) =>
          `<tr><td>${esc(s.area)}</td><td>${s.totalC1.toFixed(0)}</td><td>${s.ajusteAbsoluto.toFixed(0)}</td><td>${s.acuracidade.toFixed(1)}%</td></tr>`,
      )
      .join("");
    if (rows) {
      secoesHtml = `<h2>Suas seções</h2><table><tr><th>Seção</th><th>Contado</th><th>Ajuste</th><th>Acurácia</th></tr>${rows}</table>`;
    }
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
body{font-family:Helvetica,Arial,sans-serif;padding:24px;color:#0f172a;font-size:12px}
h1{font-size:18px;color:#1d4ed8}h2{font-size:14px;margin-top:20px}
table{width:100%;border-collapse:collapse;margin-top:8px}
th,td{border:1px solid #e2e8f0;padding:6px;text-align:left}
.score{font-size:28px;font-weight:bold;color:${cor}}
</style></head><body>
<h1>Relatório Individual — Avaliação</h1>
<p><strong>${esc(d.nome)}</strong> · ${esc(data)} · ${esc(operationType)}</p>
<p class="score">${ev.scoreFinal}/100</p>
<p>${esc(ev.nivel)} · ${rank}º de ${totalConferentes}</p>
<h2>Números</h2>
<ul>
<li>Peças: ${d.qtde}</li>
<li>Produtividade: ${d.produtividade} itens/h</li>
<li>% Erro: ${ev.pctErro.toFixed(2)}%</li>
<li>% Bloco: ${ev.pctBloco.toFixed(1)}%</li>
<li>Omissões: ${d.itensPulados ?? 0} · Duplicações: ${d.itensDuplicados ?? 0}</li>
</ul>
${secoesHtml}
<p style="margin-top:32px;color:#64748b;font-size:10px">InventExpert · ${new Date().toLocaleString("pt-BR")}</p>
</body></html>`;
}

export function generateGerencialReportHtml(
  operationType: InventoryOperationType,
  evaluations: InventoryCheckerEvaluation[],
  resumo: {
    totalConferentes: number;
    scoreMedio: number;
    taxaMediaErro: number;
  },
  dataInventario?: string,
  sectionAccuracy?: SectionAccuracyRecord[],
): string {
  const data = dataInventario ?? new Date().toLocaleDateString("pt-BR");
  const rows = evaluations
    .map((e, i) => {
      const cor = nivelCor[e.nivel] ?? "#475569";
      return `<tr>
<td>${i + 1}</td>
<td>${esc(e.input.nome)}</td>
<td style="color:${cor};font-weight:bold">${e.scoreFinal}</td>
<td>${esc(e.nivel)}</td>
<td>${e.pctErro.toFixed(2)}%</td>
<td>${e.input.produtividade}</td>
</tr>`;
    })
    .join("");

  let secoesBars = "";
  if (sectionAccuracy?.length) {
    secoesBars = sectionAccuracy
      .slice(0, 20)
      .map((s) => {
        const cor = s.acuracidade >= 99 ? "#16a34a" : s.acuracidade >= 97.5 ? "#f97316" : "#dc2626";
        return `<div style="margin:8px 0">
<div style="font-size:11px">${esc(s.area)} — ${s.acuracidade.toFixed(1)}%</div>
<div style="background:#e2e8f0;border-radius:4px;height:12px">
<div style="width:${Math.min(100, s.acuracidade)}%;background:${cor};height:12px;border-radius:4px"></div>
</div></div>`;
      })
      .join("");
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
body{font-family:Helvetica,Arial,sans-serif;padding:24px;color:#0f172a;font-size:12px}
h1{font-size:18px;color:#1d4ed8}table{width:100%;border-collapse:collapse;margin-top:12px}
th,td{border:1px solid #e2e8f0;padding:6px}
th{background:#f1f5f9}
</style></head><body>
<h1>Relatório Gerencial — Avaliação</h1>
<p>${esc(data)} · ${esc(operationType)}</p>
<p>Conferentes: ${resumo.totalConferentes} · Score médio: ${resumo.scoreMedio} · Erro médio: ${resumo.taxaMediaErro}%</p>
<h2>Ranking</h2>
<table><tr><th>#</th><th>Nome</th><th>Score</th><th>Nível</th><th>% Erro</th><th>Prod/h</th></tr>
${rows}</table>
${secoesBars ? `<h2>Acurácia por seção</h2>${secoesBars}` : ""}
<p style="margin-top:32px;color:#64748b;font-size:10px">InventExpert · ${new Date().toLocaleString("pt-BR")}</p>
</body></html>`;
}

export function generateEvolucaoReportHtml(
  titulo: string,
  linhas: string,
): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>body{font-family:Helvetica,sans-serif;padding:24px;font-size:12px}
h1{color:#1d4ed8;font-size:18px}pre{white-space:pre-wrap}</style></head>
<body><h1>${esc(titulo)}</h1><pre>${esc(linhas)}</pre>
<p style="color:#64748b;font-size:10px">InventExpert</p></body></html>`;
}
