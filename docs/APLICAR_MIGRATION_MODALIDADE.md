# Aplicar a migration de modalidade de contratação

> `supabase/migration_colaboradores_modalidade.sql`
> Necessária para o bloqueio de modalidade na tela de Avaliação funcionar em rede.

> ## ✅ JÁ APLICADA em 08/08/2026
>
> No projeto `knxwuxxpbrbmhgdatgoe`, junto com todo o `schema_v2` e as demais
> migrations, que também nunca tinham sido aplicadas. Ver `SUPABASE_ESTADO.md`.
>
> **A leitura funciona sem cadastrar ninguém:** `is_staff_reader()` trata ausência
> de perfil em `app_profiles` como legado com acesso liberado, e a tabela está
> vazia. O passo 5 deste documento vale só a partir do momento em que alguém
> ganhar perfil.
>
> O restante do documento fica como referência para aplicar em outro projeto.

---

## Por que precisa

A tela de Avaliação passou a exigir que cada conferente seja marcado como CLT,
intermitente ou prestador de serviço, porque o relatório individual muda de
linguagem conforme o vínculo.

Sem a migration aplicada:

- a marcação funciona, mas fica **só no aparelho** (AsyncStorage);
- a cada gravação o app avisa *"não foi possível gravar no cadastro"*;
- o mesmo conferente pode sair como CLT numa loja e como prestador em outra,
  porque cada líder mantém a própria lista;
- trocar de celular ou reinstalar o app perde tudo.

Com a migration aplicada, o Supabase vira a fonte de verdade e o aparelho passa
a usar o armazenamento local apenas como cache offline.

---

## O que a migration faz

| Objeto | Ação |
|---|---|
| `colaboradores.modalidade` | Coluna TEXT, aceita `CLT`, `INTERMITENTE`, `FREE` ou nulo |
| `colaboradores.modalidade_atualizada_em` | Timestamp da última marcação |
| `colaboradores.modalidade_atualizada_por` | Quem marcou |
| `idx_colaboradores_modalidade` | Índice parcial, só sobre quem tem marcação |
| `definir_modalidade_colaborador(...)` | Função de upsert usada pelo app |

**A coluna nasce nula de propósito.** Nulo significa "ainda não conferido", e é
isso que faz a tela bloquear o processamento. Um valor padrão aqui traria de
volta exatamente o problema que a migration existe para resolver.

**Nada é apagado ou alterado.** Só acrescenta. Os registros existentes ficam com
`modalidade = NULL` até alguém marcar.

**Pode rodar mais de uma vez sem quebrar.** Todo comando usa `IF NOT EXISTS` ou
`CREATE OR REPLACE`. Se ficar em dúvida se já aplicou, rode de novo.

---

## Antes de começar

Você precisa de acesso de **owner** ou **admin** ao projeto no Supabase — o
mesmo que usa para abrir o painel. Papel de leitura não executa DDL.

Confirme também em qual projeto vai aplicar. A URL está no seu `.env`, na linha
`EXPO_PUBLIC_SUPABASE_URL`, e tem o formato `https://xxxxx.supabase.co`. O
`xxxxx` é o *reference ID* do projeto, que aparece na URL do painel.

---

## Passo 1 — Abrir o SQL Editor

1. Entre em `https://supabase.com/dashboard`
2. Selecione o projeto do InventExpert (confira o reference ID)
3. No menu lateral, clique em **SQL Editor**
4. Clique em **New query**

---

## Passo 2 — Colar e executar

1. Abra `supabase/migration_colaboradores_modalidade.sql` no VS Code
2. Selecione tudo (`Ctrl+A`) e copie (`Ctrl+C`)
3. Cole na janela do SQL Editor
4. Clique em **Run** (ou `Ctrl+Enter`)

Deve aparecer **Success. No rows returned**. É o resultado esperado: comandos de
estrutura não devolvem linhas.

Se aparecer erro, veja a seção *Quando dá errado*, no fim deste documento.

---

## Passo 3 — Conferir que aplicou

Abra uma nova query e rode as três verificações abaixo.

**As colunas existem?**

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'colaboradores'
  AND column_name LIKE 'modalidade%'
ORDER BY column_name;
```

Esperado: três linhas — `modalidade`, `modalidade_atualizada_em`,
`modalidade_atualizada_por`, todas com `is_nullable = YES`.

**A restrição de valores está ativa?**

```sql
SELECT conname, pg_get_constraintdef(oid) AS definicao
FROM pg_constraint
WHERE conname = 'colaboradores_modalidade_check';
```

Esperado: uma linha mostrando o CHECK com os três valores permitidos.

**A função existe e está com as permissões certas?**

```sql
SELECT
  p.proname,
  pg_get_function_identity_arguments(p.oid) AS argumentos,
  p.prosecdef                               AS security_definer,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_executa,
  has_function_privilege('anon',          p.oid, 'EXECUTE') AS anon_executa
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'definir_modalidade_colaborador';
```

Esperado: `security_definer = true`, `authenticated_executa = true` e
**`anon_executa = false`**. O último é o que importa para a segurança: usuário
não autenticado não pode reclassificar vínculo de ninguém.

---

## Passo 4 — Testar a gravação pelo SQL

Antes de ir para o celular, prove que a função funciona:

```sql
SELECT public.definir_modalidade_colaborador(
  '00000000000', 'TESTE MIGRATION', 'FREE', 'teste-manual'
);

SELECT matricula, nome, modalidade, modalidade_atualizada_em, modalidade_atualizada_por
FROM public.colaboradores
WHERE matricula = '00000000000';
```

Deve voltar uma linha com `modalidade = FREE`. Depois, apague o teste:

```sql
DELETE FROM public.colaboradores WHERE matricula = '00000000000';
```

---

## Passo 5 — Conferir a leitura pelo app (a pegadinha do RLS)

A gravação passa pela função, que é `SECURITY DEFINER` e não depende de RLS.
**A leitura não.** O app lê `colaboradores` direto, e a política dessa tabela é:

```sql
CREATE POLICY "colaboradores_select_staff"
  ON public.colaboradores FOR SELECT TO authenticated
  USING (public.is_staff_reader());
```

Ou seja: o líder consegue gravar a modalidade, mas **só enxerga a marcação de
volta se a conta dele estiver como staff** em `app_profiles`. Se não estiver,
todo inventário vai pedir a marcação de novo, como se ninguém tivesse cadastro.

Confira quais contas são staff:

```sql
SELECT id, email, role FROM public.app_profiles ORDER BY role, email;
```

Se os líderes que usam o app não aparecerem aí com papel de leitura, me avise —
dá para resolver de dois jeitos: incluir as contas em `app_profiles`, ou criar
uma função de leitura `SECURITY DEFINER` que devolva só matrícula e modalidade,
sem expor o resto do cadastro.

---

## Passo 6 — Testar no celular

1. Abra o app com uma conta autenticada
2. Módulo **Avaliação** → anexar `RProInv_Produtividade`
3. A tela de modalidade abre com todos em branco (primeira vez)
4. Marque todos e confirme

Se aparecer **"Modalidades registradas"** sem ressalva, gravou no Supabase.
Se aparecer *"A marcação vale só neste aparelho até a próxima sincronização"*,
a gravação remota falhou — volte ao passo 3.

Para provar que a persistência funcionou: **feche o app, reabra e anexe o mesmo
arquivo**. Agora todos devem vir preenchidos e etiquetados como "do cadastro".

Confirme também pelo banco:

```sql
SELECT nome, matricula, modalidade, modalidade_atualizada_em
FROM public.colaboradores
WHERE modalidade IS NOT NULL
ORDER BY modalidade_atualizada_em DESC;
```

---

## Quando dá errado

**`relation "public.colaboradores" does not exist`**
O `schema_v2.sql` não foi aplicado neste projeto. Você está no projeto errado, ou
o banco está vazio. Confira o reference ID.

**`permission denied for table colaboradores`**
Sua conta no painel não tem permissão de DDL. Peça a quem é owner do projeto.

**`function public.is_staff_reader() does not exist`**
Não é erro desta migration — significa que `migration_security_advisor_harden.sql`
não foi aplicada. A migration de modalidade funciona mesmo assim; o que não vai
funcionar é a política de RLS mencionada no passo 5.

**O app continua avisando que não gravou**
Rode o passo 4. Se a função responder no SQL Editor mas falhar no app, o problema
é autenticação: confira se o usuário está logado e se `EXPO_PUBLIC_SUPABASE_URL`
e `EXPO_PUBLIC_SUPABASE_ANON_KEY` no `.env` apontam para o projeto onde você
aplicou a migration. Um erro comum é aplicar em produção e testar apontando para
o projeto de desenvolvimento.

---

## Desfazer

Só faça isso se precisar mesmo — **apaga as marcações já feitas**.

```sql
DROP FUNCTION IF EXISTS public.definir_modalidade_colaborador(TEXT, TEXT, TEXT, TEXT);
DROP INDEX IF EXISTS public.idx_colaboradores_modalidade;
ALTER TABLE public.colaboradores DROP CONSTRAINT IF EXISTS colaboradores_modalidade_check;
ALTER TABLE public.colaboradores DROP COLUMN IF EXISTS modalidade_atualizada_por;
ALTER TABLE public.colaboradores DROP COLUMN IF EXISTS modalidade_atualizada_em;
ALTER TABLE public.colaboradores DROP COLUMN IF EXISTS modalidade;
```

O app volta a funcionar só com o cache local. A tela de marcação continua
bloqueando o processamento — esse comportamento não depende do banco.

---

## Alternativa: Supabase CLI

Se preferir versionar a aplicação em vez de colar no painel:

```powershell
npm install -g supabase
supabase login
supabase link --project-ref SEU_REFERENCE_ID
supabase db execute --file supabase/migration_colaboradores_modalidade.sql
```

O projeto tem a pasta `supabase/` mas **não está linkado** ao CLI (falta o
`config.toml`), então o `link` é obrigatório na primeira vez. Para uma migration
só, o SQL Editor é mais rápido e tem menos o que dar errado.
