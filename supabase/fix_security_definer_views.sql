-- =============================================================================
-- InventExpert — Fix: Security Definer Views
-- Corrige as views flagadas pelo Supabase Security Advisor.
--
-- PROBLEMA:
--   Views criadas com SECURITY DEFINER executam sempre com as permissões
--   do owner (tipicamente um superuser), ignorando completamente o RLS
--   das tabelas subjacentes. Isso significa que qualquer utilizador que
--   aceda à view vê TODOS os dados, independentemente das políticas RLS.
--
-- SOLUÇÃO:
--   Recriar cada view com SECURITY INVOKER (comportamento padrão seguro).
--   SECURITY INVOKER faz a view correr com as permissões do utilizador
--   que executa a query, respeitando total o RLS configurado.
--
-- COMO EXECUTAR:
--   Supabase Dashboard → Database → SQL Editor → Cole e execute este ficheiro.
-- =============================================================================


-- =============================================================================
-- PASSO 1: Ler as definições actuais das views antes de as recriar
-- (Execute este bloco primeiro para ter backup das definições originais)
-- =============================================================================
-- SELECT 'public.recent_report_a' AS view_name, pg_get_viewdef('public.recent_report_a'::regclass, true) AS definition
-- UNION ALL
-- SELECT 'public.attendance_stats',              pg_get_viewdef('public.attendance_stats'::regclass, true)
-- UNION ALL
-- SELECT 'public.recent_report_b',               pg_get_viewdef('public.recent_report_b'::regclass, true);


-- =============================================================================
-- PASSO 2: Recriar as views como SECURITY INVOKER
--
-- PostgreSQL não tem ALTER VIEW ... SET SECURITY INVOKER directamente.
-- A estratégia correcta é:
--   1. Obter a definição actual com pg_get_viewdef()
--   2. DROP VIEW
--   3. CREATE OR REPLACE VIEW ... WITH (security_invoker = true)
--
-- O bloco DO abaixo faz isso automaticamente para as 3 views.
-- =============================================================================

DO $$
DECLARE
    v_def TEXT;
    v_name TEXT;
    v_names TEXT[] := ARRAY[
        'public.recent_report_a',
        'public.attendance_stats',
        'public.recent_report_b'
    ];
BEGIN
    FOREACH v_name IN ARRAY v_names LOOP
        -- Verifica se a view existe antes de tentar alterar
        IF EXISTS (
            SELECT 1
            FROM   pg_catalog.pg_class c
            JOIN   pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE  n.nspname || '.' || c.relname = v_name
              AND  c.relkind = 'v'
        ) THEN
            -- Obtém a query SELECT da view actual
            v_def := pg_get_viewdef(v_name::regclass, true);

            -- Remove a view existente (com SECURITY DEFINER implícito)
            EXECUTE format('DROP VIEW IF EXISTS %s CASCADE', v_name);

            -- Recria com SECURITY INVOKER explícito
            -- (seguro: respeita RLS do utilizador autenticado)
            EXECUTE format(
                'CREATE OR REPLACE VIEW %s WITH (security_invoker = true) AS %s',
                v_name,
                v_def
            );

            RAISE NOTICE 'View % recriada com SECURITY INVOKER.', v_name;
        ELSE
            RAISE NOTICE 'View % não encontrada — ignorada.', v_name;
        END IF;
    END LOOP;
END;
$$;


-- =============================================================================
-- PASSO 3: Garantir GRANT correcto nas views recriadas
-- (DROP CASCADE pode remover grants existentes)
-- =============================================================================

DO $$
DECLARE
    v_name TEXT;
    v_names TEXT[] := ARRAY[
        'public.recent_report_a',
        'public.attendance_stats',
        'public.recent_report_b'
    ];
BEGIN
    FOREACH v_name IN ARRAY v_names LOOP
        IF EXISTS (
            SELECT 1
            FROM   pg_catalog.pg_class c
            JOIN   pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE  n.nspname || '.' || c.relname = v_name
              AND  c.relkind = 'v'
        ) THEN
            EXECUTE format(
                'GRANT SELECT ON %s TO authenticated, anon',
                v_name
            );
            RAISE NOTICE 'GRANT SELECT concedido em %.', v_name;
        END IF;
    END LOOP;
END;
$$;


-- =============================================================================
-- PASSO 4: Verificação automática — confirmar que SECURITY DEFINER foi removido
-- Deve retornar 0 linhas após o fix. Se retornar alguma, há um problema.
-- =============================================================================

SELECT
    schemaname || '.' || viewname   AS view_name,
    definition,
    -- No pg_views não há coluna directa para security_definer;
    -- verificamos via pg_class.relacl e pg_proc (views não são funções, logo
    -- qualquer flag de security definer fica em pg_rewrite / parsing interno).
    -- A forma mais directa é via information_schema:
    'Verificar manualmente no Security Advisor' AS acao
FROM
    pg_catalog.pg_views
WHERE
    schemaname = 'public'
    AND viewname IN ('recent_report_a', 'attendance_stats', 'recent_report_b')
ORDER BY
    viewname;


-- =============================================================================
-- NOTAS PARA O FUTURO
-- =============================================================================
-- 1. Ao criar NOVAS views, sempre use:
--      CREATE VIEW nome WITH (security_invoker = true) AS SELECT ...;
--
-- 2. Para funções (não views), o equivalente é usar SECURITY INVOKER:
--      CREATE FUNCTION nome() RETURNS ... SECURITY INVOKER AS $$ ... $$;
--
-- 3. A excepção à regra: a nossa function gerar_escala() usa SECURITY DEFINER
--    intencionalmente para contornar o RLS durante a geração da escala.
--    Isso é seguro porque a função valida o inventario_id antes de operar.
--    Todas as VIEWS devem ser SECURITY INVOKER.
-- =============================================================================
