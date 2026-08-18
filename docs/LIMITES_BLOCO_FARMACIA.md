# Tolerância de bloco por área — farmácia

Proposta técnica para revisão de `limites_bloco_area` (perfil FARMACIA).
Base empírica: inventário **DPSP L2601** (06/08/2026 · 25 áreas · 1.054 seções ·
53.628 peças · 15 conferentes).

Referência de risco: `tolerancia_contagem_bloco_farmacia.html` (v1.0, Portaria
344/98 · SNGPC/ANVISA).

---

## 1. O problema de taxonomia

A referência técnica define tolerância por **categoria de produto**
(Controlados, Tarjados, Termolábeis, OTC, Dermocosméticos, Suplementos,
Perfumaria, Saneantes…). O InventExpert aplica tolerância por **área física**
(PAREDE DERMO, RUA 3 FRENTE, BALCAO…), porque é isso que o `PROD_SEÇÃO` e o
endereço do coletor entregam.

As duas taxonomias não são bijetivas. Uma área física quase sempre carrega mais
de uma categoria.

> **Regra de conversão adotada:** a área física herda o limite da **categoria
> mais restritiva que ela contém**, não o da categoria predominante.

O motivo é que o limite não é uma média — é o ponto a partir do qual a contagem
deixa de ser verificável item a item. Se 10% de uma parede é dermocosmético de
R$ 200 e 90% é sabonete, um limite de 20% na área inteira autoriza contar o
dermocosmético em bloco.

**Consequência prática no L2601:** nenhuma das 25 áreas se chama OTC,
MEDICAMENTOS OTC ou MIP. Mas a loja vende OTC. O OTC está fisicamente dentro de
`BALCAO`, `ATRAS DO CAIXA` ou `PAREDE CARTELADO` — que são exatamente as três
áreas propostas para 90% / sem limite. É aí que a proposta precisa de decisão,
não nas gôndolas.

---

## 2. Os dois limitantes

Cada área recebe dois números e vale o menor:

**Teto de risco** — vem do quadro de categorias. Reflete troca de EAN,
similaridade de embalagem, obrigação legal, impacto clínico e valor unitário.
É inegociável para 0% (SNGPC, tarjados, cadeia de frio).

**Piso operacional** — vem da densidade observada, `peças ÷ seções`. Mede
quanta mercadoria existe por trecho de prateleira. Não prevê o bloco% que vai
sair; indica se existe **pilha física que justifique** contar em bloco.

Densidade baixa com bloco alto não é empilhamento — é o conferente digitando
quantidade em vez de bipar item a item. Densidade alta (ilha, estoque, cartela)
é o oposto: exigir bipada unitária ali só produz trabalho sem ganho de acurácia.

### Densidade medida — L2601

| Área | seções | peças | peças/seção | conferentes |
|---|---:|---:|---:|---:|
| PAREDE CARTELADO | 23 | 3.538 | **153,8** | 4 |
| TESTE | 1 | 105 | 105,0 | 1 |
| NÃO CONTADOS | 1 | 96 | 96,0 | 1 |
| FRENTE DE CAIXA | 79 | 7.467 | 94,5 | 9 |
| ESTOQUE FRENTE | 27 | 2.111 | 78,2 | 2 |
| ILHAS FRENTE DE LOJA | 5 | 375 | 75,0 | 1 |
| ATRAS DO CAIXA | 4 | 256 | 64,0 | 1 |
| MEDICAMENTOS | 187 | 11.533 | 61,7 | 11 |
| RUA 4 FUNDO | 51 | 3.129 | 61,4 | 3 |
| RUA 2 | 50 | 2.684 | 53,7 | 4 |
| BALCAO | 28 | 1.426 | 50,9 | 4 |
| ILHAS FUNDO | 9 | 457 | 50,8 | 2 |
| VACINAS | 1 | 49 | 49,0 | 1 |
| RUA 5 FRENTE | 51 | 2.422 | 47,5 | 2 |
| RUA 5 FUNDO | 49 | 2.269 | 46,3 | 2 |
| PSICO | 54 | 2.301 | 42,6 | 1 |
| RUA 3 FUNDO | 50 | 2.089 | 41,8 | 2 |
| RUA 1 | 53 | 1.983 | 37,4 | 3 |
| RUA 3 FRENTE | 57 | 2.119 | 37,2 | 4 |
| ANTIBIOTICOS | 28 | 972 | 34,7 | 1 |
| PAREDE DERMO | 98 | 2.857 | **29,2** | 4 |
| PAREDE INFANTIL | 51 | 1.274 | **25,0** | 2 |
| RUA 4 FRENTE | 45 | 1.013 | 22,5 | 1 |
| ESTOQUE FUNDOS | 45 | 963 | 21,4 | 5 |
| THERMOLABS | 7 | 140 | 20,0 | 1 |
| **TOTAL** | **1.054** | **53.628** | | **15** |

---

## 3. Proposta por área

Coluna "hoje" = seed atual em `LIMITES_BLOCO_FARMACIA` para a área
correspondente. `—` = área real sem cadastro (bloco nunca verificado).

| Área real (L2601) | Entrada na tabela | Hoje | **Proposto** | Crítica | Base |
|---|---|---:|---:|:--:|---|
| MEDICAMENTOS | MEDICAMENTOS | 0 | **0** | sim | Tarjados Rx — regulatório |
| ANTIBIOTICOS | ANTIBIÓTICOS | 0 | **0** | sim | SNGPC |
| PSICO | PSICOTRÓPICOS *(alias)* | — | **0** | sim | Portaria 344/98 |
| THERMOLABS | TERMOLÁBEIS *(alias)* | — | **0** | sim | Cadeia de frio |
| VACINAS | VACINAS *(nova)* | — | **0** | sim | Cadeia de frio |
| PAREDE INFANTIL | P INFANTIL | 10 | **10** | **sim** | Nutrição infantil 5% + fraldas 10% |
| PAREDE DERMO | P DERMO | 5 | **10** | **sim** | Dermocosméticos 5% — ver §4.1 |
| RUA 1 … RUA 5 (frente/fundo) | G 1 … G 10 | 15 | **15** | não | Perfumaria/higiene 10–15% |
| BALCAO | BALCÃO DE ATENDIMENTO | *sem limite* | **20** | não | Decisão do gestor — §4.3 |
| ATRAS DO CAIXA | ATRÁS DE CAIXA | 90 | **20** | não | Decisão do gestor — §4.3 |
| ILHAS FRENTE DE LOJA | ILHAS | 30 | **50** | não | Pilha de SKU único; densidade 75 |
| ILHAS FUNDO | ILHAS | 30 | **50** | não | idem |
| ESTOQUE FUNDOS | ESTOQUE | 80 | **80** | não | Caixa fechada com quantidade impressa |
| ESTOQUE FRENTE | ESTOQUE | 80 | **80** | não | idem |
| FRENTE DE CAIXA | FRENTE DE CAIXA | 90 | **90** | não | Conveniência, densidade 94,5 |
| PAREDE CARTELADO | CARTELADO | 100 | **70** | não | Decisão do gestor — §4.2 |
| NÃO CONTADOS | NÃO CONTADOS | 100 | **100** | não | Bucket de auditoria, não é área |
| TESTE | — | — | **excluir** | — | Área de teste do coletor — §4.4 |

Resumo do que muda: **5 áreas críticas ganham cadastro** (hoje sem verificação
nenhuma), **DERMO sobe de 5 para 10**, **ILHAS sobe de 30 para 50**,
**CARTELADO desce de 100 para 70**, **ATRÁS DO CAIXA desce de 90 para 20** e
**BALCÃO sai de "sem limite" para 20**.

Aplicado em `supabase/migration_limites_bloco_area_patch2.sql` e espelhado em
`LIMITES_BLOCO_FARMACIA` (`src/config/inventoryEvalConfig.ts`).

---

## 4. Onde a proposta diverge do que foi pedido

### 4.1 PAREDE DERMO e PAREDE INFANTIL — 30% não se sustenta

Pedido: 30%. Proposta: **10%, mantendo o flag de área crítica**.

Três razões, em ordem de peso:

1. **A referência do próprio projeto classifica Dermocosméticos em 5%**, o
   segundo nível mais restritivo, por linhas de 8 a 15 SKUs quase idênticos
   (Effaclar, Cicaplast, Lipikar), valor unitário de R$ 80 a R$ 300 e troca de
   EAN a cada relançamento. Nutrição infantil (NAN 1 / NAN 2 / NAN Supreme)
   está no mesmo nível.
2. **A densidade é a mais baixa entre as paredes** — 29,2 e 25,0 peças por
   seção, contra 153,8 do cartelado. Numa parede com meia dúzia de faces por
   SKU não existe pilha que justifique bloco de 30%: seria uma peça em cada
   três nunca identificada individualmente, justamente onde as embalagens são
   mais parecidas e o item é mais caro.
3. **É a área com mais seções depois de MEDICAMENTOS** (98 seções, 4
   conferentes). O que for tolerado aqui vale para 2.857 peças distribuídas em
   quatro pessoas — não é um caso de borda.

O caminho para 10%, e não para 5%, é o kit promocional: dermo e infantil
circulam em pack de 2 e 3 unidades com EAN próprio, e 5% penalizava contagem
legítima de pack. 10% cobre o pack e continua fora da faixa em que a contagem
deixa de ser rastreável.

**Manter `critica: true` nas duas.** O alerta formal hoje dispara por
`crítica OU limite ≤ 5%`; sem o flag, subir para 10% apagaria o alerta junto
com o limite. Com o flag, o limite sobe e a visibilidade continua.

Se o objetivo de subir o limite era parar de reprovar gente que estava contando
certo, o teste é outro: com o `.prc` em mãos dá para medir o bloco% real dessas
duas paredes por conferente. Se todos os quatro estiverem acima de 30%, o
problema não é o limite — é o método de contagem da parede, e mexer no limite
só esconde isso.

### 4.2 PAREDE CARTELADO — 70%, resolvida a ambiguidade

Havia dúvida sobre o conteúdo, porque a tabela tinha duas entradas com
critérios opostos: `CARTELADO` a 100% (conveniência — lâmina, pilha,
preservativo) e `MEDICAMENTOS CARTELADOS` a 30% (blister de OTC em cartela).
Pela regra da §1, a área herdaria o limite da categoria mais restritiva
presente.

**O gestor confirmou: a maioria é medicamento fora da caixa, solto, o que
inviabiliza contar peça a peça.** O `BLOCO.xls` confirma a descrição — 54%
analgésicos, 17% medicamentos em geral, 11% genéricos OTC, 9,0 peças por
linha (§6.3). Densidade de 153,8 peças por seção, a maior da loja.

Decisão aplicada: **70% para os três nomes** — `CARTELADO`,
`PAREDE CARTELADO` e `MEDICAMENTOS CARTELADOS`. Manter `MEDICAMENTOS
CARTELADOS` em 30% faria o limite da mesma parede depender de qual nome a loja
escolheu cadastrar, que é a falha que a §1 existe para evitar.

70% e não 100% porque a mercadoria continua sendo OTC: 100% equivale a
desligar a checagem numa área que concentra 3.538 peças de medicamento.

### 4.3 BALCÃO e ATRÁS DO CAIXA — 20% nos dois

A proposta inicial era BALCÃO sem limite e ATRÁS DO CAIXA a 90%. Argumentei
contra os dois: `BALCAO` não é balcão vazio — são **28 seções, 1.426 peças, 4
conferentes**, mais seções que ANTIBIOTICOS e mais que PAREDE CARTELADO. É
ponto de venda com mercadoria.

E como registrado na §1, **nenhuma das 25 áreas se chama OTC**. Numa drogaria o
OTC existe, e o lugar clássico dele é o balcão e o vão atrás do caixa. Com
`sem limite` no balcão e 90% atrás do caixa, o OTC — que o quadro de risco põe
em 5%, por Tylenol 500 e 750 terem embalagem quase igual — passava a ser
contável em bloco sem checagem nenhuma. Somando o que ficaria em ≥ 80%:
**15.761 peças, 29,4% do inventário**.

**Decisão do gestor: 20% nos dois.** É o compromisso certo — reconhece que há
mercadoria empilhada no balcão sem abrir mão da verificação. O `sem limite` do
BALCÃO era a entrada mais permissiva da tabela inteira e some com este patch:
nenhuma área ficou em 9999.

### 4.4 TESTE — excluir, mas não silenciosamente

1 seção, 105 peças, 1 conferente, nome de área de teste do coletor. Não deve
receber limite nem entrar no cálculo. **Mas não pode simplesmente sumir:** 105
peças que desaparecem entre a coleta e a avaliação são exatamente o tipo de
lacuna que o projeto decidiu tornar visível. Vai para a aba **Ressalvas** do
consolidado, com o motivo.

---

## 5. Nomenclatura de gôndola

A mesma gôndola aparece como `RUA 3 FRENTE`, `R 3`, `R3`, `G3` ou `G 03 FUNDO`
dependendo de quem cadastrou o layout da loja. A tabela usa `G 1` … `G 10`.

`canonizarGondola()` (`src/utils/inventExpUtils.ts`) reduz as cinco formas a
uma chave única `GONDOLA n` **apenas para efeito de casamento com a tabela de
limites**. O nome de exibição não muda — o conferente conhece a área como
`RUA 4 FUNDO` e é assim que ela aparece na ficha dele.

Frente e fundo **herdam o mesmo limite**: são dois lados do mesmo móvel, e não
existe motivo de risco para separá-los. Se um dia existir, basta cadastrar a
entrada com o lado no nome, que ela vence a canonização.

---

## 6. Calibração contra o bloco observado

`RELATORIOS/BLOCO.xls` do L2601: 1.943 linhas úteis, **17.211 peças em bloco**
de 53.628 contadas — **32,1% do inventário**. O relatório repete 67 linhas nas
quebras de página (77 páginas); a leitura deduplica por
`capa + seção + CPF + código + qtde`.

### 6.1 Por conferente

| Conferente | bloco | contado | % |
|---|---:|---:|---:|
| AMARILDO DA SILVA | 3.727 | 4.798 | **77,7** |
| ROBERTO TADEU | 1.944 | 3.004 | 64,7 |
| MACIETE LARISA | 2.136 | 3.559 | 60,0 |
| RODRIGO LOURENCO | 1.087 | 1.896 | 57,3 |
| DIEGO DA SILVA | 2.491 | 5.795 | 43,0 |
| BIANKA ANASTACIO | 2.363 | 7.077 | 33,4 |
| IDAIANE DA CONCEICAO | 986 | 3.284 | 30,0 |
| EDGAR DE JESUS | 1.016 | 3.538 | 28,7 |
| FERNANDA DA SILVA | 846 | 4.651 | 18,2 |
| LARISSA DOS SANTOS | 478 | 3.563 | 13,4 |
| ADALBERTO TAVARES | 137 | 3.536 | 3,9 |
| IZABEL CRISTINA | 0 | 1.592 | **0,0** |
| RYAN LUCA | 0 | 1.969 | **0,0** |
| ELIANA CRISTINA | 0 | 2.992 | **0,0** |
| PATRICK DANIEL | 0 | 2.374 | **0,0** |
| **EQUIPE** | **17.211** | **53.628** | **32,1** |

Quatro conferentes fecharam o evento com **zero peça em bloco**, somando 8.927
peças. Isso responde à objeção de que contar peça a peça seria inviável na
loja: em áreas comparáveis, quatro pessoas fizeram. A dispersão de 0% a 77,7%
é grande demais para ser explicada pela mercadoria — é método.

### 6.2 Por área

Atribuição por faixa contígua de seção, usando a interseção das áreas dos
conferentes que biparam cada faixa. Só entram aqui as faixas em que a
interseção deu **uma única área**; 964 peças ficaram em faixas ambíguas.
As bordas são aproximadas — não pedir precisão de última seção destes números.

| Área | bloco | contado | observado | **limite novo** | |
|---|---:|---:|---:|---:|:--:|
| FRENTE DE CAIXA | 6.869 | 7.467 | 92% | 90% | ⚠︎ |
| PAREDE CARTELADO | 3.037 | 3.538 | 86% | 70% | ⚠︎ |
| RUA 4 FUNDO | 2.682 | 3.129 | 86% | 15% | ⚠︎ |
| ESTOQUE FRENTE | 869 | 2.111 | 41% | 80% | ok |
| PAREDE DERMO | 935 | 2.857 | 33% | 10% | ⚠︎ |
| MEDICAMENTOS | 1.855 | 11.533 | 16% | **0%** | ⚠︎ |

### 6.3 O que esses números mostram

**MEDICAMENTOS tem 1.855 peças em bloco numa área de tolerância zero.** É a
constatação mais séria do conjunto, e é regulatória, não de método. A área tem
187 seções e 11 conferentes — não é um caso isolado.

**Há psicotrópico contado em bloco.** Uma linha: `LORAZEP 2MG 30CP B1 LG`,
família `PSICOTROPICOS LISTA A B`, seção 0077, 2 peças. Lista B1, Portaria
344/98. Duas peças não movem nota nenhuma, mas é exatamente o evento que o
quadro de risco marca como bloqueio automático e relatório separado para o RT
farmacêutico.

**RUA 4 FUNDO não é gôndola de perfumaria.** 86% de bloco contra limite de
15%, e a composição explica: 41% antiácidos/hepatoprotetores, 18% medicamentos
em geral, 8% laxantes — **59% é medicamento**. O nome diz gôndola, o conteúdo
diz farmácia. Um limite único de 15% para todas as gôndolas vai reprovar essa
em bloco (AMARILDO 90%, DIEGO 70%) sem que o problema seja dos conferentes.
Isto é o caso "equipe inteira acima = problema de regra": ou a RUA 4 FUNDO
recebe cadastro próprio compatível com a mercadoria, ou o layout precisa
renomeá-la.

**O CARTELADO confirmou-se como descrito.** 54% analgésicos, 17% medicamentos
em geral, 11% genéricos OTC, 9,0 peças por linha — medicamento solto na
gancheira, como o gestor apontou. Vale registrar que 70% ainda reprova três dos
quatro: DIEGO 95%, AMARILDO 90%, ROBERTO 82%, MACIETE 68%. O limite não
absolve a área, ele separa quem contou o razoável de quem contou a parede
inteira em bloco — e havendo um conferente em 68%, o número é alcançável.

**PAREDE DERMO em 33% não contradiz o limite de 10%.** A composição do bloco
lá é 36% sabonetes perfumados e 20% antitussígenos; dermocosmético é só 10% do
que foi blocado, e a média é de 4,3 peças por linha. Ou seja: o bloco da
parede não está no dermocosmético. A parede é mista, e o que puxa o percentual
é mercadoria de outra categoria encostada nela.

**FRENTE DE CAIXA em 92% contra limite de 90%** é ruído — deixar como está.

### 6.4 O que ainda falta

`BLOCO.xls` traz seção, CPF e EAN, mas **não traz a área**. A atribuição da
§6.2 é reconstruída e por isso aproximada. Fechar isso exige o `.prc` do
evento, que tem toda bipada com sua seção e permite o recorte completo
seção → área. Com ele, a tabela §6.2 sai exata e por conferente.

---

## 7. Estado da implementação

Aplicado:

1. `supabase/migration_limites_bloco_area_patch2.sql` — patch novo; a
   migration base e o `patch1` não foram tocados, os dois já estão aplicados.
   **Falta rodar no painel do Supabase.**
2. `LIMITES_BLOCO_FARMACIA` (`src/config/inventoryEvalConfig.ts`) espelha o
   patch — é o fallback offline.
3. Nomes de campo cadastrados: `PSICO`, `THERMOLABS`, `VACINAS`,
   `PAREDE DERMO`, `PAREDE INFANTIL`, `PAREDE CARTELADO`, `ATRAS DO CAIXA`,
   `BALCAO`, `ESTOQUE FRENTE`, `ESTOQUE FUNDOS`, `ILHAS FRENTE DE LOJA`,
   `ILHAS FUNDO`.
4. `lookupLimiteBlocoArea()` passou a indexar por `chaveParaLimite()`. Antes
   comparava `toUpperCase()` literal, então no caminho de fallback
   `ANTIBIOTICOS` não achava `ANTIBIÓTICOS` e `RUA 3 FRENTE` não achava `G 3` —
   e área que não casa não é penalizada. `getViolacoesBloco()` usa
   `mesmaArea()` pelo mesmo motivo.
5. `src/config/__tests__/limitesBlocoFarmacia.test.ts` trava as cinco áreas de
   limite 0, o flag `critica` de DERMO e INFANTIL em 10%, os três nomes do
   cartelado no mesmo número, a ausência de qualquer área em 9999, e
   `areasSemLimiteCadastrado()` devolvendo só `TESTE` para as 25 áreas reais.

Pendente de decisão:

6. **RUA 4 FUNDO** (§6.3) — 86% de bloco contra limite de 15%, com 59% de
   medicamento na composição. Precisa de cadastro próprio ou de renomeação no
   layout da loja; hoje reprovaria a área inteira sem que a causa seja o
   conferente.
7. **Bloco em MEDICAMENTOS e no psicotrópico B1** (§6.3) — é achado
   regulatório, não de configuração. Encaminhar ao RT farmacêutico.

---

## 8. Peso e advertência da violação (2026-08)

A tabela de limites diz *o que é violação*. Esta seção diz *quanto custa* e
*como é comunicado*, porque o achado da §6.3 — bloco em área de tolerância zero
— não tinha peso proporcional nem enquadramento.

### 8.1 A penalidade era plana

Até aqui, área de tolerância zero descontava **20 pontos fixos** da Qualidade.
Isso fazia 0,5% de bloco em MEDICAMENTOS pesar exatamente o mesmo que 16%. A
escala agora é por faixa, em `classificarGravidadeBloco()`:

| Gravidade | Condição | Pontos |
|---|---|---:|
| TOLERANCIA_ZERO_GRAVE | limite 0, crítica, > 20% | **40** |
| TOLERANCIA_ZERO_ALTA | limite 0, crítica, > 5% | **30** |
| TOLERANCIA_ZERO | limite 0, crítica | 20 |
| AREA_CRITICA | crítica com limite > 0 (dermo, infantil, OTC) | **15** |
| EXCESSO_ALTO | não-crítica, excesso > 2× o limite | 10 |
| EXCESSO_LEVE | não-crítica | 5 |

O corte em 20% não é arbitrário: acima dele o percentual deixa de ser
compatível com engano pontual e passa a descrever o método usado na área.

`AREA_CRITICA` é nova. Antes, dermo e infantil caíam na régua comum de 10 ou 5
pontos, apesar de serem as áreas com os SKUs mais parecidos entre si e o maior
valor unitário da loja — os mesmos motivos que justificam o limite baixo.

**A classificação exige as duas condições**, limite 0 **e** `critica: true`.
Um cadastro com limite 0 e `critica: false` é erro de dados; tratá-lo como
sanitário mascararia a inconsistência em vez de expô-la.

### 8.2 A advertência

Violação de tolerância zero deixa de usar o texto genérico de área restrita e
passa a trazer o enquadramento: a contagem precisa ser peça a peça porque o
estoque da área é controle legal (ANVISA/SNGPC), a divergência não se resolve
com ajuste, e a ocorrência é encaminhada ao RT farmacêutico do cliente.

**O enquadramento sanitário vale para os três vínculos** — a restrição é da
ANVISA, não do contrato. O que muda por modalidade é só a consequência
descrita, e a regra do FREE continua intacta: nenhum termo de vínculo, nem na
advertência mais dura. `relatorioModalidade.test.ts` trava isso.

A ficha individual passou a mostrar **os pontos descontados por área**. Sem o
número, a advertência não é auditável — o conferente vê que perdeu, não quanto
nem por quê uma área pesou mais que outra.

### 8.3 Onde aparece

- **Ficha individual (v2.1)** — advertência antes dos números, e a linha de
  penalidade com `−N pts de Qualidade`.
- **Card visual** (`CheckerFeedbackReport`) — título escalonado e a nota do
  encaminhamento ao RT.
- **Consolidado do líder (v2.1)** — aba **Advertencias** nova, ordenada da
  gravidade maior para a menor, com vínculo, área, limite, realizado e
  penalidade. Fica em aba própria e não numa coluna do ranking porque quem lê
  precisa levar a ocorrência ao cliente, e isso não pode depender de alguém
  reparar num campo lateral.
