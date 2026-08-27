# SDD com dois agentes — guia prático do InventExpert

Como implantar, do zero, um fluxo de Spec-Driven Development com **dois agentes
independentes**: Claude Code escrevendo o código e Codex CLI verificando o resultado.

Escrito para ser executado no Windows, em PowerShell, dentro deste repositório.
Ao terminar a Fase 3 você terá rodado um ciclo completo de verdade.

> **Versão em página, com índice fixo e prompts copiáveis:**
> <https://claude.ai/code/artifact/d3103b70-8bbc-4f0e-9fbe-5bdc9e929943>
> Privada até ser compartilhada pelo menu da própria página. Este arquivo continua
> sendo a fonte: ao editá-lo, republique a página para os dois não divergirem.

**Convenções deste guia**

- ⚠️ marca todo ponto em que **você revisa o diff antes de aprovar**. Não é formalidade:
  é onde o método funciona ou falha.
- Cada fase termina com um **critério de pronto** que você consegue verificar sozinho.
- Nenhum comando deste guia pede chave, token ou credencial. Segredo entra pelo painel
  do Supabase, pela EAS ou pelo `.env` local — **nunca** pela conversa com um agente.

---

## 1. Visão geral do loop

```
   ┌──────────────────────────────────────────────────────────┐
   │                                                          │
   ▼                                                          │
 SPEC ───────► ESCRITOR ───────► VERIFICADOR ───────► REALIMENTAÇÃO
(specs/)      (Claude Code)      (Codex CLI)         (volta pra spec)
```

**spec → escritor.** A spec existe para fechar as perguntas antes que o agente as
responda sozinho. Um agente sem contrato preenche as lacunas — e ele é bom nisso, o que
piora o problema: o código sai coerente, plausível e errado.

**escritor → verificador.** Quem escreve não consegue auditar o que escreveu; revê a
intenção, não o texto. O verificador é de **outra família de modelo** de propósito:
modelos diferentes erram em lugares diferentes, e é dessa discordância que sai o achado.

**verificador → realimentação.** Cada achado é classificado em **bug de código** (a
spec era clara, o código desobedeceu) ou **lacuna de spec** (ninguém tinha decidido).
Bug volta ao escritor. Lacuna vira linha nova na spec.

**realimentação → spec.** É a seta que faz o método composto em vez de linear. Sem ela
você tem revisão de código com passos extras; com ela, cada ciclo deixa a próxima spec
mais difícil de errar. A meta não é aumentar a taxa de acerto do agente — é reduzir o
número de decisões que ele ainda precisa tomar sem você.

---

## 2. Fase 0 — Preparar o repositório

**Por quê:** o agente lê o repositório inteiro, mas presta atenção nos arquivos que
você indicar. Antes de escrever qualquer spec, o repositório precisa ter um lugar óbvio
para elas e um arquivo de contexto por agente.

O que a Fase 0 cria:

| Arquivo | Para quem | Papel |
|---------|-----------|-------|
| `specs/` | humano + os dois agentes | Contrato por entrega |
| `specs/TEMPLATE.md` | você | O molde a copiar |
| `specs/decisions/` | permanente | ADRs — por que as alternativas foram descartadas |
| `CLAUDE.md` | escritor | Já existe neste repo, com 35 KB de regra de negócio |
| `AGENTS.md` | verificador | Papel, proibições e formato do relatório |
| `.gitignore` | git | Impede rascunho de agente de virar commit |
| `.claude/settings.json` | escritor | Guardrail mínimo de permissões |

**No InventExpert, tudo isto já está criado** — foi o que este documento entregou junto.
Confirme com:

```powershell
cd C:\caminho\para\InventExpert
Get-ChildItem specs, specs\decisions
Get-Content AGENTS.md -TotalCount 5
```

Se estiver começando um repositório do zero, a criação é esta:

```powershell
New-Item -ItemType Directory -Path specs\decisions -Force
New-Item -ItemType Directory -Path .claude -Force
New-Item -ItemType File -Path specs\README.md, specs\TEMPLATE.md, AGENTS.md -Force
```

### O que cada arquivo contém

**`CLAUDE.md` (escritor).** Neste repositório ele já existe e já é bom: stack, estrutura
de módulos, regras de negócio críticas, decisões arquiteturais e uma lista "O que NÃO
fazer". A Fase 0 acrescentou nele apenas a seção **"SDD com dois agentes"**, que aponta
para `specs/`, e quatro linhas novas em "O que NÃO fazer".

**`AGENTS.md` (verificador).** Contém o papel, a proibição de escrever, as treze regras
invioláveis (R1–R13) e o formato obrigatório do relatório. Leia-o inteiro uma vez —
é ele que define a qualidade da verificação.

**`.gitignore`.** Ganhou duas linhas:

```gitignore
# rascunho de agente — não entra no repositório
.agent-scratch/
specs/**/*.local.md
```

**`.claude/settings.json`.** Guardrail mínimo:

```json
{
  "permissions": {
    "deny": ["Read(./.env)", "Edit(./.env*)", "Bash(git push --force:*)"]
  }
}
```

Bloqueia o agente de ler o seu `.env` e de reescrever história remota. Se atrapalhar,
apague o arquivo — ele é conveniência, não a espinha do método.

**`package.json`.** Ganhou um script:

```json
"check": "npx tsc --noEmit && jest"
```

Um comando só, usado por você, pelo escritor e pelo verificador. Ter três formas de
dizer "está verde" é ter três baselines — foi exatamente o que produziu os números
conflitantes (30 / 52 / 58 testes) registrados no `TASK_LIST.md`.

### ✅ Critério de pronto da Fase 0

```powershell
npm run check
Get-ChildItem specs\TEMPLATE.md, specs\README.md, AGENTS.md, .claude\settings.json
git status --short
```

Pronto quando: `npm run check` termina sem erro (0 erros de tipo, suíte verde), os
quatro arquivos existem, e `git status` mostra só o que você espera.

---

## 3. Fase 1 — Escrever a primeira spec

**Por quê:** a spec é onde você paga o custo de pensar. Quinze minutos escrevendo
"o que acontece quando o conferente está no primeiro inventário dele" valem mais que
duas horas depurando por que a evolução saiu como "piora" para um novato.

O template completo está em [`specs/TEMPLATE.md`](../specs/TEMPLATE.md), com as dez
seções: objetivo · escopo e não-escopo · decisões de arquitetura com justificativa ·
restrições · interfaces e contratos de dados · dependências · casos extremos · questões
em aberto · critérios de aceitação verificáveis · registro de realimentação.

### As três seções que carregam o peso

**Não-escopo.** É o freio. Sem ele, o agente entrega a função que você pediu *e* o
repository *e* o bloco no relatório *e* um refactor da tela — tudo num diff que você não
consegue revisar. Escreva por nome cada coisa que você imaginou e decidiu não fazer.

**Casos extremos.** Puxe do domínio real, nunca da imaginação. O InventExpert tem uma
coleção pronta e cara: relógio de coletor com 30% das bipadas em 2022, arquivo `.xls`
que na verdade é HTML, endereço `PI0G0233` digitado à mão, prestador FREE que não pode
ser comparado com a equipe. Cada caso extremo vira um teste nomeado na seção 9.

**Critérios de aceitação.** "Verificável" significa: outra pessoa roda um comando e diz
PASSOU ou FALHOU sem te perguntar nada. "Funciona bem" não é critério. "O teste
`sem histórico devolve SEM_HISTORICO e nenhum delta` passa" é.

### O exemplo real, preenchido

[`specs/0001-evolucao-conferente.md`](../specs/0001-evolucao-conferente.md) é o template
preenchido de verdade para a próxima entrega do InventExpert: **evolução do conferente
entre inventários**. Abra e leia inteiro antes de continuar — o resto do guia usa essa
spec como material.

Três coisas que valem notar nela, porque são o que separa spec real de spec decorativa:

1. **Ela fatia.** A entrega inteira tem três fatias (cálculo → repository → relatório).
   A spec cobre só a fatia 1: uma função pura, sem rede, sem banco, sem tela. Um ciclo
   de 20 a 30 minutos precisa caber num diff que você consiga ler inteiro.

2. **Ela se apoia no que já existe.** A decisão D1 registra que o histórico já está na
   tabela `produtividade` (`supabase/schema_v2.sql:55`), já é alimentado pelo
   `ProdutividadePublishService.ts` e já é idempotente por
   `(colaborador_id, data_inventario, inventario_ref)`. Nenhuma tabela nova, nenhuma
   migration. Spec boa reduz trabalho; spec ruim inventa trabalho.

3. **Ela decide o que é fácil deixar em aberto.** Zona morta de ±2,0 pontos (D4),
   janela de 3 eventos (D5), `score_final` nulo ignorado e contado (D6). São exatamente
   as decisões que o agente tomaria sozinho, em silêncio, e que você só descobriria ao
   ler o código.

### ✅ Critério de pronto da Fase 1

Leia sua spec e responda:

- [ ] Cada critério de aceitação pode ser respondido com PASSOU/FALHOU por um comando?
- [ ] O não-escopo lista pelo menos três coisas que você imaginou e recusou?
- [ ] Cada caso extremo tem um teste correspondente nomeado na seção 9?
- [ ] A seção "Questões em aberto" tem pelo menos uma pergunta? *(Se tem zero, você
      provavelmente respondeu tudo por reflexo — releia procurando o que você "achou
      óbvio".)*
- [ ] A lista de arquivos que podem ser tocados está escrita, por caminho?

---

## 4. Fase 2 — Configurar os dois agentes

**Por quê:** os dois agentes leem o mesmo repositório, mas têm papéis opostos. Se os
dois puderem escrever, você tem dois escritores e nenhuma verificação.

### Divisão de responsabilidade

| | Escritor | Verificador |
|---|---|---|
| Ferramenta | Claude Code | Codex CLI |
| Arquivo de contexto | `CLAUDE.md` | `AGENTS.md` |
| Pode escrever? | Sim, só nos arquivos da spec | **Não** |
| Pode commitar? | Sim, na branch da spec | Não |
| Pode tocar `supabase/`? | Só patch migration nova, se a spec pedir | Não |
| Entrega | Código + testes verdes | Relatório de achados |

### Escritor — Claude Code

Instale/atualize e confira o estado:

```powershell
npm install -g @anthropic-ai/claude-code
cd C:\caminho\para\InventExpert
claude --version
```

Autenticação é do CLI, na primeira execução, pelo navegador. **Não** cole chave de API
na conversa nem no repositório.

Confirme as permissões dentro da sessão:

```
/permissions
```

Você deve ver as negações de `.claude/settings.json`. Para trabalhar com revisão a cada
passo, deixe o modo padrão — o agente pede aprovação antes de cada edição. É mais lento
e é o certo nas duas primeiras semanas.

**Restrição de escopo de escrita.** Ela vem de três lugares, nesta ordem de força:

1. A **spec** lista os arquivos que podem ser tocados (é a que o agente lê).
2. O `.claude/settings.json` nega o que nunca pode ser tocado.
3. **Você**, aprovando cada edição. ⚠️ Esta é a que funciona de verdade.

### Verificador — Codex CLI

```powershell
npm install -g @openai/codex
codex --version
codex --help
```

O `--help` importa: as flags de sandbox e de execução mudam entre versões. Confira que a
sua tem modo somente leitura e o modo não interativo `exec`.

O Codex CLI lê `AGENTS.md` do diretório do projeto automaticamente. Rode-o **sempre** em
sandbox de leitura:

```powershell
codex exec --sandbox read-only "Leia AGENTS.md e diga em uma frase qual é o seu papel."
```

Se a resposta mencionar auditar contra a spec e não escrever, o contexto carregou.

⚠️ Se a sua versão do Codex não tiver `--sandbox read-only`, use o modo interativo e
**negue toda proposta de edição**. A proibição do `AGENTS.md` ajuda, mas sandbox é
garantia e instrução é pedido.

### Uma branch por spec

```powershell
git switch main
git pull origin main
git switch -c spec/0001-evolucao-conferente
```

Uma branch por spec dá a você a coisa mais valiosa do método: `git diff main...HEAD` é
exatamente o escopo do ciclo, e é isso que o verificador audita.

### ✅ Critério de pronto da Fase 2

```powershell
claude --version
codex --version
git branch --show-current   # spec/0001-evolucao-conferente
npm run check
```

Pronto quando os dois CLIs respondem, você está na branch da spec, o `check` está verde
e o Codex descreveu o próprio papel corretamente.

---

## 5. Fase 3 — Primeiro ciclo curto (20 a 30 minutos)

**Por quê:** o primeiro ciclo não é para entregar funcionalidade. É para você sentir o
loop inteiro com um diff pequeno o bastante para caber na sua cabeça. Ciclo grande na
primeira vez ensina a coisa errada: você aprende a confiar no agente por cansaço.

### Passo 1 — Abrir o escritor (1 min)

```powershell
cd C:\caminho\para\InventExpert
claude
```

### Passo 2 — O prompt, literal (2 min)

Copie exatamente isto, incluindo a última linha:

```
Leia specs/0001-evolucao-conferente.md por inteiro antes de qualquer coisa.

Implemente APENAS o escopo da seção 2. Respeite o não-escopo item por item.

Arquivos que você pode tocar, e nenhum outro:
- src/services/HistoricoConferenteService.ts (criar)
- src/services/__tests__/HistoricoConferenteService.test.ts (criar)
- src/types/index.ts (só acrescentar os tipos da seção 5)

Regras:
- Os tipos e a assinatura vêm da seção 5 da spec, campo a campo. Não invente campo,
  não renomeie, não "melhore" o contrato.
- Um teste por caso extremo da seção 7, com o nome literal listado na seção 9.
- Função pura: sem import de supabase, AsyncStorage, expo-* ou react.
- Sem @ts-nocheck.
- Rode `npm run check` ao terminar e me mostre a saída.

Se alguma coisa na spec estiver ambígua, PARE e me pergunte. Não decida por mim.
```

A última linha é a mais importante do prompt inteiro. Sem ela o agente resolve a
ambiguidade sozinho, com bom senso, em silêncio — e você descobre a decisão dele
lendo o código na quinta-feira.

### Passo 3 — O que esperar (10 a 15 min)

Saída saudável:

- O agente cita a spec ao decidir ("a seção 5 define `score_final` como anulável")
- Pergunta em vez de assumir, se achar ambiguidade
- Cria só os três arquivos combinados
- Roda `npm run check` sozinho e mostra a saída
- Termina com a contagem de testes

Sinais de alerta — **interrompa** (Esc) se aparecerem:

| Sinal | O que é |
|-------|---------|
| Toca arquivo fora da lista | Escopo estourou. Peça para reverter |
| "Aproveitei e também…" | Escopo estourou, na versão simpática |
| Cria repository ou mexe em relatório | Está fazendo a fatia 2 ou 3 |
| Muda um teste existente para passar | Nunca aceite. É o pior padrão possível |
| Adiciona `@ts-nocheck` | Está escondendo erro de tipo |
| Silencia erro com `catch {}` | Repete o bug histórico do `secao_lookup` |

### Passo 4 — ⚠️ Revisão do diff (5 a 10 min)

Antes de aprovar qualquer commit:

```powershell
git diff --stat
git diff
npm run check
```

⚠️ Leia o diff **inteiro**, com estas quatro perguntas:

1. **Escopo:** só os três arquivos? Alguma linha a mais em `src/types/index.ts` além
   dos tipos novos?
2. **Contrato:** os campos batem com a seção 5, incluindo `| null` e opcionais?
3. **Testes:** cada teste realmente exercita o caso, ou só chama a função e verifica que
   não explodiu? `expect(x).toBeDefined()` no lugar de um valor exato é asserção fraca.
4. **Silêncio:** algum `catch` vazio, default onde a spec pediu `null`, `console.warn`
   onde deveria ser erro?

Se passou nas quatro:

```powershell
git add src/services/HistoricoConferenteService.ts src/services/__tests__/HistoricoConferenteService.test.ts src/types/index.ts
git commit -m "feat(historico): compararEvolucao conforme spec 0001 (fatia 1)"
```

### ✅ Critério de pronto da Fase 3

- [ ] `npm run check` verde, com **9 testes novos** (415 → 424) e 29 suites
- [ ] `git diff --stat main...HEAD` mostra exatamente 3 arquivos
- [ ] Você leu o diff inteiro e entende cada linha
- [ ] Commit feito na branch `spec/0001-evolucao-conferente`

---

## 6. Fase 4 — Verificação

**Por quê:** o escritor te dirá que terminou. Ele acredita nisso. O ponto cego não é
falta de capacidade — é que quem escreveu relê a intenção, não o texto. Um modelo de
outra família lê o texto, porque não tem a intenção.

### Prompt pronto para o verificador

Abra **outro** terminal PowerShell, na mesma pasta e na mesma branch:

```powershell
cd C:\caminho\para\InventExpert
git branch --show-current   # confirme: spec/0001-evolucao-conferente
```

```powershell
codex exec --sandbox read-only @"
Você é o VERIFICADOR. Leia AGENTS.md por inteiro e siga-o à risca — inclusive a
proibição de escrever qualquer arquivo.

Audite o diff desta branch contra specs/0001-evolucao-conferente.md.

Comandos que você deve rodar antes de julgar:
  git diff --stat main...HEAD
  git diff main...HEAD
  npm run check

Audite nesta ordem: baseline · escopo · não-escopo · contratos da seção 5 ·
casos extremos da seção 7 · regras invioláveis R1-R13 · honestidade dos testes ·
erros silenciados.

Classifique CADA achado como BUG DE CÓDIGO (a spec era clara e o código não obedeceu)
ou LACUNA DE SPEC (o código escolheu por conta própria algo que a spec não decidiu).
Na dúvida, LACUNA — e escreva no achado a frase que faltava na spec.

Devolva SÓ o relatório no formato definido em AGENTS.md. Zero achados é resposta
válida; não invente achado.
"@
```

> O `@"` … `"@` é *here-string* do PowerShell — preserva as quebras de linha do prompt.
> A aspa de fechamento `"@` precisa estar na **primeira coluna** da linha.

Se preferir o modo interativo, rode `codex` e cole o mesmo texto — ⚠️ negando toda
proposta de edição.

### Formato do relatório

Definido por extenso em [`AGENTS.md`](../AGENTS.md). O esqueleto:

```markdown
# Verificação — SPEC 0001

**Baseline:** tsc 0 erros · 424 testes / 29 suites · PASSOU
**Arquivos no diff:** src/services/HistoricoConferenteService.ts, …
**Fora do escopo declarado:** nenhum
**Veredito:** APROVADO COM RESSALVAS

## Achados

### [A1] Título curto e factual
- **Severidade:** BLOQUEANTE | ALTA | MÉDIA | BAIXA
- **Classificação:** BUG DE CÓDIGO | LACUNA DE SPEC
- **Arquivo:** `src/services/HistoricoConferenteService.ts:42`
- **Evidência:** ```ts (trecho exato) ```
- **Por que é um problema:** (com entrada concreta que produz o erro)
- **Correção sugerida:** (texto — o verificador não aplica)
- **Referência:** spec seção 7, caso E6

## Resumo
| # | Severidade | Classificação | Título |
**Contagem:** N bugs de código · N lacunas de spec
```

Guarde o relatório fora do repositório (`.agent-scratch/` está no `.gitignore`) ou cole
o essencial na seção 10 da spec.

### Por que a classificação é o centro de tudo

Ela determina o destino do achado:

- **BUG DE CÓDIGO** → volta ao escritor, com a referência da spec junto. O ciclo se
  fecha em minutos porque a spec já tinha a resposta.
- **LACUNA DE SPEC** → a spec ganha uma linha, e **só depois** o escritor corrige. Se
  você corrigir só o código, a mesma lacuna reaparece na próxima entrega, com outra
  cara.

O indicador mais importante das primeiras semanas é a proporção entre os dois. Muita
lacuna significa spec rasa — e é uma boa notícia, porque spec é barata de melhorar.
Muito bug de código com spec clara significa que o escopo do ciclo está grande demais.

### ✅ Critério de pronto da Fase 4

- [ ] O relatório veio no formato do `AGENTS.md`
- [ ] Todo achado tem arquivo, linha e trecho de evidência
- [ ] Todo achado está classificado como bug **ou** lacuna
- [ ] Nenhum arquivo do repositório foi alterado pelo verificador
      (`git status --short` idêntico a antes)

---

## 7. Fase 5 — Realimentar a spec

**Por quê:** sem esta fase o método é revisão de código com passos a mais. Com ela, cada
ciclo torna o próximo mais difícil de errar.

### Regra de decisão

Para cada achado, três destinos e um só critério:

```
O achado muda o que o código precisa fazer AGORA, nesta entrega?
├── SIM, e a spec já dizia          → BUG. Corrigir o código. Não mexer na spec.
├── SIM, e a spec não dizia         → LACUNA. Linha nova na spec, DEPOIS corrigir.
└── NÃO, é trabalho para depois     → ISSUE no GitHub, com link para a spec.

Não é nenhum dos três?              → DESCARTAR, com uma linha na seção 10 dizendo
                                      por que foi descartado.
```

Escreva o descarte. Achado descartado sem registro volta no ciclo seguinte, e você gasta
o mesmo tempo decidindo de novo.

### Os três casos, com exemplo real desta spec

**Vira linha na spec (lacuna).**

> **Achado A2** — MÉDIA — LACUNA DE SPEC. `HistoricoConferenteService.ts:31`. Quando a
> janela é 3 e um dos três eventos tem `score_final` nulo, o código completa com o
> quarto mais antigo. A spec define a janela (D5) e o descarte de nulos (D6), mas não
> diz se a janela conta eventos ou eventos *válidos*.

Destino: spec. Vira decisão **D7** na seção 3 e caso **E10** na seção 7:

> D7 — A janela conta eventos **válidos**: nulos são descartados antes e a janela busca
> mais fundo até completar N ou esgotar o histórico. Justificativa: o líder pediu "os
> três últimos com nota", e uma janela que encolhe silenciosamente compara sobre base
> menor sem dizer.

Só então o escritor corrige, agora com contrato.

**Vira issue.**

> **Achado A4** — BAIXA. A evolução é do agregado do conferente. Não dá para dizer
> "você melhorou em MEDICAMENTOS e piorou em PERFUMARIA", porque `produtividade` não
> guarda breakdown por área.

Destino: issue. É verdade, é útil, e **não é esta entrega** — a limitação já está
registrada como consequência negativa do ADR 0001. Vira issue "Evolução por área exige
histórico com breakdown de seção", com link para o ADR. A spec não muda.

**Descarta.**

> **Achado A5** — BAIXA. `compararEvolucao` poderia receber um comparador injetável para
> permitir estratégias alternativas de tendência.

Destino: descarte. É generalização sem demanda: existe **uma** estratégia, definida em
D3. Registre na seção 10: *"A5 descartado — abstração sem segundo caso de uso; D3 fixa
a estratégia por score final."* Se um dia surgir a segunda estratégia, o registro
mostra que a possibilidade foi considerada.

### Fechando o ciclo

1. Atualize a seção 10 da spec com todos os achados e destinos.
2. Aplique as lacunas como decisões/casos novos nas seções 3 e 7.
3. Só então peça as correções ao escritor, referenciando o número do achado.
4. ⚠️ Revise o diff da correção com o mesmo rigor da primeira vez — correção é onde o
   escopo estoura mais fácil, porque você já está cansado e já disse "sim" uma vez.
5. Rode o verificador de novo, agora contra a spec atualizada.
6. Marque a spec como `IMPLEMENTADA` e faça o merge.

```powershell
npm run check
git switch main
git merge --no-ff spec/0001-evolucao-conferente
git push -u origin main
```

### ✅ Critério de pronto da Fase 5

- [ ] Todo achado tem destino registrado na seção 10 — inclusive os descartados
- [ ] As lacunas viraram decisão ou caso extremo numerado
- [ ] A segunda verificação passou
- [ ] Spec marcada como `IMPLEMENTADA`

---

## 8. Fase 6 — Sessões longas e não supervisionadas

**Por quê:** um agente rodando três horas sozinho produz três horas de diff. Se algo
saiu do trilho no minuto oito, você tem 2h52 de código construído em cima de um erro —
e revisar isso custa mais que reescrever. Guardrail não é desconfiança do agente; é
limitar o raio do estrago quando o desvio acontece.

Este repositório **ainda não tem usuários em produção**, o que reduz o risco de release
mas não o risco de perder o seu tempo. Os guardrails abaixo protegem o segundo.

### Guardrails obrigatórios

**1. Branch dedicada, sempre.**

```powershell
git switch -c auto/0003-repository-historico
```

**2. Proibição de push em `main`.** Não existe travessura útil aqui: o agente não faz
push, ponto. Você faz, depois de revisar.

**3. `supabase/`, `app.json` e `eas.json` fora do alcance.** Migration já aplicada não
se edita (regra R12), `versionCode` é decisão de release e `eas.json` é infra. Escreva
isso no prompt e confie no não-escopo da spec.

**4. Sem segredo no ambiente do agente.** Antes de sair:

```powershell
Get-ChildItem .env* -Force
```

Se houver `.env` com chave real, mova para fora da pasta do projeto durante a sessão. O
`.claude/settings.json` nega a leitura, mas a ausência do arquivo é garantia — a negação
é configuração, e configuração se erra.

**5. Limite de arquivos tocados.** Diga o número no prompt: *"no máximo 4 arquivos; se
precisar de um quinto, pare e escreva o motivo em `.agent-scratch/PARADA.md`"*.

**6. Ponto de parada automático.** A condição de parada precisa ser objetiva:

> Pare imediatamente e escreva `.agent-scratch/PARADA.md` se: `npm run check` falhar
> duas vezes seguidas pelo mesmo motivo; precisar tocar arquivo fora da lista;
> encontrar ambiguidade na spec; ou completar os critérios de aceitação. Não invente
> trabalho novo depois de terminar.

O último item é o que mais salva: um agente que terminou e não tem parada escrita
procura o que melhorar.

**7. Uma spec, uma sessão.** Sessão longa não é para "fazer duas coisas". É para fazer
uma coisa com mais fôlego.

### Prompt de sessão longa

```
Leia specs/0003-repository-historico.md por inteiro.

Trabalhe SOZINHO até completar os critérios de aceitação da seção 9.

Limites (não negociáveis):
- No máximo 4 arquivos tocados, todos listados na seção 2 da spec.
- Nunca tocar: supabase/**, app.json, eas.json, .env*, .github/**
- Nunca rodar: git push, git checkout main, git rebase, git reset --hard
- Commit a cada critério de aceitação concluído, mensagem descritiva, sempre nesta
  branch.
- `npm run check` verde antes de cada commit. Nunca comitar vermelho.

PARE imediatamente e escreva .agent-scratch/PARADA.md (motivo + estado + o que falta) se:
- `npm run check` falhar duas vezes seguidas pelo mesmo motivo
- precisar de um quinto arquivo
- a spec estiver ambígua
- os critérios de aceitação estiverem completos

Ao terminar, escreva .agent-scratch/RESUMO.md: o que fez, decisões tomadas, o que ficou
em aberto.
```

### Checklist pré-sessão

```powershell
git branch --show-current        # branch dedicada, nunca main
npm run check                    # baseline verde ANTES de começar
git status --short               # working tree limpo
Get-ChildItem .env* -Force       # nenhum segredo ao alcance
git log --oneline -1             # ponto de retorno conhecido
```

- [ ] Spec `APROVADA`, com escopo, não-escopo e aceitação preenchidos
- [ ] Branch dedicada, criada a partir de `main` atualizada
- [ ] Baseline verde **antes** — sessão que começa vermelha termina inútil
- [ ] Working tree limpo (o diff da manhã tem que ser só do agente)
- [ ] Segredos fora do alcance
- [ ] Limite de arquivos e condição de parada escritos no prompt
- [ ] `.agent-scratch/` existe e está no `.gitignore`

### Checklist de revisão matinal

```powershell
Get-Content .agent-scratch\PARADA.md -ErrorAction SilentlyContinue
Get-Content .agent-scratch\RESUMO.md -ErrorAction SilentlyContinue
git log --oneline main..HEAD
git diff --stat main...HEAD
npm run check
```

- [ ] **Parou por quê?** Critérios completos ou bateu numa condição de parada?
- [ ] ⚠️ `git diff --stat` — número de arquivos dentro do limite? Algum caminho proibido?
- [ ] `npm run check` verde na sua máquina, não só no relato do agente
- [ ] ⚠️ **Leia o diff inteiro.** Se ficou grande demais para ler, essa é a informação
      mais importante do dia: o próximo escopo precisa ser menor
- [ ] Nenhum teste existente foi alterado (`git diff main...HEAD -- "*__tests__*"`)
- [ ] Rodar o verificador (Fase 4) **antes** de qualquer merge
- [ ] Se algo estiver errado: `git switch main` e recomeçar com spec melhor sai mais
      barato que consertar o diff. A branch fica lá para consulta

### ✅ Critério de pronto da Fase 6

- [ ] A sessão parou por conta própria, com motivo escrito
- [ ] O diff cabe numa revisão sua de 30 minutos
- [ ] `main` não recebeu nada sem passar por você e pelo verificador

---

## 9. Métricas

Cinco números, anotados numa planilha ou num `.md`. Levam dois minutos por ciclo e são a
diferença entre "acho que está funcionando" e saber.

| # | Métrica | Como medir | O que significa |
|---|---------|-----------|-----------------|
| **M1** | **% de achados que eram lacuna de spec** | lacunas ÷ total de achados | O termômetro central. Semana 1: 60–80% é normal e saudável. Se depois de duas semanas continuar acima de 50%, você está escrevendo spec rasa. Se cair abaixo de 20% e os bugs de código subirem, o escopo do ciclo está grande demais |
| **M2** | **Retrabalho por ciclo** | commits de correção ÷ commits de implementação | Quanto do ciclo é conserto. Acima de 1,0 (mais correção que implementação) a spec não está fechando as perguntas certas |
| **M3** | **Tempo até o primeiro desvio improdutivo** | minutos entre o prompt e a primeira coisa que você teve que interromper ou descartar | Mede quanto tempo o agente aguenta sozinho. É o número que autoriza (ou não) a sessão longa: enquanto for menor que 30 min, não deixe o agente rodando por horas |
| **M4** | **Arquivos tocados vs. arquivos previstos** | `git diff --stat` ÷ lista da spec | Vazamento de escopo. Deve ser 1,0. Persistentemente acima disso, o não-escopo está frouxo |
| **M5** | **Achados BLOQUEANTE/ALTA que chegaram ao merge** | contagem por ciclo | Deve ser **zero**. Qualquer valor diferente significa que a verificação está sendo pulada ou o veredito está sendo ignorado |
| **M6** | **Tamanho do diff revisado** | linhas em `git diff main...HEAD` | Proxy da sua capacidade real de revisar. Acima de ~400 linhas você não está revisando, está folheando — e o ⚠️ vira decoração |

Meça M1 e M3 desde o primeiro ciclo. As outras entram na segunda semana.

---

## 10. Erros comuns nas primeiras semanas

**Spec grande demais.** "Implementar evolução do conferente" é entrega; "a função pura
`compararEvolucao`" é ciclo. Sintoma: diff que você não consegue ler inteiro. Cura:
fatiar até caber em 30 minutos de revisão.

**Escrever a spec depois do código.** Vira legenda do que já existe e perde a única
função que tinha: forçar as decisões antes. Se você já codou, ou joga fora e recomeça,
ou aceita que aquele pedaço ficou sem spec — e escreve a spec do próximo.

**Aceitar o "está tudo verde" do escritor.** Ele acredita nisso. ⚠️ Rode `npm run check`
você mesmo, sempre. É o hábito de maior retorno do método inteiro.

**Deixar o verificador escrever.** Aí você tem dois escritores concordando, o que parece
verificação e não é. Sandbox somente leitura, sempre.

**Corrigir a lacuna só no código.** O achado sai, a lacuna fica, e ela volta na próxima
entrega com outra cara. A ordem é: spec primeiro, código depois.

**Não-escopo vazio.** Sem ele o agente entrega a função, o repository, o relatório e um
refactor de brinde. Escreva por nome o que você recusou.

**Corrigir teste para passar.** O momento mais perigoso do método. Se o teste falhou, ou
o código está errado, ou a spec mudou (e aí o teste muda com uma linha nova na spec
justificando). Alterar teste para virar verde é apagar o único sinal que você tinha.
⚠️ Sempre confira `git diff main...HEAD -- "*__tests__*"`.

**Deixar spec desatualizada.** Depois de três ciclos você tem specs que descrevem código
que mudou. Um agente lendo spec mentirosa produz código coerente com a mentira. Ou
atualiza, ou marca como `SUPERADA POR NNNN`.

**Sessão longa cedo demais.** Antes de M3 passar de 30 minutos, sessão longa é gerador
de diff para o lixo. Ganhe o direito com ciclos curtos.

**Confundir spec com ADR.** Spec morre com a entrega, ADR vive com a decisão. Misturar
os dois produz specs que ninguém atualiza e decisões que ninguém acha.

---

## 11. Plano de 14 dias

Do primeiro ciclo curto até a primeira sessão longa supervisionada. Sessões de 45 a 60
minutos; se um dia render menos, empurre o resto — a ordem importa mais que o calendário.

### Semana 1 — o loop, com rodinhas

| Dia | O quê | Pronto quando |
|-----|-------|---------------|
| **1** | Fase 0 e Fase 2. Confirmar `specs/`, `AGENTS.md`, `.claude/settings.json`, `npm run check`. Instalar/atualizar os dois CLIs. Pedir ao Codex que descreva o próprio papel | Os dois CLIs respondem, `check` verde, Codex se descreve como verificador que não escreve |
| **2** | Ler `specs/0001-evolucao-conferente.md` inteira. Ler `AGENTS.md` inteiro. Não codar nada | Você consegue explicar, sem reler, por que o histórico vem de `produtividade` (ADR 0001) e o que E4 protege |
| **3** | **Primeiro ciclo (Fase 3).** Prompt literal, escritor, ⚠️ revisão do diff, commit | 424 testes verdes, 3 arquivos no diff, você leu tudo |
| **4** | **Primeira verificação (Fase 4).** Codex em sandbox de leitura, relatório no formato | Relatório com todo achado classificado bug/lacuna |
| **5** | **Realimentação (Fase 5).** Classificar destinos, atualizar seções 3, 7 e 10, corrigir, reverificar, merge. Anotar M1 e M3 | Spec `IMPLEMENTADA`, merge feito, duas métricas anotadas |
| **6** | Escrever `specs/0003-repository-historico.md` — fatia 2, o repository seguindo o padrão de `modalidadeRepository.ts` (Supabase é verdade, AsyncStorage é cache, `null` nunca vira default) | Spec passa no critério de pronto da Fase 1 |
| **7** | Folga ou revisão. Reler a spec 0001 já implementada: ela ainda descreve o código? | Spec e código concordam, ou a divergência virou linha na seção 10 |

### Semana 2 — autonomia com guardrail

| Dia | O quê | Pronto quando |
|-----|-------|---------------|
| **8** | Ciclo 2 (spec 0003), ainda com você aprovando cada edição. Agora tem IO: mock de Supabase nos testes | `check` verde, diff dentro do escopo |
| **9** | Verificação do ciclo 2 + realimentação. Comparar M1 com o ciclo 1 | M1 caiu? Se sim, a spec 0001 ensinou a spec 0003 |
| **10** | Escrever `specs/0004-bloco-evolucao-ficha.md` — fatia 3, o bloco na ficha. ⚠️ Casos extremos de modalidade: no FREE, evolução própria pode aparecer, comparação com a equipe não. Trave com teste, no padrão de `relatorioV3Modalidade.test.ts` | Spec com os casos de modalidade escritos e um teste nomeado para cada |
| **11** | Ciclo 3 em modo mais solto: aprove em blocos, não a cada edição. Cronometre M3 | M3 anotado. Se o primeiro desvio veio antes dos 30 min, adie a sessão longa e fatie mais |
| **12** | Verificação + realimentação do ciclo 3. Fechar a entrega "evolução do conferente" inteira. Atualizar `CLAUDE.md` com a decisão arquitetural nova (uma linha na tabela) | Três specs `IMPLEMENTADA`, `CLAUDE.md` atualizado |
| **13** | **Primeira sessão longa (Fase 6), supervisionada.** Escolha uma spec pequena (ex.: extrair um hook de `InventExpImportScreen`), rode a checklist pré-sessão, deixe rodar 60 a 90 minutos **com você por perto**. Observe sem interromper, salvo desvio real | O agente parou sozinho com `PARADA.md` ou `RESUMO.md` escrito |
| **14** | Revisão matinal completa da sessão do dia 13. Fechar as seis métricas. Decidir: sessão longa não supervisionada já, ou mais uma semana de ciclos curtos? | M1–M6 anotadas e a decisão tomada com número, não com sensação |

**Critério para liberar a sessão não supervisionada:** M3 > 45 min, M4 = 1,0 e M5 = 0
por três ciclos seguidos. Antes disso, sessão longa sem ninguém por perto é diff caro
para jogar fora.

---

## Referências no repositório

| Arquivo | O que é |
|---------|---------|
| [`specs/README.md`](../specs/README.md) | Como a pasta funciona; spec × ADR × issue |
| [`specs/TEMPLATE.md`](../specs/TEMPLATE.md) | O molde a copiar |
| [`specs/0001-evolucao-conferente.md`](../specs/0001-evolucao-conferente.md) | Spec real preenchida |
| [`specs/decisions/0001-historico-le-produtividade.md`](../specs/decisions/0001-historico-le-produtividade.md) | ADR real |
| [`AGENTS.md`](../AGENTS.md) | Contexto e regras do verificador |
| [`CLAUDE.md`](../CLAUDE.md) | Contexto do escritor — regras de negócio do projeto |
| [`docs/PROCEDIMENTO_AVALIACAO.md`](PROCEDIMENTO_AVALIACAO.md) | Procedimento de campo da avaliação |
| [`docs/SUPABASE_ESTADO.md`](SUPABASE_ESTADO.md) | O que está de fato aplicado no banco |
