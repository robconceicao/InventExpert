# 🗂️ Automação Backup Inventário

Aplicação desktop standalone para automatizar a geração e envio de backups de inventário do ProInv via WhatsApp Web.

---

## 📁 Estrutura do Projeto

```
BackupInventario/
├── inventario_backup_app.py   # Aplicação principal
├── config.py                  # Configurações (edite aqui)
├── requirements.txt           # Dependências Python
├── logs/                      # Logs automáticos
└── backups/                   # Backups gerados
```

---

## ⚙️ Configuração (antes do primeiro uso)

Edite o arquivo **`config.py`** e configure:

| Variável               | Descrição                               |
| ---------------------- | --------------------------------------- |
| `NOME_GRUPO_WHATSAPP`  | Nome exato do grupo WhatsApp para envio |
| `PASTA_PROINV`         | Caminho onde o ProInv grava os dados    |
| `PASTA_FOTOS_EXTERNAS` | Pasta de fotos externas (`C:\fotos`)    |
| `PASTA_BACKUPS`        | Onde salvar os arquivos .7z gerados     |

---

## 🔧 Instalação das Dependências

### 1. Instalar o Python

Baixe e instale o Python 3.11+ em: https://www.python.org/downloads/

> ✅ Durante a instalação, marque a opção **"Add Python to PATH"**

### 2. Instalar o 7-Zip

Baixe e instale em: https://www.7-zip.org/

- Instale no caminho padrão: `C:\Program Files\7-Zip\`

### 3. Instalar dependências Python

Abra o **Prompt de Comando** (cmd) na pasta do projeto e execute:

```cmd
pip install -r requirements.txt
```

---

## ▶️ Como Executar

```cmd
python inventario_backup_app.py
```

---

## 📦 Gerar Executável Windows (.exe)

Para distribuir em notebooks de campo sem precisar instalar Python:

### 1. Instale o PyInstaller:

```cmd
pip install pyinstaller
```

### 2. Gere o executável:

```cmd
pyinstaller --onefile --windowed --name "BackupInventario" inventario_backup_app.py
```

### 3. O arquivo gerado estará em:

```
dist\BackupInventario.exe
```

> ⚠️ **Importante:** Copie também o arquivo `config.py` para a mesma pasta do `.exe` antes de distribuir.

---

## 🖥️ Como Usar

1. **Clique em "INICIAR INVENTÁRIO"** — registra o início
2. **Realize o inventário normalmente no ProInv**
3. **Clique em "FINALIZAR INVENTÁRIO"** — o sistema automaticamente:
   - Detecta o cliente e número da loja
   - Mapeia e compacta os dados em `.7z`
   - Abre o WhatsApp Web
   - Anexa e envia o arquivo no grupo

---

## 📝 Nome do Arquivo Gerado

```
Backup_NomeCliente_NumeroLoja_DDMMYYYY.7z
Exemplo: Backup_FarmaConde_268_30012026.7z
```

---

## ❗ Resolução de Problemas

| Erro                            | Solução                                         |
| ------------------------------- | ----------------------------------------------- |
| `7-Zip não encontrado`          | Instale o 7-Zip no caminho padrão               |
| `ArqFinal_*.csv não encontrado` | Verifique se o inventário foi salvo pelo ProInv |
| `pyautogui não instalado`       | Execute `pip install pyautogui`                 |
| Grupo WhatsApp não encontrado   | Verifique o nome exato em `config.py`           |
| WhatsApp não abre               | Garanta que o Chrome/Edge está instalado        |

---

## 📋 Requisitos do Sistema

- Windows 10/11
- Python 3.11+
- 7-Zip instalado
- Google Chrome ou Microsoft Edge (para WhatsApp Web)
- WhatsApp configurado no navegador padrão
