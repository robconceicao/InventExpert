# specs/ — o contrato antes do código

Esta pasta guarda **uma spec por entrega**. Spec é o documento que descreve o que vai
ser construído, com contratos de dados e critérios de aceitação verificáveis, escrito
**antes** de qualquer linha de código.

## Por que isto existe

O InventExpert já registrava decisões — em `CLAUDE.md`, `TASK_LIST.md` e
`ANTIGRAVITY_CONTEXT_InventExpert.md`. O que faltava era um contrato **por entrega**.
O preço dessa falta está registrado no próprio `TASK_LIST.md`: dezesseis divergências
(D1 a D16) descobertas *depois* do código pronto — limite de FRENTE DE CAIXA em 15% no
código e 90% na migration, `ModalidadeContrato` com três grafias, arquivos documentados
que nunca existiram, três baselines de teste conflitantes.

Nenhuma dessas é uma falha de programação. Todas são perguntas que ninguém respondeu
por escrito antes de programar. É isso que a spec resolve.

## Como usar

| Passo | O quê |
|-------|-------|
| 1 | Copie `TEMPLATE.md` para `NNNN-slug.md` (número sequencial, slug curto em kebab-case) |
| 2 | Preencha **tudo**, inclusive "Questões em aberto" — pergunta não respondida é informação, não vergonha |
| 3 | Leia você mesmo antes de dar ao agente. Se você não consegue dizer se um critério de aceitação passou ou não, ele não é um critério |
| 4 | Só então abra o agente escritor |
| 5 | Depois da verificação, **realimente a spec** (seção "Registro de realimentação") |

## Estados de uma spec

Marque no cabeçalho do arquivo:

- `RASCUNHO` — em escrita, não dar ao agente ainda
- `APROVADA` — pronta para implementação, congelada durante o ciclo
- `IMPLEMENTADA` — código no repositório e verificação feita
- `SUPERADA POR NNNN` — substituída por outra spec (nunca apague a antiga)

## Spec × ADR × issue

Três coisas diferentes, e confundi-las é o erro mais comum:

| | O que é | Onde mora | Vida útil |
|---|---|---|---|
| **Spec** | O que a entrega faz, com contratos e aceitação | `specs/NNNN-slug.md` | Uma entrega |
| **ADR** | Uma decisão de arquitetura e por que as alternativas foram descartadas | `specs/decisions/NNNN-slug.md` | Permanente — nunca se edita um ADR, se escreve outro que o supera |
| **Issue** | Trabalho futuro que não é desta entrega | Issue do GitHub | Até ser feito |

Regra prática: se a informação **muda o que o código precisa fazer agora**, é spec.
Se **justifica uma escolha que alguém vai questionar em seis meses**, é ADR.
Se **é trabalho para depois**, é issue.

## Regra dura

**Spec desatualizada é bug.** Se o código faz algo que a spec não descreve, uma das duas
está errada, e descobrir qual é trabalho — não improviso. Um agente lendo uma spec
mentirosa produz código coerente com a mentira.
