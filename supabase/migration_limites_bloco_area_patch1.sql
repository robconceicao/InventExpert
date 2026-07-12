-- =============================================================================
-- InventExpert — Patch 1: limites_bloco_area + secao_lookup (hardening)
-- Data: 2026-07-12 | Fase 1 do overhaul Avaliação v2.1
-- =============================================================================
-- NÃO edita migration_limites_bloco_area.sql nem migration_secao_lookup.sql.
-- Objetivos:
--   1) Upsert do seed canônico (corrige ambientes com seed parcial/errado)
--   2) Alias de área visto em config legada: OTC / MIP (CAIXA) → mesmo limite de OTC
--   3) RLS + policies de leitura para usuários autenticados (padrão schema_v2)
--   4) Comentários de documentação nas tabelas
--
-- Regra de negócio: ausência de registro em limites_bloco_area = sem penalidade.
-- limite_pct = 9999 = sem limite definido (não penalizar).
-- SUPERMERCADO / HIPERMERCADO / LOJA_GERAL / ATACADO: sem linhas de seed.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Seed canônico (upsert) — valores = migration base + alias OTC
-- ---------------------------------------------------------------------------
INSERT INTO limites_bloco_area (tipo_operacao, nome_area, limite_pct, area_critica) VALUES
-- Proibido — tolerância zero (ANVISA/SNGPC)
('FARMACIA', 'ANTIBIÓTICOS',                    0.00, TRUE),
('FARMACIA', 'AVARIAS E VENCIDOS',              0.00, TRUE),
('FARMACIA', 'MEDICAMENTOS',                    0.00, TRUE),
('FARMACIA', 'PSICOTRÓPICOS',                   0.00, TRUE),
('FARMACIA', 'TERMOLÁBEIS',                     0.00, TRUE),
('FARMACIA', 'CAIXAS',                          0.00, TRUE),
('FARMACIA', 'GELADEIRAS MEDICAMENTOS',         0.00, TRUE),
('FARMACIA', 'SALA DE APLICAÇÃO',               0.00, TRUE),
-- Crítico — tolerância muito baixa
('FARMACIA', 'MEDICAMENTOS OTC',                5.00, TRUE),
('FARMACIA', 'P DERMO',                         5.00, TRUE),
-- Alias legado (config antiga / XLS de campo) — mesmo critério de MEDICAMENTOS OTC
('FARMACIA', 'OTC / MIP (CAIXA)',               5.00, TRUE),
-- Com limite — não-críticas
('FARMACIA', 'P INFANTIL',                     10.00, FALSE),
('FARMACIA', 'SUPLEMENTOS / VITAMINAS',        10.00, FALSE),
('FARMACIA', 'G 1',                            15.00, FALSE),
('FARMACIA', 'G 2',                            15.00, FALSE),
('FARMACIA', 'G 3',                            15.00, FALSE),
('FARMACIA', 'G 4',                            15.00, FALSE),
('FARMACIA', 'G 5',                            15.00, FALSE),
('FARMACIA', 'G 6',                            15.00, FALSE),
('FARMACIA', 'G 7',                            15.00, FALSE),
('FARMACIA', 'G 8',                            15.00, FALSE),
('FARMACIA', 'G 9',                            15.00, FALSE),
('FARMACIA', 'G 10',                           15.00, FALSE),
('FARMACIA', 'P PERFUMARIA / COSMÉTICOS',      15.00, FALSE),
('FARMACIA', 'MEDICAMENTOS CARTELADOS',        30.00, FALSE),
('FARMACIA', 'ILHAS',                          30.00, FALSE),
('FARMACIA', 'ESTOQUE',                        80.00, FALSE),
('FARMACIA', 'ESTOQUE 2',                      80.00, FALSE),
('FARMACIA', 'ESTOQUE 3',                      80.00, FALSE),
('FARMACIA', 'ESTOQUE FRENTE DE CAIXA',        90.00, FALSE),
('FARMACIA', 'FRENTE DE CAIXA',                90.00, FALSE),
('FARMACIA', 'ATRÁS DE CAIXA',                 90.00, FALSE),
('FARMACIA', 'GELADEIRAS FRENTE CAIXA',       100.00, FALSE),
('FARMACIA', 'SORVETES',                      100.00, FALSE),
('FARMACIA', 'CARTELADO',                     100.00, FALSE),
('FARMACIA', 'NÃO CONTADOS',                  100.00, FALSE),
('FARMACIA', 'BALCÃO DE ATENDIMENTO',        9999.00, FALSE)
ON CONFLICT (tipo_operacao, nome_area) DO UPDATE SET
  limite_pct   = EXCLUDED.limite_pct,
  area_critica = EXCLUDED.area_critica;

-- ---------------------------------------------------------------------------
-- 2. Comentários
-- ---------------------------------------------------------------------------
COMMENT ON TABLE limites_bloco_area IS
  'Limites de % bloco por área e tipo de operação. Ausência de linha = sem penalidade. limite_pct=9999 = sem limite.';

COMMENT ON COLUMN limites_bloco_area.limite_pct IS
  'Percentual máximo de contagem em bloco. 0 = proibido; 9999 = sem limite definido.';

COMMENT ON COLUMN limites_bloco_area.area_critica IS
  'TRUE se violação gera alerta formal (ANVISA/SNGPC ou limite <= 5%).';

COMMENT ON TABLE secao_lookup IS
  'Mapeamento codigo_secao (6 dígitos do .prc) → nome canônico de área. Popular por evento a partir do PRODUÇÃO_SEÇÃO.';

-- ---------------------------------------------------------------------------
-- 3. RLS — leitura para autenticados (mesma política do schema_v2)
-- ---------------------------------------------------------------------------
ALTER TABLE limites_bloco_area ENABLE ROW LEVEL SECURITY;
ALTER TABLE secao_lookup ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados podem ver limites_bloco_area" ON limites_bloco_area;
CREATE POLICY "Autenticados podem ver limites_bloco_area"
  ON limites_bloco_area
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Autenticados podem ver secao_lookup" ON secao_lookup;
CREATE POLICY "Autenticados podem ver secao_lookup"
  ON secao_lookup
  FOR SELECT
  TO authenticated
  USING (true);

-- Escrita de secao_lookup (popular após evento) — apenas autenticados
DROP POLICY IF EXISTS "Autenticados podem gerenciar secao_lookup" ON secao_lookup;
CREATE POLICY "Autenticados podem gerenciar secao_lookup"
  ON secao_lookup
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- limites_bloco_area: leitura ampla; escrita restrita a service_role (padrão Supabase)
-- Não criar policy de INSERT/UPDATE para authenticated — seed via migration/SQL Editor.
