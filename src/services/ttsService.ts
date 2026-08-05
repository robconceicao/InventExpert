/**
 * ttsService — único ponto de fala do app.
 *
 * O CLAUDE.md proíbe chamar `Speech.speak()` com objeto de opções direto das
 * telas: opção inválida (voz inexistente no aparelho, por exemplo) derruba o
 * app em produção. Aqui a chamada é centralizada e blindada: se a versão com
 * opções falhar, refaz sem nenhuma opção — o aviso sai de qualquer jeito.
 *
 * A voz masculina do ElevenLabs é usada como som da notificação (o SO toca o
 * arquivo com a tela apagada). Este serviço cobre o app em primeiro plano,
 * onde não há player de áudio disponível — ver docs/AVISO_VOZ_ELEVENLABS.md.
 */

import * as Speech from "expo-speech";
import { Platform } from "react-native";

const IDIOMA = "pt-BR";

/** Pistas de voz masculina em pt-BR (iOS: Daniel; Android: Google TTS). */
const PISTAS_MASCULINAS = [
  "daniel",
  "male",
  "masculino",
  "pt-br-x-gfs",
  "pt-br-x-afs",
  "pt-br-x-cts",
];

let vozResolvida: string | undefined;
let vozCarregada = false;

/** Escolhe uma voz masculina pt-BR uma única vez por sessão. */
async function resolverVoz(): Promise<string | undefined> {
  if (vozCarregada) return vozResolvida;
  vozCarregada = true;
  try {
    const vozes = await Speech.getAvailableVoicesAsync();
    const ptBr = vozes.filter((v) => v.language?.startsWith("pt"));
    const masculina = ptBr.find((v) => {
      const alvo = `${v.name ?? ""} ${v.identifier ?? ""}`.toLowerCase();
      return PISTAS_MASCULINAS.some((pista) => alvo.includes(pista));
    });
    const escolhida =
      masculina ?? ptBr.find((v) => v.quality === "Enhanced") ?? ptBr[0];
    vozResolvida = escolhida?.identifier;
  } catch (err) {
    console.warn("[tts] Não foi possível listar vozes:", err);
    vozResolvida = undefined;
  }
  return vozResolvida;
}

/** Interrompe qualquer fala em andamento. */
export async function stop(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await Speech.stop();
  } catch {
    // nada a fazer — parar fala nunca deve derrubar o fluxo
  }
}

/**
 * Fala a mensagem em pt-BR. Nunca lança: falha de TTS não pode travar o alarme.
 */
export async function speak(mensagem: string): Promise<void> {
  if (Platform.OS === "web" || !mensagem.trim()) return;
  await stop();

  const voice = await resolverVoz();
  try {
    Speech.speak(mensagem, {
      language: IDIOMA,
      rate: 0.9,
      pitch: 1.0,
      ...(voice ? { voice } : {}),
    });
  } catch (err) {
    console.warn("[tts] Falha com opções, repetindo sem opções:", err);
    try {
      Speech.speak(mensagem);
    } catch (err2) {
      console.warn("[tts] TTS indisponível:", err2);
    }
  }
}

/** Só para testes: descarta a voz memorizada. */
export function resetVozCache(): void {
  vozCarregada = false;
  vozResolvida = undefined;
}

export default { speak, stop, resetVozCache };
