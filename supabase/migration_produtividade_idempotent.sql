-- =============================================================================
-- InventExpert — Patch: produtividade idempotente (InventExp publish)
-- =============================================================================
-- Permite re-publicar scores sem duplicar histórico do mesmo
-- (colaborador + data + inventario_ref).
-- inventario_ref vazio → '' (não NULL) para unicidade estável.
-- =============================================================================

-- Normaliza refs nulas
UPDATE public.produtividade
SET inventario_ref = ''
WHERE inventario_ref IS NULL;

ALTER TABLE public.produtividade
  ALTER COLUMN inventario_ref SET DEFAULT '';

-- Antes do índice único: remove duplicatas mantendo o mais recente
DELETE FROM public.produtividade a
USING public.produtividade b
WHERE a.colaborador_id = b.colaborador_id
  AND a.data_inventario = b.data_inventario
  AND COALESCE(a.inventario_ref, '') = COALESCE(b.inventario_ref, '')
  AND a.created_at < b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS uq_produtividade_colab_data_ref
  ON public.produtividade (colaborador_id, data_inventario, inventario_ref);

COMMENT ON INDEX public.uq_produtividade_colab_data_ref IS
  'Idempotência de publicação InventExp / histórico de performance.';
