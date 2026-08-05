# assets/sounds

Coloque aqui `aviso_avanco.wav` — a voz masculina do alarme de avanços.

O arquivo **não** está versionado (é binário de áudio). Para gerar e instalar,
siga [`docs/AVISO_VOZ_ELEVENLABS.md`](../../docs/AVISO_VOZ_ELEVENLABS.md).

Enquanto o arquivo não existir, `SOM_AVISO` continua `null` em
`src/services/advanceAlarmService.ts` e o app usa o som padrão do sistema.
