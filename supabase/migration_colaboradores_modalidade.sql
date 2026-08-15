-- =============================================================================
-- Modalidade de contratação por colaborador
--
-- Motivo
-- ------
-- O relatório individual de avaliação muda de linguagem conforme o vínculo:
-- CLT admite menção a medida disciplinar e ao Código de Conduta; intermitente
-- fala em convocações futuras; prestador de serviço não pode receber nenhuma
-- das duas, sob pena de o documento sugerir subordinação onde ela não existe.
--
-- Até aqui o campo não existia em lugar nenhum e o gerador de relatório caía no
-- default 'CLT' para todo mundo — inclusive para quem não tem vínculo.
--
-- Escopo
-- ------
-- Patch migration. Não altera nada do que já foi aplicado.
-- A coluna nasce NULL de propósito: nulo significa "ainda não conferido", e o
-- app bloqueia o processamento da avaliação enquanto houver conferente sem
-- modalidade. Um default aqui reintroduziria em silêncio o problema que a
-- migration existe para resolver.
-- =============================================================================

ALTER TABLE public.colaboradores
  ADD COLUMN IF NOT EXISTS modalidade TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'colaboradores_modalidade_check'
  ) THEN
    ALTER TABLE public.colaboradores
      ADD CONSTRAINT colaboradores_modalidade_check
      CHECK (modalidade IS NULL OR modalidade IN ('CLT', 'INTERMITENTE', 'FREE'));
  END IF;
END $$;

COMMENT ON COLUMN public.colaboradores.modalidade IS
  'CLT, INTERMITENTE ou FREE. NULL = ainda não conferido; o app exige a '
  'marcação antes de gerar avaliação. Define a linguagem do relatório '
  'individual — FREE nunca recebe termos de vínculo empregatício.';

-- Quem marcou e quando. Uma reclassificação de vínculo precisa ser rastreável.
ALTER TABLE public.colaboradores
  ADD COLUMN IF NOT EXISTS modalidade_atualizada_em TIMESTAMPTZ;

ALTER TABLE public.colaboradores
  ADD COLUMN IF NOT EXISTS modalidade_atualizada_por TEXT;

CREATE INDEX IF NOT EXISTS idx_colaboradores_modalidade
  ON public.colaboradores (modalidade)
  WHERE modalidade IS NOT NULL;

-- -----------------------------------------------------------------------------
-- Upsert usado pela tela de marcação.
--
-- O conferente pode aparecer no relatório de produtividade sem estar cadastrado
-- em `colaboradores` (equipe montada na hora, prestador de uma praça só). Então
-- a função insere quando não existe, em vez de falhar.
--
-- `cidade` e `estado` são obrigatórios na tabela e não vêm do relatório de
-- produtividade; entram como '-' e 'XX' até que o cadastro seja completado pela
-- tela de Gestão. Marcar o vínculo não pode depender de dados de escala.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.definir_modalidade_colaborador(
  p_matricula  TEXT,
  p_nome       TEXT,
  p_modalidade TEXT,
  p_por        TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_modalidade IS NOT NULL
     AND p_modalidade NOT IN ('CLT', 'INTERMITENTE', 'FREE') THEN
    RAISE EXCEPTION 'Modalidade inválida: %', p_modalidade;
  END IF;

  INSERT INTO public.colaboradores (
    matricula, nome, funcao, cidade, estado,
    modalidade, modalidade_atualizada_em, modalidade_atualizada_por
  )
  VALUES (
    p_matricula, p_nome, 'CONFERENTE', '-', 'XX',
    p_modalidade, NOW(), p_por
  )
  ON CONFLICT (matricula) DO UPDATE SET
    modalidade               = EXCLUDED.modalidade,
    modalidade_atualizada_em = NOW(),
    modalidade_atualizada_por = EXCLUDED.modalidade_atualizada_por,
    updated_at               = NOW();
END $$;

REVOKE ALL ON FUNCTION public.definir_modalidade_colaborador(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.definir_modalidade_colaborador(TEXT, TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.definir_modalidade_colaborador(TEXT, TEXT, TEXT, TEXT)
  TO authenticated, service_role;
