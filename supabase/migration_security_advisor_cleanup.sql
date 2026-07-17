-- =============================================================================
-- InventExpert — Security Advisor cleanup (2026-07-17)
-- =============================================================================
-- 1) REVOKE anon/PUBLIC em views e helpers
-- 2) FORCE RLS nas tabelas core (owner não contorna policies)
-- 3) Bootstrap app_profiles (OPERADOR) em novo auth.users
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Views — sem acesso anónimo
-- ---------------------------------------------------------------------------
REVOKE ALL ON TABLE public.vw_produtividade_consolidada FROM anon;
REVOKE ALL ON TABLE public.vw_produtividade_consolidada FROM PUBLIC;
GRANT SELECT ON TABLE public.vw_produtividade_consolidada TO authenticated;
GRANT SELECT ON TABLE public.vw_produtividade_consolidada TO service_role;

-- attendance_stats (security_invoker) — só autenticados
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public' AND table_name = 'attendance_stats'
  ) THEN
    EXECUTE 'REVOKE ALL ON TABLE public.attendance_stats FROM anon';
    EXECUTE 'REVOKE ALL ON TABLE public.attendance_stats FROM PUBLIC';
    EXECUTE 'GRANT SELECT ON TABLE public.attendance_stats TO authenticated';
    EXECUTE 'GRANT SELECT ON TABLE public.attendance_stats TO service_role';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Helpers de auth — não devem ser chamáveis por anon
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.is_authenticated_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_authenticated_user() FROM anon;
REVOKE ALL ON FUNCTION public.is_staff_reader() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_staff_reader() FROM anon;
REVOKE ALL ON FUNCTION public.is_staff_writer() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_staff_writer() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_authenticated_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff_reader() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff_writer() TO authenticated;

-- Trigger helper: só owner/authenticated (não anon)
REVOKE ALL ON FUNCTION public.fn_set_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_set_updated_at() FROM anon;
-- triggers executam com privilégios do owner da função

-- ---------------------------------------------------------------------------
-- 3. FORCE ROW LEVEL SECURITY (mesmo table owner / bypasses reduzidos)
-- ---------------------------------------------------------------------------
ALTER TABLE public.clientes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.colaboradores FORCE ROW LEVEL SECURITY;
ALTER TABLE public.inventarios FORCE ROW LEVEL SECURITY;
ALTER TABLE public.escala FORCE ROW LEVEL SECURITY;
ALTER TABLE public.produtividade FORCE ROW LEVEL SECURITY;
ALTER TABLE public.field_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.app_profiles FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 4. Bootstrap perfil OPERADOR no signup
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.app_profiles (user_id, role, display_name)
  VALUES (
    NEW.id,
    'OPERADOR',
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user_profile() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user_profile() FROM anon;
-- trigger em auth.users — execução pelo owner

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_profile();

COMMENT ON FUNCTION public.handle_new_user_profile() IS
  'Cria app_profiles.role=OPERADOR no signup. Promover a LIDER/ADMIN via SQL service_role.';

-- ---------------------------------------------------------------------------
-- 5. Reafirma grants de funções de escala (idempotente)
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.gerar_escala(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gerar_escala(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.gerar_escala(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gerar_escala(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.listar_escala(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.listar_escala(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.listar_escala(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_escala(uuid) TO service_role;
