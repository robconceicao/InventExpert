-- =============================================================================
-- InventExpert — Patch: attendance_stats sobre field_events + kinds H/I/J
-- Data: 2026-08-08
-- =============================================================================
-- NÃO edita migration_field_events_and_roles.sql. Corrige duas incoerências
-- entre o app e o banco, ambas encontradas depois que o schema foi aplicado
-- pela primeira vez neste projeto.
--
-- Incoerência 1 — resumo de presença sempre vazio
-- -----------------------------------------------
-- O app grava presença em `field_events` (kind='attendance'), via
-- `upsertFieldEventFromQueueItem`. Mas o componente AttendanceSummary lê a view
-- `attendance_stats`, que era construída sobre a tabela `attendance` — que
-- nenhum código alimenta desde a migração para a fila de eventos.
--
-- Resultado: o resumo mostrava zero, e ninguém percebia porque não dá erro.
--
-- A `migration_field_events_and_roles.sql` já previa recriar a view sobre
-- `field_events`, mas essa parte não havia sido aplicada para não derrubar a
-- view antiga sem conferir o formato do payload. Conferido: aplicar CONSERTA.
--
-- Incoerência 2 — relatórios H, I e J não sincronizavam
-- ----------------------------------------------------
-- `FIELD_EVENT_KINDS` em src/services/fieldEventSync.ts lista onze tipos,
-- incluindo reportH, reportI e reportJ — e as telas correspondentes enfileiram
-- com esses syncKind. O CHECK da coluna `kind` só aceitava reportA–G e
-- attendance, então o upsert desses três falhava com violação de constraint.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. kind alinhado ao código
-- ---------------------------------------------------------------------------
ALTER TABLE public.field_events DROP CONSTRAINT IF EXISTS chk_field_events_kind;

ALTER TABLE public.field_events ADD CONSTRAINT chk_field_events_kind CHECK (
    kind IN ('reportA','reportB','reportC','reportD','reportE',
             'reportF','reportG','reportH','reportI','reportJ','attendance')
);

COMMENT ON COLUMN public.field_events.kind IS
    'Espelha FIELD_EVENT_KINDS em src/services/fieldEventSync.ts. '
    'Ao criar uma tela nova de relatório, estender este CHECK junto.';

-- ---------------------------------------------------------------------------
-- 2. attendance_stats sobre field_events
-- ---------------------------------------------------------------------------
-- Mesmas colunas, mesma ordem e mesmos tipos da view antiga, para que o
-- AttendanceSummary não precise mudar.
--
-- `upsertFieldEventFromQueueItem` chama `unwrapEventBody` antes de gravar, então
-- o payload de presença fica plano: `colaboradores` no primeiro nível. Loja e
-- data vão para colunas dedicadas — os COALESCE cobrem registros gravados antes
-- dessa extração existir.
--
-- DROP + CREATE em vez de CREATE OR REPLACE: a definição muda de tabela de
-- origem, e o REPLACE exigiria lista de colunas idêntica à anterior.
DROP VIEW IF EXISTS public.attendance_stats;

CREATE VIEW public.attendance_stats WITH (security_invoker = true) AS
SELECT
    fe.id,
    fe.user_id,
    COALESCE(NULLIF(fe.loja, ''), fe.payload->>'loja', '') AS loja,
    COALESCE(
        fe.event_date::text,
        CASE
            WHEN (fe.payload->>'data') ~ '^\d{4}-\d{2}-\d{2}' THEN (fe.payload->>'data')
            WHEN (fe.payload->>'data') ~ '^\d{2}/\d{2}/\d{4}'
                THEN to_char(to_date(fe.payload->>'data', 'DD/MM/YYYY'), 'YYYY-MM-DD')
            ELSE NULL
        END
    ) AS data,
    COALESCE(jsonb_array_length(fe.payload->'colaboradores'), 0) AS total_colaboradores,
    COALESCE((
        SELECT count(*)
        FROM jsonb_array_elements(COALESCE(fe.payload->'colaboradores', '[]'::jsonb)) c
        WHERE c->>'status' = 'PRESENTE'
    ), 0) AS presentes,
    fe.created_at
FROM public.field_events fe
WHERE fe.kind = 'attendance';

COMMENT ON VIEW public.attendance_stats IS
    'Presença derivada de field_events (kind=attendance). security_invoker: '
    'cada usuário vê apenas os próprios eventos, pela policy fe_select_own.';

REVOKE ALL ON public.attendance_stats FROM anon;
GRANT SELECT ON public.attendance_stats TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Tabela `attendance` — deprecada, não removida
-- ---------------------------------------------------------------------------
-- Fica órfã: nenhum código escreve nela e está vazia. Não é removida porque
-- DROP é irreversível e não traz ganho algum. Sem acesso para anon nem para
-- authenticated; só service_role alcança, para eventual inspeção.
COMMENT ON TABLE public.attendance IS
    'DEPRECADA em 08/08/2026. A presença passou a ser gravada em field_events '
    '(kind=attendance) e consolidada pela view attendance_stats. Tabela mantida '
    'vazia por precaução; pode ser removida após uma temporada sem incidentes.';

REVOKE ALL ON TABLE public.attendance FROM anon;
REVOKE ALL ON TABLE public.attendance FROM authenticated;
