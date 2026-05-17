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

import { GEMINI_API_KEY } from '@env';

const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

export type GeminiEraseResult =
  | { success: true; html: string }
  | { success: false; error: string };

/**
 * Envia uma imagem para o Gemini Vision e solicita a recriação do formulário limpo em HTML.
 * Retorna o HTML para ser convertido em PDF digital.
 *
 * @param base64Image  - Base64 da imagem
 * @param mimeType     - ex: "image/jpeg"
 */
export async function eraseHandwritingWithGemini(
  base64Image: string,
  mimeType: "image/jpeg" | "image/png" = "image/jpeg",
): Promise<GeminiEraseResult> {
  const prompt = `Você é um sistema especializado em processamento de documentos e OCR.

A imagem enviada é uma folha de relatório de inventário com:
- Layout impresso (formulário com cabeçalho, colunas, tabelas)
- Preenchimento manual feito a caneta/lápis

Sua tarefa:
1. Recrie EXATAMENTE a estrutura digital do formulário original (títulos, cabeçalhos, colunas da tabela).
2. REMOVA COMPLETAMENTE toda a escrita manuscrita ou preenchimento à caneta. Os campos/linhas da tabela devem ficar em branco.
3. Crie uma tabela HTML limpa e profissional com bordas, usando CSS inline, como se o arquivo original em branco tivesse sido baixado do sistema de inventário.
4. Mantenha o máximo de fidelidade aos nomes das colunas e textos de cabeçalho que você conseguir ler.
5. Adicione cerca de 20 a 25 linhas em branco na tabela para reproduzir o aspecto da folha impressa.

Retorne APENAS o código HTML completo (<!DOCTYPE html><html>...), sem blocos de código Markdown (\`\`\`html). Nenhuma outra palavra.`;

  try {
    const body = {
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Image,
              },
            },
            { text: prompt },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        topP: 0.8,
        maxOutputTokens: 8192,
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_ONLY_HIGH",
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_ONLY_HIGH",
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_ONLY_HIGH",
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_ONLY_HIGH",
        },
      ],
    };

    console.log("[Gemini] Sending payload to:", GEMINI_API_URL);
    console.log("[Gemini] Base64 Image length:", base64Image.length);

    const response = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    console.log("[Gemini] Response status:", response.status);

    if (!response.ok) {
      const errText = await response.text();
      console.error("[Gemini] Error Response:", errText);
      return { success: false, error: `HTTP ${response.status}: ${errText}` };
    }

    const json = (await response.json()) as GeminiApiResponse;
    console.log("[Gemini] Success Response (truncated):", JSON.stringify(json).slice(0, 800));

    // Extrai o texto gerado
    const parts = json?.candidates?.[0]?.content?.parts ?? [];
    const textPart = parts.find((p) => typeof p.text === "string");
    
    if (textPart?.text) {
      let html = textPart.text.trim();
      html = html.replace(/```html/ig, "").replace(/```/g, "").trim();

      return {
        success: true,
        html: html,
      };
    }

    console.error("[Gemini] Candidates content missing. Full Response:", JSON.stringify(json));
    return { success: false, error: "Resposta inesperada do Gemini (sem texto)." };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[Gemini] Exception during API call:", msg);
    return { success: false, error: `Erro de rede: ${msg}` };
  }
}

// ---------------------------------------------------------------------------
// Tipos internos da resposta da API Gemini
// ---------------------------------------------------------------------------
interface GeminiApiResponse {
  candidates?: {
    content?: {
      parts?: {
        text?: string;
        inline_data?: {
          mime_type?: string;
          data?: string;
        };
      }[];
    };
    finishReason?: string;
  }[];
  error?: {
    code: number;
    message: string;
    status: string;
  };
}
