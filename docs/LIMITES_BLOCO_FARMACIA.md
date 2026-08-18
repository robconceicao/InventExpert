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
| BALCAO | BALCÃO DE ATENDIMENTO | *sem limite* | **5** | **sim** | ver §4.3 — decisão pendente |
| ATRAS DO CAIXA | ATRÁS DE CAIXA | 90 | **15** | não | ver §4.3 — decisão pendente |
| ILHAS FRENTE DE LOJA | ILHAS | 30 | **50** | não | Pilha de SKU único; densidade 75 |
| ILHAS FUNDO | ILHAS | 30 | **50** | não | idem |
| ESTOQUE FUNDOS | ESTOQUE | 80 | **80** | não | Caixa fechada com quantidade impressa |
| ESTOQUE FRENTE | ESTOQUE | 80 | **80** | não | idem |
| FRENTE DE CAIXA | FRENTE DE CAIXA | 90 | **90** | não | Conveniência, densidade 94,5 |
| PAREDE CARTELADO | CARTELADO | 100 | **90** | não | ver §4.2 — condicional |
| NÃO CONTADOS | NÃO CONTADOS | 100 | **100** | não | Bucket de auditoria, não é área |
| TESTE | — | — | **excluir** | — | Área de teste do coletor — §4.4 |

Resumo do que muda: **5 áreas críticas ganham cadastro** (hoje sem verificação
nenhuma), **DERMO sobe de 5 para 10**, **ILHAS sobe de 30 para 50**,
**CARTELADO desce de 100 para 90**, e **BALCÃO / ATRÁS DO CAIXA** ficam
pendentes de confirmação de conteúdo.

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

### 4.2 PAREDE CARTELADO — 90% sim, com uma condição

Densidade de 153,8 peças por seção, de longe a maior da loja, é exatamente o
perfil de cartela pendurada em gancheira: muitas unidades idênticas do mesmo
SKU no mesmo ponto. Contar unitário ali é trabalho sem ganho de acurácia.

**A condição é a ambiguidade do nome.** A tabela tem duas entradas:
`CARTELADO` a 100% (conveniência, lâmina, pilha, preservativo) e
`MEDICAMENTOS CARTELADOS` a 30% (blister de OTC em cartela). Antes de aplicar
90% é preciso confirmar que a parede não pendura blister de medicamento. Se
pendurar, a regra da §1 manda usar o limite da categoria mais restritiva
presente — 30%, não 90%.

Proponho **90% e não 100%** para preservar um resíduo de verificação: 100%
equivale a desligar a checagem da área, e essa é a área com mais peças por
seção da loja inteira.

### 4.3 BALCÃO e ATRÁS DO CAIXA — é aqui que está o risco real

Pedido: BALCÃO sem limite, ATRÁS DO CAIXA 90%. **Não recomendo nenhum dos
dois**, e o `sem limite` do BALCÃO é hoje a entrada mais perigosa da tabela.

`BALCAO` não é um balcão vazio: são **28 seções, 1.426 peças, 4 conferentes** —
mais seções que ANTIBIOTICOS (28) e quase o dobro de PAREDE CARTELADO (23).
Isso é ponto de venda com mercadoria, não mobiliário.

E como registrado na §1, **nenhuma das 25 áreas se chama OTC**. Numa drogaria
o OTC existe, e o lugar clássico dele é o balcão e o vão atrás do caixa. Com
`sem limite` no balcão e 90% atrás do caixa, o OTC — que a referência técnica
coloca em 5%, por Tylenol 500 e 750 terem embalagem quase igual — passa a ser
contável em bloco sem nenhuma checagem.

Somando o que a proposta abriria para ≥ 80%: PAREDE CARTELADO, ATRAS DO CAIXA,
BALCAO, ESTOQUE FRENTE, ESTOQUE FUNDOS e FRENTE DE CAIXA = **15.761 peças,
29,4% do inventário** contáveis em bloco praticamente sem verificação.

Proposta enquanto o conteúdo não for confirmado:

- **BALCÃO DE ATENDIMENTO: 5%, crítica.** Se o líder confirmar que ali não há
  medicamento nem OTC, sobe para 15%.
- **ATRÁS DE CAIXA: 15%.** Se for confirmado que guarda só sacola, embalagem e
  material de loja, sobe para 90%.

Nos dois casos a subida é uma linha de migration — o custo de começar
restritivo é baixo, e o custo do contrário é uma área de medicamento sem
verificação nenhuma.

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

## 6. O que ainda não dá para calibrar

Tudo acima usa densidade e categoria de risco. **Falta o bloco% observado por
área**, que só sai do `.prc` do evento ou do `RELATORIOS/BLOCO.xls` — nenhum
dos dois foi anexado.

Com esse dado o método fecha: para cada área, comparar a distribuição do
bloco% entre os conferentes com o limite proposto. Se a mediana da equipe já
está acima do limite, ou o limite está errado ou o método de contagem da área
está errado — e a distribuição diz qual dos dois, porque um conferente isolado
acima da mediana é problema de pessoa e a equipe inteira acima é problema de
regra.

Recomendo rodar essa comparação antes de aplicar a migration, e usá-la
principalmente para decidir DERMO (§4.1) e a natureza do CARTELADO (§4.2).

---

## 7. Se aprovado

1. Patch migration em `supabase/` — nunca editar
   `migration_limites_bloco_area.sql` nem o `patch1`, que já estão aplicados.
2. Mesmo conteúdo espelhado em `LIMITES_BLOCO_FARMACIA`
   (`src/config/inventoryEvalConfig.ts`), que é o fallback offline.
3. Aliases novos: `PSICO`, `THERMOLABS`, `VACINAS`, `PAREDE DERMO`,
   `PAREDE INFANTIL`, `PAREDE CARTELADO`, `ATRAS DO CAIXA`, `BALCAO`,
   `ESTOQUE FRENTE`, `ESTOQUE FUNDOS`, `ILHAS FRENTE DE LOJA`, `ILHAS FUNDO`.
4. Teste de regressão travando as cinco áreas de limite 0 e o flag `critica`
   de DERMO e INFANTIL em 10%.
5. `areasSemLimiteCadastrado()` deve voltar vazia para as 24 áreas reais
   (`TESTE` fica de fora por decisão).
