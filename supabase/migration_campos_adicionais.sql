-- =============================================================================
-- InventExpert — Migration: Campos Adicionais
-- Aplica os campos referenciados no módulo CRUD que não existiam no schema_v2.
--
-- Execute este ficheiro APÓS o schema_v2.sql e functions.sql.
-- SQL Editor do Supabase: Database > SQL Editor
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. CLIENTES — Campos adicionais de negócio
-- -----------------------------------------------------------------------------

-- Código único da loja (ex: "SP-001", "RJ-042")
ALTER TABLE public.clientes
    ADD COLUMN IF NOT EXISTS codigo_loja TEXT;

-- Garante unicidade do código (NULL é permitido; apenas valores preenchidos são únicos)
CREATE UNIQUE INDEX IF NOT EXISTS uq_clientes_codigo_loja
    ON public.clientes (codigo_loja)
    WHERE codigo_loja IS NOT NULL;

-- Contacto da loja
ALTER TABLE public.clientes
    ADD COLUMN IF NOT EXISTS telefone TEXT;

-- Segmento de operação do cliente
ALTER TABLE public.clientes
    ADD COLUMN IF NOT EXISTS segmento TEXT
    CHECK (segmento IN ('FARMACIA', 'SUPERMERCADO', 'LOJA_GERAL'));

-- Índice para busca por segmento
CREATE INDEX IF NOT EXISTS idx_clientes_segmento
    ON public.clientes (segmento);

-- Índice trigramas para busca fuzzy por código de loja
CREATE INDEX IF NOT EXISTS idx_clientes_codigo_loja_trgm
    ON public.clientes USING GIN (codigo_loja gin_trgm_ops)
    WHERE codigo_loja IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 2. COLABORADORES — Campos adicionais de negócio
-- -----------------------------------------------------------------------------

-- Telefone / WhatsApp (obrigatório por regra de negócio, mas nullable no banco
-- para compatibilidade retroativa com registos existentes)
ALTER TABLE public.colaboradores
    ADD COLUMN IF NOT EXISTS telefone TEXT;

-- Data de nascimento (para cálculo de senioridade e outros relatórios)
ALTER TABLE public.colaboradores
    ADD COLUMN IF NOT EXISTS data_nascimento DATE;

-- -----------------------------------------------------------------------------
-- 3. INVENTÁRIOS — Campo de tipo de agendamento (coluna definitiva)
-- Até esta migration ser aplicada, o tipo é persistido como prefixo
-- nas observações pelo módulo TypeScript.
-- Após a migration, a service pode gravar neste campo directamente.
-- -----------------------------------------------------------------------------

ALTER TABLE public.inventarios
    ADD COLUMN IF NOT EXISTS tipo_agendamento TEXT
    CHECK (tipo_agendamento IN ('JANELA', 'FIXO'));

-- Índice para filtrar por tipo de agendamento
CREATE INDEX IF NOT EXISTS idx_inventarios_tipo_agendamento
    ON public.inventarios (tipo_agendamento);

-- Migração de dados existentes: extrai tag das observações para o novo campo
UPDATE public.inventarios
SET tipo_agendamento = CASE
    WHEN observacoes ILIKE '[JANELA]%' THEN 'JANELA'
    WHEN observacoes ILIKE '[FIXO]%'   THEN 'FIXO'
    ELSE NULL
END
WHERE tipo_agendamento IS NULL;

-- =============================================================================
-- COMENTÁRIOS DE COLUNA
-- =============================================================================

COMMENT ON COLUMN public.clientes.codigo_loja IS
    'Código único da loja no sistema do cliente. Tratado sempre como texto.';

COMMENT ON COLUMN public.clientes.telefone IS
    'Telefone de contacto da loja.';

COMMENT ON COLUMN public.clientes.segmento IS
    'Segmento de negócio: FARMACIA, SUPERMERCADO ou LOJA_GERAL.';

COMMENT ON COLUMN public.colaboradores.telefone IS
    'Telefone / WhatsApp do colaborador. Obrigatório por regra de negócio.';

COMMENT ON COLUMN public.colaboradores.data_nascimento IS
    'Data de nascimento para cálculo de senioridade e relatórios.';

COMMENT ON COLUMN public.inventarios.tipo_agendamento IS
    'JANELA: inventário urgente (≤ 7 dias). FIXO: planeado (> 7 dias). Calculado automaticamente.';
