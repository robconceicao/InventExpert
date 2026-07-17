-- =============================================================================
-- InventExpert — Patch: gerar_escala concurrency + exclude CANCELADO
-- =============================================================================
-- 1) pg_advisory_xact_lock por data → serializa gerações no mesmo dia
-- 2) Conflito de escala ignora inventários CANCELADO
-- 3) Exige auth.uid() (SECURITY DEFINER sem caller anónimo)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.gerar_escala(p_inventario_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_inventario            RECORD;
    v_headcount             INTEGER;
    v_data_inventario       DATE;
    v_lideres_disponiveis   INTEGER;
    v_conf_disponiveis      INTEGER;
    v_lider_selecionado     UUID;
    v_total_inserido        INTEGER := 0;
    v_avisos                TEXT[] := ARRAY[]::TEXT[];
BEGIN
    -- Apenas utilizadores autenticados (RPC via PostgREST)
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Não autenticado: gerar_escala requer sessão válida'
            USING ERRCODE = '42501';
    END IF;

    SELECT i.*, c.cidade AS cliente_cidade, c.nome AS cliente_nome
    INTO v_inventario
    FROM public.inventarios i
    INNER JOIN public.clientes c ON c.id = i.cliente_id
    WHERE i.id = p_inventario_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Inventário não encontrado: %', p_inventario_id
            USING ERRCODE = 'P0001';
    END IF;

    IF v_inventario.status = 'CANCELADO' THEN
        RAISE EXCEPTION 'Não é possível gerar escala para inventário CANCELADO: %', p_inventario_id
            USING ERRCODE = 'P0003';
    END IF;

    v_headcount       := v_inventario.headcount;
    v_data_inventario := v_inventario.data;

    -- Serializa gerações concorrentes na mesma data (evita double-book)
    PERFORM pg_advisory_xact_lock(hashtext('escala:' || v_data_inventario::text));

    SELECT COUNT(*) INTO v_lideres_disponiveis
    FROM public.vw_produtividade_consolidada vpc
    WHERE vpc.funcao = 'LIDER'
      AND vpc.colaborador_id NOT IN (
          SELECT e.colaborador_id
          FROM public.escala e
          INNER JOIN public.inventarios inv ON inv.id = e.inventario_id
          WHERE inv.data = v_data_inventario
            AND e.inventario_id != p_inventario_id
            AND inv.status <> 'CANCELADO'
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
            AND inv.status <> 'CANCELADO'
      );

    IF v_lideres_disponiveis < 1 THEN
        RAISE EXCEPTION
            'Headcount insuficiente: nenhum LÍDER disponível na data % (conflito de escala).',
            v_data_inventario
            USING ERRCODE = 'P0002';
    END IF;

    IF v_conf_disponiveis < (v_headcount + 2) THEN
        v_avisos := array_append(
            v_avisos,
            FORMAT(
                'AVISO: Apenas %s conferentes disponíveis para headcount de %s + 2 reservas. Escala parcial gerada.',
                v_conf_disponiveis,
                v_headcount
            )
        );
    END IF;

    DELETE FROM public.escala WHERE inventario_id = p_inventario_id;

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
            AND inv.status <> 'CANCELADO'
      )
    ORDER BY
        (vpc.score_base * CASE WHEN vpc.cidade = v_inventario.cliente_cidade THEN 1.2 ELSE 1.0 END) DESC,
        vpc.ultimo_inventario DESC NULLS LAST
    LIMIT 1
    RETURNING colaborador_id INTO v_lider_selecionado;

    v_total_inserido := v_total_inserido + 1;

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
                AND inv.status <> 'CANCELADO'
          )
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
    v_total_inserido := v_total_inserido + 1;

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
                AND inv.status <> 'CANCELADO'
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
        RAISE EXCEPTION 'gerar_escala falhou para inventário %: % (SQLSTATE: %)',
            p_inventario_id, SQLERRM, SQLSTATE;
END;
$$;

COMMENT ON FUNCTION public.gerar_escala(UUID) IS
    'Motor de escala: 1 Líder + N Conferentes + 2 Reservas. '
    'Lock por data + exclui inventários CANCELADO (patch concurrency).';

GRANT EXECUTE ON FUNCTION public.gerar_escala(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.gerar_escala(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.gerar_escala(UUID) FROM public;
