# Task — APK Release (InventExpert)

> Esta task não altera código-fonte — apenas prepara e executa o build.
> Baseline a preservar: 0 erros TS / ~150 testes verdes (9 suites, v3 2026-08).

---

## Contexto

O InventExpert usa **Expo + EAS Build** como pipeline principal de build.
O projeto tem `eas.json` na raiz e JDK 17 local em `jdk17/`.
Para builds locais, usar **Gradle 8.14.3** via `android/gradlew`.

Esta release consolida:
- Overhaul completo do módulo Avaliação (limites de bloco por área)
- Perfil ATACADO
- Sistema de evolução do conferente (se concluído antes deste build)

**Release 1.6.0 (versionCode 18) — motor de Avaliação v3:**
- `prcParser` corrigido: bloco pela quantidade, seção de 4 dígitos, quantidade
  de 9 dígitos, endereço digitado à mão e relógio de coletor fora de data
- Mapa Seção → Área física → Conferente (`AreaMappingService`)
- Divergência atribuída por SEÇÃO+EAN, com reconciliação obrigatória
- Produtos não contados com área e responsável provável em 3 níveis
- Auditoria dirigida separada do cálculo de produtividade
- Tela de Avaliação com os arquivos obrigatórios e complementares separados

---

## Passo 1 — Verificar versão atual

Leia `app.json` e reporte:
- `version` atual (ex: `1.2.0`)
- `versionCode` atual (ex: `5`)
- `bundleIdentifier` / `package`

**Aguarde aprovação do Roberto para os novos valores antes de editar.**

Critério de incremento:
- `versionCode` → sempre +1 (obrigatório — Android rejeita instalação se igual ou menor)
- `version` patch (X.Y.**Z**) → correções e melhorias internas
- `version` minor (X.**Y**.0) → nova funcionalidade visível ao usuário

---

## Passo 2 — Verificar eas.json

Confirmar que existe um perfil que gera **APK** (não AAB) para instalação direta:

```json
{
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

Se não existir perfil `preview` com `buildType: apk`, adicionar.
**Não alterar** perfis de produção existentes.

---

## Passo 3 — Sanidade pré-build

```bash
# Dependências íntegras
npm install

# Bundle sem erros
npx expo export --platform android 2>&1 | tail -30
```

Se houver erro no bundle, reportar ao Roberto antes de prosseguir.

---

## Passo 4 — Build

### Opção A — EAS Build (cloud, preferencial)

```bash
eas build --platform android --profile preview
```

Ao finalizar, o link de download aparece no terminal e em `expo.dev`.

### Opção B — Gradle local (se EAS não disponível ou quota esgotada)

```bash
cd android
./gradlew assembleRelease
```

APK gerado em:
`android/app/build/outputs/apk/release/app-release.apk`

#### JDK — atenção

A pasta `jdk17/` do projeto está no `.gitignore` e **não existe mais** na máquina.
Apontar `JAVA_HOME` para ela devolve *"JAVA_HOME is set to an invalid directory"*.

Gradle 8.14.3 exige **JDK 17** (21 também serve; 11 e 24 não).

Para descobrir os JDKs instalados:

```powershell
Get-ChildItem "C:\Program Files\Android\Android Studio\jbr", `
              "C:\Program Files\Eclipse Adoptium", `
              "C:\Program Files\Java", `
              "$env:LOCALAPPDATA\Programs\Eclipse Adoptium" `
              -ErrorAction SilentlyContinue | Select-Object FullName
```

Caminhos confirmados nesta máquina (07/08/2026), em ordem de preferência:

1. `C:\Program Files\Eclipse Adoptium\jdk-17.0.19.10-hotspot` — JDK 17 completo e versionado
2. `C:\Program Files\Java\jdk-17`
3. `C:\Program Files\Android\Android Studio\jbr` — runtime da JetBrains, também 17

Definir para a sessão atual:

```powershell
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.19.10-hotspot"
$env:Path = "$env:JAVA_HOME\bin;" + $env:Path
java -version   # tem de mostrar 17.x
```

Para fixar de vez (e reabrir o terminal depois):

```powershell
[Environment]::SetEnvironmentVariable("JAVA_HOME","C:\Program Files\Eclipse Adoptium\jdk-17.0.19.10-hotspot","User")
```

---

## Passo 5 — Verificar APK gerado

```bash
# Tamanho (esperado > 20MB para React Native)
ls -lh android/app/build/outputs/apk/release/app-release.apk

# Versão embarcada (requer aapt do Android SDK)
aapt dump badging app-release.apk | grep -E "versionCode|versionName|package"
```

Confirmar que `versionCode` e `versionName` batem com o `app.json` atualizado.

---

## Passo 6 — Commit de versão

Após o build bem-sucedido:

```bash
git add app.json eas.json
git commit -m "chore: bump version para X.Y.Z (versionCode N)"
```

---

## Checklist de encerramento

- [ ] `app.json`: `version` e `versionCode` atualizados e aprovados pelo Roberto
- [ ] `eas.json`: perfil `preview` com `buildType: apk` confirmado
- [ ] Bundle exportado sem erros
- [ ] APK gerado com sucesso
- [ ] `versionCode` no APK confere com `app.json`
- [ ] Commit de versão feito com mensagem descritiva
- [ ] Caminho completo ou link de download do APK informado ao Roberto
