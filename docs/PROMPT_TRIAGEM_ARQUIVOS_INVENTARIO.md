# Prompt — triagem de uma pasta de arquivos de inventário

Prompt pronto para descobrir, numa pasta qualquer de arquivos de inventário, **o que
serve para o módulo Avaliação** e o que não serve.

## Quando usar

Chegou uma pasta de uma loja nova (ou do Desktop, ou de um pendrive) e você não sabe
se dá para rodar a avaliação com aquilo. Este prompt responde três perguntas:

1. O que é cada arquivo, de verdade — pelo conteúdo, não pelo nome nem pela extensão.
2. Qual motor responde com o que está ali: v2.1, v3, ou nenhum.
3. O que falta, por nome.

## Como usar

Abra o Claude Code **dentro deste repositório** — o prompt manda o agente conferir os
parsers de verdade, e isso só funciona com o código à mão. Depois cole o bloco abaixo,
substituindo `<NOME-DA-PASTA>` e a linha `OPERAÇÃO`.

```
Analise uma pasta de arquivos de inventário e me diga o que dela serve para o
módulo Avaliação deste repositório.

PASTA: $env:USERPROFILE\Desktop\<NOME-DA-PASTA>
OPERAÇÃO: supermercado (não é farmácia)

REGRAS DE TRABALHO — leia antes de tocar em qualquer coisa
- Somente leitura. Não mova, renomeie, converta, salve por cima nem apague nada
  na pasta. Se precisar manipular, copie para uma pasta temporária fora do Desktop.
- Nunca abra os arquivos no Excel: ele reescreve o XLS e destrói o formato que o
  parser espera.
- Os arquivos contêm CPF e nome de pessoas. No relatório, cite contagens e amostras
  mascaradas (***.456.789-**), nunca listas de CPF ou de nomes completos.
- Não altere nada em src/. Esta tarefa é diagnóstico, não implementação.

PASSO 1 — Fundamente-se no repositório
Leia, nesta ordem, para saber o que o módulo realmente aceita hoje:
- CLAUDE.md, seções "Arquivos de Entrada do Módulo Avaliação", "Formato .prc" e
  "Regras de Negócio Críticas"
- src/utils/fileFormat.ts        (detecção por magic bytes e encoding)
- src/utils/avaliacaoV3Parsers.ts (PROD_SEÇÃO, ACURACIDADE, NAO CONTADOS, DOBRO, BLOCO)
- src/utils/prcParser.ts          (layout de 83/84 posições)
- src/utils/inventoryImportParsers.ts e src/utils/parsers.ts (PRODUÇÃO / conferentes)
- src/utils/catalogoLookup.ts     (cadastro.txt e invent_DSP)
A verdade é o código, não a minha descrição nem a documentação — se divergirem,
me diga onde divergem.

PASSO 2 — Inventário bruto da pasta
Liste recursivamente nome, caminho relativo, tamanho e data de modificação de
TODOS os arquivos, inclusive subpastas e arquivos sem extensão.

PASSO 3 — Descubra o formato REAL de cada arquivo
Não confie na extensão nem no ícone. Leia os primeiros bytes e classifique:
  50 4B 03 04                → XLSX
  D0 CF 11 E0                → XLS binário
  09 00 / 09 02 / 09 04 / 09 08 → BIFF cru
  "<html", "<table", "MIME-Version" → HTML ou MHTML (o "Excel" do Crystal Reports
                                      costuma ser isto, com extensão .xls)
  qualquer outra coisa       → texto
Para os de texto, diga se são UTF-8 válido ou windows-1252 (se "SEÇÃO" chegar como
"SE?ÃO", o encoding está errado e a normalização de área falha).
Marque com destaque todo arquivo em que a extensão mente sobre o conteúdo.

PASSO 4 — Diga o que cada arquivo É, comparando com as entradas do módulo
Entradas que o módulo Avaliação conhece:

  OBRIGATÓRIAS
  - PRODUÇÃO.xls          totais por conferente: peças, horas, erro%, bloco total
  - PRODUÇÃO_SEÇÃO.xls    breakdown por área × conferente

  OPCIONAIS (habilitam a v3 e o RAIO-X)
  - .prc (vários)         texto de largura fixa, 83 ou 84 chars por linha
  - PROD_SEÇÃO.xlsx       área física × conferente × nº de seções × Qtd C1/A1/A2/A3/FINAL
  - ACURACIDADE.xls       por SEÇÃO + EAN: C1, A1/A2/A3, FINAL, AJST(QTD)
  - NAO CONTADOS.xls      produtos com saldo em sistema e sem coleta
  - DOBRO.xls             bipadas repetidas
  - BLOCO.xls             seção + CPF + EAN + família + qtde
  - cadastro.txt          texto fixo 38 chars, latin-1 — código interno → descrição
  - invent_DSP_[DATA].old CSV ';' latin-1 — código → EAN real → descrição
  - agentes.txt / CadFun  resolução de identidade (CPF × matrícula × código ProInv)

Identifique cada arquivo por CONTEÚDO, não por nome: relatório do Crystal sai com
título e filtros antes do cabeçalho e colunas espalhadas por posições vazias, e o
nome do arquivo varia por loja. Para cada candidato, abra como matriz, mostre as
5 primeiras linhas úteis e confirme que os rótulos de cabeçalho que o parser
procura existem de fato. Se o cabeçalho não bater, o arquivo NÃO é usável — diga
isso, com a linha que você encontrou no lugar.

Para os .prc, confirme o layout antes de dar como bom:
- comprimento das linhas (83 ou 84)
- existência do prefixo "PI" dentro da janela 44-58 (não numa posição fixa)
- quantidade nos 9 últimos dígitos (÷ 1000)
- amostra de datas: relógio de coletor fora de data é comum e não invalida o arquivo

PASSO 5 — Ressalvas de SUPERMERCADO (não pule esta parte)
O módulo nasceu para farmácia. Diga explicitamente, para esta pasta:
- Bloco NÃO é penalizado fora de FARMACIA: detectarViolacoesBloco() devolve [] de
  imediato. Então BLOCO.xls aqui não vale como penalidade — vale como conferência
  independente de seção/CPF/EAN e como detector de mudança de layout do coletor.
- limites_bloco_area tem seed de farmácia. Em supermercado, área sem limite
  cadastrado é o esperado, não é erro, e não pode virar penalidade.
- Os aliases de normalizarNomeArea() são nomes de farmácia. Liste as áreas reais
  que aparecem nos arquivos desta pasta e diga quantas casariam hoje.
- Classificação legal A1/A2/A3, B1/B2, C1/C2/C3 do invent_DSP é conceito de
  farmácia; aqui o arquivo interessa por EAN e descrição.
- qualityDecayK é por perfil de operação: confira em src/config/inventoryEvalConfig.ts
  qual valor vale para SUPERMERCADO/HIPERMERCADO/ATACADO e diga qual se aplica.

FORMATO DA RESPOSTA

1) Tabela, um arquivo por linha:
   arquivo | formato real | extensão mente? | encoding | o que é | parser que lê |
   usável: SIM / NÃO / COM RESSALVA | motivo em uma linha

2) Veredito:
   - Com o que está nesta pasta, qual motor responde: v2.1, v3, ou nenhum?
   - O que falta para o v3 (liste por nome os arquivos ausentes)
   - O que falta para rodar qualquer coisa (as duas entradas obrigatórias)

3) Riscos e ressalvas, em ordem de gravidade — comece pelos arquivos cuja extensão
   mente, pelos cabeçalhos que não bateram e pelas ressalvas de supermercado.

4) O que NÃO dá para saber só olhando a pasta (ex.: modalidade de contratação de
   cada conferente, que é marcada pelo líder e bloqueia o processamento quando nula).

Se algum arquivo não se encaixar em nenhuma entrada conhecida, não force: liste em
"não identificados", com as 3 primeiras linhas, e me pergunte.
```

## Por que o prompt insiste nessas três coisas

**Formato pelo conteúdo, não pela extensão.** O export "Excel" do Crystal Reports é
HTML com extensão `.xls`. Um relatório que parece pronto pode não abrir no parser — e
o inverso também: arquivo sem extensão pode ser perfeitamente utilizável. É a mesma
regra que `fileFormat.ts` aplica em produção, e ela existe porque a extensão já mentiu
aqui antes.

**Confirmar o cabeçalho, não só o nome do arquivo.** Cada parser localiza a própria
linha de cabeçalho pelos rótulos, porque o Crystal espalha as colunas. Sem essa
checagem, "usável" é chute — e o erro só aparece na hora de rodar, com o líder
esperando.

**As ressalvas de supermercado.** Fora de farmácia o bloco não penaliza nada e os
limites por área são um seed de farmácia. Sem esse aviso escrito no relatório, é fácil
olhar o `BLOCO.xls` e concluir que há algo a cobrar de um conferente que o motor vai
ignorar por completo.

## Adaptando para farmácia

Troque a linha `OPERAÇÃO` e, no Passo 5, inverta a leitura: em FARMÁCIA o bloco
penaliza, os limites de `limites_bloco_area` valem, e área sem limite cadastrado passa
a ser **lacuna de cadastro** — tem que aparecer no aviso da tela e na aba Ressalvas do
consolidado, nunca só num `console.warn`.
