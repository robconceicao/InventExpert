# Analise do Aplicativo InventExpert

## 1. Informacoes Gerais

| Campo | Valor |
|---|---|
| **Nome** | InventExpert |
| **Package/Bundle ID** | `com.inventexpert.app` |
| **Versao** | 1.0.0 |
| **Framework** | React Native 0.81.5 + Expo SDK 54 |
| **Plataformas** | Android, iOS, Web |
| **Orientacao** | Portrait |
| **Proprietario (Expo)** | robtadeu |
| **Projeto EAS ID** | e9746070-0b84-4327-adef-3de641cf1d57 |
| **Build Android** | APK (development e preview) |
| **Estilizacao** | NativeWind (TailwindCSS) |
| **Navegacao** | React Navigation (Bottom Tabs) |
| **Backend** | Supabase (auth + database) |
| **Linguagem** | TypeScript (strict mode) |

---

## 2. Funcionalidades Principais

### 2.1 Telas do Aplicativo

O app possui **4 abas** (tabs) principais:

| Aba | Tela | Descricao |
|---|---|---|
| **Andamento de Inventario** | `ReportAScreen` | Formulario completo para acompanhamento de inventario em tempo real |
| **Resumo de Inventario** | `ReportBScreen` | Formulario de resumo final do inventario com fotos e PDF |
| **Escala** | `AttendanceScreen` | Gerenciamento de presenca de colaboradores (parser de WhatsApp) |
| **Scanner** | `ScannerScreen` | Digitalizacao de documentos com scanner automatico (somente mobile) |

### 2.2 Tela de Autenticacao (`AuthScreen`)
- Login com e-mail e senha via Supabase Auth
- Cadastro de nova conta
- Reenvio de e-mail de confirmacao
- Mensagens de erro traduzidas para portugues

### 2.3 ReportA - Andamento de Inventario
**Campos coletados:**
- Identificacao: numero da loja, nome, endereco, quantidade de colaboradores, lider
- Cronograma: horario de chegada, inicio/termino de estoque, loja, divergencia, inventario
- Avanco (%): medicoes em 22h, 00h, 01h, 03h, 04h
- Gestao de arquivos: horario de envio de 3 arquivos
- Indicadores: avaliacao de estoque/loja (%), acuracidade (%), percentual de auditoria, PH, satisfacao (1-5)
- Gerenciamento: contagem antecipada (Sim/Nao/N/A)

**Funcionalidades:**
- Persistencia local (AsyncStorage)
- Pre-visualizacao da mensagem formatada
- Envio direto via WhatsApp (deep link `whatsapp://send`)
- Arquivamento de historico e exportacao CSV
- Notificacoes agendadas para lembrar avanco (22h, 00h, 01h, 03h, 04h - 5 min antes)
- Sincronizacao com Supabase (tabela `report_a`)

### 2.4 ReportB - Resumo de Inventario
**Campos coletados:**
- Identificacao: cliente, numero da loja, data, endereco, PIV programado/realizado
- Cronograma operacional: chegada da equipe, deposito, loja
- Auditoria e divergencias: auditoria do cliente, divergencia, nao contados
- Resultado: itens alterados, nao contados, encontrados, total de pecas, valor financeiro (R$)
- Envio de arquivos (3 horarios)
- Indicadores: preparacao deposito/loja (%), acuracidade cliente/terceirizada (%), satisfacao
- Finalizacao: responsavel, termino, solicitacao de suporte

**Funcionalidades adicionais:**
- Anexo de ate 10 fotos da galeria
- Reordenacao de fotos (mover para cima/baixo)
- Geracao de PDF com fotos (via `expo-print`)
- Compartilhamento de PDF via sistema nativo
- Formatacao de moeda (BRL) e numeros inteiros com separadores
- Sincronizacao com Supabase (tabela `report_b`)

### 2.5 Attendance - Escala
**Funcionalidades:**
- Parser de texto de WhatsApp (colar texto bruto da escala)
- Deteccao automatica de: data, loja, endereco e lista de colaboradores
- Marcacao de presenca: PRESENTE, AUSENTE, NAO_DEFINIDO
- Campo de substituto para colaboradores ausentes
- Pre-visualizacao de mensagem formatada com emojis
- Envio via WhatsApp
- Arquivamento e exportacao CSV
- Sincronizacao com Supabase (tabela `attendance`)

### 2.6 Scanner de Documentos
- Scanner automatico com deteccao de borda (`react-native-document-scanner-plugin`)
- Digitalizacao de ate 10 documentos por vez
- Opcao de adicionar mais paginas
- Pre-visualizacao das paginas escaneadas
- Geracao de PDF a partir das imagens
- Compartilhamento do PDF
- **Disponivel somente no mobile** (nao funciona na web)

---

## 3. Arquitetura Tecnica

### 3.1 Estrutura de Pastas

```
/
├── app/                    # Rotas Expo Router (redirecionam para src/App)
│   ├── _layout.tsx         # Layout raiz (Stack sem header)
│   ├── index.tsx           # Rota principal
│   ├── Attendance.tsx      # Rota /Attendance
│   ├── ReportA.tsx         # Rota /ReportA
│   └── ReportB.tsx         # Rota /ReportB
├── src/                    # Codigo-fonte principal
│   ├── App.tsx             # Componente raiz com auth e navegacao
│   ├── components/         # Componentes reutilizaveis
│   │   └── TimeInput.tsx   # Input de horario com botao "agora"
│   ├── navigation/
│   │   └── RootTabs.tsx    # Navegacao por abas
│   ├── screens/            # Telas do app
│   │   ├── AuthScreen.tsx
│   │   ├── AttendanceScreen.tsx
│   │   ├── ReportAScreen.tsx
│   │   ├── ReportBScreen.tsx
│   │   └── ScannerScreen.tsx
│   ├── services/
│   │   ├── supabase.ts     # Configuracao do cliente Supabase
│   │   └── sync.ts         # Fila de sincronizacao offline-first
│   ├── types/
│   │   └── index.ts        # Tipos TypeScript (ReportA, ReportB, Attendance)
│   └── utils/
│       ├── export.ts       # Exportacao CSV e compartilhamento
│       └── parsers.ts      # Formatadores e validadores
├── assets/images/          # Icones e splash screen
├── docs/                   # Build web (GitHub Pages)
└── scripts/                # Scripts auxiliares
```

### 3.2 Padrao de Navegacao

O app usa uma **dupla navegacao**:
1. **Expo Router** (file-based) - para rotas web/deep links
2. **React Navigation Bottom Tabs** - para navegacao entre abas no mobile

Todas as rotas do Expo Router (`app/*.tsx`) simplesmente renderizam o `src/App.tsx`, que gerencia autenticacao e exibe as tabs via React Navigation.

### 3.3 Gerenciamento de Estado
- **Estado local**: `useState` + `useEffect` em cada tela
- **Persistencia**: `AsyncStorage` com chaves prefixadas (`inventexpert:*`)
- **Sincronizacao**: fila offline-first que envia para Supabase quando conectado

---

## 4. Dependencias Principais

| Pacote | Versao | Uso |
|---|---|---|
| expo | ~54.0.32 | Plataforma base |
| react-native | 0.81.5 | Runtime mobile |
| react | 19.1.0 | UI framework |
| @supabase/supabase-js | ^2.49.1 | Backend (auth + DB) |
| @react-navigation/bottom-tabs | ^7.4.0 | Navegacao por abas |
| expo-camera | ^17.0.10 | Acesso a camera |
| expo-image-picker | ^17.0.10 | Selecao de imagens |
| expo-image-manipulator | ^14.0.8 | Redimensionamento de imagens |
| expo-print | ~15.0.3 | Geracao de PDF |
| expo-sharing | ^14.0.8 | Compartilhamento de arquivos |
| expo-file-system | ~19.0.21 | Acesso ao sistema de arquivos |
| expo-notifications | ^0.32.16 | Notificacoes push/local |
| nativewind | ^2.0.11 | TailwindCSS para RN |
| react-native-document-scanner-plugin | ^2.0.4 | Scanner de documentos |
| react-native-reanimated | ~4.1.1 | Animacoes |
| @react-native-async-storage/async-storage | ^2.2.0 | Persistencia local |

---

## 5. Analise de Seguranca

### 5.1 Pontos Positivos
- Autenticacao via Supabase (e-mail + senha)
- Tela de login obrigatoria quando Supabase configurado
- Sessao persistida com `autoRefreshToken: true`
- `detectSessionInUrl: false` (evita ataques de URL)
- Dados sincronizados com `user_id` associado
- Arquivo `.env` vazio (chaves no `app.json`)

### 5.2 Pontos de Atencao - SEGURANCA

| Severidade | Item | Descricao |
|---|---|---|
| **ALTA** | Chave Supabase no app.json | A `supabaseAnonKey` esta hardcoded no `app.json` (linha 70). Embora seja uma chave "anon" (publica), ela fica exposta no bundle do app. **Recomendacao**: mover para variavel de ambiente. |
| **ALTA** | Supabase URL exposta | A URL do Supabase (`knxwuxxpbrbmhgdatgoe.supabase.co`) esta hardcoded. Isso facilita engenharia reversa. |
| **MEDIA** | Dados locais sem criptografia | Os dados armazenados no AsyncStorage nao sao criptografados. Em dispositivos com root/jailbreak, podem ser acessados. **Recomendacao**: usar `expo-secure-store` para dados sensiveis. |
| **MEDIA** | Fila de sync sem retry robusto | A funcao `syncQueue` tenta enviar uma vez e, se falhar, mantem na fila. Nao ha mecanismo de retry com backoff. |
| **BAIXA** | WhatsApp deep link | O uso de `whatsapp://send` e seguro mas nao valida se o WhatsApp esta instalado antes de chamar. |
| **BAIXA** | JSON.parse sem try-catch em loadData | No `AttendanceScreen`, o `JSON.parse(stored)` nao esta em try-catch, podendo causar crash se os dados estiverem corrompidos. |

### 5.3 Permissoes Android Solicitadas

| Permissao | Justificativa |
|---|---|
| `android.permission.CAMERA` | Scanner de documentos e camera |
| `android.permission.POST_NOTIFICATIONS` | Notificacoes de avanco do inventario |
| `android.permission.RECORD_AUDIO` | Declarada mas **nao utilizada** no codigo |

> **Nota**: A permissao `RECORD_AUDIO` esta declarada no `app.json` mas nao ha nenhum uso de audio no aplicativo. Recomenda-se remover.

---

## 6. Analise de Performance

### 6.1 Pontos Positivos
- React Compiler habilitado (`experiments.reactCompiler: true`)
- New Architecture habilitada (`newArchEnabled: true`)
- Uso de `useMemo` para mensagens formatadas
- Imagens redimensionadas antes de gerar PDF (width: 1600, compress: 0.7)

### 6.2 Pontos de Atencao

| Item | Descricao |
|---|---|
| ScrollView vs FlatList | As listas de colaboradores e fotos usam `ScrollView` com `.map()`. Para listas grandes, `FlatList` seria mais performatico. |
| Re-renders | Toda atualizacao de campo no formulario causa re-render da tela inteira. Extrair campos como componentes memoizados reduziria renders. |
| PDF generation | A geracao de PDF com base64 de imagens pode consumir muita memoria. Para muitas fotos, pode causar crash em dispositivos com pouca RAM. |
| AsyncStorage writes | Cada keystroke nos formularios dispara `AsyncStorage.setItem` (via useEffect). Recomenda-se debounce. |

---

## 7. Analise de UX/UI

### 7.1 Pontos Positivos
- Design limpo e consistente usando TailwindCSS/NativeWind
- Cores azul (`#2563EB`) e slate para aparencia profissional
- Botao "agora" nos campos de horario (otima UX para uso em campo)
- Pre-visualizacao antes do envio
- Formatacao automatica de horarios (HH:mm) e datas (DD/MM/AAAA)
- Mascaras de moeda e percentual
- Confirmacao antes de arquivar/limpar dados

### 7.2 Sugestoes de Melhoria

| Item | Sugestao |
|---|---|
| Validacao em tempo real | Mostrar erros inline nos campos em vez de somente no submit |
| Skeleton/Loading | Adicionar estados de loading durante operacoes assincronas |
| Acessibilidade | Adicionar labels de acessibilidade (`accessibilityLabel`) nos icones e botoes |
| Modo offline | Indicar visualmente quando o app esta offline |
| Dark mode | O app declara `userInterfaceStyle: "automatic"` mas nao implementa tema escuro |

---

## 8. Fluxo de Dados

```
[Usuario preenche formulario]
        |
        v
[Estado local (useState)]
        |
        v
[AsyncStorage (persistencia imediata)]
        |
        v
[Usuario clica "Enviar"]
        |
        ├─> [Pre-visualizacao (Modal)]
        │       |
        │       v
        │   [WhatsApp deep link]
        │
        └─> [Arquivar e Limpar]
                |
                ├─> [AsyncStorage (historico)]
                ├─> [Fila de sync (enqueueSyncItem)]
                ├─> [Exportacao CSV (compartilhamento)]
                └─> [Supabase (syncQueue)]
                        |
                        v
                    [Tabelas: report_a, report_b, attendance]
```

---

## 9. Integracao com Backend (Supabase)

### 9.1 Configuracao
- **URL**: `https://knxwuxxpbrbmhgdatgoe.supabase.co`
- **Chave Anon**: `sb_publishable_DYOVR11_d_KccROE2JW4yg_A0TDzy0Q`
- Autenticacao com persistencia via AsyncStorage
- Deteccao de sessao em URL desativada

### 9.2 Tabelas Utilizadas
| Tabela | Tipo de Dado | Campos |
|---|---|---|
| `report_a` | Relatatorio A | `payload` (JSON), `user_id`, `created_at` |
| `report_b` | Relatatorio B | `payload` (JSON), `user_id`, `created_at` |
| `attendance` | Escala | `payload` (JSON), `user_id`, `created_at` |

### 9.3 Sincronizacao
- Modelo **offline-first** com fila local
- Itens enfileirados com `enqueueSyncItem()`
- Sync executada em `syncQueue()` apos login e apos arquivar
- Itens com falha permanecem na fila para nova tentativa

---

## 10. Build e Deploy

### 10.1 Configuracao EAS
- **CLI**: v16.31.0
- **Development**: APK com dev client
- **Preview**: APK para testes
- **App version source**: remote (controlada pelo EAS)

### 10.2 Web
- Output estatico para GitHub Pages
- Script personalizado: `build-web-gh.js`
- URL base: `https://robconceicao.github.io/InventExpert/`

---

## 11. Resumo Final

**InventExpert** e um aplicativo mobile corporativo voltado para **gestao de inventario** em lojas. Permite:

1. Registrar o andamento do inventario em tempo real (ReportA)
2. Gerar resumo final com fotos e indicadores (ReportB)
3. Gerenciar presenca de equipe com integracao WhatsApp (Attendance)
4. Digitalizar documentos fisicos para PDF (Scanner)

O app segue boas praticas de desenvolvimento com TypeScript strict, arquitetura clean, persistencia offline-first e sincronizacao com backend. As principais areas de melhoria estao na seguranca (chaves hardcoded, dados nao criptografados), performance (debounce em saves, FlatList para listas) e a permissao `RECORD_AUDIO` nao utilizada que deveria ser removida.
