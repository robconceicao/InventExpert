# SPEC NNNN — [título curto da entrega]

- **Estado:** RASCUNHO | APROVADA | IMPLEMENTADA | SUPERADA POR NNNN
- **Autor:** Roberto
- **Data:** AAAA-MM-DD
- **Entrega relacionada:** [issue, item de backlog, ou "—"]

---

## 1. Objetivo

*Uma frase dizendo o que passa a ser possível depois desta entrega, do ponto de vista de
quem usa o app — líder de inventário, conferente, cliente. Não descreva a solução
técnica aqui; descreva o resultado. Se você não consegue escrever essa frase, você ainda
não sabe o que vai construir.*

## 2. Escopo

*A lista fechada do que esta entrega faz. Cada item deve ser pequeno o bastante para
caber num ciclo. Escopo grande demais é a causa número um de agente que se perde.*

- [ ] …

### Não-escopo

*Igualmente obrigatório. É aqui que você impede o agente de "melhorar" o que você não
pediu. Todo item que você imaginou e decidiu não fazer agora entra nesta lista, por
nome. Um agente sem não-escopo escrito preenche as lacunas sozinho — e ele é bom nisso,
o que torna o problema pior, não melhor.*

- …

## 3. Decisões de arquitetura

*Cada decisão com a justificativa junto. A justificativa não é enfeite: é o que permite
ao verificador dizer "isto contradiz a decisão D2" em vez de "não gostei". Alternativa
descartada e o motivo do descarte contam como parte da decisão.*

| # | Decisão | Justificativa | Alternativa descartada |
|---|---------|---------------|------------------------|
| D1 | | | |

## 4. Restrições

*O que a entrega tem de respeitar mesmo que fosse mais fácil ignorar: regras de negócio
invioláveis, compatibilidade, offline, desempenho, tamanho de bundle, prazo. Restrição
não escrita é restrição que o agente vai violar de boa-fé.*

- …

## 5. Interfaces e contratos de dados

*Assinaturas de função, tipos TypeScript, formato de tabela ou de arquivo. Escreva o
tipo completo, com os campos opcionais marcados e o significado de `null` explicitado —
no InventExpert, `null` já significou "não conferido" e virou default silencioso uma
vez; a diferença mora aqui.*

```typescript
// tipos e assinaturas
```

## 6. Dependências

*O que precisa existir para esta entrega funcionar: tabela no Supabase, migration
aplicada, arquivo que o usuário anexa, biblioteca, outra spec. Marque cada uma como
JÁ EXISTE ou A CRIAR — e se for A CRIAR, diga se está no escopo desta spec ou não.*

| Dependência | Estado | No escopo? |
|-------------|--------|------------|
| | | |

## 7. Casos extremos

*O coração da spec. Liste as situações reais em que a implementação óbvia erra. Puxe do
domínio, não da imaginação: relógio de coletor fora de data, arquivo sem extensão,
conferente no primeiro inventário, prestador FREE que não pode ser comparado com a
equipe. Cada caso extremo aqui deve virar um teste na seção 9.*

| # | Caso | Comportamento esperado |
|---|------|------------------------|
| E1 | | |

## 8. Questões em aberto

*Perguntas que você ainda não respondeu. Escrever a pergunta é o que impede o agente de
responder por conta própria e você descobrir a resposta dele só no code review. Cada
questão precisa de um dono e de um estado.*

| # | Pergunta | Dono | Estado |
|---|----------|------|--------|
| Q1 | | Roberto | ABERTA |

## 9. Critérios de aceitação

*Verificáveis significa: outra pessoa (ou outro agente) consegue rodar um comando e
dizer PASSOU ou FALHOU sem te perguntar nada. "Funciona bem" não é critério. "O teste
`nome do teste` passa" é.*

- [ ] `npm run check` termina sem erro (tsc = 0 erros, suíte inteira verde)
- [ ] Testes novos em `caminho/do/arquivo.test.ts`, um por caso extremo da seção 7:
  - [ ] E1 → `nome literal do teste`
- [ ] Nenhum arquivo fora desta lista foi tocado: `arquivo1`, `arquivo2`
- [ ] …

## 10. Registro de realimentação

*Preenchido DEPOIS do ciclo, com o que a verificação encontrou. É este registro que
transforma a spec num documento vivo em vez de um artefato de abertura. Toda linha aqui
é uma pergunta que a próxima spec já vai nascer respondendo.*

| Data | Achado | Classificação | O que foi feito |
|------|--------|---------------|-----------------|
| | | BUG DE CÓDIGO / LACUNA DE SPEC | |
