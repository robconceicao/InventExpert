-- =============================================================================
-- InventExpert — Views & Functions
-- Motor de Geração Automática de Escalas
-- =============================================================================
-- Execute APÓS o schema_v2.sql no SQL Editor do Supabase.
-- =============================================================================

-- =============================================================================
-- VIEW: vw_produtividade_consolidada
-- Consolidação de métricas de performance por colaborador.
-- Colaboradores sem histórico recebem valores base (COALESCE para novatos).
-- =============================================================================
CREATE OR REPLACE VIEW public.vw_produtividade_consolidada AS
SELECT
    c.id                                                AS colaborador_id,
    c.nome,
    c.funcao,
    c.cidade,
    c.ativo,

    -- Total de inventários realizados
    COUNT(p.id)                                         AS total_inventarios,

    -- Produtividade média em itens/hora
    -- Novato (sem histórico): score base de 500 itens/h
    COALESCE(
        AVG(p.produtividade_ph) FILTER (WHERE p.produtividade_ph > 0),
        500.0
    )::NUMERIC(10, 2)                                   AS produtividade_media,

    -- Taxa de erro média: (total_erros / total_pecas) * 100
    -- Novato (sem histórico): 0.5% de erro base (conservador)
    COALESCE(
        CASE
            WHEN SUM(p.qtde) > 0
            THEN (SUM(p.erro)::NUMERIC / SUM(p.qtde)::NUMERIC) * 100
            ELSE NULL
        END,
        0.5
    )::NUMERIC(10, 4)                                   AS erro_medio_pct,

    -- Score base de performance (sem fator logístico)
    -- Fórmula: (produtividade_media * 0.7) - (erro_medio_pct * 0.3)
    COALESCE(
        (
            (COALESCE(AVG(p.produtividade_ph) FILTER (WHERE p.produtividade_ph > 0), 500.0) * 0.7)
            - (
                CASE
                    WHEN SUM(p.qtde) > 0
                    THEN (SUM(p.erro)::NUMERIC / SUM(p.qtde)::NUMERIC) * 100
                    ELSE 0.5
                END * 0.3
            )
        ),
        (500.0 * 0.7) - (0.5 * 0.3)
    )::NUMERIC(10, 4)                                   AS score_base,

    -- Última data de trabalho (para ordenação de desempate)
    MAX(p.data_inventario)                              AS ultimo_inventario

FROM
    public.colaboradores c
LEFT JOIN
    public.produtividade p ON p.colaborador_id = c.id
WHERE
    c.ativo = TRUE
GROUP BY
    c.id, c.nome, c.funcao, c.cidade, c.ativo;

COMMENT ON VIEW public.vw_produtividade_consolidada IS
    'Performance consolidada dos colaboradores. Novatos recebem score base via COALESCE.';

-- Grant para usuários autenticados lerem a view
GRANT SELECT ON public.vw_produtividade_consolidada TO authenticated;

-- =============================================================================
-- FUNCTION: gerar_escala(p_inventario_id UUID)
-- Motor de geração automática de escala.
--
-- Algoritmo:
--   1. Busca dados do inventário e valida existência.
--   2. Calcula score de cada colaborador ativo (via vw_produtividade_consolidada).
--   3. Aplica fator logístico (1.2x se mesmo cidade que a loja).
--   4. Filtra colaboradores com conflito de data (já escalados em outro inventário no mesmo dia).
--   5. Seleciona: 1 Líder, N Conferentes (headcount), 2 Reservas.
--   6. Limpa escala anterior e insere a nova seleção.
--   7. Retorna JSON com o resultado e avisos.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.gerar_escala(p_inventario_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER          -- executa com privilégios do owner para burlar RLS temporariamente
SET search_path = public
AS $$
DECLARE
    v_inventario        RECORD;
    v_cliente           RECORD;
    v_headcount         INTEGER;
    v_data_inventario   DATE;

    -- Contadores disponíveis
    v_lideres_disponiveis   INTEGER;
    v_conf_disponiveis      INTEGER;

    -- Resultado
    v_lider_selecionado     UUID;
    v_total_inserido        INTEGER := 0;
    v_avisos                TEXT[] := ARRAY[]::TEXT[];

BEGIN
    -- =========================================================================
    -- PASSO 1: Busca e valida o inventário
    -- =========================================================================
    SELECT i.*, c.cidade AS cliente_cidade, c.nome AS cliente_nome
    INTO v_inventario
    FROM public.inventarios i
    INNER JOIN public.clientes c ON c.id = i.cliente_id
    WHERE i.id = p_inventario_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Inventário não encontrado: %', p_inventario_id
            USING ERRCODE = 'P0001';
    END IF;

    v_headcount       := v_inventario.headcount;
    v_data_inventario := v_inventario.data;

    -- =========================================================================
    -- PASSO 2: CTE principal — candidatos sem conflito de data
    -- Exclui colaboradores que já possuem escala em inventário na mesma data.
    -- =========================================================================
    -- Primeiro verifica disponibilidade
    SELECT COUNT(*) INTO v_lideres_disponiveis
    FROM public.vw_produtividade_consolidada vpc
    WHERE vpc.funcao = 'LIDER'
      AND vpc.colaborador_id NOT IN (
          SELECT e.colaborador_id
          FROM public.escala e
          INNER JOIN public.inventarios inv ON inv.id = e.inventario_id
          WHERE inv.data = v_data_inventario
            AND e.inventario_id != p_inventario_id
      );

    SELECT COUNT(*) INTO v_conf_disponiveis
    FROM public.vw_produtividade_consolidada vpc
    WHERE vpc.funcao = 'CONFERENTE'
      AND vpc.colaborador_id NOT IN (
          SELECT e.colaborador_id
          FROM public.escala e
          INNER JOIN public.inventarios inv ON inv.id = e.inventario_id
          WHERE inv.data = v_data_inventario
            AND e.inventario_id != p_inventario_id
      );

    -- Validação de headcount (conferentes + 2 reservas obrigatórias)
    IF v_lideres_disponiveis < 1 THEN
        RAISE EXCEPTION
            'Headcount insuficiente: nenhum LÍDER disponível na data % (conflito de escala).',
            v_data_inventario
            USING ERRCODE = 'P0002';
    END IF;

    IF v_conf_disponiveis < (v_headcount + 2) THEN
        -- Aviso, mas não bloqueia se houver ao menos os conferentes mínimos
        v_avisos := array_append(
            v_avisos,
            FORMAT(
                'AVISO: Apenas %s conferentes disponíveis para headcount de %s + 2 reservas. Escala parcial gerada.',
                v_conf_disponiveis,
                v_headcount
            )
        );
    END IF;

    -- =========================================================================
    -- PASSO 3: Limpa escala anterior para este inventário (geração incremental)
    -- =========================================================================
    DELETE FROM public.escala WHERE inventario_id = p_inventario_id;

    -- =========================================================================
    -- PASSO 4: Seleciona e insere o LÍDER (máximo score_final com fator logístico)
    -- =========================================================================
    INSERT INTO public.escala (inventario_id, colaborador_id, papel, score_final)
    SELECT
        p_inventario_id,
        vpc.colaborador_id,
        'LIDER',
        (vpc.score_base * CASE WHEN vpc.cidade = v_inventario.cliente_cidade THEN 1.2 ELSE 1.0 END)::NUMERIC(10, 4)
    FROM public.vw_produtividade_consolidada vpc
    WHERE vpc.funcao = 'LIDER'
      AND vpc.colaborador_id NOT IN (
          SELECT e.colaborador_id FROM public.escala e
          INNER JOIN public.inventarios inv ON inv.id = e.inventario_id
          WHERE inv.data = v_data_inventario
            AND e.inventario_id != p_inventario_id
      )
    ORDER BY
        (vpc.score_base * CASE WHEN vpc.cidade = v_inventario.cliente_cidade THEN 1.2 ELSE 1.0 END) DESC,
        vpc.ultimo_inventario DESC NULLS LAST
    LIMIT 1
    RETURNING colaborador_id INTO v_lider_selecionado;

    v_total_inserido := v_total_inserido + 1;

    -- =========================================================================
    -- PASSO 5: Seleciona e insere os CONFERENTES (N = headcount)
    -- Exclui o líder já inserido e qualquer um com conflito de data.
    -- =========================================================================
    WITH candidatos_conferentes AS (
        SELECT
            vpc.colaborador_id,
            (vpc.score_base * CASE WHEN vpc.cidade = v_inventario.cliente_cidade THEN 1.2 ELSE 1.0 END) AS score_final_calculado
        FROM public.vw_produtividade_consolidada vpc
        WHERE vpc.funcao = 'CONFERENTE'
          AND vpc.colaborador_id NOT IN (
              SELECT e.colaborador_id FROM public.escala e
              INNER JOIN public.inventarios inv ON inv.id = e.inventario_id
              WHERE inv.data = v_data_inventario
                AND e.inventario_id != p_inventario_id
          )
          -- Exclui o líder já selecionado (improvável ser conferente, mas por segurança)
          AND vpc.colaborador_id != COALESCE(v_lider_selecionado, uuid_nil())
        ORDER BY score_final_calculado DESC, vpc.ultimo_inventario DESC NULLS LAST
        LIMIT v_headcount
    )
    INSERT INTO public.escala (inventario_id, colaborador_id, papel, score_final)
    SELECT
        p_inventario_id,
        cc.colaborador_id,
        'CONFERENTE',
        cc.score_final_calculado
    FROM candidatos_conferentes cc;

    GET DIAGNOSTICS v_total_inserido = ROW_COUNT;
    v_total_inserido := v_total_inserido + 1; -- inclui o líder

    -- =========================================================================
    -- PASSO 6: Seleciona e insere as 2 RESERVAS
    -- Excluídos os já inseridos nesta escala.
    -- =========================================================================
    WITH ja_inseridos AS (
        SELECT colaborador_id FROM public.escala WHERE inventario_id = p_inventario_id
    ),
    candidatos_reserva AS (
        SELECT
            vpc.colaborador_id,
            (vpc.score_base * CASE WHEN vpc.cidade = v_inventario.cliente_cidade THEN 1.2 ELSE 1.0 END) AS score_final_calculado
        FROM public.vw_produtividade_consolidada vpc
        WHERE vpc.funcao = 'CONFERENTE'
          AND vpc.colaborador_id NOT IN (SELECT colaborador_id FROM ja_inseridos)
          AND vpc.colaborador_id NOT IN (
              SELECT e.colaborador_id FROM public.escala e
              INNER JOIN public.inventarios inv ON inv.id = e.inventario_id
              WHERE inv.data = v_data_inventario
                AND e.inventario_id != p_inventario_id
          )
        ORDER BY score_final_calculado DESC, vpc.ultimo_inventario DESC NULLS LAST
        LIMIT 2
    )
    INSERT INTO public.escala (inventario_id, colaborador_id, papel, score_final)
    SELECT
        p_inventario_id,
        cr.colaborador_id,
        'RESERVA',
        cr.score_final_calculado
    FROM candidatos_reserva cr;

    -- =========================================================================
    -- PASSO 7: Conta total final e retorna resultado
    -- =========================================================================
    SELECT COUNT(*) INTO v_total_inserido
    FROM public.escala
    WHERE inventario_id = p_inventario_id;

    RETURN jsonb_build_object(
        'sucesso',          TRUE,
        'inventario_id',    p_inventario_id,
        'data',             v_data_inventario,
        'cliente',          v_inventario.cliente_nome,
        'headcount',        v_headcount,
        'total_escalados',  v_total_inserido,
        'avisos',           to_jsonb(v_avisos)
    );

EXCEPTION
    WHEN OTHERS THEN
        -- Garante rollback implícito e repropaga o erro com contexto
        RAISE EXCEPTION 'gerar_escala falhou para inventário %: % (SQLSTATE: %)',
            p_inventario_id, SQLERRM, SQLSTATE;
END;
$$;

COMMENT ON FUNCTION public.gerar_escala(UUID) IS
    'Motor de geração automática de escala. Seleciona 1 Líder + N Conferentes + 2 Reservas '
    'com base em score de performance e fator logístico de cidade.';

-- Grant: apenas autenticados podem chamar a function via RPC
GRANT EXECUTE ON FUNCTION public.gerar_escala(UUID) TO authenticated;


-- =============================================================================
-- FUNCTION AUXILIAR: listar_escala(p_inventario_id UUID)
-- Retorna a escala completa com dados dos colaboradores para o front-end.
-- =============================================================================
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
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

COMMENT ON FUNCTION public.listar_escala(UUID) IS
    'Retorna a escala de um inventário com dados completos dos colaboradores, ordenada por papel e score.';

GRANT EXECUTE ON FUNCTION public.listar_escala(UUID) TO authenticated;
