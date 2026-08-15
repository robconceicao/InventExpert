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

**O MP3 do ElevenLabs serve direto no Android — não precisa converter.**

Verificado no próprio pacote: o plugin copia o arquivo para `res/raw` sem
converter nem validar formato (`plugin/build/withNotificationsAndroid.js`,
`writeNotificationSoundFile`), e o nativo resolve o recurso **pelo nome base**,
descartando a extensão (`android/.../SoundResolver.java`, `filenameToBasename`).
O `res/raw` do Android toca MP3 sem problema.

Requisitos que valem de verdade:

- **Nome do arquivo:** só minúsculas, dígitos e `_` — `aviso_avanco.mp3`. O
  build falha na validação (`assertValidAndroidAssetName`) se tiver acento,
  espaço ou maiúscula.
- **Duração:** máximo 30 segundos. O texto tem ~8 s, folgado.
- **Silêncio:** até 0,2 s no início; nada no fim.

### Se um dia o app for para iOS

Aí sim o formato importa: o iOS aceita apenas **WAV, AIFF ou CAF** em som de
notificação e ignora MP3 (cai para o som padrão, sem erro). Hoje o projeto só
gera APK Android, então isso não bloqueia nada.

Para converter no Windows, sem instalar nada pesado:

```powershell
winget install Gyan.FFmpeg
# feche e reabra o PowerShell para o PATH atualizar
ffmpeg -i aviso_avanco.mp3 -ar 44100 -ac 1 -c:a pcm_s16le aviso_avanco.wav
```

Alternativa em interface gráfica: abrir o MP3 no **Audacity** e usar
_Arquivo → Exportar → Exportar como WAV_ (44100 Hz, mono, 16 bits).

---

## 4. Instalar no app (3 passos)

**1. Coloque o arquivo em** `assets/sounds/aviso_avanco.mp3`
(ou `.wav`, se tiver convertido — o Android resolve pelo nome base)

**2. Registre no `app.json`**, trocando a entrada `"expo-notifications"` por:

```json
[
  "expo-notifications",
  {
    "sounds": ["./assets/sounds/aviso_avanco.mp3"]
  }
]
```

**3. Ligue o som em** `src/services/advanceAlarmService.ts`:

```ts
export const SOM_AVISO: string | null = "aviso_avanco.mp3";
```

Enquanto `SOM_AVISO` for `null`, o app usa o som padrão do sistema e nada
quebra. Com o arquivo instalado, o valor deve ser o nome do MP3 (hoje
`"aviso_avanco.mp3"`).

**4. Gere um build novo.** O som é asset nativo (vai para `res/raw` no
Android): não basta recarregar o JS.

```bash
# lembre de subir o versionCode no app.json antes
eas build --platform android --profile production
```

---

## 5. Conferir no aparelho

O jeito rápido: **Acompanhamento → DSP → seção "3. Avanço (%)" → botão
"Testar aviso de voz (2 min, tela bloqueada)"**. Ele agenda a mesma
notificação do alarme real, no mesmo canal e com o mesmo som — bloqueie a
tela e aguarde 2 minutos. O alerta de confirmação também lista quais avanços
estão com aviso ativo naquele momento.

Fluxo real: preencha o avanço das **22h00** (libera o aviso das 00h00),
confira `[advanceAlarm] Agendados: 00h00` no log e aguarde as 23h45 com a
tela bloqueada.

- **confira o canal pelo log.** Ao abrir o Report A o app registra o estado real
  do canal: `[advanceAlarm] Canal: {"id":"alarms_aviso_avanco","existe":true,
  "som":"aviso_avanco",...}`. É o que o Android guardou, não o que o código
  pediu. Se `som` vier `null` ou `default`, o arquivo não chegou ao `res/raw` —
  gere o build de novo;
- confirme que o arquivo está em `res/raw` no build (`aviso_avanco.mp3`);
- confirme que o aparelho não está em Não Perturbe sem exceção para o app;
- confirme que o usuário não desligou o som do canal em
  *Configurações → Apps → InventExpert → Notificações → Alarme de Avanços*. Essa
  escolha é do usuário e o app não tem como sobrescrever.

### Por que o canal é o suspeito número um

**Canal de notificação do Android é imutável.** Depois de criado, chamar
`setNotificationChannelAsync` com o mesmo ID **não troca o som** — o sistema
mantém o que valia na criação e não devolve erro nenhum. Foi exatamente o que
aconteceu neste projeto: o canal `alarms` nasceu no commit `b6d748b`, antes de a
voz gravada existir (`ed48c44`), então quem já tinha o app instalado continuou
ouvindo o som padrão com o código correto na frente.

A correção não depende mais de reinstalar: o ID do canal carrega o nome do som
(`alarms_aviso_avanco`, em `ALARM_CHANNEL_ID`). Trocar o arquivo de áudio passa a
criar um canal novo sozinho, e `garantirCanalDeAlarme()` apaga os anteriores.
**Ao trocar o som, mude o nome do arquivo** — reaproveitar `aviso_avanco.mp3`
mantém o mesmo ID e reabre o problema.

### Se o aviso atrasar ou não chegar com a tela apagada

No Android 12+ o expo-notifications só usa alarme **exato** se o app tiver a
permissão — sem ela, cai em alarme inexato, que o modo Doze pode segurar por
muitos minutos (verificado em `ExpoSchedulingDelegate.kt`:
`canScheduleExactAlarms()`). O `app.json` declara
`SCHEDULE_EXACT_ALARM` + `USE_EXACT_ALARM` para garantir o disparo pontual —
essas permissões só entram no APK após `expo prebuild` + build novo. Em
aparelhos Xiaomi/Oppo/Realme, confira também a otimização de bateria do app
(colocar como "Sem restrição").

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
