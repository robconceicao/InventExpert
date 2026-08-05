# Aviso de voz do avanço — voz masculina (ElevenLabs)

Guia para gerar o áudio do alarme de avanços e instalá-lo no app.

Com a tela apagada, quem fala é o **som da notificação** — o Android e o iOS
tocam um arquivo de áudio do próprio app. Não existe player de áudio embarcado
(o projeto não usa `expo-av`/`expo-audio`), então a voz gravada entra por aí.
Com o app aberto, quem fala é o TTS do aparelho via `ttsService`.

---

## 1. Texto do aviso

Exatamente este texto, sem alterações — é o mesmo que aparece na notificação e
no banner da tela (`ALARM_VOICE_MSG` em `src/services/advanceAlarmService.ts`):

```
Atenção, estamos a quinze minutos do próximo avanço. Solicite aos conferentes que exportem os dados do coletor.
```

---

## 2. Prompt para criar a voz (ElevenLabs → Voice Design)

Cole no campo de descrição da voz em **Voice Design** (Text to Voice → Design a
voice). O campo aceita **no máximo 500 caracteres** — o prompt abaixo tem 495,
então cole inteiro, sem quebras de linha. Está em inglês porque o Voice Design
responde melhor assim; o idioma **falado** vem do texto em português do item 1.

```
Brazilian Portuguese male voice, 35-45: an experienced operations supervisor announcing a shift update over a store intercom. Warm, authoritative baritone with chest resonance. Calm and steady, never dramatic or cheerful. Measured pace, crisp fully articulated consonants that survive a noisy supermarket floor at night. Neutral Sao Paulo accent, no slang. Even volume throughout, no rising excitement, no trailing off. Clean dry studio recording, close-mic'd, no reverb, no music, no room tone.
```

> Sem acento em "Sao Paulo" de propósito: a descrição é lida como inglês e o
> acento às vezes puxa a pronúncia da voz para o lado errado.

Se a voz sair jovem demais, animada demais ou com sotaque estranho, use esta
variação mais curta (352 caracteres), que insiste no tom sério:

```
Brazilian Portuguese male voice, around 40: a night-shift inventory supervisor giving a calm announcement to his team. Deep, steady baritone, serious and reassuring, never cheerful. Slow deliberate pace, very clear consonants, neutral Sao Paulo accent. Even volume from first to last word. Dry close-mic studio recording, no reverb or background noise.
```

Ajustes recomendados na geração (Text to Speech):

| Parâmetro | Valor | Por quê |
|---|---|---|
| Model | Eleven Multilingual v2 | melhor pronúncia de pt-BR |
| Stability | 55–65% | previsível a cada geração, sem robotizar |
| Similarity | 75% | mantém o timbre da voz criada |
| Style exaggeration | 0–10% | aviso operacional, não locução |
| Speed | 0.95× | um pouco abaixo do normal: o aviso é ouvido dormindo |

Se a IA pronunciar "avanço" ou "coletor" de forma estranha, gere de novo — não
altere o texto (ele precisa bater com o que aparece escrito na notificação).

---

## 3. Exportar o arquivo

Requisitos do Android para som de notificação:

- **Formato:** WAV (PCM 16 bits) — o mais compatível. MP3 costuma funcionar,
  WAV nunca falha.
- **Duração:** máximo 30 segundos. O texto tem ~8 s, folgado.
- **Sample rate:** 44.1 kHz, mono.
- **Silêncio:** até 0,2 s no início; nada no fim.
- **Nome do arquivo:** `aviso_avanco.wav` — minúsculas, sem acento e sem
  espaço (o Android rejeita o recurso se tiver).

Se o ElevenLabs só exportar MP3, converta:

```bash
ffmpeg -i aviso_avanco.mp3 -ar 44100 -ac 1 -c:a pcm_s16le aviso_avanco.wav
```

---

## 4. Instalar no app (3 passos)

**1. Coloque o arquivo em** `assets/sounds/aviso_avanco.wav`

**2. Registre no `app.json`**, trocando a entrada `"expo-notifications"` por:

```json
[
  "expo-notifications",
  {
    "sounds": ["./assets/sounds/aviso_avanco.wav"]
  }
]
```

**3. Ligue o som em** `src/services/advanceAlarmService.ts`:

```ts
export const SOM_AVISO: string | null = "aviso_avanco.wav";
```

Enquanto `SOM_AVISO` for `null`, o app usa o som padrão do sistema e nada
quebra — por isso o valor já vem `null` no repositório.

**4. Gere um build novo.** O som é asset nativo (vai para `res/raw` no
Android): não basta recarregar o JS.

```bash
# lembre de subir o versionCode no app.json antes
eas build --platform android --profile production
```

---

## 5. Conferir no aparelho

1. Preencha o avanço das **22h00** no Acompanhamento → DSP. É esse
   preenchimento que libera o aviso das 00h00.
2. Confira no log: `[advanceAlarm] Agendados: 00h00`.
3. Bloqueie a tela e espere as 23h45 — ou, para testar na hora, mude o
   relógio do aparelho para 23h44.
4. Esperado: notificação na tela de bloqueio com o texto completo + a voz
   masculina tocando.

Se aparecer a notificação mas o som for o padrão do sistema:

- o canal `alarms` do Android guarda o som de quando foi criado. Desinstale e
  reinstale o app (ou limpe os dados) para o canal ser recriado com o novo som;
- confirme que o arquivo está em `res/raw` no build (`aviso_avanco.wav`);
- confirme que o aparelho não está em Não Perturbe sem exceção para o app.

---

## 6. Quando o aviso dispara

| Avanço | Aviso | Condição |
|---|---|---|
| 22h00 | **nunca** | é o avanço inicial (0%), não tem anterior |
| 00h00 | 23h45 | `avanco22h` preenchido |
| 01h00 | 00h45 | `avanco00h` preenchido |
| 03h00 | 02h45 | `avanco01h` preenchido |
| 04h00 | 03h45 | `avanco03h` preenchido |

O aviso também é suspenso quando o próprio avanço já foi lançado (deixou de ser
o próximo) e quando algum avanço chega a 100% (inventário encerrado).

Regras em `src/utils/advanceAlarmRules.ts`, cobertas por
`src/utils/__tests__/advanceAlarm.test.ts`.
