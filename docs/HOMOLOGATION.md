# Homologação e retorno à produção

Em homologação, use APP_ENV=homologation e TEST_LICENSE_BYPASS=true. Sem a flag, a licença comercial é obrigatória. A decisão vem do build/ambiente do servidor, nunca de usuário, cabeçalho, query string ou preferência salva. A autenticação operacional do aplicativo continua vigente.

O código de licenciamento e os planos continuam presentes. A autorização temporária existe somente em memória e não deve ser salva em cache como licença comercial. Os instaladores identificados como homologation são exclusivos para testes; não devem ser cadastrados no canal production da Tadeu Apps.

## Como compilar

- InventExpert e MA Concepty: EAS profile preview/development configura homologação; production fixa APP_ENV=production e TEST_LICENSE_BYPASS=false. O workflow Homologation APK também gera APK sem conta EAS. Execute node --test scripts/license-build-config.test.cjs para conferir a proteção de produção.
- AION: flutter build apk --release --dart-define=APP_ENV=homologation --dart-define=TEST_LICENSE_BYPASS=true, incluindo os valores públicos SUPABASE_URL/SUPABASE_ANON_KEY obrigatórios. --release é otimização do Flutter; não define o ambiente comercial. Para produção, APP_ENV=production e TEST_LICENSE_BYPASS=false/ausente.
- Elias: TEST_LICENSE_BYPASS=true e tarefa assembleHomologation. A variante usa applicationId com sufixo .homologation e assinatura de debug; a variante release compila a flag false mesmo se a variável externa for true.
- InfOper Smart: APP_ENV=homologation TEST_LICENSE_BYPASS=true npm run build. O produto é Web/PWA, sem projeto Android/APK neste repositório.

## Servidores de AION e Elias

Configure APP_ENV=homologation e TEST_LICENSE_BYPASS=true somente na instância de teste. Isso dispensa gate/cotas comerciais, inclusive com token comercial antigo, sem consumir cotas ou conceder direitos no banco. A flag antiga TADEU_LICENSE_ENFORCED=false não é mais um bypass. Sem a nova flag, o servidor exige token/licença; falhas de rede não liberam acesso. Nenhum backend foi automaticamente reconfigurado por este arquivo.

## Antes da produção

1. Compilar novos artefatos com bypass false/ausente e ambiente production; nunca promover APK de homologação.
2. Configurar URLs e chaves públicas do licenciamento oficial e dos backends de produção. Manter segredos de IA/pagamento somente no servidor.
3. Nos servidores, remover TEST_LICENSE_BYPASS e fixar APP_ENV=production. Validar conta sem licença, expirada, cancelada, offline e com limite esgotado.
4. Confirmar assinatura Android oficial, applicationId e canal de distribuição production. Testar instalação e atualização em aparelho real.
5. Billing permanece BILLING_MODE=test e BILLING_PROVIDER=mock durante esta entrega. A ativação financeira real é uma etapa posterior explícita.

## Finalização de 2026-10-01

Projeto operacional confirmado pelo usuário: `knxwuxxpbrbmhgdatgoe`.
A conexão Supabase do Codex ainda precisa de acesso à organização correta.
Não aplicar a migration de perfis nem configurar o APK apontando ao projeto antigo.
Versão reservada para teste: 1.8.2 (23). Main incorporada preservando a correção
de mensagem de rede no login e a SPEC 0007 de proxy IA adicionada pelo usuário.
A correção de fila/autorização está em `0007-auditoria-fila-e-autorizacao.md`;
a spec de proxy IA é outro documento e não significa implantação concluída.
Produção exige bypass false/ausente, migration validada e nenhuma chave privada
de provedor embutida no cliente, além da liberação comercial explícita.
