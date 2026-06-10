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
  const prompt = `Você é um sistema especialista em OCR e reconstrução digital de documentos.

A imagem enviada é um formulário impresso de inventário que foi preenchido manualmente.
Sua missão é gerar um documento HTML limpo que seja a RECONSTRUÇÃO DIGITAL exata do formulário original, atendendo aos seguintes critérios:

1. APAGUE COMPLETAMENTE toda a escrita manual (caneta azul, preenchimentos à mão, assinaturas ou rabiscos).
2. PRESERVE EXATAMENTE todo o texto impresso original (títulos como "FORMULARIO DE INVENTARIO", rótulos de campos como "Campo 2:", "Campo 3:", cabeçalhos de tabelas, etc.). O documento retornado deve conter esses textos como TEXTO DIGITAL selecionável no HTML (não como imagem).
3. DETECTE O LAYOUT ORIGINAL E RECONSTRUA-O FIELMENTE:
   - Se for uma lista de campos com linhas horizontais para escrita (ex: "Campo X: ____________"), crie campos com linhas horizontais vazias usando CSS de bordas inferiores (border-bottom) ou linhas contínuas elegantes.
   - Se for uma tabela com colunas, crie uma tabela HTML real (<table>) com bordas finas, mantendo os cabeçalhos originais, e deixe as linhas de dados em branco para preenchimento.
4. ESTILO E APARÊNCIA:
   - Use CSS inline limpo e profissional.
   - O documento final deve parecer um arquivo PDF novo em branco, gerado por computador e pronto para impressão.
   - Configure a página para A4 portrait (vertical) com margens elegantes para que caiba perfeitamente no PDF.

Retorne APENAS o código HTML completo e válido (começando com <!DOCTYPE html> e terminando com </html>), sem blocos de código Markdown ou qualquer outro texto explicativo.`;

  // Lista de modelos que suportam visão na API do Gemini.
  // Caso ocorra erro de limite de cota (HTTP 429) ou qualquer outro erro em um modelo,
  // o sistema tentará automaticamente o próximo da lista de forma totalmente transparente para o usuário!
  const models = [
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash-8b"
  ];

  let lastError = "Nenhum modelo foi executado.";

  for (const model of models) {
    const apiURL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    console.log(`[Gemini] Tentando processar remoção de escrita com o modelo: ${model}`);

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

      const response = await fetch(apiURL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      console.log(`[Gemini] Status do modelo ${model}:`, response.status);

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`[Gemini] Modelo ${model} falhou com erro:`, errText);
        
        let errorMsg = `HTTP ${response.status}`;
        try {
          const parsed = JSON.parse(errText);
          if (parsed?.error?.message) {
            errorMsg = parsed.error.message;
          }
        } catch {
          errorMsg = errText;
        }
        
        lastError = `Modelo ${model}: ${errorMsg}`;
        continue; // Tenta o próximo modelo
      }

      const json = (await response.json()) as GeminiApiResponse;
      const parts = json?.candidates?.[0]?.content?.parts ?? [];
      const textPart = parts.find((p) => typeof p.text === "string");

      if (textPart?.text) {
        let html = textPart.text.trim();
        // Remove markdown tags se houverem
        html = html.replace(/```html/ig, "").replace(/```/g, "").trim();

        console.log(`[Gemini] Sucesso absoluto ao processar com o modelo: ${model}`);
        return {
          success: true,
          html: html,
        };
      }

      console.warn(`[Gemini] Resposta sem texto para o modelo ${model}`);
      lastError = `Modelo ${model}: Resposta vazia ou malformada da API.`;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[Gemini] Exceção no modelo ${model}:`, msg);
      lastError = `Modelo ${model}: Erro de conexão/rede: ${msg}`;
    }
  }

  // Se todos falharam, retorna o último erro consolidado
  return { success: false, error: lastError };
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
