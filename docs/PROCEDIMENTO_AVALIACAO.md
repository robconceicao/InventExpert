# PO-AVA-001 — Procedimento de Avaliação de Conferentes

| | |
|--|--|
| Revisão | 3.1 |
| Substitui | 3.0 (07/08/2026) |
| Aplicação | Inventários de farmácia, supermercado, hipermercado e atacado |
| Sistema | InventExpert — módulo Avaliação (motor v3) |
| Calibração | DPSP / Drogaria São Paulo, loja L2601, capa 2915, 06/08/2026 |
| Destinatários | Líderes de inventário, coordenação e RH |

> A revisão 3.1 não muda o método de cálculo. Ela define a **emissão e a
> entrega** dos documentos: ficha individual por conferente, planilha
> consolidada do líder e envio por WhatsApp — ver [§7](#7-documentos-gerados-e-como-emitir).

---

## 1. Para que serve

Transformar os arquivos que sobram no fim de um inventário em uma avaliação
individual **defensável** — que se sustente numa conversa com o conferente, com
o cliente e, se preciso, num processo.

Cada número tem origem declarada e passa por uma conferência que prova que ele
fecha com o relatório do próprio sistema.

Produz três coisas:

1. uma **ficha individual** por conferente, com nota, áreas, erros localizados
   até o produto e recomendações;
2. um **consolidado da equipe**, com ranking, mapa de áreas e rastreabilidade;
3. um **registro de ressalvas** que permite reconstruir qualquer número.

Não se aplica a contagens cegas sem auditoria — sem divergência apurada não há
o que atribuir.

---

## 2. Arquivos de entrada

### Obrigatórios

| Arquivo | O que fornece |
|---|---|
| `RProInv_Produtividade.xlsx` | Matrícula, nome, peças, janela de trabalho, horas, peças/h, erro em quantidade, valor contado e ajustado |
| `PROD_SEÇÃO.xlsx` | Área física × conferente × nº de seções × peças. **Única fonte da área física** |
| `RELATORIOS/ACURACIDADE.xls` | Por seção e EAN: 1ª contagem, auditorias, quantidade final e ajuste |
| `BKP/CNT/*.prc` | Bipadas brutas com matrícula, seção, produto, quantidade e hora |

Sem os quatro não há atribuição individual — a avaliação sai apenas com
produtividade e erro total.

### Complementares

| Arquivo | O que acrescenta | Sem ele |
|---|---|---|
| `NAO CONTADOS.xls` | Produtos com saldo e sem coleta | Não há capítulo de cobertura |
| Folha da auditoria dirigida | Produtos recuperados na varredura | Recuperados entram como perda e superestimam o prejuízo |
| `CadProd` (2 arquivos) | EAN, PLU, custo e família | Divergências ficam sem valor em reais |
| `CONTROLADOS.xls` | EANs de controlados | A penalidade agravada não é aplicada |
| `DOBRO.xls` | Itens em duplicidade | Perde-se o indicador de rebipagem |
| `BLOCO.xls` | Seção + CPF + EAN | Perde-se a conferência independente do mapa |

**Leitura dos arquivos:** o formato é decidido pelos *magic bytes*, nunca pela
extensão — o mesmo relatório sai ora como `.xls` binário, ora como tabela HTML
com extensão `.xls`. Ver [`CLAUDE.md`](../CLAUDE.md) e `src/utils/fileFormat.ts`.

---

## 3. A cadeia de atribuição

O sistema informa **o que** deu errado, mas não **quem** errou.

### 3.1 Seção → área física

O `.prc` traz a seção de cada bipada; o `PROD_SEÇÃO` traz quantas seções cada
conferente cobriu em cada área, sem dizer quais. A numeração acompanha o
percurso físico da loja, então seções da mesma área ficam próximas:

1. ordenar as seções que o conferente bipou;
2. recortar em blocos do tamanho declarado no `PROD_SEÇÃO`;
3. escolher a ordem que faz as peças baterem, preferindo blocos próximos de
   seções já atribuídas à mesma área por outro conferente.

Na calibração, 68 das 72 combinações fecharam exatamente; as 4 restantes
ficaram dentro da margem de rebipagem e viraram ressalva.

> Implementação: `services/AreaMappingService.ts`.

### 3.2 Divergência → conferente

O ACURACIDADE identifica cada divergência pelo par **seção + EAN**. As bipadas
carregam o mesmo par junto com a matrícula. O par é a chave.

- par apontando mais de um conferente → **compartilhada**, todos registrados;
- sem bipada correspondente → **órfã**.

Nunca se atribui por proximidade ou suposição.

> Implementação: `services/ErroAtribuicaoService.ts`.

### 3.3 Produto não contado → responsável

Os relatórios de não contados não trazem seção. A saída é geográfica: um
produto fica na prateleira ao lado dos semelhantes.

| Nível | Critério | Pesa na nota |
|---|---|---|
| ALTA | Troca de código comprovada, ou marca com 3+ itens contados e um conferente concentrando ≥70% | Sim |
| MÉDIA | Marca localizada, poucos itens de referência ou responsável dividido | Não — dirige recontagem |
| BAIXA | Só a família aponta a área | Não — informativo |
| Sem base | Nenhum item da marca ou família contado | Não — fica com a equipe |

> Implementação: `services/NaoContadoService.ts`.

---

## 4. Cálculo da nota

| Eixo | Peso | Como se calcula |
|---|---|---|
| Acuracidade | 35% | (1 − unidades em erro ÷ peças contadas) × 100 |
| Produtividade | 25% | peças/h ÷ mediana da equipe × 100, limitado a 100 |
| Valor | 25% | 100 − (valor ajustado ÷ valor contado × 100) |
| Cobertura | 15% | 100 − fatia do valor perdida em não contados de confiança ALTA |

**Penalidades:** −5 por divergência em controlado · −2 por não contado
atribuído com confiança ALTA (−1 quando recuperado na auditoria dirigida).

| Faixa | Nota | Encaminhamento |
|---|---|---|
| Excelente | 90–100 | Manter — referência para os demais |
| Bom | 80–89 | Devolutiva com os pontos de melhora |
| Regular | 70–79 | Acompanhamento em campo no próximo inventário |
| Requer treinamento | < 70 | Reciclagem antes da próxima escala |

### Escolhas que exigem explicação

- **Mediana, não média.** Um conferente muito rápido desloca a média e faz o
  resto parecer lento.
- **Mediana da equipe, não meta do perfil.** Comparar com quem esteve na mesma
  loja, no mesmo turno, é mais justo e mais difícil de contestar.
- **Auditoria dirigida fora da produtividade.** Na calibração, separar as duas
  atividades levou a conferente responsável pela auditoria da 11ª para a 6ª.
- **Cobertura proporcional ao valor contado.** Sem a proporção, o conferente de
  área nobre é punido pelo tamanho da própria área.

---

## 5. Execução

| Etapa | O que fazer | Onde, no app |
|---|---|---|
| 1 | Conferir presença dos 4 obrigatórios; capa, loja e data batendo entre eles | Cartão *Arquivos obrigatórios* |
| 2 | Processar **todos** os `.prc`; conferir datas e endereços fora do padrão | Botão de anexar `.prc` (seleção múltipla) |
| 3 | Montar o mapa de áreas e conferir as combinações que não fecharam | Automático ao processar |
| 4 | Atribuir divergências pelo par seção + EAN | Automático ao processar |
| 5 | **Conferência obrigatória** — ver §5.1 | Alerta "Reconciliação não fechou" |
| 6 | Transcrever a auditoria dirigida e classificar os não contados | Campo de auditoria dirigida |
| 7 | Calcular, revisar o ranking e emitir os documentos | Cartão *Entregáveis da avaliação* |
| 8 | Devolutiva ao conferente | Ficha individual em mãos |

### 5.1 A conferência que trava a publicação

Somar, por conferente, os ajustes atribuídos. O resultado tem de reproduzir
**exatamente** a coluna `Erro (Qtde)` do relatório de produtividade, pessoa a
pessoa. Se sobrar ou faltar, a cadeia quebrou — voltar à etapa 4.

Havendo custo de cadastro, a soma dos valores calculados deve reproduzir a
coluna `Vlr (AJST)`. Na calibração: R$ 6.333,90 contra R$ 6.333,93 do sistema.

> O app roda essa conferência sozinho e avisa quando não fecha. **Não publicar
> avaliação com o alerta na tela.**

---

## 6. Ressalvas obrigatórias

Todo relatório traz um capítulo de ressalvas. Omitir limitação é o caminho mais
curto para perder a credibilidade do conjunto.

Registrar sempre: divergências órfãs · compartilhadas · não contados MÉDIA e
BAIXA · não contados sem base · coletores com relógio errado · endereços fora
do padrão · combinações de área não conformes.

**Limite da cobertura:** não existe inventário do que *deveria* haver em cada
seção. A cobertura mede produto que ficou de fora, não prateleira vazia.

### O que nunca fazer

- Atribuir divergência sem correspondência no arquivo bruto.
- Deixar não contado MÉDIA ou BAIXA pesar na nota.
- Publicar sem a conferência da §5.1.
- Medir horas da primeira à última bipada quando houver mais de uma data.
- Somar auditoria dirigida à produtividade de contagem.
- Usar a flag do `.prc` para identificar contagem em bloco.
- Apresentar percentual de erro sem dizer se é sobre unidades ou sobre itens.

---

## 7. Documentos gerados e como emitir

Dois documentos, dois públicos. **A ficha é do conferente; a planilha é do
líder.** Não trocar: a planilha expõe o ranking inteiro e a ficha é escrita
para ser lida junto com a pessoa avaliada.

Ambos saem do cartão **Entregáveis da avaliação**, que só aparece depois de
processar com o motor v3.

### 7.1 Ficha individual — `Avaliacao_<Matrícula>_<Nome>.pdf`

Uma por conferente. Identificação e áreas · nota decomposta nos quatro eixos ·
produtividade · acuracidade · divergências item a item · não contados
atribuídos · leitura dos dados · recomendações.

Três formas de emitir:

| Ação | Onde | Resultado |
|---|---|---|
| **PDF** de um conferente | Botão `PDF` na linha dele, no ranking v3 | Um arquivo, pelo compartilhamento do sistema |
| **WhatsApp** de um conferente | Botão do WhatsApp na mesma linha | Mesma ficha em texto, pronta para enviar |
| **Fichas de toda a equipe** | Botão `Fichas de toda a equipe` | Todas de uma vez — ver abaixo |

O lote se comporta conforme a plataforma:

- **Android:** o app pede a pasta **uma única vez** e grava todos os PDFs lá.
- **Web:** cada ficha baixa pelo navegador, em HTML pronto para imprimir como
  PDF (o motor de impressão do Expo não roda no browser).
- **iOS:** uma janela de compartilhamento por ficha.

**A linguagem muda com a modalidade de contratação.** Prestador de serviço
(`FREE`) não recebe posição no ranking nem instrução de como executar o
trabalho — comparar com a equipe e orientar execução são indícios de
subordinação. A modalidade nula bloqueia o processamento: um default silencioso
faria o prestador receber relatório com termos de vínculo.

Escrever para ser lido junto com o conferente: **"contou 16 onde havia 2"**, não
"ajuste de −14 no EAN 007896658027796".

### 7.2 Consolidado do líder — `Avaliacao_Consolidada_<loja>_<data>.xlsx`

Oito abas:

| Aba | Conteúdo |
|---|---|
| `Resumo` | Números da operação, com a fonte de cada um e a rastreabilidade |
| `Ranking` | Nota, componentes, faixa e encaminhamento por conferente |
| `Por_Conferente` | Áreas, horas, peças, erros, valores e diagnóstico do coletor |
| `Erros_Detalhados` | Divergências item a item: área, seção, EAN, ajuste, valor, hora |
| `Nao_Contados` | Situação, valor, confiança, área, responsável e base da inferência |
| `Mapa_Areas` | Área × conferente × seções × peças × se fechou |
| `Ressalvas` | Limites da análise |
| `Metodologia` | Fontes, eixos, decisões de método e limites |

> Implementação: `utils/avaliacaoConsolidadaXlsx.ts`, coberta por teste.

A **referência (loja / evento)**, preenchida no fim da tela, nomeia os arquivos
e identifica o inventário nos cabeçalhos. Sem ela os arquivos saem como
`inventario`.

### 7.3 Arquivamento

Guardar, junto com os documentos gerados, **cópia dos arquivos de entrada**.
Uma avaliação questionada seis meses depois só se defende se a base bruta ainda
existir.

---

## 8. Anexo — referência técnica

| Componente | Responsabilidade |
|---|---|
| `utils/prcParser.ts` | Leitura dos `.prc`: seção, quantidade, bloco, diagnóstico de relógio e endereço |
| `utils/fileFormat.ts` · `utils/spreadsheetReader.ts` | Formato por magic bytes, encoding, planilha → matriz |
| `utils/avaliacaoV3Parsers.ts` | Parsers dos relatórios do Crystal |
| `services/AreaMappingService.ts` | Mapa seção → área física → conferente |
| `services/ErroAtribuicaoService.ts` | Atribuição das divergências e reconciliação |
| `services/NaoContadoService.ts` | Atribuição dos não contados e cobertura |
| `services/AvaliacaoV3Service.ts` | Composição da nota e ranking |
| `utils/inventExpReportV3.ts` | Ficha individual (texto e HTML/PDF) |
| `utils/avaliacaoConsolidadaXlsx.ts` | Planilha consolidada do líder |
| `utils/export.ts` | Compartilhar, baixar e gravar em lote |
| `config/inventoryEvalConfig.ts` | Pesos, penalidades, limites de bloco, seções de auditoria |

### Parâmetros configuráveis

| Parâmetro | Padrão | Quando mexer |
|---|---|---|
| Pesos dos eixos | 35 / 25 / 25 / 15 | Mudança de política, com aprovação da coordenação |
| Penalidade por controlado | 5 pontos | Operação sem medicamento controlado |
| Penalidade por não contado ALTA | 2 pontos | Calibração após alguns inventários |
| Referência de produtividade | Mediana da equipe | Equipe muito pequena |
| Limiar de ociosidade | 15 minutos | Operação com pausas programadas longas |
| Seções de auditoria | 9999 | Cliente que use outro código |
| Confiança ALTA | 3 itens da marca e 70% de concentração | Afrouxar aumenta a contestação |

---

Calibrado no inventário DPSP / Drogaria São Paulo, loja L2601, capa 2915,
data-base 06/08/2026: 15 conferentes, 53.628 peças, 38.588 bipadas, 13.204
itens auditados, 56 divergências e 28 produtos não contados.
