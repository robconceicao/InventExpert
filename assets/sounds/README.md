# assets/sounds

Coloque aqui `aviso_avanco.mp3` — a voz masculina do alarme de avanços.

Para gerar e instalar, siga
[`docs/AVISO_VOZ_ELEVENLABS.md`](../../docs/AVISO_VOZ_ELEVENLABS.md).

O nome do arquivo alimenta o ID do canal Android (`alarms_aviso_avanco`).
**Ao trocar o áudio, mude o nome do arquivo** — reaproveitar o mesmo nome
mantém o canal velho e o Android ignora o som novo.

Se `SOM_AVISO` estiver `null` em `src/services/advanceAlarmService.ts`, o app
usa o som padrão do sistema.
