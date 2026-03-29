-- =============================================================================
-- InventExpert — Fix: Function Search Path Mutable
-- Corrige o alerta do Supabase Security Advisor para handle_updated_at.
--
-- PROBLEMA:
--   Funções sem search_path fixo são vulneráveis a "search_path hijacking":
--   um utilizador malicioso pode criar objectos num schema com maior prioridade
--   no search_path e substituir funções ou tipos do sistema, executando código
--   arbitrário quando a função for chamada.
--
-- SOLUÇÃO:
--   Recriar a função com SET search_path = public (ou '' para máxima segurança).
--   Isso fixa o schema de resolução de nomes, eliminando a vulnerabilidade.
--
-- EXECUTAR EM:
--   Supabase Dashboard → Database → SQL Editor
-- =============================================================================


-- =============================================================================
-- 1. CORRIGIR: public.handle_updated_at
--    Função trigger que actualiza o campo updated_at automaticamente.
--    Reescrita com search_path fixo e tipagem explícita.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
-- search_path vazio ('') é a opção mais segura:
-- força qualificação explícita de schema para todos os objectos.
-- Usamos 'public' aqui para manter compatibilidade com o código existente.
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_updated_at() IS
    'Trigger function: actualiza o campo updated_at para o timestamp actual. '
    'search_path fixado em public para prevenir search_path hijacking.';


-- =============================================================================
-- 2. CORRIGIR (preventivo): public.fn_set_updated_at
--    Função trigger equivalente criada no schema_v2.sql.
--    Aplica o mesmo fix por consistência.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_set_updated_at() IS
    'Trigger function: actualiza updated_at. search_path=public (seguro).';


-- =============================================================================
-- 3. VERIFICAÇÃO — Confirmar que o search_path está fixado
--    Deve retornar 'public' na coluna search_path para ambas as funções.
--    Resultado esperado: 2 linhas com search_path = 'public'.
-- =============================================================================
SELECT
    n.nspname || '.' || p.proname  AS function_name,
    p.prosecdef                    AS is_security_definer,
    -- Extrai o search_path das opções de configuração da função
    (
        SELECT option_value
        FROM   pg_options_to_table(p.proconfig)
        WHERE  option_name = 'search_path'
    )                              AS search_path,
    CASE
        WHEN p.proconfig IS NULL THEN '❌ SEM search_path fixo (vulnerável)'
        WHEN EXISTS (
            SELECT 1 FROM pg_options_to_table(p.proconfig)
            WHERE option_name = 'search_path'
        ) THEN '✅ search_path fixado'
        ELSE '⚠️  Verificar manualmente'
    END                            AS status_seguranca
FROM
    pg_catalog.pg_proc   p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE
    n.nspname = 'public'
    AND p.proname IN ('handle_updated_at', 'fn_set_updated_at')
ORDER BY
    p.proname;
