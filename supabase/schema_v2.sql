-- =============================================================================
-- InventExpert — Schema v2
-- Engine de Escalas Automáticas
-- =============================================================================
-- Executa no SQL Editor do Supabase (Database > SQL Editor)
-- Compatível com PostgreSQL 15+ / Supabase
-- =============================================================================

-- Extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- Busca por nome (fuzzy)

-- =============================================================================
-- 1. CLIENTES
-- Lojas / clientes para os quais os inventários são realizados.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.clientes (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome        TEXT NOT NULL,
    cidade      TEXT NOT NULL,
    estado      CHAR(2) NOT NULL,
    endereco    TEXT,
    ativo       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.clientes IS 'Lojas/empresas clientes onde são realizados os inventários.';
COMMENT ON COLUMN public.clientes.cidade IS 'Usado no cálculo do fator logístico da escala.';

-- =============================================================================
-- 2. COLABORADORES
-- Equipe de conferentes e líderes disponíveis.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.colaboradores (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    matricula       TEXT UNIQUE,
    nome            TEXT NOT NULL,
    funcao          TEXT NOT NULL CHECK (funcao IN ('LIDER', 'CONFERENTE')),
    cidade          TEXT NOT NULL,
    estado          CHAR(2) NOT NULL,
    ativo           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.colaboradores IS 'Colaboradores da equipe de inventário (líderes e conferentes).';
COMMENT ON COLUMN public.colaboradores.funcao IS 'LIDER ou CONFERENTE — define o papel na escala gerada.';
COMMENT ON COLUMN public.colaboradores.cidade IS 'Usada no fator logístico: cidade == loja → bônus de 1.2x no score.';

-- =============================================================================
-- 3. PRODUTIVIDADE
-- Histórico de performance por inventário (importado via InventExp).
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.produtividade (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    colaborador_id      UUID NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
    inventario_ref      TEXT,                   -- referência livre (nº loja, data)
    data_inventario     DATE NOT NULL,
    qtde                INTEGER NOT NULL DEFAULT 0 CHECK (qtde >= 0),
    qtde1a1             INTEGER NOT NULL DEFAULT 0 CHECK (qtde1a1 >= 0),
    produtividade_ph    NUMERIC(10, 2) NOT NULL DEFAULT 0,  -- itens/hora
    erro                INTEGER NOT NULL DEFAULT 0 CHECK (erro >= 0),
    horas_estimadas     NUMERIC(5, 2),
    operacao_tipo       TEXT CHECK (operacao_tipo IN ('FARMACIA', 'SUPERMERCADO', 'LOJA_GERAL')),
    score_final         NUMERIC(5, 2),          -- score calculado pelo InventExp
    nivel               TEXT,                   -- 'EXCELENTE', 'BOM', 'ATENCAO', 'CRITICO'
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.produtividade IS 'Histórico de performance dos colaboradores por inventário.';
COMMENT ON COLUMN public.produtividade.produtividade_ph IS 'Produtividade em itens por hora (itens/h).';
COMMENT ON COLUMN public.produtividade.erro IS 'Quantidade absoluta de divergências encontradas.';

-- =============================================================================
-- 4. INVENTARIOS
-- Inventários agendados (futuros, em andamento ou concluídos).
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.inventarios (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id      UUID NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
    data            DATE NOT NULL,
    hora_inicio     TIME,
    tipo_operacao   TEXT NOT NULL DEFAULT 'LOJA_GERAL'
                        CHECK (tipo_operacao IN ('FARMACIA', 'SUPERMERCADO', 'LOJA_GERAL')),
    headcount       INTEGER NOT NULL DEFAULT 1 CHECK (headcount >= 1),  -- Nº de conferentes (sem líder/reservas)
    status          TEXT NOT NULL DEFAULT 'AGENDADO'
                        CHECK (status IN ('AGENDADO', 'EM_ANDAMENTO', 'CONCLUIDO', 'CANCELADO')),
    observacoes     TEXT,
    created_by      UUID REFERENCES auth.users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.inventarios IS 'Inventários agendados. O headcount define o número de conferentes necessários.';
COMMENT ON COLUMN public.inventarios.headcount IS 'Número de conferentes necessários (excluindo líder e 2 reservas).';

-- =============================================================================
-- 5. ESCALA
-- Equipe selecionada para cada inventário (gerada automaticamente).
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.escala (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inventario_id   UUID NOT NULL REFERENCES public.inventarios(id) ON DELETE CASCADE,
    colaborador_id  UUID NOT NULL REFERENCES public.colaboradores(id) ON DELETE RESTRICT,
    papel           TEXT NOT NULL CHECK (papel IN ('LIDER', 'CONFERENTE', 'RESERVA')),
    score_final     NUMERIC(10, 4),             -- score usado na seleção
    gerado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmado      BOOLEAN NOT NULL DEFAULT FALSE,
    observacoes     TEXT,

    -- Garantia: um colaborador NÃO pode ter dois papéis no mesmo inventário
    CONSTRAINT uq_escala_colaborador_inventario
        UNIQUE (inventario_id, colaborador_id)
);

COMMENT ON TABLE public.escala IS 'Escala de colaboradores por inventário. Gerada automaticamente pelo motor.';
COMMENT ON COLUMN public.escala.papel IS 'LIDER, CONFERENTE ou RESERVA.';
COMMENT ON COLUMN public.escala.score_final IS 'Score calculado pelo motor: (prod*0.7 - erro*0.3) * fator_logístico.';

-- =============================================================================
-- ÍNDICES DE PERFORMANCE
-- =============================================================================

-- Produtividade — busca por colaborador (mais frequente)
CREATE INDEX IF NOT EXISTS idx_produtividade_colaborador_id
    ON public.produtividade (colaborador_id);

-- Produtividade — busca por data (relatórios históricos)
CREATE INDEX IF NOT EXISTS idx_produtividade_data
    ON public.produtividade (data_inventario DESC);

-- Colaboradores — busca por cidade (fator logístico)
CREATE INDEX IF NOT EXISTS idx_colaboradores_cidade
    ON public.colaboradores (cidade);

-- Colaboradores — trigramas para busca fuzzy por nome
CREATE INDEX IF NOT EXISTS idx_colaboradores_nome_trgm
    ON public.colaboradores USING GIN (nome gin_trgm_ops);

-- Escala — busca de colaboradores em inventários (conflito de data)
CREATE INDEX IF NOT EXISTS idx_escala_colaborador_id
    ON public.escala (colaborador_id);

CREATE INDEX IF NOT EXISTS idx_escala_inventario_id
    ON public.escala (inventario_id);

-- Inventários — busca por data e status
CREATE INDEX IF NOT EXISTS idx_inventarios_data
    ON public.inventarios (data DESC);

CREATE INDEX IF NOT EXISTS idx_inventarios_cliente_id
    ON public.inventarios (cliente_id);

-- =============================================================================
-- TRIGGERS — updated_at automático
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_clientes_updated_at
    BEFORE UPDATE ON public.clientes
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE OR REPLACE TRIGGER trg_colaboradores_updated_at
    BEFORE UPDATE ON public.colaboradores
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE OR REPLACE TRIGGER trg_inventarios_updated_at
    BEFORE UPDATE ON public.inventarios
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- Habilita RLS em todas as tabelas.
-- Políticas básicas: usuário autenticado tem acesso total.
-- Ajustar conforme regras de papel (RBAC) no futuro.
-- =============================================================================

ALTER TABLE public.clientes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colaboradores     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtividade     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventarios       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escala            ENABLE ROW LEVEL SECURITY;

-- Políticas: acesso total para usuários autenticados
CREATE POLICY "Autenticados podem ver clientes"
    ON public.clientes FOR SELECT
    TO authenticated USING (true);

CREATE POLICY "Autenticados podem gerenciar clientes"
    ON public.clientes FOR ALL
    TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Autenticados podem ver colaboradores"
    ON public.colaboradores FOR SELECT
    TO authenticated USING (true);

CREATE POLICY "Autenticados podem gerenciar colaboradores"
    ON public.colaboradores FOR ALL
    TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Autenticados podem ver produtividade"
    ON public.produtividade FOR SELECT
    TO authenticated USING (true);

CREATE POLICY "Autenticados podem inserir produtividade"
    ON public.produtividade FOR INSERT
    TO authenticated WITH CHECK (true);

CREATE POLICY "Autenticados podem ver inventarios"
    ON public.inventarios FOR SELECT
    TO authenticated USING (true);

CREATE POLICY "Autenticados podem gerenciar inventarios"
    ON public.inventarios FOR ALL
    TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Autenticados podem ver escala"
    ON public.escala FOR SELECT
    TO authenticated USING (true);

CREATE POLICY "Autenticados podem gerenciar escala"
    ON public.escala FOR ALL
    TO authenticated USING (true) WITH CHECK (true);
