-- =============================================================================
-- InventExpert — Security Advisor harden (2026-07-17)
-- =============================================================================
-- 1) Helpers de autorização (SECURITY INVOKER, search_path fixo)
-- 2) Substituir policies USING (true) nas tabelas core
-- 3) Restringir listar_escala / gerar_escala (grants + auth + search_path)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_authenticated_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL;
$$;

COMMENT ON FUNCTION public.is_authenticated_user() IS
  'True se existe JWT com sub (auth.uid()).';

-- Leitura: autenticado; se tem perfil, role deve ser staff conhecido.
-- Sem perfil = legado (acesso de leitura mantido).
CREATE OR REPLACE FUNCTION public.is_staff_reader()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL
    AND (
      NOT EXISTS (
        SELECT 1 FROM public.app_profiles p WHERE p.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.app_profiles p
        WHERE p.user_id = auth.uid()
          AND p.role IN ('OPERADOR', 'LIDER', 'ADMIN')
      )
    );
$$;

-- Escrita: autenticado; se tem perfil, apenas LIDER/ADMIN.
-- Sem perfil = legado (escrita mantida para não quebrar gestão existente).
CREATE OR REPLACE FUNCTION public.is_staff_writer()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL
    AND (
      NOT EXISTS (
        SELECT 1 FROM public.app_profiles p WHERE p.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.app_profiles p
        WHERE p.user_id = auth.uid()
          AND p.role IN ('LIDER', 'ADMIN')
      )
    );
$$;

REVOKE ALL ON FUNCTION public.is_authenticated_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_staff_reader() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_staff_writer() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_authenticated_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff_reader() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff_writer() TO authenticated;

-- ---------------------------------------------------------------------------
-- CLIENTES
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "authenticated_select_clientes" ON public.clientes;
DROP POLICY IF EXISTS "authenticated_write_clientes" ON public.clientes;
DROP POLICY IF EXISTS "Autenticados podem ver clientes" ON public.clientes;
DROP POLICY IF EXISTS "Autenticados podem gerenciar clientes" ON public.clientes;

CREATE POLICY "clientes_select_staff"
  ON public.clientes FOR SELECT TO authenticated
  USING (public.is_staff_reader());

CREATE POLICY "clientes_insert_staff"
  ON public.clientes FOR INSERT TO authenticated
  WITH CHECK (public.is_staff_writer());

CREATE POLICY "clientes_update_staff"
  ON public.clientes FOR UPDATE TO authenticated
  USING (public.is_staff_writer())
  WITH CHECK (public.is_staff_writer());

CREATE POLICY "clientes_delete_staff"
  ON public.clientes FOR DELETE TO authenticated
  USING (public.is_staff_writer());

-- ---------------------------------------------------------------------------
-- COLABORADORES
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "authenticated_select_colaboradores" ON public.colaboradores;
DROP POLICY IF EXISTS "authenticated_write_colaboradores" ON public.colaboradores;
DROP POLICY IF EXISTS "Autenticados podem ver colaboradores" ON public.colaboradores;
DROP POLICY IF EXISTS "Autenticados podem gerenciar colaboradores" ON public.colaboradores;

CREATE POLICY "colaboradores_select_staff"
  ON public.colaboradores FOR SELECT TO authenticated
  USING (public.is_staff_reader());

CREATE POLICY "colaboradores_insert_staff"
  ON public.colaboradores FOR INSERT TO authenticated
  WITH CHECK (public.is_staff_writer());

CREATE POLICY "colaboradores_update_staff"
  ON public.colaboradores FOR UPDATE TO authenticated
  USING (public.is_staff_writer())
  WITH CHECK (public.is_staff_writer());

CREATE POLICY "colaboradores_delete_staff"
  ON public.colaboradores FOR DELETE TO authenticated
  USING (public.is_staff_writer());

-- ---------------------------------------------------------------------------
-- INVENTARIOS
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "authenticated_select_inventarios" ON public.inventarios;
DROP POLICY IF EXISTS "authenticated_write_inventarios" ON public.inventarios;
DROP POLICY IF EXISTS "Autenticados podem ver inventarios" ON public.inventarios;
DROP POLICY IF EXISTS "Autenticados podem gerenciar inventarios" ON public.inventarios;

CREATE POLICY "inventarios_select_staff"
  ON public.inventarios FOR SELECT TO authenticated
  USING (public.is_staff_reader());

CREATE POLICY "inventarios_insert_staff"
  ON public.inventarios FOR INSERT TO authenticated
  WITH CHECK (
    public.is_staff_writer()
    OR (auth.uid() IS NOT NULL AND created_by = auth.uid())
  );

CREATE POLICY "inventarios_update_staff"
  ON public.inventarios FOR UPDATE TO authenticated
  USING (
    public.is_staff_writer()
    OR (auth.uid() IS NOT NULL AND created_by = auth.uid())
  )
  WITH CHECK (
    public.is_staff_writer()
    OR (auth.uid() IS NOT NULL AND created_by = auth.uid())
  );

CREATE POLICY "inventarios_delete_staff"
  ON public.inventarios FOR DELETE TO authenticated
  USING (public.is_staff_writer());

-- ---------------------------------------------------------------------------
-- ESCALA
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "authenticated_select_escala" ON public.escala;
DROP POLICY IF EXISTS "authenticated_write_escala" ON public.escala;
DROP POLICY IF EXISTS "Autenticados podem ver escala" ON public.escala;
DROP POLICY IF EXISTS "Autenticados podem gerenciar escala" ON public.escala;

CREATE POLICY "escala_select_staff"
  ON public.escala FOR SELECT TO authenticated
  USING (public.is_staff_reader());

CREATE POLICY "escala_insert_staff"
  ON public.escala FOR INSERT TO authenticated
  WITH CHECK (public.is_staff_writer());

CREATE POLICY "escala_update_staff"
  ON public.escala FOR UPDATE TO authenticated
  USING (public.is_staff_writer())
  WITH CHECK (public.is_staff_writer());

CREATE POLICY "escala_delete_staff"
  ON public.escala FOR DELETE TO authenticated
  USING (public.is_staff_writer());

-- ---------------------------------------------------------------------------
-- PRODUTIVIDADE
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "authenticated_select_produtividade" ON public.produtividade;
DROP POLICY IF EXISTS "authenticated_insert_produtividade" ON public.produtividade;
DROP POLICY IF EXISTS "authenticated_update_produtividade" ON public.produtividade;
DROP POLICY IF EXISTS "Autenticados podem ver produtividade" ON public.produtividade;
DROP POLICY IF EXISTS "Autenticados podem inserir produtividade" ON public.produtividade;

CREATE POLICY "produtividade_select_staff"
  ON public.produtividade FOR SELECT TO authenticated
  USING (public.is_staff_reader());

CREATE POLICY "produtividade_insert_staff"
  ON public.produtividade FOR INSERT TO authenticated
  WITH CHECK (public.is_staff_writer());

CREATE POLICY "produtividade_update_staff"
  ON public.produtividade FOR UPDATE TO authenticated
  USING (public.is_staff_writer())
  WITH CHECK (public.is_staff_writer());

CREATE POLICY "produtividade_delete_staff"
  ON public.produtividade FOR DELETE TO authenticated
  USING (public.is_staff_writer());

-- ---------------------------------------------------------------------------
-- FUNÇÕES: grants + search_path + auth em listar_escala
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.gerar_escala(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gerar_escala(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.gerar_escala(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gerar_escala(uuid) TO service_role;

ALTER FUNCTION public.gerar_escala(p_inventario_id uuid)
  SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.listar_escala(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.listar_escala(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.listar_escala(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_escala(uuid) TO service_role;

-- Recria listar_escala em plpgsql com verificação de autenticação
CREATE OR REPLACE FUNCTION public.listar_escala(p_inventario_id UUID)
RETURNS TABLE (
    escala_id       UUID,
    papel           TEXT,
    score_final     NUMERIC,
    confirmado      BOOLEAN,
    colaborador_id  UUID,
    nome            TEXT,
    funcao          TEXT,
    cidade          TEXT,
    matricula       TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Não autenticado: listar_escala requer sessão válida'
            USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT
        e.id            AS escala_id,
        e.papel,
        e.score_final,
        e.confirmado,
        c.id            AS colaborador_id,
        c.nome,
        c.funcao,
        c.cidade,
        c.matricula
    FROM public.escala e
    INNER JOIN public.colaboradores c ON c.id = e.colaborador_id
    WHERE e.inventario_id = p_inventario_id
    ORDER BY
        CASE e.papel
            WHEN 'LIDER'        THEN 1
            WHEN 'CONFERENTE'   THEN 2
            WHEN 'RESERVA'      THEN 3
        END,
        e.score_final DESC;
END;
$$;

COMMENT ON FUNCTION public.listar_escala(UUID) IS
  'Lista escala de um inventário. SECURITY DEFINER; exige auth.uid(); sem EXECUTE para anon/PUBLIC.';

REVOKE ALL ON FUNCTION public.listar_escala(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.listar_escala(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.listar_escala(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_escala(uuid) TO service_role;
