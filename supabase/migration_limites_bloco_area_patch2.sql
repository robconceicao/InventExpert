-- =============================================================================
-- InventExpert — Patch 2: revisão dos limites de bloco (FARMACIA)
-- Data: 2026-08-18 | Base: docs/LIMITES_BLOCO_FARMACIA.md
-- =============================================================================
-- NÃO edita migration_limites_bloco_area.sql nem o patch1 — os dois já estão
-- aplicados. Este patch faz upsert por cima.
--
-- Calibrado contra o inventário DPSP L2601 (06/08/2026 · 25 áreas · 1.054
-- seções · 53.628 peças · 15 conferentes), cruzando PROD_SEÇÃO (densidade
-- peças/seção) com RELATORIOS/BLOCO.xls (bloco% observado por área).
--
-- Três grupos de mudança:
--   1) Áreas reais que NUNCA tiveram cadastro — PSICO, THERMOLABS, VACINAS e
--      as variantes de nome das paredes, ilhas e estoques. Sem linha na tabela
--      a regra é "não penalizar", então o bloco dessas áreas jamais foi
--      verificado. Três delas são de tolerância zero.
--   2) Limites revistos com decisão do gestor: BALCÃO e ATRÁS DO CAIXA saem de
--      "sem limite"/90% para 20%; CARTELADO cai de 100% para 70%; ILHAS sobe
--      de 30% para 50%; DERMO sobe de 5% para 10%.
--   3) P INFANTIL passa a área crítica, acompanhando P DERMO.
--
-- Regra inalterada: ausência de registro = sem penalidade.
-- limite_pct = 9999 = sem limite definido. Nenhuma linha usa mais esse valor.
-- =============================================================================

INSERT INTO limites_bloco_area (tipo_operacao, nome_area, limite_pct, area_critica) VALUES

-- ---------------------------------------------------------------------------
-- Tolerância zero (ANVISA / Portaria 344-98 / cadeia de frio)
-- ---------------------------------------------------------------------------
('FARMACIA', 'ANTIBIÓTICOS',                    0.00, TRUE),
('FARMACIA', 'AVARIAS E VENCIDOS',              0.00, TRUE),
('FARMACIA', 'MEDICAMENTOS',                    0.00, TRUE),
('FARMACIA', 'PSICOTRÓPICOS',                   0.00, TRUE),
-- Nome usado no campo (L2601). Sem esta linha, 54 seções e 2.301 peças de
-- psicotrópico ficavam sem verificação de bloco.
('FARMACIA', 'PSICO',                           0.00, TRUE),
('FARMACIA', 'TERMOLÁBEIS',                     0.00, TRUE),
('FARMACIA', 'THERMOLABS',                      0.00, TRUE),
-- Vacina é cadeia de frio: EAN varia por concentração e o item é de alto valor.
('FARMACIA', 'VACINAS',                         0.00, TRUE),
('FARMACIA', 'CAIXAS',                          0.00, TRUE),
('FARMACIA', 'GELADEIRAS MEDICAMENTOS',         0.00, TRUE),
('FARMACIA', 'SALA DE APLICAÇÃO',               0.00, TRUE),

-- ---------------------------------------------------------------------------
-- OTC — 5%, alerta formal
-- ---------------------------------------------------------------------------
('FARMACIA', 'MEDICAMENTOS OTC',                5.00, TRUE),
('FARMACIA', 'OTC / MIP (CAIXA)',               5.00, TRUE),

-- ---------------------------------------------------------------------------
-- Dermo e infantil — 5% → 10%, mantendo area_critica
-- ---------------------------------------------------------------------------
-- 10% cobre o pack promocional de 2–3 unidades, que 5% penalizava sem motivo.
-- area_critica fica TRUE de propósito: o alerta formal dispara por
-- "crítica OU limite <= 5%", e subir o limite sem o flag apagaria a
-- visibilidade junto com ele. São as áreas com os SKUs mais parecidos entre si
-- (linhas de 8 a 15 itens quase idênticos) e o maior valor unitário da loja.
('FARMACIA', 'P DERMO',                        10.00, TRUE),
('FARMACIA', 'PAREDE DERMO',                   10.00, TRUE),
('FARMACIA', 'P INFANTIL',                     10.00, TRUE),
('FARMACIA', 'PAREDE INFANTIL',                10.00, TRUE),
('FARMACIA', 'SUPLEMENTOS / VITAMINAS',        10.00, FALSE),

-- ---------------------------------------------------------------------------
-- Gôndolas — 15%
-- ---------------------------------------------------------------------------
-- RUA n, R n, G n, com ou sem FRENTE/FUNDO, casam todas com estas linhas via
-- canonizarGondola(). Frente e fundo são dois lados do mesmo móvel e herdam o
-- mesmo limite.
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

-- ---------------------------------------------------------------------------
-- Balcão e atrás do caixa — 20%
-- ---------------------------------------------------------------------------
-- BALCÃO DE ATENDIMENTO estava como 9999 (sem limite), a entrada mais
-- permissiva da tabela. No L2601 o balcão tem 28 seções e 1.426 peças em 4
-- conferentes: é ponto de venda com mercadoria, não mobiliário. Nenhuma área
-- do evento se chama OTC, e o OTC da loja está fisicamente aqui.
('FARMACIA', 'BALCÃO DE ATENDIMENTO',          20.00, FALSE),
('FARMACIA', 'BALCAO',                         20.00, FALSE),
('FARMACIA', 'ATRÁS DE CAIXA',                 20.00, FALSE),
('FARMACIA', 'ATRAS DO CAIXA',                 20.00, FALSE),

-- ---------------------------------------------------------------------------
-- Ilhas — 30% → 50%
-- ---------------------------------------------------------------------------
-- Ilha é pilha de SKU único por definição; 75 peças/seção no L2601.
('FARMACIA', 'ILHAS',                          50.00, FALSE),
('FARMACIA', 'ILHAS FRENTE DE LOJA',           50.00, FALSE),
('FARMACIA', 'ILHAS FUNDO',                    50.00, FALSE),

-- ---------------------------------------------------------------------------
-- Cartelado — 100% → 70%
-- ---------------------------------------------------------------------------
-- Medicamento fora da caixa, solto na gancheira: contar peça a peça é
-- inviável e o limite reconhece isso. 70% e não 100% porque a mercadoria é
-- OTC (54% analgésicos, 17% medicamentos em geral, 11% genéricos OTC no
-- L2601) e a área tem a maior densidade da loja — 153,8 peças/seção.
-- Os três nomes descrevem a mesma parede e por isso carregam o mesmo número:
-- deixar MEDICAMENTOS CARTELADOS em 30% faria o limite depender de qual nome
-- a loja escolheu cadastrar.
('FARMACIA', 'CARTELADO',                      70.00, FALSE),
('FARMACIA', 'PAREDE CARTELADO',               70.00, FALSE),
('FARMACIA', 'MEDICAMENTOS CARTELADOS',        70.00, FALSE),

-- ---------------------------------------------------------------------------
-- Estoque e frente de caixa — inalterados
-- ---------------------------------------------------------------------------
-- Caixa fechada traz a quantidade impressa: o bloco aqui é a forma correta.
('FARMACIA', 'ESTOQUE',                        80.00, FALSE),
('FARMACIA', 'ESTOQUE 2',                      80.00, FALSE),
('FARMACIA', 'ESTOQUE 3',                      80.00, FALSE),
('FARMACIA', 'ESTOQUE FRENTE',                 80.00, FALSE),
('FARMACIA', 'ESTOQUE FUNDOS',                 80.00, FALSE),
('FARMACIA', 'ESTOQUE FRENTE DE CAIXA',        90.00, FALSE),
('FARMACIA', 'FRENTE DE CAIXA',                90.00, FALSE),
('FARMACIA', 'GELADEIRAS FRENTE CAIXA',       100.00, FALSE),
('FARMACIA', 'SORVETES',                      100.00, FALSE),

-- Bucket da auditoria dirigida — não é área física, não penaliza ninguém.
('FARMACIA', 'NÃO CONTADOS',                  100.00, FALSE)

ON CONFLICT (tipo_operacao, nome_area) DO UPDATE SET
  limite_pct   = EXCLUDED.limite_pct,
  area_critica = EXCLUDED.area_critica;

-- =============================================================================
-- Conferência pós-aplicação
-- =============================================================================
-- Nenhuma área deve continuar em 9999:
--   SELECT nome_area FROM limites_bloco_area
--    WHERE tipo_operacao = 'FARMACIA' AND limite_pct >= 9999;
--
-- As 24 áreas reais do L2601 devem estar cobertas (TESTE fica de fora por
-- decisão — é área de teste do coletor e vai para a aba Ressalvas):
--   SELECT nome_area, limite_pct, area_critica FROM limites_bloco_area
--    WHERE tipo_operacao = 'FARMACIA' ORDER BY limite_pct, nome_area;
