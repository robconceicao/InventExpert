# =============================================================================
# config.py — Configurações da Automação de Backup de Inventário
# =============================================================================

# ─── WHATSAPP ────────────────────────────────────────────────────────────────
# Nome EXATO do grupo no WhatsApp onde o backup será enviado
NOME_GRUPO_WHATSAPP = "Grupo Operação Backup"  # ← altere para o nome correto

# ─── CAMINHOS ────────────────────────────────────────────────────────────────
# Pasta raiz onde o ProInv grava os dados
PASTA_PROINV = r"C:\Proinv"

# Pasta de fotos externas
PASTA_FOTOS_EXTERNAS = r"C:\fotos"
SUBPASTAS_FOTOS = ["fotos_iniciais", "fotos_finais"]

# Pasta de backups gerados pela automação
PASTA_BACKUPS = r"C:\Users\robtc\InventExpert\BackupInventario\backups"

# Pasta de logs
PASTA_LOGS = r"C:\Users\robtc\InventExpert\BackupInventario\logs"

# Caminho do executável do 7-Zip
CAMINHO_7ZIP = r"C:\Program Files\7-Zip\7z.exe"

# ─── PASTAS A INCLUIR NO BACKUP ───────────────────────────────────────────────
# Pastas fixas que existem dentro da pasta do cliente
PASTAS_FIXAS = [
    "ArqFinal",
    "CadProd",
    "Capa",
    "CapaT",
    "CargaColetor",
    "CNT",
    "Coletor",
    "fotos",
    "LOG",
    "MAP",
    "Parm2",
]

# Prefixo de pastas dinâmicas (ex: "RELATORIOS FARMACONDE (648)")
PREFIXO_PASTA_RELATORIOS = "RELATORIOS"

# ─── ARQUIVOS DE BANCO DE DADOS A INCLUIR ────────────────────────────────────
# Procurados de forma case-insensitive dentro da pasta do cliente
ARQUIVOS_DB = [
    "DB_ProInv",
    "DB_ProInv_2",
    "DB_ProInv_3",
    "DB_ProInv_4",
    "Db_Proinv.mdb",
    "Db_Proinv.mdb 2",
    "Db_Proinv.mdb 3",
    "Db_Proinv.mdb 4",
]

# ─── TIMEOUTS E RETENTATIVAS ─────────────────────────────────────────────────
# Tempo máximo para aguardar o carregamento do WhatsApp Web (segundos)
TIMEOUT_WHATSAPP_CARREGAR = 60

# Tempo máximo para aguardar o upload do arquivo (segundos)
TIMEOUT_UPLOAD_ARQUIVO = 120

# Número de tentativas de reenvio em caso de falha
MAX_RETRIES = 3

# Tempo entre tentativas (segundos)
TEMPO_ENTRE_RETRIES = 10
