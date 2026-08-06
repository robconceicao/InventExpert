# Task — APK Release (InventExpert)

> Esta task não altera código-fonte — apenas prepara e executa o build.
> Baseline a preservar: 0 erros TS / 52 testes verdes.

---

## Contexto

O InventExpert usa **Expo + EAS Build** como pipeline principal de build.
O projeto tem `eas.json` na raiz e JDK 17 local em `jdk17/`.
Para builds locais, usar **Gradle 8.14.3** via `android/gradlew`.

Esta release consolida:
- Overhaul completo do módulo Avaliação (limites de bloco por área)
- Perfil ATACADO
- Sistema de evolução do conferente (se concluído antes deste build)

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

> Se o build local falhar por JDK, usar o JDK local do projeto:
> `$env:JAVA_HOME = "C:\Users\robtc\InventExpert\jdk17"`
> `$env:Path = "$env:JAVA_HOME\bin;" + $env:Path`

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
