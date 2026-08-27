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

Abra o Claude Code **dentro deste repositório**, na máquina onde a pasta está — o
prompt manda o agente conferir os parsers de verdade, e isso só funciona com o código à
mão. Depois cole o bloco abaixo, ajustando o caminho e a linha `OPERAÇÃO`.

```
Analise uma pasta de arquivos de inventário e me diga o que dela serve para o
módulo Avaliação deste repositório.

PASTA: C:\Users\<usuário>\Downloads\<NOME-DA-PASTA>
OPERAÇÃO: supermercado (não é farmácia)

REGRAS DE TRABALHO — leia antes de tocar em qualquer coisa
- Somente leitura. Não mova, renomeie, converta, salve por cima nem apague nada
  na pasta. Se precisar manipular, copie para uma pasta temporária fora dela.
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
Não confie na extensão nem no ícone. Leia os primeiros bytes e classifique, na
mesma ordem que detectarFormato() usa:
  50 4B 03 04                     → XLSX (contêiner ZIP)
  D0 CF 11 E0 A1 B1 1A E1         → XLS binário (CFB, Excel 97-2003)
  09 00 / 09 02 / 09 04 / 09 08   → XLS (BIFF2-5 cru)
  "MIME-Version:" ou
  "Content-Type: multipart/related" → HTML (MHTML — o "Excel" do Crystal Reports
                                      costuma ser isto, com extensão .xls)
  "<?xml" + "spreadsheet"/"<workbook" → XML (SpreadsheetML 2003)
  "<?xml" + "<table"/"<html"      → HTML
  "<!doctype html", "<html", "<table" → HTML
  qualquer outra coisa            → TEXTO
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
nome do arquivo varia por loja.

RÓTULOS QUE CADA PARSER PROCURA (conferidos em src/utils/avaliacaoV3Parsers.ts).
Comparação é feita em maiúsculas e sem acento, por igualdade OU substring, e
localizarCabecalho() desiste depois de 200 linhas:

  PROD_SEÇÃO   obrigatórios: AREA + MATRICULA
               demais: NOME · SECOES CONTADAS/SECOES · QTD(C1) · QTD(A1) ·
                       QTD(A2) · QTD(A3) · QTD(FINAL)
  ACURACIDADE  obrigatórios: SECAO + C1
               demais: BARRA/EAN · DESCRICAO · QTD(A1..A3) · QTD(FINAL) · AJST/AJUSTE
  NAO CONTADOS obrigatórios: ORDEM + DESCRICAO
               demais: DEP · PRECO UNIT/PRECO
  DOBRO        obrigatórios: SECAO + COD.COLETADO
               demais: DESCRICAO · FAMILIA · QTDE(INV)
  BLOCO        obrigatórios: SECAO + CODIGO COLETADO
               demais: DESCRICAO · FAMILIA · QTDE (C FINAL)
               CPF e nome NÃO têm rótulo: saem de SECAO+2 e SECAO+5
  PRODUÇÃO     header CSV, separador ; , ou tab:
               NOME DO CONFERENTE;PRODUTIVIDADE;QTDE. VOLUMES;1a1;BLOCO;
               HORAS ESTIMADAS;ERRO;% ERRO
               (aceita também o simplificado Nome,Qtde,Qtde1a1,Produtividade,Erro)

ATENÇÃO — cabeçalho que não bate NÃO produz erro visível.
Só parseAcuracidadeMatrix lança exceção quando não acha o cabeçalho. PROD_SEÇÃO,
NAO CONTADOS, DOBRO e BLOCO caem em ÍNDICES DE COLUNA FIXOS (area=1, matricula=6,
nome=9 …; ean=5, secao=15 …; secao=3, ean=14 …) e leem a coluna errada em
silêncio, produzindo número plausível e falso. Portanto:

  - Abra cada candidato como matriz, mostre as 5 primeiras linhas úteis e diga
    em que linha o cabeçalho foi encontrado.
  - Confirme, rótulo a rótulo, que os obrigatórios existem.
  - Classifique o arquivo como:
      USÁVEL                            → cabeçalho encontrado, obrigatórios batem
      RISCO DE LEITURA SILENCIOSA ERRADA → parece ser este relatório, mas o
                                           cabeçalho não bate; o app não vai
                                           reclamar, vai inventar número
      NÃO É ESTE ARQUIVO                → conteúdo é outra coisa
    Nunca diga só "não usável": isso sugere falha visível, e não é o que acontece.

Para os .prc, confirme o layout antes de dar como bom:
- comprimento das linhas (mínimo 83; variante de 84 desloca +1 a partir da 44)
- endereço no padrão /^0{7}PI\d{6}$/ na janela 44-58; fora do padrão, a seção sai
  dos últimos 4 dígitos depois do "PI" (digitação manual no coletor)
- quantidade nos 9 últimos dígitos, dividida por 1000
- is_bloco = quantidade > 1, nunca a flag da posição 43
- datasDistintas: mais de uma data indica relógio de coletor desconfigurado, e
  isso NÃO invalida o arquivo

PASSO 5 — Ressalvas de SUPERMERCADO (não pule esta parte)
O módulo nasceu para farmácia. Diga explicitamente, para esta pasta:

- Bloco não penaliza fora de FARMACIA, e a guarda aparece em QUATRO funções:
  getLimitesBlocoFallback(), lookupLimiteBlocoArea() e getViolacoesBloco() em
  src/config/inventoryEvalConfig.ts, e detectarViolacoesBloco() em
  src/services/InventoryEvaluationService.ts. Então BLOCO.xls aqui não vale como
  penalidade — vale como conferência independente de seção/CPF/EAN e como
  detector de mudança de layout do coletor.
- limites_bloco_area e LIMITES_BLOCO_FARMACIA são seed de farmácia. Em
  supermercado, área sem limite cadastrado é o esperado, não é erro, e não pode
  virar penalidade.
- AREA_ALIASES (src/utils/inventExpUtils.ts) tem só sete entradas, todas de
  farmácia: F CAIXA, GELADEIRAS CAIXA, AVARIAS, B ATENDIMENTO, P OTC e duas
  grafias de OTC/MIP. Nenhuma serve aqui.
- canonizarGondola() é a peça que DE FATO serve a supermercado: casa RUA 3 FRENTE,
  R3 e G 03 FUNDO na mesma GONDOLA 3. Liste as áreas reais desta pasta e conte
  quantas casam por ela.
- Classificação legal A1/A2/A3, B1/B2, C1/C2/C3 do invent_DSP é conceito de
  farmácia; aqui o arquivo interessa por EAN e descrição.
- Perfil SUPERMERCADO em src/config/inventoryEvalConfig.ts: qualityDecayK 0,8
  (farmácia é 1,5), pesos qualidade 0,45 / produtividade 0,40 / aderência 0,15,
  meta de 1.200 peças/h, tolerância de erro 1,0% e crítico 2,0%. Confirme que
  esses valores continuam esses no código e diga qual perfil se aplica à loja.

FORMATO DA RESPOSTA

1) Tabela, um arquivo por linha:
   arquivo | formato real | extensão mente? | encoding | o que é | parser que lê |
   USÁVEL / RISCO DE LEITURA SILENCIOSA ERRADA / NÃO É ESTE ARQUIVO |
   linha do cabeçalho | motivo em uma linha

2) Veredito:
   - Com o que está nesta pasta, qual motor responde: v2.1, v3, ou nenhum?
   - O que falta para o v3 (liste por nome os arquivos ausentes)
   - O que falta para rodar qualquer coisa (as duas entradas obrigatórias)

3) Riscos e ressalvas, em ordem de gravidade — comece pelos arquivos em risco de
   leitura silenciosa errada, depois os cuja extensão mente, depois as ressalvas
   de supermercado.

4) O que NÃO dá para saber só olhando a pasta (ex.: modalidade de contratação de
   cada conferente, que é marcada pelo líder e bloqueia o processamento quando nula).

Se algum arquivo não se encaixar em nenhuma entrada conhecida, não force: liste em
"não identificados", com as 3 primeiras linhas, e me pergunte.
```

## Por que o prompt insiste nessas três coisas

**Formato pelo conteúdo, não pela extensão.** O export "Excel" do Crystal Reports é
HTML (às vezes MHTML) com extensão `.xls`. Um relatório que parece pronto pode não abrir
no parser — e o inverso também: arquivo sem extensão pode ser perfeitamente utilizável.
É a mesma regra que `fileFormat.ts` aplica em produção, e ela existe porque a extensão
já mentiu aqui antes.

**Confirmar o cabeçalho rótulo a rótulo — porque o erro NÃO aparece sozinho.** Este é o
ponto que mais importa e o mais fácil de errar. Só o `ACURACIDADE` lança exceção quando
o cabeçalho não bate; os outros quatro parsers caem em índices de coluna fixos e leem a
coluna errada **em silêncio**, entregando número plausível. Não existe mensagem de erro
para esperar: ou a triagem confere o rótulo, ou o problema só aparece quando alguém
questionar a nota de um conferente.

**As ressalvas de supermercado.** Fora de farmácia o bloco não penaliza nada — a guarda
está em quatro funções diferentes — e os limites por área são seed de farmácia. Sem esse
aviso escrito no relatório, é fácil olhar o `BLOCO.xls` e concluir que há algo a cobrar
de um conferente que o motor vai ignorar por completo.

## Adaptando para farmácia

Troque a linha `OPERAÇÃO` e, no Passo 5, inverta a leitura: em FARMÁCIA o bloco
penaliza, os limites de `limites_bloco_area` valem, e área sem limite cadastrado passa
a ser **lacuna de cadastro** — tem que aparecer no aviso da tela e na aba Ressalvas do
consolidado, nunca só num `console.warn`.

## Candidato a issue (não é conserto de passagem)

O fallback por índice fixo dos quatro parsers pode ser bug de verdade: hoje um relatório
com layout novo é lido errado sem avisar. Corrigir isso muda o comportamento do motor e
merece spec própria — não entra numa edição de documentação.
