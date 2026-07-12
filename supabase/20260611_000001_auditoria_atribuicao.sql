-- =====================================================================
-- InventExpert — Migration: Módulo Auditoria de Atribuição de Erros (AAE)
-- Arquivo: 20260611_000001_auditoria_atribuicao.sql
-- =====================================================================
-- Cria as três tabelas do módulo de auditoria de integridade da
-- atribuição manual de erros de contagem:
--   1. auditoria_atribuicao         — 1 linha por execução (loja/inventário)
--   2. auditoria_atribuicao_item    — 1 linha por conferente por execução
--   3. auditoria_reconciliacao      — 1 linha por reconciliação Nível 2
--
-- Padrão seguido: migration em arquivo separado (não edita migrations
-- existentes), RLS habilitada, vínculo ao usuário via coluna user_id
-- referenciando auth.users.
--
-- >>> CONFIRMAR antes de aplicar:
--   (a) Se o seu projeto vincula registros por user_id (auth.uid()) ou por
--       um conceito de equipe/org. Abaixo uso user_id = auth.uid(), igual
--       ao padrão mais comum. Se você usa team_id/org_id, troque as policies.
--   (b) Se o nome do schema é public (assumido aqui).
--   (c) O prefixo de timestamp do arquivo segue a convenção que você já usa.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. auditoria_atribuicao  (cabeçalho da execução)
-- ---------------------------------------------------------------------
create table if not exists public.auditoria_atribuicao (
    id                  uuid primary key default gen_random_uuid(),
    user_id             uuid not null default auth.uid()
                            references auth.users (id) on delete cascade,
    loja                text not null,
    capa                text,
    data_inventario     date,
    total_conferentes   integer not null default 0,
    total_divergentes   integer not null default 0,   -- conferentes com diferenca != 0
    resumo_json         jsonb,                          -- snapshot livre p/ relatório
    created_at          timestamptz not null default now()
);

comment on table public.auditoria_atribuicao is
    'Cabecalho de cada execucao de auditoria de atribuicao de erros (1 por loja/inventario).';
comment on column public.auditoria_atribuicao.total_divergentes is
    'Quantidade de conferentes cuja diferenca (atribuido - real) != 0.';

create index if not exists idx_auditoria_atribuicao_user
    on public.auditoria_atribuicao (user_id);
create index if not exists idx_auditoria_atribuicao_loja
    on public.auditoria_atribuicao (loja, data_inventario);

-- ---------------------------------------------------------------------
-- 2. auditoria_atribuicao_item  (resultado Nível 1 por conferente)
-- ---------------------------------------------------------------------
create table if not exists public.auditoria_atribuicao_item (
    id                  uuid primary key default gen_random_uuid(),
    auditoria_id        uuid not null
                            references public.auditoria_atribuicao (id) on delete cascade,
    user_id             uuid not null default auth.uid()
                            references auth.users (id) on delete cascade,
    codigo_conferente   text,                 -- codigo ProInv 6 digitos (agentes.txt)
    nome                text,
    cpf                 text,                 -- chave tecnica; NAO exibir em relatorio final
    erro_real           numeric(12,2) not null default 0,  -- soma |AJST| das secoes contadas
    erro_atribuido      numeric(12,2) not null default 0,  -- Erro(Qtde) do PRODUCAO.xls
    diferenca           numeric(12,2) not null default 0,  -- atribuido - real
    status              text not null
                            check (status in (
                                'OK',
                                'ERRO_DE_TERCEIRO_RECEBIDO',
                                'ERRO_PROPRIO_EM_OUTRO'
                            )),
    detalhe_json        jsonb,                -- secoes envolvidas + de-quem/para-quem
    created_at          timestamptz not null default now()
);

comment on table public.auditoria_atribuicao_item is
    'Resultado da conferencia aritmetica (Nivel 1) por conferente.';
comment on column public.auditoria_atribuicao_item.cpf is
    'Chave tecnica de cruzamento (CPF). Nao deve ser exibido em relatorios entregaveis.';
comment on column public.auditoria_atribuicao_item.status is
    'OK = integro; ERRO_DE_TERCEIRO_RECEBIDO = atribuido>real; ERRO_PROPRIO_EM_OUTRO = atribuido<real.';

create index if not exists idx_aai_auditoria
    on public.auditoria_atribuicao_item (auditoria_id);
create index if not exists idx_aai_user
    on public.auditoria_atribuicao_item (user_id);
create index if not exists idx_aai_status
    on public.auditoria_atribuicao_item (status);

-- ---------------------------------------------------------------------
-- 3. auditoria_reconciliacao  (Nível 2, sob demanda, por produto)
-- ---------------------------------------------------------------------
create table if not exists public.auditoria_reconciliacao (
    id                    uuid primary key default gen_random_uuid(),
    auditoria_id          uuid not null
                              references public.auditoria_atribuicao (id) on delete cascade,
    user_id               uuid not null default auth.uid()
                              references auth.users (id) on delete cascade,
    ean                   text not null,
    descricao             text,
    fisico_nao_ajustado   numeric(12,2) not null default 0,  -- soma C1 (todas as secoes do EAN)
    fisico_ajustado       numeric(12,2) not null default 0,  -- soma FINAL (todas as secoes)
    contabil              numeric(12,2),                      -- saldo teorico TOTAL da loja
    dif_nao_ajustado      numeric(12,2),                      -- fisico_nao_ajustado - contabil
    dif_ajustado          numeric(12,2),                      -- fisico_ajustado - contabil
    veredito              text
                              check (veredito in ('COERENTE', 'SUSPEITO', 'INDETERMINADO')),
    detalhe_json          jsonb,            -- por secao: C1, FINAL, AJST, conferente que contou
    created_at            timestamptz not null default now()
);

comment on table public.auditoria_reconciliacao is
    'Reconciliacao fisico x contabil (Nivel 2) por produto inteiro. Contabil e total da loja.';
comment on column public.auditoria_reconciliacao.veredito is
    'COERENTE = ajuste aproximou do contabil; SUSPEITO = afastou; INDETERMINADO = sem contabil.';

create index if not exists idx_arec_auditoria
    on public.auditoria_reconciliacao (auditoria_id);
create index if not exists idx_arec_user
    on public.auditoria_reconciliacao (user_id);
create index if not exists idx_arec_ean
    on public.auditoria_reconciliacao (ean);

-- =====================================================================
-- Row Level Security
-- Padrao: cada usuario enxerga e manipula apenas as proprias auditorias.
-- >>> Se o seu projeto compartilha dados por equipe, troque
--     (user_id = auth.uid()) pela checagem de membership da sua tabela
--     de equipe/org.
-- =====================================================================

alter table public.auditoria_atribuicao        enable row level security;
alter table public.auditoria_atribuicao_item   enable row level security;
alter table public.auditoria_reconciliacao      enable row level security;

-- --- auditoria_atribuicao -------------------------------------------------
create policy "aa_select_own" on public.auditoria_atribuicao
    for select using (user_id = auth.uid());
create policy "aa_insert_own" on public.auditoria_atribuicao
    for insert with check (user_id = auth.uid());
create policy "aa_update_own" on public.auditoria_atribuicao
    for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "aa_delete_own" on public.auditoria_atribuicao
    for delete using (user_id = auth.uid());

-- --- auditoria_atribuicao_item -------------------------------------------
-- Acesso pelo dono do registro; o vinculo ao cabecalho garante coerencia.
create policy "aai_select_own" on public.auditoria_atribuicao_item
    for select using (user_id = auth.uid());
create policy "aai_insert_own" on public.auditoria_atribuicao_item
    for insert with check (
        user_id = auth.uid()
        and exists (
            select 1 from public.auditoria_atribuicao a
            where a.id = auditoria_id and a.user_id = auth.uid()
        )
    );
create policy "aai_update_own" on public.auditoria_atribuicao_item
    for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "aai_delete_own" on public.auditoria_atribuicao_item
    for delete using (user_id = auth.uid());

-- --- auditoria_reconciliacao ---------------------------------------------
create policy "arec_select_own" on public.auditoria_reconciliacao
    for select using (user_id = auth.uid());
create policy "arec_insert_own" on public.auditoria_reconciliacao
    for insert with check (
        user_id = auth.uid()
        and exists (
            select 1 from public.auditoria_atribuicao a
            where a.id = auditoria_id and a.user_id = auth.uid()
        )
    );
create policy "arec_update_own" on public.auditoria_reconciliacao
    for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "arec_delete_own" on public.auditoria_reconciliacao
    for delete using (user_id = auth.uid());

-- =====================================================================
-- Fim da migration.
-- Rollback manual (se necessario, em migration separada):
--   drop table if exists public.auditoria_reconciliacao;
--   drop table if exists public.auditoria_atribuicao_item;
--   drop table if exists public.auditoria_atribuicao;
-- =====================================================================
