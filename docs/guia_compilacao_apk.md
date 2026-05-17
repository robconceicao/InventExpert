# 📱 Guia de Compilação do APK Local no Windows

Como as cotas gratuitas do Expo Cloud EAS Build foram atingidas, a melhor alternativa para gerar o aplicativo é compilar o APK localmente usando o Gradle diretamente na sua máquina Windows.

Siga os passos abaixo para configurar o seu ambiente e gerar o arquivo **`app-debug.apk`**.

---

## 🛠️ Passo 1: Pré-requisitos do Sistema

Para compilar aplicativos Android nativos, o seu Windows precisa de duas ferramentas essenciais instaladas:

1. **Java JDK (versão 17 recomendada):**
   * Baixe e instale o **JDK 17** (do Oracle ou Eclipse Temurin).
   * Certifique-se de que a variável de ambiente `JAVA_HOME` aponta para a pasta de instalação do seu JDK (ex: `C:\Program Files\Java\jdk-17`).

2. **Android SDK (geralmente instalado com o Android Studio):**
   * Instale o **Android Studio**.
   * Abra o Android Studio e, no menu de configurações, vá em **SDK Manager** e certifique-se de ter instalado o **Android SDK** correspondente à versão do seu projeto Expo.
   * Certifique-se de que a variável de ambiente `ANDROID_HOME` está configurada apontando para a pasta do SDK (geralmente `C:\Users\SEU_USUARIO\AppData\Local\Android\Sdk`).

---

## 🚀 Passo 2: Executando a Compilação do APK

Abra o seu terminal **PowerShell** ou **Prompt de Comando (CMD)** dentro da pasta raiz do seu projeto `InventExpert` e execute os comandos abaixo:

```powershell
# 1. Entre na pasta nativa do Android do projeto
cd android

# 2. Execute o script do Gradle para compilar o APK de Debug
.\gradlew.bat assembleDebug
```

> [!NOTE]
> * Se você estiver usando o **PowerShell**, certifique-se de usar `.\gradlew.bat`.
> * Na primeira vez que for executado, o Gradle baixará todas as dependências necessárias da internet. Isso pode levar alguns minutos.

---

## 📂 Passo 3: Onde encontrar o seu APK

Assim que a compilação terminar com sucesso, a mensagem `BUILD SUCCESSFUL` aparecerá na tela. Você encontrará o arquivo executável prontinho no seguinte caminho:

```text
c:\Users\robtc\InventExpert\android\app\build\outputs\apk\debug\app-debug.apk
```

Você pode transferir este arquivo `app-debug.apk` diretamente para o seu celular Android por cabo USB, e-mail ou WhatsApp e instalá-lo imediatamente para testar todas as funcionalidades do **InventExpert**!

---

## 💡 Dica Bônus: Testando em tempo real sem compilar APK

Se você quiser apenas rodar o aplicativo no seu dispositivo físico para testar em tempo real com hot-reload, você não precisa compilar o APK inteiro toda vez. Você pode usar:

```powershell
# Inicia o servidor local do Expo Metro Bundler
npx expo start --dev-client
```

Depois, basta baixar o aplicativo **Expo Go** ou abrir o build de desenvolvimento no seu celular e escanear o QR Code gerado no terminal!
