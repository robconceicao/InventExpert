-- =============================================================================
-- InventExpert — Patch: RLS authenticated-only (core tables)
-- =============================================================================
-- PROBLEMA (audit): schema_v2 criou policies TO public USING (true), o que
-- permite acesso anónimo (role anon) a clientes, colaboradores, produtividade,
-- inventarios e escala quando a anon key está no cliente.
--
-- SOLUÇÃO:
--   1) DROP das policies abertas
--   2) Recriar policies apenas para role authenticated
--   3) REVOKE de anon nas tabelas core (defesa em profundidade)
--
-- Executar no SQL Editor do Supabase APÓS schema_v2.
-- NÃO edita migrations já aplicadas — ficheiro de patch novo.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. CLIENTES
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Autenticados podem ver clientes" ON public.clientes;
DROP POLICY IF EXISTS "Autenticados podem gerenciar clientes" ON public.clientes;

CREATE POLICY "authenticated_select_clientes"
  ON public.clientes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated_write_clientes"
  ON public.clientes FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 2. COLABORADORES
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Autenticados podem ver colaboradores" ON public.colaboradores;
DROP POLICY IF EXISTS "Autenticados podem gerenciar colaboradores" ON public.colaboradores;

CREATE POLICY "authenticated_select_colaboradores"
  ON public.colaboradores FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated_write_colaboradores"
  ON public.colaboradores FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 3. PRODUTIVIDADE
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Autenticados podem ver produtividade" ON public.produtividade;
DROP POLICY IF EXISTS "Autenticados podem inserir produtividade" ON public.produtividade;

CREATE POLICY "authenticated_select_produtividade"
  ON public.produtividade FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated_insert_produtividade"
  ON public.produtividade FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "authenticated_update_produtividade"
  ON public.produtividade FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 4. INVENTARIOS
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Autenticados podem ver inventarios" ON public.inventarios;
DROP POLICY IF EXISTS "Autenticados podem gerenciar inventarios" ON public.inventarios;

CREATE POLICY "authenticated_select_inventarios"
  ON public.inventarios FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated_write_inventarios"
  ON public.inventarios FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 5. ESCALA
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Autenticados podem ver escala" ON public.escala;
DROP POLICY IF EXISTS "Autenticados podem gerenciar escala" ON public.escala;

CREATE POLICY "authenticated_select_escala"
  ON public.escala FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated_write_escala"
  ON public.escala FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 6. REVOKE anon (defesa em profundidade)
-- PostgREST usa roles anon / authenticated. Sem GRANT, anon não lê/escreve.
-- service_role (migrations/admin) mantém bypass de RLS.
-- ---------------------------------------------------------------------------
REVOKE ALL ON TABLE public.clientes FROM anon;
REVOKE ALL ON TABLE public.colaboradores FROM anon;
REVOKE ALL ON TABLE public.produtividade FROM anon;
REVOKE ALL ON TABLE public.inventarios FROM anon;
REVOKE ALL ON TABLE public.escala FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.clientes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.colaboradores TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.produtividade TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.inventarios TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.escala TO authenticated;

-- Sequências (se existirem serials noutros patches) — safe no-op se não houver
DO $$
BEGIN
  -- nada específico para uuid_generate_v4; placeholders para serials futuros
  NULL;
END $$;

COMMENT ON POLICY "authenticated_select_clientes" ON public.clientes IS
  'Patch audit: apenas authenticated; anon revogado.';
