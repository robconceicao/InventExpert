# Métricas do fluxo SDD

Registro por ciclo. Dois minutos de preenchimento; é a diferença entre "acho que
está funcionando" e saber. As definições estão na seção 9 de
[`SDD_AGENTES.md`](SDD_AGENTES.md).

| # | Métrica | Meta / leitura |
|---|---------|----------------|
| M1 | % de achados que eram **lacuna de spec** | Semana 1: 60–80% é saudável. >50% depois de duas semanas = spec rasa. <20% com bugs subindo = escopo grande demais |
| M2 | Retrabalho (commits de correção ÷ de implementação) | >1,0 = a spec não fecha as perguntas certas |
| M3 | Minutos até o primeiro desvio improdutivo | <30 min = ainda não libere sessão longa |
| M4 | Arquivos tocados ÷ previstos na spec | Deve ser 1,0 |
| M5 | Achados BLOQUEANTE/ALTA que chegaram ao merge | Deve ser **zero** |
| M6 | Linhas no diff revisado | >400 = você folheou, não revisou |

---

## Ciclo 1 — spec 0002 (cabeçalho ausente nos parsers v3)

**Data:** 2026-08-27 · **PR:** #18

| Métrica | Valor | Observação |
|---------|-------|------------|
| **M1** | **33%** — 1 lacuna de 3 achados | Abaixo da faixa esperada para a semana 1. Não é bom sinal por si só: os dois bugs eram contra regras que a spec **já dizia** (D3 e E6), o que aponta implementação apressada, não spec rasa |
| **M2** | **1,0** — 1 commit de correção / 1 de implementação | No limite. Os três achados vieram de uma verificação só, então foi um ciclo de conserto, não três |
| **M3** | não medido | O ciclo não foi cronometrado; medir no próximo |
| **M4** | **1,25** — 5 arquivos de código tocados, 4 previstos | O teste do consolidado faltava na lista de escopo da spec. Registrado como lacuna na seção 10 dela |
| **M5** | **0** | Os três achados foram pegos **antes** do merge. É o número que mais importa |
| **M6** | **~380 linhas** (+342 −37 na primeira leva) | Dentro do que dá para revisar de verdade |

### Achados do ciclo

| # | Severidade | Classificação | O quê |
|---|-----------|---------------|-------|
| A1 | ALTA | BUG DE CÓDIGO | Ressalva só chegava ao consolidado no ramo v3; caindo no v2.1, o líder não via nada — apesar de o PROD_SEÇÃO alimentar aquele motor |
| A2 | MÉDIA | LACUNA DE SPEC | Reimportar o relatório corrigido mantinha a ressalva do arquivo antigo. Ninguém tinha decidido o que acontece na reimportação |
| A3 | MÉDIA | BUG DE CÓDIGO | No PROD_SEÇÃO o `return` de zero linhas vinha antes do registro, e a mensagem culpava colunas que existem no arquivo |

### Ressalva sobre esta verificação

**Ela não foi feita pelo verificador previsto.** O Codex CLI ainda não foi instalado;
quem revisou foi o mesmo modelo que escreveu, com o comando de revisão do próprio
Claude Code. Achou três coisas reais, então valeu — mas é uma checagem mais fraca que a
do método, exatamente porque não é independente. Modelos da mesma família tendem a
errar nos mesmos lugares.

**O que isso significa para M1:** os 33% podem estar enviesados. Um verificador de
outra família provavelmente classificaria diferente, e possivelmente acharia coisas que
este não viu. Trate este número como piso, não como medida.
