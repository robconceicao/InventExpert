export const cleanFormWithApi = async (
  base64Jpeg: string,
  customApiUrl?: string,
): Promise<{ success: boolean; pdfUri?: string; error?: string }> => {
  try {
    // Preferir URL injectada; evita hardcode de LAN em produção.
    const API_URL =
      customApiUrl ||
      process.env.EXPO_PUBLIC_FORM_CLEANER_URL ||
      "";
    if (!API_URL) {
      return {
        success: false,
        error:
          "API de limpeza não configurada. Defina EXPO_PUBLIC_FORM_CLEANER_URL ou passe customApiUrl.",
      };
    }

    // Converte base64 para Blob para enviar como multipart/form-data
    const binary = atob(base64Jpeg);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      array[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([array], { type: "image/jpeg" });
    const formData = new FormData();
    formData.append("file", blob, "scanned_form.jpg");

    const response = await fetch(API_URL, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: API Indisponível`,
      };
    }

    // A API Python já devolve o arquivo PDF binário pronto!
    const pdfBlob = await response.blob();

    // Converte de volta para base64 para salvar no expo-file-system
    const reader = new FileReader();
    return new Promise((resolve) => {
      reader.onloadend = () => {
        const base64Data = (reader.result as string).split(",")[1];
        resolve({ success: true, pdfUri: base64Data });
      };
      reader.onerror = () => {
        resolve({
          success: false,
          error: "Falha ao processar o PDF recebido da API.",
        });
      };
      reader.readAsDataURL(pdfBlob);
    });
  } catch (error) {
    return { success: false, error: String(error) };
  }
};
