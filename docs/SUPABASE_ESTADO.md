# Estado do Supabase — InventExpert

> Projeto `knxwuxxpbrbmhgdatgoe` (sa-east-1) · última aplicação em 08/08/2026
> Confere com `EXPO_PUBLIC_SUPABASE_URL` do `.env`.

---

## O que aconteceu em 08/08/2026

Antes desta data **nenhuma migration da pasta `supabase/` havia sido aplicada**
neste projeto. O controle de migrations do Supabase estava vazio e o banco tinha
apenas as tabelas de uma geração anterior do app: `attendance`, `messages`,
`report_a`, `report_b`, `summaries`, `users` e três views.

Isso passou despercebido porque `secaoLookupRepository` e `limitesBlocoRepository`
caem em fallback local silencioso quando o Supabase não responde — o módulo
Avaliação vinha funcionando sem nunca ter falado com o banco.

Foram aplicadas **14 migrations**, na ordem de dependência abaixo.

---

## Ordem de aplicação

A ordem alfabética dos arquivos **não** é a ordem de dependência. A sequência
correta, já aplicada:

| # | Migration | Conteúdo |
|---|---|---|
| 1 | `schema_v2_base` | clientes, colaboradores, produtividade, inventarios, escala |
| 2 | `view_produtividade_consolidada` | view de score consolidado |
| 3 | `secao_lookup_limites_bloco_produtividade_idempotente` | secao_lookup, limites_bloco_area (37 áreas), índice de idempotência |
| 4 | `limites_bloco_patch1_e_campos_adicionais` | alias OTC, RLS das duas tabelas, campos extras |
| 5 | `field_events_e_app_profiles` | field_events, app_profiles |
| 6 | `gerar_escala_com_lock_e_cancelado` | motor de escala com advisory lock |
| 7 | `auditoria_atribuicao` | três tabelas do módulo Auditoria |
| 8 | `security_advisor_harden` | is_staff_reader/writer + policies das tabelas core |
| 9 | `security_advisor_cleanup` | FORCE RLS, revokes, bootstrap de perfil |
| 10 | `colaboradores_modalidade` | modalidade de contratação + RPC |
| 11 | `fechar_exposicao_anon_avaliacao` | revoke de anon nas tabelas do módulo |
| 12 | `revogar_anon_tabelas_legadas` | revoke de anon nas tabelas antigas |
| 13 | `mover_pg_trgm_para_schema_extensions` | pg_trgm sai do schema exposto |
| 14 | `attendance_stats_sobre_field_events_e_kinds_h_i_j` | consolida presença em field_events; libera reportH/I/J |

**`harden` vem antes de `cleanup`**, apesar dos nomes. O cleanup revoga
permissões das funções `is_staff_*` que o harden cria; na ordem alfabética
falharia com `function does not exist`.

---

## Correção de bug na migration original

`migration_limites_bloco_area.sql` declarava `limite_pct NUMERIC(5,2)`, que
comporta no máximo 999,99. O próprio seed insere **9999,00** como sentinela de
"sem limite definido" em BALCÃO DE ATENDIMENTO.

Resultado: `ERROR: 22003 numeric field overflow`. **Essa migration nunca teria
sido aplicada com sucesso por ninguém.** O tipo foi corrigido para
`NUMERIC(7,2)` no banco e no arquivo do repositório.

---

## Desvios conscientes em relação aos arquivos

**Policies `USING (true)` do `schema_v2.sql` não foram criadas.** O `CLAUDE.md`
proíbe recriá-las nas tabelas core, e o harden as substituiria em seguida. Entre
os dois passos as tabelas ficaram sem policy nenhuma — o estado mais restritivo
possível, não o mais permissivo.

**`attendance_stats` foi recriada na migration 14, não na 5.** Na primeira
passagem ela ficou de fora por precaução — trocar uma view consumida por um
módulo sem conferir o formato do payload seria imprudente. Conferido depois:
aplicar **conserta** em vez de quebrar. Ver a seção seguinte.

**`gerar_escala` e `listar_escala` do `functions.sql` foram puladas.** As duas
são redefinidas por inteiro pelas migrations 6 e 8. Criar a versão antiga para
substituí-la em seguida seria ruído.

---

## Presença e relatórios H/I/J — dois bugs corrigidos

Ao investigar a pendência do `attendance_stats`, apareceram duas incoerências
entre o app e o banco. Nenhuma das duas dava erro visível.

**O resumo de presença mostrava zero desde sempre.** O app grava presença em
`field_events` (kind `attendance`), via `upsertFieldEventFromQueueItem`. Mas o
`AttendanceSummary` lia `attendance_stats`, que era construída sobre a tabela
`attendance` — órfã desde a migração para a fila de eventos. Consulta válida,
tabela vazia, resultado vazio, nenhum erro.

**Os relatórios H, I e J não sincronizavam.** `FIELD_EVENT_KINDS` lista onze
tipos e as telas H, I e J enfileiram com os `syncKind` correspondentes, mas o
CHECK da coluna `kind` só aceitava reportA–G e attendance. O upsert falhava com
violação de constraint.

A migration 14 corrige as duas: recria a view sobre `field_events` mantendo
colunas, ordem e tipos (o componente não muda), e estende o CHECK para os onze
tipos. Validado com um evento de presença real — 4 colaboradores, 2 presentes,
2 faltas — e um `reportH`, que antes era rejeitado.

A tabela `attendance` ficou **deprecada, não removida**: está vazia e sem
referência no código, mas `DROP` é irreversível e não traz ganho. Acesso
revogado de `anon` e de `authenticated`.

> Quando criar uma tela de relatório nova, estenda `FIELD_EVENT_KINDS` **e** o
> CHECK. O comentário na coluna e o bloco em `fieldEventSync.ts` lembram disso.

---

## Sobre o RLS — o que você precisa saber

`is_staff_reader()` e `is_staff_writer()` tratam **ausência de linha em
`app_profiles` como legado com acesso liberado**:

```sql
NOT EXISTS (SELECT 1 FROM app_profiles WHERE user_id = auth.uid())
OR EXISTS (... role IN (...))
```

Como `app_profiles` está vazia, **qualquer conta autenticada lê e escreve
normalmente**. Não é preciso cadastrar ninguém para o app funcionar.

Há um trigger em `auth.users` que cria o perfil como `OPERADOR` a cada novo
cadastro. A partir do momento em que alguém tiver perfil, ele passa a valer:
`OPERADOR` lê mas não escreve nas tabelas core; `LIDER` e `ADMIN` escrevem.

Para promover alguém:

```sql
UPDATE public.app_profiles SET role = 'LIDER' WHERE user_id = '<uuid>';
```

O usuário não consegue se auto-promover — a policy `ap_update_own` exige que o
`role` permaneça igual.

---

## Segurança: de 40 avisos para 26

**Fechados:**

- 15 objetos expostos ao `anon` no schema GraphQL
- `pg_trgm` no schema `public`
- `handle_new_user_profile()` e `rls_auto_enable()` chamáveis via RPC por `anon`

**Os 26 restantes são intencionais:**

- 22 avisos de `pg_graphql_authenticated_table_exposed` — o app precisa que
  usuários autenticados leiam essas tabelas; a filtragem por linha é feita pelas
  policies, não pelo grant.
- 3 funções `SECURITY DEFINER` chamáveis por autenticados: `gerar_escala`,
  `listar_escala` e `definir_modalidade_colaborador`. São RPCs que o app chama, e
  todas verificam `auth.uid()` internamente.

**Uma pendência real, que não é SQL:** *Leaked Password Protection* está
desligado. Liga no painel em **Authentication → Policies**; passa a checar senhas
contra o HaveIBeenPwned no cadastro.

---

## Verificações rápidas

```sql
-- Migrations aplicadas
SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;

-- Modalidades marcadas
SELECT nome, matricula, modalidade, modalidade_atualizada_em
FROM public.colaboradores WHERE modalidade IS NOT NULL
ORDER BY modalidade_atualizada_em DESC;

-- Quem tem perfil (vazio = todos com acesso de legado)
SELECT user_id, role FROM public.app_profiles;

-- Seed de limites de bloco (esperado: 37)
SELECT count(*) FROM public.limites_bloco_area;
```
