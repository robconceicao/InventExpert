-- Tabela de limites de bloco por área.
-- Ausência de registro = sem limite = sem penalidade (para operações não-farmácia).
-- limite_pct = 9999 significa "sem limite definido" (não penalizar).
CREATE TABLE IF NOT EXISTS limites_bloco_area (
  id              SERIAL PRIMARY KEY,
  tipo_operacao   VARCHAR(30)   NOT NULL,
  nome_area       VARCHAR(50)   NOT NULL,
  limite_pct      NUMERIC(5,2)  NOT NULL,
  area_critica    BOOLEAN       NOT NULL DEFAULT FALSE,
  UNIQUE (tipo_operacao, nome_area)
);

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
-- MEDICAMENTOS CARTELADOS: blísteres em pilhas uniformes — EAN idêntico, risco baixo
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
ON CONFLICT (tipo_operacao, nome_area) DO NOTHING;

-- Para SUPERMERCADO, HIPERMERCADO, LOJA_GERAL: não inserir linhas.
-- Ausência de registro = sem penalidade de bloco.
