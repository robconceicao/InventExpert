# SPEC 0007 — Mostrar o servidor Supabase na tela de login

- **Estado:** IMPLEMENTADA (verificação no aparelho pendente — critério 3)
- **Autor:** Roberto
- **Data:** 2026-09-28
- **Entrega relacionada:** incidente de 28/09 — APK mostrava "Não foi possível falar com
  o servidor" enquanto o projeto `knxwuxxpbrbmhgdatgoe` estava ACTIVE_HEALTHY e não
  recebeu nenhuma requisição HTTP no dia

---

## 1. Objetivo

Quem olha a tela de login (ou o print dela) sabe para qual servidor Supabase aquele
build está apontando, e é avisado quando a URL e a chave do build são de projetos
diferentes — sem precisar de acesso a EAS, GitHub Secrets ou logs.

## 2. Escopo

- [ ] `src/utils/supabaseDiagnostico.ts` — puro: host da URL, ref do host, ref da anon key
      (payload do JWT), divergência entre os dois
- [ ] Rodapé discreto na tela de login: `Servidor: <host>`
- [ ] Aviso em vermelho quando o ref da chave diverge do ref da URL (E3)
- [ ] O alerta de falha de rede passa a terminar com `Servidor: <host>` (D2)
- [ ] Suíte `supabaseDiagnostico.test.ts` + casos novos em `authErrorMessage.test.ts`

### Não-escopo

- **Mostrar a anon key**, inteira ou parcial. O ref basta para diagnosticar.
- **Testar conectividade** (ping, health check) ao abrir a tela. Seria outra requisição
  em toda abertura e não mudaria o diagnóstico: o host já diz para onde o build aponta.
- **Trocar o servidor pela tela.** A URL continua vindo só do build.
- **Mudar a mensagem de rede** em si (SPEC implícita do #33) — só se anexa o host.

## 3. Decisões de arquitetura

| # | Decisão | Justificativa | Alternativa descartada |
|---|---------|---------------|------------------------|
| D1 | Mostrar o host, não a URL inteira | É o que identifica o projeto e cabe numa linha | URL completa — ruído de `https://` sem ganho |
| D2 | Host anexado só ao alerta de **rede** | É o único erro em que o servidor está em dúvida; em "senha inválida" o servidor respondeu | Anexar a todo erro — poluiria mensagens que já são claras |
| D3 | Host extraído por regex, não por `new URL()` | O `URL` do React Native não implementa `host` em todas as versões | `new URL(url).host` |
| D4 | Ref da chave lido do payload do JWT com decodificador base64url próprio | Não depende de `atob`/`Buffer` existirem no motor JS | `atob` — ausente em motores antigos |
| D5 | Divergência só quando **os dois** refs são conhecidos | Domínio próprio e chave `sb_publishable_…` não trazem ref; ausência de informação não é erro | Avisar sempre que não der para conferir |

## 4. Restrições

- A tela não pode quebrar com URL ou chave malformadas — o diagnóstico devolve `null`,
  nunca lança.
- Nada de segredo na tela: a anon key é pública, mas nem ela aparece.

## 5. Interfaces e contratos de dados

```typescript
export interface DiagnosticoSupabase {
  host: string | null;       // null = URL vazia ou sem esquema://host
  refUrl: string | null;     // subdomínio de *.supabase.co; null em domínio próprio
  refChave: string | null;   // claim "ref" do JWT; null se a chave não for JWT
  divergente: boolean;       // true só se refUrl e refChave existem e diferem
}
export function diagnosticarSupabase(url: string, anonKey: string): DiagnosticoSupabase;

// authErrorMessage.ts
export function anexarServidor(mensagem: string, host: string | null): string;
```

## 6. Dependências

| Dependência | Estado | No escopo? |
|-------------|--------|------------|
| `translateAuthError` / mensagem de rede (#33) | JÁ EXISTE | não |
| `supabaseUrl` / `supabaseAnonKey` em `services/supabase.ts` | JÁ EXISTE | exportar o diagnóstico |

## 7. Casos extremos

| # | Caso | Comportamento esperado |
|---|------|------------------------|
| E1 | Build sem credenciais | Não mostra rodapé; o aviso de credenciais ausentes continua |
| E2 | URL com barra final, porta ou caminho | Host sem caminho: `abc.supabase.co` |
| E3 | URL do projeto novo com chave do projeto antigo | Aviso nomeando os dois refs |
| E4 | Chave que não é JWT (`sb_publishable_…`, lixo) | `refChave = null`, sem aviso |
| E5 | Domínio próprio (não `supabase.co`) | `refUrl = null`, sem aviso, host mostrado |
| E6 | Erro que não é de rede | Mensagem sem `Servidor:` |

## 8. Questões em aberto

- Nenhuma.

## 9. Critérios de aceitação

- [ ] `npm run check` verde
- [ ] Cada caso E2–E6 coberto por teste
- [ ] Tela de login mostra `Servidor: <host>` num build configurado
