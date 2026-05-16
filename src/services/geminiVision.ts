/**
 * geminiVision.ts
 * Serviço de visão computacional com Gemini para o InventExpert.
 *
 * Função principal: recebe uma imagem base64 de uma folha preenchida à mão
 * e retorna a mesma imagem com a escrita manuscrita removida (campos em branco),
 * preservando o layout impresso original.
 *
 * Usa a Gemini 2.0 Flash Vision API via fetch direto (sem SDK nativo),
 * compatível com React Native / Expo.
 */

const GEMINI_API_KEY = "AIzaSyCJE8Hb-Weem_3C-q5F5LGZvZIRwzgvkyY";
const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

export type GeminiEraseResult =
  | { success: true; base64: string; mimeType: string }
  | { success: false; error: string };

/**
 * Envia uma imagem para o Gemini Vision e solicita a remoção da escrita manuscrita.
 * Retorna base64 da imagem "limpa" (sem escrita manual).
 *
 * @param base64Image  - Base64 da imagem (sem prefixo "data:image/...")
 * @param mimeType     - ex: "image/jpeg" ou "image/png"
 */
export async function eraseHandwritingWithGemini(
  base64Image: string,
  mimeType: "image/jpeg" | "image/png" = "image/jpeg",
): Promise<GeminiEraseResult> {
  const prompt = `Você é um sistema especializado em processamento de documentos.

A imagem enviada é uma folha de relatório de inventário com:
- Layout impresso (formulário com campos, tabelas, texto pré-impresso)
- Preenchimento manual feito a caneta ou lápis nos campos

Sua tarefa:
1. Identifique APENAS a escrita manuscrita (preenchimentos manuais nos campos)
2. Remova completamente essa escrita, deixando os campos em branco
3. Preserve INTEGRALMENTE todo o conteúdo impresso: bordas, campos, títulos, linhas, texto pré-impresso
4. A imagem resultante deve parecer a folha original em branco antes do preenchimento
5. Mantenha a mesma orientação, proporção e resolução da imagem original

Retorne APENAS a imagem processada em base64 formato JPEG, sem nenhum texto adicional, sem marcação markdown, sem prefixo "data:image".`;

  try {
    const body = {
      contents: [
        {
          parts: [
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Image,
              },
            },
            { text: prompt },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,         // baixa temperatura = mais determinístico
        topP: 0.8,
        maxOutputTokens: 8192,
        responseMimeType: "image/jpeg", // pede retorno em imagem
      },
    };

    const response = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${errText}` };
    }

    const json = (await response.json()) as GeminiApiResponse;

    // Tenta extrair imagem inline_data da resposta
    const parts = json?.candidates?.[0]?.content?.parts ?? [];

    for (const part of parts) {
      if (part.inline_data?.data) {
        return {
          success: true,
          base64: part.inline_data.data,
          mimeType: part.inline_data.mime_type ?? "image/jpeg",
        };
      }
    }

    // Fallback: se Gemini retornou texto descrevendo o erro
    const textPart = parts.find((p) => typeof p.text === "string");
    if (textPart?.text) {
      return {
        success: false,
        error: `Gemini não retornou imagem: ${textPart.text.slice(0, 200)}`,
      };
    }

    return { success: false, error: "Resposta inesperada do Gemini." };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: `Erro de rede: ${msg}` };
  }
}

// ---------------------------------------------------------------------------
// Tipos internos da resposta da API Gemini
// ---------------------------------------------------------------------------
interface GeminiApiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        inline_data?: {
          mime_type?: string;
          data?: string;
        };
      }>;
    };
    finishReason?: string;
  }>;
  error?: {
    code: number;
    message: string;
    status: string;
  };
}
