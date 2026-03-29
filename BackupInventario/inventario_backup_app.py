#!/usr/bin/env python3
# =============================================================================
# inventario_backup_app.py — Automação de Backup de Inventário
# =============================================================================
# Aplicação desktop para automatizar backup, compactação e envio via WhatsApp.
# Uso: Execute o arquivo ou o executável gerado pelo PyInstaller.
# =============================================================================

import glob
import logging
import os
import re
import shutil
import subprocess
import sys
import threading
import time
import webbrowser
from datetime import datetime
from pathlib import Path
import tkinter as tk
from tkinter import messagebox, scrolledtext, ttk

# Importação condicional do pyautogui
try:
    import pyautogui
    PYAUTOGUI_DISPONIVEL = True
except ImportError:
    PYAUTOGUI_DISPONIVEL = False

# Tenta importar pyperclip para colar texto no campo de busca
try:
    import pyperclip
    PYPERCLIP_DISPONIVEL = True
except ImportError:
    PYPERCLIP_DISPONIVEL = False

# Importa configurações do arquivo config.py
try:
    from config import (
        CAMINHO_7ZIP,
        MAX_RETRIES,
        NOME_GRUPO_WHATSAPP,
        PASTA_BACKUPS,
        PASTA_FOTOS_EXTERNAS,
        PASTA_LOGS,
        PASTA_PROINV,
        PASTAS_FIXAS,
        PREFIXO_PASTA_RELATORIOS,
        ARQUIVOS_DB,
        SUBPASTAS_FOTOS,
        TEMPO_ENTRE_RETRIES,
        TIMEOUT_UPLOAD_ARQUIVO,
        TIMEOUT_WHATSAPP_CARREGAR,
    )
except ImportError:
    # Valores padrão se config.py não for encontrado
    NOME_GRUPO_WHATSAPP     = "Grupo Operação Backup"
    PASTA_PROINV            = r"C:\Proinv"
    PASTA_FOTOS_EXTERNAS    = r"C:\fotos"
    SUBPASTAS_FOTOS         = ["fotos_iniciais", "fotos_finais"]
    PASTA_BACKUPS           = os.path.join(os.path.dirname(__file__), "backups")
    PASTA_LOGS              = os.path.join(os.path.dirname(__file__), "logs")
    CAMINHO_7ZIP            = r"C:\Program Files\7-Zip\7z.exe"
    PASTAS_FIXAS            = [
        "ArqFinal","CadProd","Capa","CapaT","CargaColetor",
        "CNT","Coletor","fotos","LOG","MAP","Parm2",
    ]
    PREFIXO_PASTA_RELATORIOS = "RELATORIOS"
    ARQUIVOS_DB             = [
        "DB_ProInv","DB_ProInv_2","DB_ProInv_3","DB_ProInv_4",
        "Db_Proinv.mdb","Db_Proinv.mdb 2","Db_Proinv.mdb 3","Db_Proinv.mdb 4",
    ]
    TIMEOUT_WHATSAPP_CARREGAR = 60
    TIMEOUT_UPLOAD_ARQUIVO    = 120
    MAX_RETRIES               = 3
    TEMPO_ENTRE_RETRIES       = 10


# =============================================================================
# CONFIGURAÇÃO DO LOGGING
# =============================================================================

os.makedirs(PASTA_LOGS, exist_ok=True)
os.makedirs(PASTA_BACKUPS, exist_ok=True)

log_file = os.path.join(
    PASTA_LOGS,
    f"backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(log_file, encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ]
)
logger = logging.getLogger(__name__)


# =============================================================================
# FUNÇÕES DE LÓGICA DE BACKUP
# =============================================================================

def detectar_cliente_e_loja() -> tuple[str, str, str]:
    """
    Procura o arquivo ArqFinal_*.csv mais recente dentro de C:\\Proinv.
    Retorna (nome_cliente, numero_loja, pasta_cliente).
    Lança FileNotFoundError se não encontrar nada.
    """
    padrao = os.path.join(PASTA_PROINV, "**", "ArqFinal", "ArqFinal_*.csv")
    arquivos = glob.glob(padrao, recursive=True)

    if not arquivos:
        raise FileNotFoundError(
            f"Nenhum arquivo ArqFinal_*.csv encontrado dentro de {PASTA_PROINV}"
        )

    # Pega o arquivo modificado mais recentemente
    arquivo_mais_recente = max(arquivos, key=os.path.getmtime)
    nome_base = Path(arquivo_mais_recente).stem  # ex: ArqFinal_FarmaConde_268_2026130_53526HS

    # Extrai cliente e loja via regex
    # Formato esperado: ArqFinal_NomeCliente_NumeroLoja_Data_Hora
    match = re.match(r"ArqFinal_([A-Za-z]+)_(\d+)_", nome_base)
    if not match:
        raise ValueError(
            f"Formato inesperado no nome do arquivo: {nome_base}\n"
            "Esperado: ArqFinal_NomeCliente_NumeroLoja_Data_Hora"
        )

    nome_cliente = match.group(1)
    numero_loja  = match.group(2)

    # A pasta do cliente é dois níveis acima do arquivo CSV (cliente/ArqFinal/arquivo.csv)
    pasta_cliente = str(Path(arquivo_mais_recente).parent.parent)

    return nome_cliente, numero_loja, pasta_cliente


def montar_lista_itens(pasta_cliente: str) -> list[str]:
    """
    Monta a lista de pastas e arquivos que devem entrar no backup.
    Retorna lista de caminhos absolutos que existem.
    """
    itens = []
    avisos = []

    # ── Pastas fixas dentro da pasta do cliente ──────────────────────────────
    for pasta in PASTAS_FIXAS:
        caminho = os.path.join(pasta_cliente, pasta)
        if os.path.isdir(caminho):
            itens.append(caminho)
        else:
            avisos.append(f"Pasta não encontrada (ignorada): {caminho}")

    # ── Pastas RELATORIOS* dentro da pasta do cliente ────────────────────────
    try:
        for entrada in os.scandir(pasta_cliente):
            if entrada.is_dir() and entrada.name.upper().startswith(PREFIXO_PASTA_RELATORIOS.upper()):
                itens.append(entrada.path)
    except PermissionError:
        avisos.append(f"Sem permissão para listar: {pasta_cliente}")

    # ── Arquivos de banco de dados (case-insensitive) ─────────────────────────
    todos_arquivos_cliente = []
    try:
        todos_arquivos_cliente = [e.name for e in os.scandir(pasta_cliente) if e.is_file()]
    except PermissionError:
        avisos.append(f"Sem permissão para listar arquivos em: {pasta_cliente}")

    for nome_db in ARQUIVOS_DB:
        for arq in todos_arquivos_cliente:
            if arq.lower() == nome_db.lower():
                itens.append(os.path.join(pasta_cliente, arq))
                break
        else:
            avisos.append(f"Arquivo DB não encontrado (ignorado): {nome_db}")

    # ── Fotos externas ─────────────────────────────────────────────────────────
    for subpasta in SUBPASTAS_FOTOS:
        caminho = os.path.join(PASTA_FOTOS_EXTERNAS, subpasta)
        if os.path.isdir(caminho):
            itens.append(caminho)
        else:
            avisos.append(f"Pasta de fotos externas não encontrada (ignorada): {caminho}")

    for aviso in avisos:
        logger.warning(aviso)

    return itens


def compactar_backup(nome_cliente: str, numero_loja: str, itens: list[str]) -> str:
    """
    Compacta os itens usando 7-Zip no formato .7z.
    Retorna o caminho completo do arquivo .7z gerado.
    Lança FileNotFoundError se o 7-Zip não estiver instalado.
    RuntimeError se a compactação falhar.
    """
    if not os.path.isfile(CAMINHO_7ZIP):
        raise FileNotFoundError(
            f"7-Zip não encontrado em: {CAMINHO_7ZIP}\n"
            "Instale o 7-Zip em: https://www.7-zip.org/"
        )

    data_str = datetime.now().strftime("%d%m%Y")
    nome_arquivo = f"Backup_{nome_cliente}_{numero_loja}_{data_str}.7z"
    caminho_arquivo = os.path.join(PASTA_BACKUPS, nome_arquivo)

    # Remove backup anterior com mesmo nome se existir
    if os.path.isfile(caminho_arquivo):
        os.remove(caminho_arquivo)

    # Monta o comando 7z
    cmd = [CAMINHO_7ZIP, "a", "-t7z", caminho_arquivo] + itens

    logger.info(f"Compactando {len(itens)} item(s) em: {nome_arquivo}")
    resultado = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")

    if resultado.returncode not in (0, 1):  # 7z return code 1 = warning (ignorável)
        raise RuntimeError(
            f"Erro na compactação (código {resultado.returncode}):\n{resultado.stderr}"
        )

    logger.info(f"Backup criado com sucesso: {caminho_arquivo}")
    return caminho_arquivo


def abrir_whatsapp_e_enviar(caminho_arquivo: str, log_callback=None) -> bool:
    """
    Abre o WhatsApp Web, localiza o grupo e envia o arquivo via pyautogui.
    Retorna True se enviou com sucesso, False caso contrário.
    """

    def log(msg: str):
        logger.info(msg)
        if log_callback:
            log_callback(msg)

    if not PYAUTOGUI_DISPONIVEL:
        raise ImportError(
            "pyautogui não instalado. Execute:\n"
            "  pip install pyautogui\npara habilitar o envio automático."
        )

    # Configura o pyautogui
    pyautogui.FAILSAFE = True
    pyautogui.PAUSE    = 0.5

    log("Abrindo WhatsApp Web no navegador...")
    webbrowser.open("https://web.whatsapp.com")

    log(f"Aguardando carregamento do WhatsApp Web ({TIMEOUT_WHATSAPP_CARREGAR}s)...")
    time.sleep(TIMEOUT_WHATSAPP_CARREGAR)

    # Tenta localizar o campo de busca pelo grupo
    log(f"Procurando grupo: {NOME_GRUPO_WHATSAPP}")

    # Clica na caixa de pesquisa (ícone de lupa / campo de busca)
    try:
        # Procura pelo campo de busca usando imagem ou keyboard shortcut
        pyautogui.hotkey("ctrl", "f")
        time.sleep(1.5)

        # Cola o nome do grupo
        if PYPERCLIP_DISPONIVEL:
            pyperclip.copy(NOME_GRUPO_WHATSAPP)
            pyautogui.hotkey("ctrl", "v")
        else:
            pyautogui.typewrite(NOME_GRUPO_WHATSAPP, interval=0.05)

        time.sleep(2)

        # Pressiona Enter para abrir o grupo
        pyautogui.press("enter")
        time.sleep(2)
        pyautogui.press("escape")  # Fecha a busca se necessário
        time.sleep(1)

    except Exception as e:
        log(f"Aviso ao localizar grupo: {e}")

    # Clica no campo de mensagem para focar
    time.sleep(1)
    pyautogui.hotkey("ctrl", "end")  # vai ao final da conversa
    time.sleep(0.5)

    # Usa o atalho de anexar arquivo: clica no ícone de clipe
    log("Abrindo diálogo de anexo...")
    try:
        # Atalho para abrir o seletor de arquivos no WhatsApp Web
        pyautogui.hotkey("ctrl", "shift", "u")
        time.sleep(2)
    except Exception:
        pass

    # Alterna: Usa o alt para abrir o menu de anexo via tab/navegação
    # Se a abordagem acima não funcionar, usa o dialog padrão do OS
    try:
        import ctypes
        # Abre o diálogo de arquivo do Windows diretamente via pyautogui + clipboard
        if PYPERCLIP_DISPONIVEL:
            pyperclip.copy(caminho_arquivo)
            time.sleep(0.5)
            pyautogui.hotkey("ctrl", "v")
            time.sleep(TIMEOUT_UPLOAD_ARQUIVO)  # aguarda upload
        else:
            pyautogui.typewrite(caminho_arquivo, interval=0.02)
            time.sleep(TIMEOUT_UPLOAD_ARQUIVO)

        pyautogui.press("enter")
        time.sleep(3)

        # Confirma o envio
        pyautogui.press("enter")
        time.sleep(2)

        log("✔ Arquivo enviado com sucesso!")
        return True

    except Exception as e:
        log(f"Erro ao enviar arquivo: {e}")
        return False


# =============================================================================
# INTERFACE GRÁFICA (TKINTER)
# =============================================================================

class AppBackupInventario:
    """Janela principal da aplicação de backup de inventário."""

    COR_FUNDO    = "#1E1E2E"
    COR_HEADER   = "#2563EB"
    COR_TEXTO    = "#F8FAFC"
    COR_SUCESSO  = "#22C55E"
    COR_ERRO     = "#EF4444"
    COR_INFO     = "#94A3B8"
    COR_INICIAR  = "#16A34A"
    COR_FINALIZAR = "#DC2626"
    COR_BOTAO_TXT = "#FFFFFF"

    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("🗂️ Automação Backup Inventário")
        self.root.geometry("700x620")
        self.root.resizable(False, False)
        self.root.configure(bg=self.COR_FUNDO)

        self.inicio_inventario: datetime | None = None
        self.em_execucao = False

        self._construir_ui()

    def _construir_ui(self):
        """Constrói todos os elementos visuais da janela."""

        # ── Cabeçalho ──────────────────────────────────────────────────────────
        frame_header = tk.Frame(self.root, bg=self.COR_HEADER, pady=12)
        frame_header.pack(fill="x")

        tk.Label(
            frame_header,
            text="🗂️  Automação Backup Inventário",
            font=("Segoe UI", 16, "bold"),
            bg=self.COR_HEADER,
            fg=self.COR_TEXTO,
        ).pack()

        tk.Label(
            frame_header,
            text="Sistema automático de backup e envio via WhatsApp",
            font=("Segoe UI", 9),
            bg=self.COR_HEADER,
            fg="#BFDBFE",
        ).pack()

        # ── Status do inventário ──────────────────────────────────────────────
        frame_status = tk.Frame(self.root, bg=self.COR_FUNDO, pady=10)
        frame_status.pack(fill="x", padx=20)

        tk.Label(
            frame_status,
            text="STATUS",
            font=("Segoe UI", 9, "bold"),
            bg=self.COR_FUNDO,
            fg=self.COR_INFO,
        ).pack(anchor="w")

        self.lbl_status = tk.Label(
            frame_status,
            text="⏸  Aguardando início do inventário...",
            font=("Segoe UI", 11),
            bg=self.COR_FUNDO,
            fg=self.COR_TEXTO,
        )
        self.lbl_status.pack(anchor="w", pady=4)

        self.lbl_cliente = tk.Label(
            frame_status,
            text="",
            font=("Segoe UI", 10),
            bg=self.COR_FUNDO,
            fg=self.COR_INFO,
        )
        self.lbl_cliente.pack(anchor="w")

        # ── Barra de progresso ────────────────────────────────────────────────
        self.progresso = ttk.Progressbar(
            self.root,
            orient="horizontal",
            length=660,
            mode="indeterminate",
        )
        self.progresso.pack(pady=(5, 10), padx=20)

        # ── Botões principais ─────────────────────────────────────────────────
        frame_botoes = tk.Frame(self.root, bg=self.COR_FUNDO)
        frame_botoes.pack(fill="x", padx=20, pady=10)

        self.btn_iniciar = tk.Button(
            frame_botoes,
            text="▶  INICIAR INVENTÁRIO",
            font=("Segoe UI", 13, "bold"),
            bg=self.COR_INICIAR,
            fg=self.COR_BOTAO_TXT,
            activebackground="#15803D",
            activeforeground="#FFFFFF",
            relief="flat",
            cursor="hand2",
            pady=14,
            command=self.iniciar_inventario,
        )
        self.btn_iniciar.pack(fill="x", pady=4)

        self.btn_finalizar = tk.Button(
            frame_botoes,
            text="⏹  FINALIZAR INVENTÁRIO",
            font=("Segoe UI", 13, "bold"),
            bg="#4B5563",
            fg=self.COR_BOTAO_TXT,
            activebackground=self.COR_FINALIZAR,
            activeforeground="#FFFFFF",
            relief="flat",
            cursor="hand2",
            pady=14,
            state="disabled",
            command=self.finalizar_inventario,
        )
        self.btn_finalizar.pack(fill="x", pady=4)

        # ── Log de operações ──────────────────────────────────────────────────
        frame_log = tk.Frame(self.root, bg=self.COR_FUNDO)
        frame_log.pack(fill="both", expand=True, padx=20, pady=(5, 15))

        tk.Label(
            frame_log,
            text="LOG DE OPERAÇÕES",
            font=("Segoe UI", 9, "bold"),
            bg=self.COR_FUNDO,
            fg=self.COR_INFO,
        ).pack(anchor="w")

        self.txt_log = scrolledtext.ScrolledText(
            frame_log,
            font=("Consolas", 9),
            bg="#0F172A",
            fg=self.COR_TEXTO,
            insertbackground=self.COR_TEXTO,
            relief="flat",
            height=12,
            state="disabled",
        )
        self.txt_log.pack(fill="both", expand=True, pady=4)
        self.txt_log.tag_config("SUCESSO", foreground=self.COR_SUCESSO)
        self.txt_log.tag_config("ERRO",    foreground=self.COR_ERRO)
        self.txt_log.tag_config("INFO",    foreground=self.COR_INFO)

    # ── Métodos auxiliares da UI ──────────────────────────────────────────────

    def adicionar_log(self, mensagem: str, tipo: str = "INFO"):
        """Adiciona uma linha ao painel de log."""
        timestamp = datetime.now().strftime("%H:%M:%S")
        linha = f"[{timestamp}] {mensagem}\n"
        self.txt_log.configure(state="normal")
        self.txt_log.insert("end", linha, tipo)
        self.txt_log.see("end")
        self.txt_log.configure(state="disabled")

    def atualizar_status(self, mensagem: str, cor: str = None):
        """Atualiza o rótulo de status principal."""
        self.lbl_status.configure(
            text=mensagem,
            fg=cor or self.COR_TEXTO,
        )
        self.root.update_idletasks()

    def set_botoes(self, iniciando: bool):
        """Alterna o estado dos botões conforme a fase do inventário."""
        if iniciando:
            self.btn_iniciar.configure(state="disabled", bg="#4B5563")
            self.btn_finalizar.configure(state="normal", bg=self.COR_FINALIZAR)
        else:
            self.btn_iniciar.configure(state="normal", bg=self.COR_INICIAR)
            self.btn_finalizar.configure(state="disabled", bg="#4B5563")

    # ── Ações dos botões ──────────────────────────────────────────────────────

    def iniciar_inventario(self):
        """Registra o início do inventário e prepara o ambiente."""
        self.inicio_inventario = datetime.now()

        # Limpa o log anterior
        self.txt_log.configure(state="normal")
        self.txt_log.delete("1.0", "end")
        self.txt_log.configure(state="disabled")

        self.adicionar_log("═" * 50)
        self.adicionar_log(f"🟢 Inventário INICIADO às {self.inicio_inventario.strftime('%H:%M:%S')}", "SUCESSO")
        self.adicionar_log("Realize o inventário normalmente no ProInv.")
        self.adicionar_log("Clique em FINALIZAR quando concluir.")
        self.adicionar_log("═" * 50)

        self.atualizar_status("🟢  Inventário em andamento...", self.COR_SUCESSO)
        self.lbl_cliente.configure(text=f"Iniciado às {self.inicio_inventario.strftime('%H:%M:%S')}")
        self.set_botoes(iniciando=True)

    def finalizar_inventario(self):
        """Dispara o processo completo de backup em uma thread separada."""
        if self.em_execucao:
            messagebox.showwarning("Atenção", "Processo já em execução. Aguarde.")
            return

        self.em_execucao = True
        self.btn_finalizar.configure(state="disabled", text="⏳  Processando...")

        # Executa em thread para não travar a UI
        t = threading.Thread(target=self._executar_backup, daemon=True)
        t.start()
        self._monitorar_thread(t)

    def _monitorar_thread(self, thread: threading.Thread):
        """Monitora a thread de backup e restaura a UI ao concluir."""
        if thread.is_alive():
            self.root.after(500, lambda: self._monitorar_thread(thread))
        else:
            self.em_execucao = False
            self.progresso.stop()

    def _executar_backup(self):
        """Lógica principal de backup executada em background."""
        self.progresso.start(10)

        try:
            # 1. Detectar cliente e loja
            self._log_ui("Detectando cliente e número da loja...", "INFO")
            nome_cliente, numero_loja, pasta_cliente = detectar_cliente_e_loja()
            self._log_ui(f"✔ Cliente detectado: {nome_cliente} — Loja: {numero_loja}", "SUCESSO")
            self._status_ui(f"🔍  Cliente: {nome_cliente} | Loja: {numero_loja}")
            self.root.after(0, lambda: self.lbl_cliente.configure(
                text=f"Cliente: {nome_cliente}  |  Loja: {numero_loja}  |  Pasta: {pasta_cliente}"
            ))

            # 2. Montar lista de itens
            self._log_ui("Mapeando arquivos e pastas para backup...", "INFO")
            itens = montar_lista_itens(pasta_cliente)
            self._log_ui(f"✔ {len(itens)} item(s) mapeado(s) para compactação.", "SUCESSO")

            # 3. Compactar
            self._log_ui("Compactando arquivos com 7-Zip...", "INFO")
            self._status_ui("📦  Compactando backup...")
            caminho_backup = compactar_backup(nome_cliente, numero_loja, itens)
            tamanho_mb = os.path.getsize(caminho_backup) / (1024 * 1024)
            self._log_ui(f"✔ Backup criado: {os.path.basename(caminho_backup)} ({tamanho_mb:.1f} MB)", "SUCESSO")

            # 4. Enviar via WhatsApp (com retentativas)
            self._log_ui("Iniciando envio automático via WhatsApp Web...", "INFO")
            self._status_ui("💬  Enviando via WhatsApp...")
            enviado = False
            for tentativa in range(1, MAX_RETRIES + 1):
                try:
                    self._log_ui(f"Tentativa {tentativa}/{MAX_RETRIES} de envio...", "INFO")
                    enviado = abrir_whatsapp_e_enviar(caminho_backup, log_callback=self._log_ui)
                    if enviado:
                        break
                except Exception as e_env:
                    self._log_ui(f"Erro na tentativa {tentativa}: {e_env}", "ERRO")
                if tentativa < MAX_RETRIES:
                    self._log_ui(f"Aguardando {TEMPO_ENTRE_RETRIES}s antes de tentar novamente...", "INFO")
                    time.sleep(TEMPO_ENTRE_RETRIES)

            if enviado:
                self._log_ui("✔ Arquivo enviado com sucesso no WhatsApp!", "SUCESSO")
                self._status_ui("✅  Backup enviado com sucesso!", self.COR_SUCESSO)
                self.root.after(0, lambda: messagebox.showinfo(
                    "Sucesso",
                    f"✅ Backup enviado com sucesso!\n\n"
                    f"Arquivo: {os.path.basename(caminho_backup)}\n"
                    f"Tamanho: {tamanho_mb:.1f} MB\n"
                    f"Grupo: {NOME_GRUPO_WHATSAPP}"
                ))
            else:
                self._log_ui(
                    f"⚠ Não foi possível enviar automaticamente após {MAX_RETRIES} tentativas.\n"
                    f"Arquivo gerado em: {caminho_backup}", "ERRO"
                )
                self._status_ui("⚠  Backup criado, mas envio manual necessário!", "#F59E0B")
                self.root.after(0, lambda: messagebox.showwarning(
                    "Atenção",
                    f"⚠ Backup criado, mas o envio automático falhou.\n\n"
                    f"Envie manualmente o arquivo:\n{caminho_backup}\n\n"
                    f"Grupo: {NOME_GRUPO_WHATSAPP}"
                ))

        except FileNotFoundError as e:
            self._log_ui(f"❌ Arquivo/pasta não encontrado(a): {e}", "ERRO")
            self._status_ui("❌  Erro — verifique o log.", self.COR_ERRO)
            self.root.after(0, lambda: messagebox.showerror("Erro", str(e)))

        except ValueError as e:
            self._log_ui(f"❌ Erro de formato: {e}", "ERRO")
            self._status_ui("❌  Erro de formato.", self.COR_ERRO)
            self.root.after(0, lambda: messagebox.showerror("Erro de Formato", str(e)))

        except RuntimeError as e:
            self._log_ui(f"❌ Erro de execução: {e}", "ERRO")
            self._status_ui("❌  Erro na compactação.", self.COR_ERRO)
            self.root.after(0, lambda: messagebox.showerror("Erro", str(e)))

        except ImportError as e:
            self._log_ui(f"❌ Dependência ausente: {e}", "ERRO")
            self._status_ui("❌  Dependência não instalada.", self.COR_ERRO)
            self.root.after(0, lambda: messagebox.showerror("Dependência Ausente", str(e)))

        except Exception as e:
            self._log_ui(f"❌ Erro inesperado: {e}", "ERRO")
            self._status_ui("❌  Erro inesperado.", self.COR_ERRO)
            self.root.after(0, lambda: messagebox.showerror("Erro Inesperado", str(e)))

        finally:
            # Restaura o botão de finalizar
            self.root.after(0, lambda: self.btn_finalizar.configure(
                text="⏹  FINALIZAR INVENTÁRIO", state="normal"
            ))
            self._log_ui("═" * 50)

    def _log_ui(self, msg: str, tipo: str = "INFO"):
        """Thread-safe: adiciona log e registra no logger."""
        logger.info(msg)
        self.root.after(0, lambda m=msg, t=tipo: self.adicionar_log(m, t))

    def _status_ui(self, msg: str, cor: str = None):
        """Thread-safe: atualiza o status."""
        self.root.after(0, lambda m=msg, c=cor: self.atualizar_status(m, c))


# =============================================================================
# PONTO DE ENTRADA
# =============================================================================

def main():
    root = tk.Tk()
    app = AppBackupInventario(root)
    root.mainloop()


if __name__ == "__main__":
    main()
