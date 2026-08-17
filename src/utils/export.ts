import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Alert, Platform } from "react-native";

// ---- Web helper: trigger browser download ----
const downloadOnWeb = (filename: string, content: string, mimeType: string) => {
  const bom = "\uFEFF";
  const blob = new Blob([bom + content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/** Download de conteúdo binário no navegador (sem BOM — BOM corrompe XLSX/PDF). */
const downloadBinaryOnWeb = (filename: string, base64: string, mimeType: string) => {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/** Compartilha um arquivo de texto (ex.: relatório gerencial .txt) */
export const shareTextFile = async (
  filename: string,
  content: string,
  dialogTitle = "Exportar relatório"
) => {
  if (Platform.OS === "web") {
    downloadOnWeb(filename, content, "text/plain;charset=utf-8");
    return;
  }
  try {
    const directory =
      FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? "";
    const fileUri = directory.replace(/\/?$/, "/") + filename;
    await FileSystem.writeAsStringAsync(fileUri, "\uFEFF" + content, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: "text/plain",
        dialogTitle,
      });
    } else {
      Alert.alert("Erro", "Compartilhamento não disponível neste dispositivo.");
    }
  } catch (error) {
    console.error("Erro ao exportar texto:", error);
    Alert.alert("Erro", "Falha ao gerar o arquivo.");
  }
};

export const shareCsvFile = async (
  filename: string,
  headers: string[],
  rows: (string | number)[][],
) => {
  const headerString = headers.join(";") + "\n";
  const rowString = rows
    .map((row) =>
      row
        .map((val) => {
          const s = String(val ?? "").replace(/"/g, '""');
          return s.includes(";") || s.includes("\n") ? `"${s}"` : s;
        })
        .join(";"),
    )
    .join("\n");
  const csvContent = headerString + rowString;

  if (Platform.OS === "web") {
    downloadOnWeb(filename, csvContent, "text/csv;charset=utf-8");
    return;
  }

  try {
    const directory =
      FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? "";
    const fileUri = directory.replace(/\/?$/, "/") + filename;

    await FileSystem.writeAsStringAsync(fileUri, "\uFEFF" + csvContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: "text/csv",
        dialogTitle: "Exportar CSV",
      });
    } else {
      Alert.alert("Erro", "Compartilhamento não disponível neste dispositivo.");
    }
  } catch (error) {
    console.error("Erro ao exportar CSV:", error);
    Alert.alert("Erro", "Falha ao gerar o arquivo CSV.");
  }
};

/**
 * Gera PDF a partir de HTML (expo-print) e compartilha.
 * No web: baixa um .html equivalente (print via browser).
 */
export const sharePdfFromHtml = async (
  filename: string,
  html: string,
  dialogTitle = "Exportar PDF",
) => {
  if (Platform.OS === "web") {
    downloadOnWeb(
      filename.replace(/\.pdf$/i, ".html"),
      html,
      "text/html;charset=utf-8",
    );
    return;
  }

  try {
    const Print = await import("expo-print");
    const { uri } = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle,
        UTI: "com.adobe.pdf",
      });
    } else {
      Alert.alert("Erro", "Compartilhamento não disponível neste dispositivo.");
    }
  } catch (error) {
    console.error("Erro ao exportar PDF:", error);
    Alert.alert("Erro", "Falha ao gerar o PDF.");
  }
};

// ---------------------------------------------------------------------------
// Entregáveis da Avaliação: planilha do líder e fichas individuais em lote
// ---------------------------------------------------------------------------

const MIME_XLSX =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Arquivo já renderizado, pronto para gravar em disco. */
export type ArquivoGerado = {
  nome: string;
  base64: string;
  mimeType: string;
};

export type ResultadoLote = {
  /** Quantos arquivos chegaram ao destino. */
  salvos: number;
  /** Nomes que falharam, com o motivo. */
  falhas: { nome: string; motivo: string }[];
  /** Pasta escolhida pelo usuário (Android/SAF) ou undefined nos demais. */
  pasta?: string;
  /** Como os arquivos foram entregues — muda a mensagem que a tela exibe. */
  via: "download" | "pasta" | "compartilhamento" | "cancelado";
};

/**
 * Compartilha (ou baixa, na web) a planilha consolidada da avaliação.
 *
 * O workbook chega pronto de `montarWorkbookConsolidado()`; aqui só se resolve
 * o IO, que muda entre web e nativo.
 */
export const shareXlsxWorkbook = async (
  filename: string,
  workbook: unknown,
  dialogTitle = "Exportar avaliação consolidada",
) => {
  const XLSX = await import("xlsx");
  const base64 = XLSX.write(workbook as any, { bookType: "xlsx", type: "base64" });

  if (Platform.OS === "web") {
    downloadBinaryOnWeb(filename, base64, MIME_XLSX);
    return;
  }

  try {
    const directory =
      FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? "";
    const fileUri = directory.replace(/\/?$/, "/") + filename;
    await FileSystem.writeAsStringAsync(fileUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, { mimeType: MIME_XLSX, dialogTitle });
    } else {
      Alert.alert("Erro", "Compartilhamento não disponível neste dispositivo.");
    }
  } catch (error) {
    console.error("Erro ao exportar XLSX:", error);
    Alert.alert("Erro", "Falha ao gerar a planilha.");
  }
};

/**
 * Renderiza HTML em PDF e devolve o conteúdo em base64, sem compartilhar.
 *
 * É o que permite gerar as fichas de toda a equipe antes de perguntar ao
 * usuário onde salvar — em vez de abrir uma janela de compartilhamento por
 * conferente.
 *
 * Na web o expo-print não gera PDF; o chamador recebe `null` e deve cair para
 * o HTML, como `sharePdfFromHtml()` já faz.
 */
export const renderizarPdfBase64 = async (html: string): Promise<string | null> => {
  if (Platform.OS === "web") return null;
  try {
    const Print = await import("expo-print");
    const { base64 } = await Print.printToFileAsync({ html, base64: true });
    return base64 ?? null;
  } catch (error) {
    console.error("Erro ao renderizar PDF:", error);
    return null;
  }
};

/**
 * Grava vários arquivos de uma vez, no melhor mecanismo de cada plataforma.
 *
 * - **Web:** baixa um a um pelo navegador.
 * - **Android:** pede a pasta uma única vez (Storage Access Framework) e grava
 *   tudo lá. É o único caminho em que "baixar as fichas de toda a equipe" não
 *   vira uma sequência de janelas de compartilhamento.
 * - **iOS e demais:** compartilha em sequência, um arquivo por vez.
 */
export const salvarArquivosEmLote = async (
  arquivos: ArquivoGerado[],
  dialogTitle = "Salvar fichas de avaliação",
): Promise<ResultadoLote> => {
  const falhas: { nome: string; motivo: string }[] = [];
  if (arquivos.length === 0) return { salvos: 0, falhas, via: "cancelado" };

  if (Platform.OS === "web") {
    for (const a of arquivos) {
      try {
        downloadBinaryOnWeb(a.nome, a.base64, a.mimeType);
      } catch (e: any) {
        falhas.push({ nome: a.nome, motivo: e?.message ?? "falha no download" });
      }
    }
    return { salvos: arquivos.length - falhas.length, falhas, via: "download" };
  }

  if (Platform.OS === "android") {
    const saf = (FileSystem as any).StorageAccessFramework;
    if (saf?.requestDirectoryPermissionsAsync) {
      const permissao = await saf.requestDirectoryPermissionsAsync();
      if (!permissao.granted) {
        return { salvos: 0, falhas, via: "cancelado" };
      }
      for (const a of arquivos) {
        try {
          const uri = await saf.createFileAsync(permissao.directoryUri, a.nome, a.mimeType);
          await FileSystem.writeAsStringAsync(uri, a.base64, {
            encoding: FileSystem.EncodingType.Base64,
          });
        } catch (e: any) {
          falhas.push({ nome: a.nome, motivo: e?.message ?? "falha ao gravar" });
        }
      }
      return {
        salvos: arquivos.length - falhas.length,
        falhas,
        pasta: permissao.directoryUri,
        via: "pasta",
      };
    }
  }

  // iOS e fallback: uma janela de compartilhamento por arquivo.
  const disponivel = await Sharing.isAvailableAsync();
  if (!disponivel) {
    return {
      salvos: 0,
      falhas: arquivos.map((a) => ({
        nome: a.nome,
        motivo: "compartilhamento indisponível",
      })),
      via: "cancelado",
    };
  }

  const directory = FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? "";
  for (const a of arquivos) {
    try {
      const fileUri = directory.replace(/\/?$/, "/") + a.nome;
      await FileSystem.writeAsStringAsync(fileUri, a.base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await Sharing.shareAsync(fileUri, { mimeType: a.mimeType, dialogTitle });
    } catch (e: any) {
      falhas.push({ nome: a.nome, motivo: e?.message ?? "falha ao compartilhar" });
    }
  }
  return { salvos: arquivos.length - falhas.length, falhas, via: "compartilhamento" };
};
