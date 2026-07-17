# InventExpert Web (responsivo)

## Produto único

A web **é o app InventExpert** exportado com Expo para o browser.

| | |
|--|--|
| **URL** | https://robconceicao.github.io/InventExpert/ |
| **Código** | Este repositório (`robconceicao/InventExpert`) |
| **Backend** | Mesmo Supabase do Android/iOS |
| **Scanner** | Indisponível no browser (`ScannerScreen.web.tsx`) |

Não existe segundo projeto web (o repositório `inventexpert-web` foi descontinuado).

---

## Supabase Auth

No dashboard → Authentication → URL Configuration:

| Campo | Valor |
|-------|--------|
| **Site URL** | `https://robconceicao.github.io/InventExpert/` |
| **Redirect URLs** | `https://robconceicao.github.io/InventExpert/**` |
| | `http://localhost:8081/**` (Expo web dev) |
| | `http://localhost:19006/**` (se usar) |

---

## Deploy

Automático a cada **push em `main`** (workflow **Deploy GitHub Pages**).

Secrets do repositório:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Manual: Actions → Deploy GitHub Pages → Run workflow.

### Local

```bash
npm install
# .env com EXPO_PUBLIC_SUPABASE_*
npm run web
```

---

## Atualizar a web

```bash
git push origin main
```

O workflow exporta o app e publica na URL acima. Nada a sincronizar com outro repositório.
