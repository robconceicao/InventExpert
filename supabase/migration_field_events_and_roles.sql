-- =============================================================================
-- InventExpert — Patch: field_events (sync relatórios/presença) + app_profiles
-- =============================================================================
-- 1) Tabela genérica para flush da fila local (reportA–G, attendance)
-- 2) View attendance_stats consumida pelo AttendanceSummary
-- 3) app_profiles.role para RBAC leve (OPERADOR | LIDER | ADMIN)
-- 4) RLS: cada user só vê os seus field_events; profiles próprio + admin
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 1. field_events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.field_events (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id           UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    kind              TEXT NOT NULL,
    client_event_id   TEXT NOT NULL,
    event_date        DATE,
    loja              TEXT,
    payload           JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_field_events_user_kind_client
        UNIQUE (user_id, kind, client_event_id),
    CONSTRAINT chk_field_events_kind CHECK (
        kind IN (
            'reportA', 'reportB', 'reportC', 'reportD',
            'reportE', 'reportF', 'reportG', 'attendance'
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_field_events_user_kind
    ON public.field_events (user_id, kind, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_field_events_event_date
    ON public.field_events (event_date DESC NULLS LAST);

COMMENT ON TABLE public.field_events IS
    'Eventos de campo sincronizados da fila local (relatórios A–G e presença).';

DROP TRIGGER IF EXISTS trg_field_events_updated_at ON public.field_events;
CREATE TRIGGER trg_field_events_updated_at
    BEFORE UPDATE ON public.field_events
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

ALTER TABLE public.field_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fe_select_own" ON public.field_events;
DROP POLICY IF EXISTS "fe_insert_own" ON public.field_events;
DROP POLICY IF EXISTS "fe_update_own" ON public.field_events;
DROP POLICY IF EXISTS "fe_delete_own" ON public.field_events;

CREATE POLICY "fe_select_own" ON public.field_events
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "fe_insert_own" ON public.field_events
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "fe_update_own" ON public.field_events
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "fe_delete_own" ON public.field_events
    FOR DELETE TO authenticated
    USING (user_id = auth.uid());

REVOKE ALL ON TABLE public.field_events FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.field_events TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. attendance_stats (view) — agrega presença a partir de field_events
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.attendance_stats
WITH (security_invoker = true) AS
SELECT
    fe.id,
    COALESCE(fe.loja, fe.payload->>'loja', '') AS loja,
    COALESCE(
        fe.event_date,
        CASE
            WHEN (fe.payload->>'data') ~ '^\d{4}-\d{2}-\d{2}'
                THEN (fe.payload->>'data')::date
            WHEN (fe.payload->>'data') ~ '^\d{2}/\d{2}/\d{4}'
                THEN to_date(fe.payload->>'data', 'DD/MM/YYYY')
            ELSE NULL
        END
    ) AS data,
    COALESCE(jsonb_array_length(fe.payload->'colaboradores'), 0) AS total_colaboradores,
    COALESCE((
        SELECT COUNT(*)::int
        FROM jsonb_array_elements(COALESCE(fe.payload->'colaboradores', '[]'::jsonb)) c
        WHERE c->>'status' = 'PRESENTE'
    ), 0) AS presentes,
    fe.created_at
FROM public.field_events fe
WHERE fe.kind = 'attendance';

COMMENT ON VIEW public.attendance_stats IS
    'Estatísticas de presença derivadas de field_events (kind=attendance). RLS via security_invoker.';

GRANT SELECT ON public.attendance_stats TO authenticated;
REVOKE ALL ON public.attendance_stats FROM anon;

-- ---------------------------------------------------------------------------
-- 3. app_profiles — RBAC leve
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_profiles (
    user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role        TEXT NOT NULL DEFAULT 'OPERADOR'
                    CHECK (role IN ('OPERADOR', 'LIDER', 'ADMIN')),
    display_name TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.app_profiles IS
    'Perfil de app: OPERADOR (campo), LIDER (gestão/escala), ADMIN (tudo). '
    'Ausência de linha = legado com acesso total (compatibilidade).';

DROP TRIGGER IF EXISTS trg_app_profiles_updated_at ON public.app_profiles;
CREATE TRIGGER trg_app_profiles_updated_at
    BEFORE UPDATE ON public.app_profiles
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

ALTER TABLE public.app_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ap_select_own" ON public.app_profiles;
DROP POLICY IF EXISTS "ap_insert_own" ON public.app_profiles;
DROP POLICY IF EXISTS "ap_update_own" ON public.app_profiles;

-- Leitura do próprio perfil
CREATE POLICY "ap_select_own" ON public.app_profiles
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Insert próprio (bootstrap); role só ADMIN pode elevar via SQL/service_role
CREATE POLICY "ap_insert_own" ON public.app_profiles
    FOR INSERT TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        AND role = 'OPERADOR'
    );

-- Utilizador não pode auto-promover-se
CREATE POLICY "ap_update_own" ON public.app_profiles
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (
        user_id = auth.uid()
        AND role = (SELECT p.role FROM public.app_profiles p WHERE p.user_id = auth.uid())
    );

REVOKE ALL ON TABLE public.app_profiles FROM anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.app_profiles TO authenticated;
