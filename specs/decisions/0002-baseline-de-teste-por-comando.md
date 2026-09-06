# ADR 0002 — A baseline de teste do `CLAUDE.md` é um comando, não um número

- **Estado:** ACEITO
- **Data:** 2026-09-06
- **Spec relacionada:** 0003 (questão Q2)

## Contexto

O `CLAUDE.md` carregava a baseline como um par congelado: *"415 testes / 28 suites"*,
depois *"428 testes / 29 suites"*. O número serve para um agente confirmar que não
quebrou nada — mas envelhece a cada PR, e ninguém percebe quando envelhece errado.

O `specs/README.md` já lista **"três baselines de teste conflitantes"** entre as
dezesseis divergências que motivaram a pasta `specs/` a existir. O quarto apareceu em
2026-09-06, no PR #21: a branch saiu de `380106a`, a `main` avançou com o #17 e
seguintes enquanto isso, e o `428/29` medido na base defasada foi mergeado como se
fosse verdade. O valor real na `main` era `437/29`. Nenhum teste falhou, nenhuma
verificação acusou — um documento que existe para ser fonte de contexto passou nove
testes a mentir.

O modo de falha não é o número estar errado. É ele poder estar errado **sem que nada
falhe**. Um número que só uma pessoa atenta consegue invalidar não é uma verificação:
é uma afirmação com aparência de verificação. Pior, um agente que lê `428` numa `main`
com `437` conclui que quebrou alguma coisa, e "conserta" o que está certo.

## Decisão

O `CLAUDE.md` deixa de publicar a contagem. No lugar, manda rodar `npm run check`
(`tsc --noEmit && jest`) e exigir que ele termine verde — o mesmo comando que a seção
9 de toda spec já usa como critério de aceitação.

## Alternativas descartadas

**Manter o número e atualizá-lo com disciplina.** É o que já se tentou três vezes; a
quarta falhou do mesmo jeito. A disciplina depende de quem edita ter medido na base
certa, e é justamente isso que não dá para verificar lendo o diff.

**Gerar o número automaticamente por hook ou CI.** Resolveria a defasagem, mas cria
manutenção de infraestrutura para produzir um dado que o próprio comando já devolve em
vinte segundos. Custo permanente para um benefício que `npm run check` entrega de graça.

**Publicar só o número de suites**, mais estável que o de testes. Mesma classe de
problema, com frequência menor de erro — o que só torna a defasagem mais difícil de
notar quando acontece.

## Consequências

**A favor.** A baseline passa a ser verificável por qualquer um, a qualquer momento, sem
depender de o documento estar em dia. Some uma categoria inteira de divergência entre
`CLAUDE.md` e repositório. Fonte única: o mesmo comando dos critérios de aceitação.

**Contra — e este é o custo real.** Perde-se a detecção passiva de teste sumido. Com o
número escrito, alguém que apagasse uma suíte inteira poderia ser pego pela contagem
menor no diff. Sem ele, `npm run check` continua verde com menos testes e ninguém nota.

Essa perda é aceita por duas razões. A primeira é que a detecção era teórica: exigia que
alguém comparasse a contagem contra o documento, e nas quatro vezes em que o número
divergiu, ninguém comparou. A segunda é que o buraco é de cobertura, e cobertura tem
ferramenta própria — `npm test -- --coverage`. Trocar uma detecção que nunca funcionou
por um comando que sempre funciona é o negócio que este ADR aceita.
