/**
 * handwritingEraser.ts
 * Serviço avançado multi-API e multi-modelo para remoção de escrita manuscrita no InventExpert.
 * 
 * Este serviço implementa um fluxo resiliente de inteligência artificial de alta qualidade,
 * eliminando completamente o fallback local de filtro de imagem (que gerava imagens de baixa qualidade).
 * 
 * Fluxo de execução inteligente:
 * 1. Tenta Gemini Vision (com modelos estáveis: 2.0-flash, 1.5-flash, 1.5-pro).
 * 2. Se falhar ou estiver sem cota (HTTP 429), tenta Groq Llama 3.2 Vision (se chave configurada).
 * 3. Se falhar, tenta OpenAI GPT-4o-mini (se chave configurada).
 * 4. Se falhar, usa o motor híbrido exclusivo: OCR.space (grátis) + DeepSeek-V3 para reconstruir o HTML!
 */

import { GEMINI_API_KEY, DEEPSEEK_API_KEY, OPENAI_API_KEY, GROQ_API_KEY } from '@env';

export type EraserEngine = 'GEMINI' | 'GROQ' | 'OPENAI' | 'HYBRID_DEEPSEEK';

export type EraserResult =
  | { success: true; html: string; engine: string; model: string }
  | { success: false; error: string };

const PROMPT_VISION = `Você é um sistema especialista em OCR e reconstrução digital de documentos.

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

const PROMPT_SYSTEM_DEEPSEEK = `Você é um sistema especialista em OCR, processamento de linguagem e reconstrução digital de documentos.
Você receberá os dados brutos de texto extraídos de uma imagem de formulário impresso de inventário preenchido à mão por meio de um sistema de OCR.
Sua missão é gerar um documento HTML limpo que seja a RECONSTRUÇÃO DIGITAL exata do formulário original, atendendo aos seguintes critérios:
1. Identifique e APAGUE COMPLETAMENTE toda a escrita manual (como números inseridos de quantidades, anotações de caneta, rasuras ou assinaturas).
2. PRESERVE EXATAMENTE todo o texto impresso original (títulos como "FORMULARIO DE INVENTARIO", cabeçalhos de tabela, códigos de barra, nomes de produtos, etc.). O documento retornado deve conter esses textos como TEXTO DIGITAL selecionável no HTML.
3. Se os dados de OCR contiverem tabelas ou sequências de colunas, crie uma tabela HTML real (<table>) com bordas finas e as linhas originais, mas com os valores preenchidos à mão zerados ou vazios para preenchimento posterior.
4. Use CSS inline profissional e limpo. Configure a página para A4 portrait (vertical) com margens elegantes.
Retorne APENAS o código HTML completo e válido (começando com <!DOCTYPE html> e terminando com </html>), sem blocos de código Markdown ou qualquer outro texto explicativo.`;

/**
 * Remove a escrita manual da foto reconstruindo o PDF digital usando IA.
 */
export async function eraseHandwriting(
  base64Image: string,
  mimeType: "image/jpeg" | "image/png" = "image/jpeg"
): Promise<EraserResult> {
  const errors: string[] = [];

  // ==========================================
  // 1. TENTA GEMINI VISION (MÚLTIPLOS MODELOS ESTÁVEIS)
  // ==========================================
  const geminiModels = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"];
  if (GEMINI_API_KEY && GEMINI_API_KEY !== "sua_chave_gemini_aqui") {
    for (const model of geminiModels) {
      console.log(`[Eraser] Tentando Gemini Vision com modelo: ${model}`);
      try {
        const apiURL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
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
                { text: PROMPT_VISION },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            topP: 0.8,
            maxOutputTokens: 8192,
          },
        };

        const response = await fetch(apiURL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (response.ok) {
          const json = await response.json();
          const parts = json?.candidates?.[0]?.content?.parts ?? [];
          const textPart = parts.find((p: any) => typeof p.text === "string");
          if (textPart?.text) {
            let html = textPart.text.trim();
            html = html.replace(/```html/ig, "").replace(/```/g, "").trim();
            console.log(`[Eraser] Sucesso com Gemini (${model})!`);
            return { success: true, html, engine: "Gemini AI Studio", model };
          }
        } else {
          const errText = await response.text();
          console.warn(`[Eraser] Gemini (${model}) falhou:`, errText);
          errors.push(`Gemini (${model}): HTTP ${response.status}`);
        }
      } catch (e: any) {
        errors.push(`Gemini (${model}) Erro: ${e.message || e}`);
      }
    }
  } else {
    errors.push("Gemini: Chave API não configurada.");
  }

  // ==========================================
  // 2. TENTA GROQ LLAMA 3.2 VISION (SE DISPONÍVEL)
  // ==========================================
  if (GROQ_API_KEY && GROQ_API_KEY !== "sua_chave_groq_aqui") {
    const model = "llama-3.2-11b-vision-preview";
    console.log(`[Eraser] Tentando Groq Vision com modelo: ${model}`);
    try {
      const apiURL = "https://api.groq.com/openai/v1/chat/completions";
      const body = {
        model: model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: PROMPT_VISION },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`
                }
              }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 4096
      };

      const response = await fetch(apiURL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        const json = await response.json();
        let html = json?.choices?.[0]?.message?.content || "";
        if (html) {
          html = html.trim().replace(/```html/ig, "").replace(/```/g, "").trim();
          console.log(`[Eraser] Sucesso com Groq (${model})!`);
          return { success: true, html, engine: "Groq Cloud", model };
        }
      } else {
        const errText = await response.text();
        console.warn(`[Eraser] Groq falhou:`, errText);
        errors.push(`Groq: HTTP ${response.status}`);
      }
    } catch (e: any) {
      errors.push(`Groq Erro: ${e.message || e}`);
    }
  }

  // ==========================================
  // 3. TENTA OPENAI GPT-4o-mini (SE DISPONÍVEL)
  // ==========================================
  if (OPENAI_API_KEY && OPENAI_API_KEY !== "sua_chave_openai_aqui") {
    const model = "gpt-4o-mini";
    console.log(`[Eraser] Tentando OpenAI Vision com modelo: ${model}`);
    try {
      const apiURL = "https://api.openai.com/v1/chat/completions";
      const body = {
        model: model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: PROMPT_VISION },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`
                }
              }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 4096
      };

      const response = await fetch(apiURL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        const json = await response.json();
        let html = json?.choices?.[0]?.message?.content || "";
        if (html) {
          html = html.trim().replace(/```html/ig, "").replace(/```/g, "").trim();
          console.log(`[Eraser] Sucesso com OpenAI (${model})!`);
          return { success: true, html, engine: "OpenAI", model };
        }
      } else {
        const errText = await response.text();
        console.warn(`[Eraser] OpenAI falhou:`, errText);
        errors.push(`OpenAI: HTTP ${response.status}`);
      }
    } catch (e: any) {
      errors.push(`OpenAI Erro: ${e.message || e}`);
    }
  }

  // ==========================================
  // 4. MOTOR HÍBRIDO DE CONTINGÊNCIA: OCR.SPACE + DEEPSEEK
  // ==========================================
  if (DEEPSEEK_API_KEY && DEEPSEEK_API_KEY !== "sua_chave_deepseek_aqui") {
    console.log("[Eraser] Tentando Motor Híbrido: OCR.space (Grátis) + DeepSeek-V3");
    try {
      // Passo A: Enviar imagem para OCR.space (API gratuita com chave padrão pública)
      const ocrURL = "https://api.ocr.space/parse/image";
      const ocrBody = new URLSearchParams();
      ocrBody.append("apikey", "helloworld"); // Chave demo pública do OCR.space (funciona nativamente)
      ocrBody.append("base64Image", `data:${mimeType};base64,${base64Image}`);
      ocrBody.append("language", "por");
      ocrBody.append("isOverlayRequired", "true");
      ocrBody.append("detectOrientation", "true");
      ocrBody.append("scale", "true");

      console.log("[Eraser] Extraindo texto via OCR.space...");
      const ocrResponse = await fetch(ocrURL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: ocrBody.toString(),
      });

      if (!ocrResponse.ok) {
        throw new Error(`OCR.space retornou status ${ocrResponse.status}`);
      }

      const ocrJson = await ocrResponse.json();
      if (ocrJson.IsErroredOnProcessing) {
        throw new Error(ocrJson.ErrorMessage || "Erro desconhecido no OCR.space");
      }

      const parsedText = ocrJson.ParsedResults?.[0]?.ParsedText || "";
      if (!parsedText.trim()) {
        throw new Error("OCR.space não conseguiu extrair nenhum texto legível da imagem.");
      }

      console.log("[Eraser] Texto extraído via OCR com sucesso! Enviando para DeepSeek-V3...");

      // Passo B: Enviar o texto de OCR extraído para o DeepSeek reconstrutor
      const deepseekURL = "https://api.deepseek.com/v1/chat/completions";
      const response = await fetch(deepseekURL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: PROMPT_SYSTEM_DEEPSEEK },
            {
              role: "user",
              content: `Aqui estão os dados de texto estruturados obtidos do formulário preenchido por meio de OCR:\n\n${parsedText}\n\nPor favor, remova toda a escrita manual e reconstrua o HTML em branco exatamente no layout original.`
            }
          ],
          temperature: 0.2,
          max_tokens: 4096
        })
      });

      if (response.ok) {
        const json = await response.json();
        let html = json?.choices?.[0]?.message?.content || "";
        if (html) {
          html = html.trim().replace(/```html/ig, "").replace(/```/g, "").trim();
          console.log("[Eraser] Reconstrução híbrida do DeepSeek concluída com sucesso!");
          return {
            success: true,
            html,
            engine: "DeepSeek Híbrido",
            model: "OCR.space + DeepSeek-V3"
          };
        }
      } else {
        const errText = await response.text();
        errors.push(`DeepSeek Híbrido: HTTP ${response.status} - ${errText}`);
      }
    } catch (e: any) {
      errors.push(`DeepSeek Híbrido Erro: ${e.message || e}`);
    }
  } else {
    errors.push("DeepSeek Híbrido: Chave API DeepSeek não configurada.");
  }

  // ==========================================
  // SE TODOS FALHAREM
  // ==========================================
  const consolidatedError = errors.join("\n");
  console.error("[Eraser] Falha crítica em todos os modelos:\n", consolidatedError);
  return {
    success: false,
    error: "Infelizmente, todas as inteligências artificiais atingiram os limites ou estão temporariamente indisponíveis.\n\nDetalhes dos erros:\n" + consolidatedError
  };
}
