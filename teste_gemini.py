import os
import time
from google import genai
from dotenv import load_dotenv

# 1. Carrega as variáveis de ambiente do arquivo .env
load_dotenv()

# Tenta carregar a chave de ambas as formas (a padrão ou a que você nomeou no print)
api_key = os.getenv("GEMINI_API_KEY") or os.getenv("API_KEY_INVENT_EXPERT")

# 2. Inicializa o cliente da API
client = genai.Client(api_key=api_key)

def executar_teste():
    print("=== INICIANDO TESTE DE CONEXÃO: INVENTEXPERT ===")
    
    try:
        # 3. Mapeia os modelos disponíveis na sua conta
        modelos_disponiveis = [m.name for m in client.models.list()]
        
        # Define a prioridade: tenta o G3, se não achar, vai para o G2 (estável)
        target_model = "gemini-3-flash"
        
        # Busca o nome completo (ex: models/gemini-3-flash-preview)
        full_name_match = [m for m in modelos_disponiveis if target_model in m]
        
        if full_name_match:
            target_model = full_name_match[0]
        else:
            print("Gemini 3 não encontrado. Utilizando Gemini 2.0 Flash (Estável).")
            target_model = "gemini-2.0-flash"

        print(f"Modelo selecionado: {target_model}")

        # 4. Lógica de Tentativas (para evitar o erro 503 de alta demanda)
        max_tentativas = 3
        for i in range(max_tentativas):
            try:
                print(f"Enviando solicitação (Tentativa {i+1}/{max_tentativas})...")
                
                response = client.models.generate_content(
                    model=target_model,
                    contents="Olá! Confirme que o acesso via API para o InventExpert foi liberado e está operacional."
                )
                
                # Se chegou aqui, deu certo!
                print("\n" + "="*40)
                print(f"SUCESSO! RESPOSTA DO {target_model.upper()}:")
                print("="*40)
                print(response.text)
                print("="*40)
                return # Encerra a função com sucesso

            except Exception as error_intern:
                # Se for erro de servidor ocupado (503), espera e tenta de novo
                if "503" in str(error_intern) and i < max_tentativas - 1:
                    print("Servidor ocupado. Aguardando 5 segundos para tentar novamente...")
                    time.sleep(5)
                else:
                    # Se for outro erro ou última tentativa, repassa para o catch principal
                    raise error_intern

    except Exception as e:
        print(f"\n[ERRO CRÍTICO]: {e}")
        print("\nVerificações rápidas:")
        print("1. Sua chave de API termina com '...vkyY'?")
        print("2. O arquivo .env está na mesma pasta que este script?")
        print("3. Você tem conexão com a internet ativa?")

if __name__ == "__main__":
    executar_teste()