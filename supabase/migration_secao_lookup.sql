CREATE TABLE IF NOT EXISTS secao_lookup (
  codigo_secao  VARCHAR(6)   NOT NULL,
  nome_area     VARCHAR(50)  NOT NULL,
  tipo_operacao VARCHAR(30)  NOT NULL DEFAULT 'FARMACIA',
  PRIMARY KEY (codigo_secao, tipo_operacao)
);
-- Popular com os dados reais do PRODUÇÃO_SEÇÃO.xls após cada evento.
