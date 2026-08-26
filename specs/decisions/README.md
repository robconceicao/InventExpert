# specs/decisions/ — ADRs (Architecture Decision Records)

Um ADR registra **uma decisão de arquitetura e por que as alternativas foram
descartadas**. Ele responde à pergunta que aparece seis meses depois, geralmente na voz
de alguém (ou de algum agente) que quer "consertar" o que não está quebrado:

> "Por que isso foi feito assim?"

## Diferença para a spec

A spec descreve **uma entrega** e morre quando a entrega termina. O ADR descreve **uma
escolha** e vive enquanto a escolha valer. A tabela "Decisões Arquiteturais Registradas"
do `CLAUDE.md` é uma lista de ADRs comprimidos em uma linha cada; esta pasta é o lugar
onde os que precisam de contexto ficam por extenso.

## Regras

1. **Nunca edite um ADR aceito.** Se a decisão mudou, escreva um novo e marque o antigo
   como `SUPERADO POR NNNN`. Um ADR editado apaga a razão pela qual a decisão antiga
   fazia sentido — e é essa razão que evita repetir o erro.
2. **Alternativa descartada é obrigatória.** Um ADR sem alternativa é propaganda.
3. **Consequência negativa é obrigatória.** Toda decisão custa alguma coisa. Se você não
   consegue nomear o custo, você não entendeu a decisão.
4. Uma decisão por arquivo. Numeração sequencial, `NNNN-slug.md`.

## Formato

```markdown
# ADR NNNN — [título]

- **Estado:** PROPOSTO | ACEITO | SUPERADO POR NNNN
- **Data:** AAAA-MM-DD
- **Spec relacionada:** NNNN

## Contexto
O que era verdade quando a decisão foi tomada.

## Decisão
O que foi decidido, em uma frase.

## Alternativas descartadas
| Alternativa | Por que não |

## Consequências
Positivas e — obrigatoriamente — negativas.
```
