/**
 * deepseek.ts
 * Serviço de inteligência artificial usando a API oficial do DeepSeek.
 * 
 * Usado para tarefas de linguagem de alta complexidade e baixíssimo custo
 * (ex: análise de produtividade, auditoria de inventário, relatórios inteligentes).
 * 
 * Utiliza o modelo "deepseek-chat" (DeepSeek-V3) via fetch direto,
 * 100% compatível com React Native / Expo.
 */

import { DEEPSEEK_API_KEY } from '@env';

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";

export type DeepSeekResult =
  | { success: true; text: string }
  | { success: false; error: string };

/**
 * Envia uma mensagem de prompt para o DeepSeek Chat Completions.
 * 
 * @param systemPrompt - Instruções de sistema para definir a persona/comportamento da IA
 * @param userPrompt   - A solicitação ou dados do usuário
 * @param temperature  - Nível de criatividade (default 0.2 para respostas mais exatas)
 */
export async function askDeepSeek(
  systemPrompt: string,
  userPrompt: string,
  temperature: number = 0.2
): Promise<DeepSeekResult> {
  if (!DEEPSEEK_API_KEY || DEEPSEEK_API_KEY === "sua_chave_deepseek_aqui") {
    console.warn("[DeepSeek] Chave de API não configurada ou inválida no .env.");
    return { 
      success: false, 
      error: "API Key do DeepSeek não configurada. Por favor, adicione a DEEPSEEK_API_KEY no seu arquivo .env local." 
    };
  }

  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: "deepseek-chat", // Mapeia para o melhor modelo geral de chat (DeepSeek-V3)
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: temperature,
        max_tokens: 2048
      })
    });

    console.log("[DeepSeek] Response status:", response.status);

    if (!response.ok) {
      const errText = await response.text();
      console.error("[DeepSeek] Error Response:", errText);
      return { success: false, error: `Erro API DeepSeek (${response.status}): ${errText}` };
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content;

    if (text) {
      return { success: true, text: text.trim() };
    }

    return { success: false, error: "Resposta inesperada da API (campo 'content' vazio)." };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[DeepSeek] Exception during API call:", msg);
    return { success: false, error: `Falha de rede ao conectar no DeepSeek: ${msg}` };
  }
}

/**
 * Gera um relatório analítico inteligente da performance da equipe de inventário.
 * 
 * @param operationType  - Tipo de operação (Farmácia, Supermercado, etc)
 * @param rankingText    - Dados formatados dos conferentes (nomes, scores, erros, produtividade)
 */
export async function analyzeTeamPerformance(
  operationType: string,
  rankingText: string
): Promise<DeepSeekResult> {
  const systemPrompt = `Você é um Consultor de Alta Performance e Auditor Especialista em Inventários Físicos e Logística.
Sua missão é analisar o ranking de desempenho da equipe de conferentes e fornecer uma análise executiva assertiva, identificando pontos de atenção crítica, parabenizando os melhores e dando estratégias táticas acionáveis de liderança.`;

  const userPrompt = `Tipo de Operação de Inventário: ${operationType}

Aqui está a lista de conferentes avaliados e seus respectivos desempenhos (ordenados por pontuação geral):
${rankingText}

Por favor, forneça uma análise estruturada contendo:
1. **Destaques Positivos (MVPs):** Quem são e por que se destacaram (rapidez, precisão).
2. **Radar de Risco / Alertas:** Quem apresentou desempenho crítico ou risco de contagem superficial (bloco muito alto ou erros) e quais os impactos disso para a acuracidade da loja.
3. **Recomendações Práticas para o Líder:** Dicas acionáveis sobre remanejamento, feedbacks específicos e como aumentar a produtividade geral da equipe nas próximas horas.

Seja extremamente profissional, direto ao ponto e focado em logística real. Use português brasileiro.`;

  return askDeepSeek(systemPrompt, userPrompt, 0.3);
}

/**
 * Analisa os gargalos, prazos e indicadores do Relatório de Inventário (Report A)
 * e fornece uma auditoria com insights de melhoria contínua.
 * 
 * @param reportText - O texto pré-visualizado/formatado do Relatório A
 */
export async function analyzeInventoryGaps(
  reportText: string
): Promise<DeepSeekResult> {
  const systemPrompt = `Você é um Auditor Sênior de Controladoria e Gestão de Perdas especializado em Inventários de Varejo.
Seu objetivo é analisar as métricas e tempos de execução de um inventário finalizado e identificar gargalos operacionais e oportunidades de otimização financeira e de tempo.`;

  const userPrompt = `Analise o seguinte relatório consolidado de inventário de varejo:

---
${reportText}
---

Por favor, faça uma auditoria profunda deste relatório e estruture sua resposta da seguinte forma:
1. **Diagnóstico dos Tempos e Prazos:** Avalie se as durações de contagem (estoque vs loja) e divergência foram adequadas e se os avanços de horários foram constantes. Identifique onde ocorreu o maior atraso.
2. **Qualidade da Gestão e Indicadores:** Analise a acuracidade final obtida, percentual de auditoria, satisfação do cliente e produtividade por homem-hora (PH).
3. **Plano de Otimização Operacional:** Indique 3 ações de melhoria logística cruciais para que o próximo inventário desta mesma loja termine mais cedo e com acuracidade ainda maior.

Forneça respostas acionáveis, baseadas em dados e muito profissionais em português brasileiro.`;

  return askDeepSeek(systemPrompt, userPrompt, 0.3);
}
