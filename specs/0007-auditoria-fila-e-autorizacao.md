# SPEC 0007 — INV-01 a INV-04

Estado: implementação local para homologação; sem APK, deploy ou alteração remota.

## Contrato
1. Escritas na fila AsyncStorage são serializadas. Um flush retira somente IDs confirmados, preservando enqueues concorrentes. Flushes simultâneos compartilham uma execução.
2. Cada item novo exige ownerId obtido da sessão operacional, nunca do payload. Leitura, remoção e envio se limitam ao autor atual. Itens antigos sem autor ficam preservados, em quarentena lógica na mesma chave; não podem ser atribuídos automaticamente.
3. O handler e o upsert rejeitam autor ausente/diferente da sessão. RLS permanece responsável por validar auth.uid() no servidor.
4. Erro de leitura/escrita não vira fila vazia nem sucesso. Formulários mantêm os dados e informam que o histórico pode ter sido salvo localmente e que a fila falhou. Sync automático retorna erro estruturado, sem rejeição não tratada.
5. Papel vem apenas de app_metadata administrado pelo servidor ou app_profiles protegido por RLS. user_metadata é ignorado. null nega ações privilegiadas.

## Aceite
- Enqueues concorrentes preservam todos os IDs; enqueue durante envio permanece pendente; falha de handler mantém item; retry usa o mesmo ID.
- Conta B não enxerga nem envia itens de A; legado sem autor permanece intacto; upsert rejeita divergência antes de tocar no banco.
- Falha/corrupção de armazenamento rejeita enqueue e não sobrescreve a cópia existente.
- Metadado editável não concede ADMIN; sessão/perfil ausentes ou erro negam gestão.
- npm run check deve passar, conforme ADR 0002, preservando as regressões de fila/autorização e regras R1–R13.

## Escopo de arquivos
src/services/{sync,syncHandlers,fieldEventSync,authz,authzRules}.ts; testes em src/services/__tests__; mensagens dos três formulários (ReportFormShell, ReportAScreen, AttendanceScreen); SyncStatus para erro de leitura; esta spec.

## Fora do escopo
Reatribuir dados legados, apagar histórico, sincronização entre dispositivos completa, alterar regras R1–R13, licenças, migrations aplicadas, publicar builds. Arquivos de histórico local legados não são reclassificados por autor nesta entrega; sua migração exige origem verificável.

## Revisão após verificação independente
- INV-03 inclui o servidor: nova migration_20260927_staff_writer_requires_profile.sql remove o acesso legado sem perfil de is_staff_writer. Aplicação remota separada; validar auth.uid nulo, perfil ausente, OPERADOR (false), LIDER/ADMIN (true).
- SyncStatus deve mostrar um alerta visível ao tocar, inclusive fora de __DEV__, quando a fila falha.

## Reconciliação do baseline em 2026-10-01

Após incorporar main, authErrorMessage.test.ts passou de 33 para 11 casos Jest:
vários parametrizados foram agrupados em testes com múltiplas asserções.
Assim, 539 - 33 + 11 = 517 testes em 36 suítes. Os nove testes novos de fila/
autorização permanecem e o verificador não encontrou regressão nas correções INV.
