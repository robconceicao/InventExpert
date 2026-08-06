# InventExpert — Módulo Avaliação: Implementação Completa (v2)

## Instruções gerais para o agente

Você está implementando o módulo de **Avaliação de Conferentes** do InventExpert
(React Native + Expo + TypeScript + Supabase). Este prompt é completo e
autossuficiente. Não pesquise na internet. Leia os arquivos existentes antes
de editar qualquer um deles.

**A cada fase:**
1. Implemente tudo o que está descrito
2. Rode `npx tsc --noEmit` — corrija qualquer erro antes de avançar
3. Rode `npm test` — todos os testes devem passar
4. Faça o commit com a mensagem indicada
5. **Pare e aguarde aprovação do Roberto antes de iniciar a próxima fase**

---

## FASE 0 — Alinhamento com histórico (EXECUTAR ANTES DE QUALQUER OUTRA FASE)

Antes de tocar em qualquer arquivo, execute os seguintes passos:

### 0a — Buscar conversas anteriores sobre o módulo Avaliação

Pesquise em seu histórico de conversas com Roberto todas as interações
relacionadas ao módulo de Avaliação do InventExpert. Use termos como:
- "avaliação conferente InventExpert"
- "módulo avaliação score"
- "relatório individual conferente"
- "bloco área farmácia"
- "PRODUÇÃO_SEÇÃO"

### 0b — Comparar com este prompt

Para cada especificação que aparecer no histórico **e** neste prompt:
- Use a versão **mais recente** como fonte de verdade
- Se o histórico tiver uma atualização posterior à data deste prompt,
  a versão do histórico prevalece
- Se este prompt tiver algo que o histórico não cobre, este prompt prevalece
- Anote as divergências encontradas

### 0c — Reportar antes de avançar

Liste:
1. Conversas encontradas no histórico (data e resumo do que foi decidido)
2. Divergências entre o histórico e este prompt
3. Qual versão será adotada em cada ponto divergente

**Aguarde aprovação do Roberto antes de iniciar a Fase 1.**

---

## Mapa de arquivos do projeto

### Arquivos existentes a modificar

```
src/types/index.ts
src/config/inventoryEvalConfig.ts
src/services/InventoryEvaluationService.ts
src/services/AvaliacaoHistoricoService.ts
src/services/CheckerDBService.ts
src/utils/excelParser.ts
src/utils/inventoryImportParsers.ts
src/utils/parsers.ts
src/utils/fileImport.ts
src/utils/nomeMatching.ts
src/utils/inventExpUtils.ts
src/utils/inventExpReports.ts
src/utils/inventExpReportHtml.ts
src/utils/exportPdf.ts
src/hooks/inventExp/useInventExpImport.ts
src/hooks/inventExp/useInventExpEvaluations.ts
src/hooks/inventExp/useInventExpExport.ts
src/components/CheckerFeedbackReport.tsx
src/screens/InventExpImportScreen.tsx
src/screens/CheckersScreen.tsx
```

### Novos arquivos a criar

```
src/utils/prcParser.ts
src/utils/catalogoLookup.ts
supabase/migration_limites_bloco_area.sql
supabase/migration_secao_lookup.sql
src/utils/__tests__/prcParser.integration.test.ts
src/utils/__tests__/relatorioOutput.test.ts
```

---

## FASE 1 — Banco de dados: migrations

### 1a — `supabase/migration_limites_bloco_area.sql`

Criar este arquivo com o seguinte conteúdo:

```sql
-- Tabela de limites de bloco por área.
-- Ausência de registro = sem limite = sem penalidade (para operações não-farmácia).
-- limite_pct = 9999 significa "sem limite definido" (não penalizar).
CREATE TABLE IF NOT EXISTS limites_bloco_area (
  id              SERIAL PRIMARY KEY,
  tipo_operacao   VARCHAR(30)   NOT NULL,
  nome_area       VARCHAR(50)   NOT NULL,
  limite_pct      NUMERIC(5,2)  NOT NULL,
  area_critica    BOOLEAN       NOT NULL DEFAULT FALSE,
  UNIQUE (tipo_operacao, nome_area)
);

INSERT INTO limites_bloco_area (tipo_operacao, nome_area, limite_pct, area_critica) VALUES
-- Proibido — tolerância zero (ANVISA/SNGPC)
('FARMACIA', 'ANTIBIÓTICOS',                    0.00, TRUE),
('FARMACIA', 'AVARIAS E VENCIDOS',              0.00, TRUE),
('FARMACIA', 'MEDICAMENTOS',                    0.00, TRUE),
('FARMACIA', 'PSICOTRÓPICOS',                   0.00, TRUE),
('FARMACIA', 'TERMOLÁBEIS',                     0.00, TRUE),
('FARMACIA', 'CAIXAS',                          0.00, TRUE),
('FARMACIA', 'GELADEIRAS MEDICAMENTOS',         0.00, TRUE),
('FARMACIA', 'SALA DE APLICAÇÃO',               0.00, TRUE),
-- Crítico — tolerância muito baixa
('FARMACIA', 'MEDICAMENTOS OTC',                5.00, TRUE),
('FARMACIA', 'P DERMO',                         5.00, TRUE),
-- Com limite — não-críticas
('FARMACIA', 'P INFANTIL',                     10.00, FALSE),
('FARMACIA', 'SUPLEMENTOS / VITAMINAS',        10.00, FALSE),
('FARMACIA', 'G 1',                            15.00, FALSE),
('FARMACIA', 'G 2',                            15.00, FALSE),
('FARMACIA', 'G 3',                            15.00, FALSE),
('FARMACIA', 'G 4',                            15.00, FALSE),
('FARMACIA', 'G 5',                            15.00, FALSE),
('FARMACIA', 'G 6',                            15.00, FALSE),
('FARMACIA', 'G 7',                            15.00, FALSE),
('FARMACIA', 'G 8',                            15.00, FALSE),
('FARMACIA', 'G 9',                            15.00, FALSE),
('FARMACIA', 'G 10',                           15.00, FALSE),
('FARMACIA', 'P PERFUMARIA / COSMÉTICOS',      15.00, FALSE),
-- MEDICAMENTOS CARTELADOS: blísteres em pilhas uniformes — EAN idêntico, risco baixo
('FARMACIA', 'MEDICAMENTOS CARTELADOS',        30.00, FALSE),
('FARMACIA', 'ILHAS',                          30.00, FALSE),
('FARMACIA', 'ESTOQUE',                        80.00, FALSE),
('FARMACIA', 'ESTOQUE 2',                      80.00, FALSE),
('FARMACIA', 'ESTOQUE 3',                      80.00, FALSE),
('FARMACIA', 'ESTOQUE FRENTE DE CAIXA',        90.00, FALSE),
('FARMACIA', 'FRENTE DE CAIXA',                90.00, FALSE),
('FARMACIA', 'ATRÁS DE CAIXA',                 90.00, FALSE),
('FARMACIA', 'GELADEIRAS FRENTE CAIXA',       100.00, FALSE),
('FARMACIA', 'SORVETES',                      100.00, FALSE),
('FARMACIA', 'CARTELADO',                     100.00, FALSE),
('FARMACIA', 'NÃO CONTADOS',                  100.00, FALSE),
('FARMACIA', 'BALCÃO DE ATENDIMENTO',        9999.00, FALSE)
ON CONFLICT (tipo_operacao, nome_area) DO NOTHING;

-- Para SUPERMERCADO, HIPERMERCADO, LOJA_GERAL: não inserir linhas.
-- Ausência de registro = sem penalidade de bloco.
```

### 1b — `supabase/migration_secao_lookup.sql`

```sql
CREATE TABLE IF NOT EXISTS secao_lookup (
  codigo_secao  VARCHAR(6)   NOT NULL,
  nome_area     VARCHAR(50)  NOT NULL,
  tipo_operacao VARCHAR(30)  NOT NULL DEFAULT 'FARMACIA',
  PRIMARY KEY (codigo_secao, tipo_operacao)
);
-- Popular com os dados reais do PRODUÇÃO_SEÇÃO.xls após cada evento.
```

**Commit:** `feat: migrations limites_bloco_area e secao_lookup`
**Aguarde aprovação do Roberto antes de avançar.**

---

## FASE 2 — Tipos e interfaces (`src/types/index.ts`)

Adicionar ou atualizar os tipos abaixo. **Não remover tipos existentes.**
Se algum tipo conflitar com o histórico encontrado na Fase 0, usar a versão
mais recente e anotar a divergência.

```typescript
// Modalidade de contrato do conferente
export type ModalidadeContrato = 'CLT' | 'INTERMITENTE' | 'FREE';

// Tipo de operação — controla se bloco é penalizado
export type InventoryOperationType =
  | 'FARMACIA'
  | 'SUPERMERCADO'
  | 'HIPERMERCADO'
  | 'LOJA_GERAL';

// Linha da tabela intermediária (originada do .prc)
export interface ContagemDetalhada {
  matricula:       string;
  area_codigo:     string;   // código numérico 6 dígitos do .prc
  area_nome:       string;   // resolvido via secao_lookup + normalizarNomeArea
  produto_codigo:  string;   // código interno stripped (sem zeros à esquerda)
  produto_nome:    string;   // de cadastro.txt ou invent_DSP.old
  produto_ean:     string;   // EAN real (invent_DSP.old; '' se não disponível)
  produto_classe:  string;   // classificação legal: 'A2', 'C1', '-B2'... ou ''
  quantidade:      number;
  is_bloco:        boolean;  // true quando flag = 'X' no .prc
  data_hora:       Date;
}

// Violação de limite de bloco por área
export interface ViolacaoBloco {
  area_nome:     string;
  limite_pct:    number;
  real_pct:      number;
  area_critica:  boolean;
  excesso_fator: number;    // real_pct / limite_pct; Infinity quando limite = 0
}

// Erro localizado por área (para RAIO-X)
export interface ErroAreaDetalhe {
  area_nome:       string;
  tipo_erro:       'EXECUCAO' | 'OMISSAO' | 'DUPLICACAO' | 'AJUSTE_SECAO';
  ajuste_qtd:      number;
  produto_codigo?: string;
  produto_nome?:   string;
}

// Registro de acurácia por área (seção SUAS SEÇÕES)
export interface SectionAccuracyRecord {
  area_nome:        string;
  secoes_contadas:  number;
  qtd_c1:           number;
  ajuste_a1:        number;
  ajuste_a2:        number;
  ajuste_a3:        number;
  qtd_final:        number;
  bloco_pct:        number;    // % de bloco nessa área (dos .prc)
  limite_bloco:     number;    // limite configurado para a área
  violacao_bloco:   boolean;   // true se bloco_pct > limite_bloco
  area_critica:     boolean;   // true se limite_bloco = 0
}

// Entrada para avaliação de um conferente
export interface InventoryCheckerInput {
  nome:             string;
  matricula:        string;
  modalidade:       ModalidadeContrato;
  totalPecas:       number;
  ritmoMedio:       number;      // itens/hora
  pctErro:          number;
  pctBloco:         number;      // total geral (para exibição)
  errosExecucao:    number;
  omissoes:         number;
  duplicacoes:      number;
  erroSecao:        number;
  icsi:             number;      // 0–100
  sectionAccuracy:  SectionAccuracyRecord[];
  contagensDetalhadas?: ContagemDetalhada[];  // opcional — enriquece RAIO-X
}

// Resultado da avaliação
export interface InventoryCheckerEvaluation {
  matricula:           string;
  nome:                string;
  modalidade:          ModalidadeContrato;
  scoreQualidade:      number;   // 0–100; NUNCA 100 quando há violações de bloco
  scoreProdutividade:  number;
  scoreAderencia:      number;
  scoreICV:            number;
  scoreFinal:          number;
  classificacao:       'CRÍTICO' | 'REGULAR' | 'BOM' | 'EXCELENTE';
  violacoesBloco:      ViolacaoBloco[];
  errosAreaDetalhe:    ErroAreaDetalhe[];
  tags:                string[];
  rankingPos?:         number;
}
```

**Commit:** `feat: atualizar tipos do modulo avaliacao`
**Aguarde aprovação do Roberto antes de avançar.**

---

## FASE 3 — Configurações (`src/config/inventoryEvalConfig.ts`)

Atualizar sem sobrescrever — manter o que já existe e ajustar o necessário:

```typescript
// Metas de produtividade por nível de experiência (itens/hora)
export const METAS_PRODUTIVIDADE: Record<string, number> = {
  EXPERT:  800,
  PLENO:   800,
  JUNIOR:  500,
  TRAINEE: 350,
};

// Penalidades de bloco sobre o componente QUALIDADE
export const PENALIDADE_BLOCO_AREA_CRITICA = 20;  // limite 0%, qualquer bloco
export const PENALIDADE_BLOCO_EXCESSO_ALTO  = 10;  // excesso > 2× o limite
export const PENALIDADE_BLOCO_EXCESSO_LEVE  =  5;  // excesso até 2× o limite

// Classificação por faixa de score final
export const FAIXAS_CLASSIFICACAO = {
  EXCELENTE: 90,
  BOM:       80,
  REGULAR:   70,
  // abaixo de 70 = CRÍTICO
};
```

**Commit:** `feat: atualizar inventoryEvalConfig com penalidades de bloco por area`
**Aguarde aprovação do Roberto antes de avançar.**

---

## FASE 4 — Utilitários auxiliares

### 4a — `normalizarNomeArea` em `src/utils/inventExpUtils.ts`

Adicionar ao arquivo existente (não substituir o conteúdo):

```typescript
// De-para de nomes abreviados (vindos do XLS) para nomes canônicos (tabela BD).
// Aplicar em todo ponto onde o nome de área é lido de um arquivo externo.
const AREA_ALIASES: Record<string, string> = {
  'F CAIXA':           'FRENTE DE CAIXA',
  'GELADEIRAS CAIXA':  'GELADEIRAS FRENTE CAIXA',
  'AVARIAS':           'AVARIAS E VENCIDOS',
  'B ATENDIMENTO':     'BALCÃO DE ATENDIMENTO',
  'P OTC':             'MEDICAMENTOS OTC',
};

export function normalizarNomeArea(nome: string): string {
  const upper = nome.trim().toUpperCase();
  return AREA_ALIASES[upper] ?? upper;
}
```

Aplicar `normalizarNomeArea()` em `inventoryImportParsers.ts` em todos os
pontos onde o nome da área é lido do XLS e atribuído a `SectionAccuracyRecord`.

### 4b — Novo arquivo `src/utils/prcParser.ts`

```typescript
import { ContagemDetalhada } from '../types';

/**
 * Parser de arquivos .prc do sistema de coleta (fixed-width).
 *
 * Layout padrão (83 chars/linha):
 * [00-05] Código evento    [32-42] Matrícula (11d)
 * [06-11] Código loja      [43]    Flag: P=unitário X=bloco
 * [12-17] Seq. sessão      [44-50] Campo interno (7d)
 * [18-25] Data YYYYMMDD    [51-52] Prefixo 'PI'
 * [26-31] Hora HHMMSS      [53-58] Código seção (6d)
 *                          [59-73] Código produto (15d, zero-padded)
 *                          [74-79] Quantidade (6d)
 *                          [80-82] Reservado
 *
 * Variante 84 chars: campo interno com 8d → offset +1 a partir da posição 44.
 */
export function parsePrcFile(conteudo: string): ContagemDetalhada[] {
  const linhas = conteudo.split(/\r?\n/).filter(l => l.length >= 83);
  const resultado: ContagemDetalhada[] = [];

  for (const linha of linhas) {
    const offset = linha.length >= 84 ? 1 : 0;

    const prefixoTipo = linha.substring(51 + offset, 53 + offset);
    if (prefixoTipo !== 'PI') continue;

    const matricula     = linha.substring(32, 43);
    const flag          = linha.substring(43, 44);
    const codigoSecao   = linha.substring(53 + offset, 59 + offset);
    const codigoProduto = linha.substring(59 + offset, 74 + offset).replace(/^0+/, '') || '0';
    const quantidade    = parseInt(linha.substring(74 + offset, 80 + offset), 10);
    const dataStr       = linha.substring(18, 26);
    const horaStr       = linha.substring(26, 32);

    if (isNaN(quantidade)) continue;

    resultado.push({
      matricula,
      area_codigo:    codigoSecao,
      area_nome:      '',
      produto_codigo: codigoProduto,
      produto_nome:   '',
      produto_ean:    '',
      produto_classe: '',
      quantidade,
      is_bloco:       flag === 'X',
      data_hora:      parsePrcDateTime(dataStr, horaStr),
    });
  }
  return resultado;
}

function parsePrcDateTime(data: string, hora: string): Date {
  return new Date(
    `${data.slice(0,4)}-${data.slice(4,6)}-${data.slice(6,8)}` +
    `T${hora.slice(0,2)}:${hora.slice(2,4)}:${hora.slice(4,6)}`
  );
}
```

### 4c — Novo arquivo `src/utils/catalogoLookup.ts`

```typescript
interface ProdutoInfo {
  nome:   string;
  ean:    string;
  classe: string;  // 'A2', 'C1', '-B2'... ou ''
}

/** Indexa cadastro.txt: 15d código | 20d descrição | 3d flag (latin-1) */
export function buildCatalogoIndex(conteudo: string): Map<string, ProdutoInfo> {
  const index = new Map<string, ProdutoInfo>();
  for (const linha of conteudo.split(/\r?\n/)) {
    if (linha.length < 35) continue;
    const codigo = linha.substring(0, 15).replace(/^0+/, '') || '0';
    const nome   = linha.substring(15, 35).trim();
    index.set(codigo, { nome, ean: '', classe: '' });
  }
  return index;
}

/** Indexa invent_DSP_[DATA].old: CSV (;) código;EAN;descrição+classe (latin-1) */
export function buildInventDspIndex(conteudo: string): Map<string, ProdutoInfo> {
  const index = new Map<string, ProdutoInfo>();
  for (const linha of conteudo.split(/\r?\n/)) {
    const partes = linha.split(';');
    if (partes.length < 3) continue;
    const codigo      = partes[0].trim();
    const ean         = partes[1].trim();
    const descRaw     = partes[2].trim();
    const classeMatch = descRaw.match(/\s(-?[ABC]\d)$/);
    const classe      = classeMatch ? classeMatch[1] : '';
    const nome        = descRaw.replace(/\s(-?[ABC]\d)$/, '').trim();
    if (codigo) index.set(codigo, { nome, ean, classe });
  }
  return index;
}

/**
 * Resolve produto preferindo invent_DSP (EAN real + classe legal).
 * Cai para cadastro.txt. Se não encontrado, retorna placeholder.
 */
export function resolverProduto(
  codigo: string,
  inventDsp: Map<string, ProdutoInfo>,
  catalogo: Map<string, ProdutoInfo>
): ProdutoInfo {
  return inventDsp.get(codigo)
      ?? catalogo.get(codigo)
      ?? { nome: `Produto ${codigo}`, ean: '', classe: '' };
}
```

**Commit:** `feat: normalizarNomeArea, prcParser e catalogoLookup`
**Aguarde aprovação do Roberto antes de avançar.**

---

## FASE 5 — Motor de avaliação (`src/services/InventoryEvaluationService.ts`)

Ler o arquivo antes de editar. Adicionar às funções existentes:

### 5a — `calcularBlocoPorArea`

```typescript
function calcularBlocoPorArea(
  matricula: string,
  contagens: ContagemDetalhada[]
): Map<string, number> {
  const doAgente = contagens.filter(c => c.matricula === matricula);
  const result   = new Map<string, number>();

  const areas = [...new Set(doAgente.map(c => c.area_nome))];
  for (const area of areas) {
    const itens    = doAgente.filter(c => c.area_nome === area);
    const totalQtd = itens.reduce((s, c) => s + c.quantidade, 0);
    const blocoQtd = itens.filter(c => c.is_bloco).reduce((s, c) => s + c.quantidade, 0);
    result.set(area, totalQtd > 0 ? (blocoQtd / totalQtd) * 100 : 0);
  }
  return result;
}
```

### 5b — `detectarViolacoesBloco`

```typescript
function detectarViolacoesBloco(
  matricula: string,
  contagens: ContagemDetalhada[],
  limites: Array<{
    tipo_operacao: string;
    nome_area: string;
    limite_pct: number;
    area_critica: boolean;
  }>,
  tipoOperacao: InventoryOperationType
): ViolacaoBloco[] {
  if (tipoOperacao !== 'FARMACIA') return [];  // outros setores: sem penalidade

  const blocoPorArea = calcularBlocoPorArea(matricula, contagens);
  const violacoes: ViolacaoBloco[] = [];

  for (const [area, pct] of blocoPorArea) {
    const limite = limites.find(
      l => l.tipo_operacao === tipoOperacao && l.nome_area === area
    );
    if (!limite) {
      console.warn(`[Avaliação] Área sem limite configurado: "${area}" — ignorando.`);
      continue;
    }
    if (limite.limite_pct >= 9999) continue;  // sem limite definido
    if (pct > limite.limite_pct) {
      violacoes.push({
        area_nome:     area,
        limite_pct:    limite.limite_pct,
        real_pct:      pct,
        area_critica:  limite.area_critica,
        excesso_fator: limite.limite_pct > 0 ? pct / limite.limite_pct : Infinity,
      });
    }
  }
  return violacoes;
}
```

### 5c — Penalidade de bloco no componente QUALIDADE

Adicionar à função de cálculo de qualidade existente, após calcular `qualidadeBase`:

```typescript
let qualidadePenalty = 0;
for (const v of violacoes) {
  if (v.area_critica && v.limite_pct === 0) {
    qualidadePenalty += PENALIDADE_BLOCO_AREA_CRITICA;
  } else if (v.excesso_fator > 2) {
    qualidadePenalty += PENALIDADE_BLOCO_EXCESSO_ALTO;
  } else {
    qualidadePenalty += PENALIDADE_BLOCO_EXCESSO_LEVE;
  }
}
const qualidadeFinal = Math.max(0, qualidadeBase - qualidadePenalty);

// REGRA ABSOLUTA: qualidade nunca pode ser 100 quando há violações de bloco
if (violacoes.length > 0 && qualidadeFinal >= 100) {
  console.error('[Avaliação] BUG: qualidade = 100 com violações de bloco.');
  return 99;
}
return qualidadeFinal;
```

### 5d — Exclusão do líder

O líder da operação (obtido do módulo Andamento) deve ser excluído
automaticamente da lista de conferentes avaliados. Usar o mesmo mecanismo
que o módulo Andamento já usa para buscar o nome/matrícula do líder.

**Commit:** `feat: calcularBlocoPorArea, detectarViolacoesBloco e exclusao do lider`
**Aguarde aprovação do Roberto antes de avançar.**

---

## FASE 6 — Parser XLS de entrada (`src/utils/inventoryImportParsers.ts`)

Ler o arquivo antes de editar. Garantir que o adapter do `PRODUÇÃO_SEÇÃO.xls`
leia corretamente:

| Campo XLS | Campo TypeScript | Tipo |
|-----------|-----------------|------|
| AREA | area_nome (após normalizarNomeArea) | string |
| MATRICULA | matricula | string |
| NOME | nome | string |
| Seções Contadas | secoes_contadas | number |
| Qtd(C1) | qtd_c1 | number |
| Qtd(A1) | ajuste_a1 | number |
| Qtd(A2) | ajuste_a2 | number |
| Qtd(A3) | ajuste_a3 | number |
| QTD(FINAL) | qtd_final | number |

**Regra crítica:** aplicar `normalizarNomeArea()` em todo nome de área lido
do XLS antes de atribuir ao `SectionAccuracyRecord`. Sem isso, as áreas não
encontram seu limite na tabela e a penalidade de bloco é ignorada silenciosamente.

O `PRODUÇÃO.xls` (totais por conferente) deve continuar sendo lido normalmente —
verificar apenas que o campo `BLOCO` é lido como número.

**Commit:** `feat: parser PRODUCAO_SECAO com normalizacao de nomes de area`
**Aguarde aprovação do Roberto antes de avançar.**

---

## FASE 7 — Hook de importação (`src/hooks/inventExp/useInventExpImport.ts`)

### 7a — Múltiplos arquivos .prc

```typescript
// O picker de .prc deve usar multiple: true
const result = await DocumentPicker.getDocumentAsync({
  type: '*/*',
  copyToCacheDirectory: true,
  multiple: true,
});

if (!result.canceled) {
  const todasContagens: ContagemDetalhada[] = [];
  for (const arquivo of result.assets) {
    const conteudo = await FileSystem.readAsStringAsync(arquivo.uri);
    todasContagens.push(...parsePrcFile(conteudo));
  }
  // acumula bipes de todos os coletores do evento
}
```

### 7b — Preview

Após seleção exibir: `✓ N arquivo(s) · X linhas`
onde X = total de linhas válidas (≥ 83 chars e prefixo PI) de todos os arquivos.

### 7c — Resolução de produto e área

```typescript
const catalogoIdx  = buildCatalogoIndex(conteudoCadastro ?? '');
const inventDspIdx = buildInventDspIndex(conteudoInventDsp ?? '');

for (const c of todasContagens) {
  const prod   = resolverProduto(c.produto_codigo, inventDspIdx, catalogoIdx);
  c.produto_nome   = prod.nome;
  c.produto_ean    = prod.ean;
  c.produto_classe = prod.classe;

  const areaNome = await resolverAreaNome(c.area_codigo, tipoOperacao);
  c.area_nome = normalizarNomeArea(areaNome);
}
```

**Commit:** `feat: importacao multiplos prc com resolucao de produto e area`
**Aguarde aprovação do Roberto antes de avançar.**

---

## FASE 8 — Relatório: textos e HTML

Arquivos: `src/utils/inventExpReports.ts` e `src/utils/inventExpReportHtml.ts`
Ler ambos antes de editar.

### 8a — Remover "Perfil Operacional" do cabeçalho

Em todos os templates (texto, HTML, PDF, WhatsApp): remover o campo
"Perfil Operacional". **Não reintroduzir.** Foi removido porque é calculado
com histórico acumulado, gerando incoerência com a classificação do evento atual.

### 8b — Alerta de área crítica (antes de qualquer outra seção)

Condição: `violacoes.filter(v => v.area_critica || v.limite_pct <= 5).length > 0`
Exibir imediatamente após o cabeçalho. Um bloco por violação.

**CLT:**
```
🚨 ALERTA — USO DE BLOCO EM ÁREA RESTRITA

Área: [NOME DA ÁREA]
Limite permitido: [X]%  |  Seu percentual: [Y.Y]%

⚠️ FALTA GRAVE: O uso de bloco nesta área compromete a integridade
do inventário e está em desacordo com os procedimentos internos.
Esta ocorrência será registrada e pode resultar em medida disciplinar
conforme o Código de Conduta e a CLT.
```

**INTERMITENTE:**
```
🚨 ALERTA — USO DE BLOCO EM ÁREA RESTRITA

Área: [NOME DA ÁREA]
Limite permitido: [X]%  |  Seu percentual: [Y.Y]%

⚠️ FALTA GRAVE: O uso de bloco nesta área compromete a integridade
do inventário. Esta ocorrência está documentada e pode impactar
suas convocações futuras, conforme o contrato de trabalho intermitente.
```

**FREE:**
```
🚨 ALERTA — USO DE BLOCO EM ÁREA RESTRITA

Área: [NOME DA ÁREA]
Limite permitido: [X]%  |  Seu percentual: [Y.Y]%

⚠️ OCORRÊNCIA REGISTRADA: O uso de bloco nesta área está em
desacordo com o escopo do serviço contratado. Esta ocorrência
será considerada na avaliação para prestações futuras.
```

### 8c — Seção "SUAS SEÇÕES — ACURÁCIA POR ÁREA" (restaurar)

Esta seção foi removida e deve ser reinserida. Uma linha por área:

```
| Área             | Seções | C1   | Ajuste | Final | Bloco% | Status |
| G 1              |   6    | 1871 |   -9   |  1862 | 12.4%  |  ✅   |
| MEDICAMENTOS     |  35    | 2219 |   +1   |  2220 |  3.1%  |  🚨   |
```

Ícones: ✅ dentro do limite | ⚠️ acima do limite (não crítica) | 🚨 crítica violada.

### 8d — RAIO-X DA QUALIDADE OPERACIONAL (revisado)

**Regra:** exibir apenas itens com ocorrência. Valor zero → não exibir.

**Item 1 — Erros de Execução:**
```
1. Erros de Execução (Quantidade direta): [N] erro(s)
   Produto bipado com quantidade registrada diferente da real.

   - Área [NOME]: [N] unidade(s) de diferença
     → Produto: [NOME] (Cód. [CÓDIGO])
```

**Item 2 — Itens Não Contados:**
```
2. Itens Não Contados na Gôndola (Omissão): [N] produto(s)
   Produto não contado na prateleira ou gancho —
   identificado pelo auditor na recontagem.

   - Área [NOME], Seção [CÓDIGO]: [NOME DO PRODUTO] (Cód. [CÓDIGO])

⚠️ Produto não contado não gera erro no indicador individual,
   mas causa divergência real no estoque da loja.
```

⚠️ TEXTO PROIBIDO: nunca usar "Prateleira ou gancho sem bip algum".
Texto correto: "Produto não contado na prateleira ou gancho".

**Item 3 — Duplicações:**
```
3. Contagens Duplicadas (Excesso): [N] produto(s)
   Área já contada que foi recontada por engano.

   - Área [NOME]: [NOME DO PRODUTO] (Cód. [CÓDIGO])
```

**Item 4 — Erro de Seção:** Σ|Qtd(A1)| + |Qtd(A2)| + |Qtd(A3)|. Exibir só se > 0.

**Item 5 — ICSI:** exibir apenas quando < 100%.

### 8e — COMO A NOTA FOI CALCULADA (revisado)

Cada componente com a estrutura:

```
[COMPONENTE]: [X] pts

Como avaliamos:
[Explicação conceitual — o que é medido, sem fórmula]

Motivo da pontuação:   ← SOMENTE quando nota < máximo possível
[Lista dos fatores que reduziram a nota]
```

Exemplos:

```
Qualidade: 73 pts

Como avaliamos:
Medimos a precisão das contagens — erros de quantidade, produtos
não contados, duplicações e consistência com a recontagem do auditor.

Motivo da pontuação:
• 10 erros de quantidade nas suas seções.
• 1 produto não contado na área G 3.
• 3 contagens duplicadas nas áreas G 2 e P DERMO.
• Bloco acima do limite em MEDICAMENTOS (seu uso: 15% | limite: 0%).
```

```
Aderência ao Método: 0 pts

Como avaliamos:
Verificamos se você seguiu os procedimentos definidos por área —
principalmente o uso correto da contagem unitária onde é obrigatório.

Motivo da pontuação:
• Bloco em MEDICAMENTOS: 15% (limite: 0%) — área de tolerância zero.
• Bloco em G 1: 68% (limite: 15%) — excesso de 4,5× o permitido.
```

### 8f — DIRECIONAMENTO (revisado)

Sempre balancear elogios e pontos de melhora. **Nunca apenas elogios** quando
há falhas registradas.

```
📌 DIRECIONAMENTO PARA O PRÓXIMO INVENTÁRIO

✅ O que você fez bem — continue assim:
• [pontos positivos reais: zero omissões, ritmo acima da meta, etc.]

⚠️ O que precisa melhorar:
• [bloco geral acima do limite]: "Seu uso de bloco foi de [X]%, acima do
  limite de [Y]% para [área]. Isso impacta Qualidade e Aderência."
• [área crítica violada]: "Na área [NOME], o uso de bloco é proibido.
  Você registrou [Y]%. Essa ocorrência fica registrada formalmente."
• [omissões]: "[N] produto(s) não contado(s) em [ÁREAS].
  Isso gera divergência no estoque da loja."

Contamos com sua evolução no próximo processo!
```

Para FREE LANCE: `"Esperamos contar com sua participação no próximo evento!"`

### 8g — Linguagem FREE LANCE

Nunca usar: "colaborador", "funcionário", "equipe", "medida disciplinar".
Substituir "colaborador" → nome ou "prestador de serviço".

Rodapé FREE:
```
Avaliação de desempenho referente à prestação de serviço
Evento: [DATA] — Operação: [OPERAÇÃO]
Gerado em: [DATA DE GERAÇÃO]
```

### 8h — PDF espelha o texto

O relatório PDF (expo-print) deve ter exatamente as mesmas seções, na mesma
ordem, com o mesmo conteúdo do relatório em texto/WhatsApp.

**Commit:** `feat: relatorios revisados com alerta, raio-x, secoes e direcionamento`
**Aguarde aprovação do Roberto antes de avançar.**

---

## FASE 9 — Componente visual (`src/components/CheckerFeedbackReport.tsx`)

Ler o arquivo antes de editar.

1. Remover "Perfil Operacional" do cabeçalho visual.
2. Inserir alerta de área crítica após o cabeçalho (fundo vermelho/amarelo).
3. Restaurar a seção "SUAS SEÇÕES — ACURÁCIA POR ÁREA" com tabela e ícones.
4. Garantir que `sectionAccuracy` é recebido como prop e exibido corretamente.

**Commit:** `feat: CheckerFeedbackReport sem perfil operacional, com alerta e secoes`
**Aguarde aprovação do Roberto antes de avançar.**

---

## FASE 10 — Testes

### `src/utils/__tests__/prcParser.integration.test.ts`

```typescript
import { parsePrcFile } from '../prcParser';
import { buildCatalogoIndex, buildInventDspIndex, resolverProduto } from '../catalogoLookup';
import { normalizarNomeArea } from '../inventExpUtils';

const PRC_83 = [
  '0000010000010000022022050720041441712954830P0000000PI003029000000078910041000033000',
  '0000010000010000022022050720043741712954830P0000000PI003029007895144299549000019000',
  '0000010000010000022022050720062641712954830X0000000PI003029000000078945449000009000',
  '0000010000010000022022050720063541712954830X0000000PI003029000000078945470000009000',
].join('\r\n');

const CADASTRO   = '000000000695815COD PAR 500MG 12CP  NNN\r\n000000078910041GRT PAST.HORTELA17G NNN\r\n';
const INVENT_DSP = '695815; 7899420506918; COD PAR 500MG 12CP  A2\r\n311910; 7891317481629; SIBUTR.15 EU.30CS  -B2\r\n';

describe('parsePrcFile', () => {
  it('parseia 4 linhas de 83 chars', () => {
    const r = parsePrcFile(PRC_83);
    expect(r).toHaveLength(4);
    expect(r[0].matricula).toBe('41712954830');
    expect(r[0].area_codigo).toBe('003029');
    expect(r[0].produto_codigo).toBe('78910041');
    expect(r[0].quantidade).toBe(33);
    expect(r[0].is_bloco).toBe(false);
    expect(r[2].is_bloco).toBe(true);
  });
  it('ignora linhas sem prefixo PI', () => {
    const r = parsePrcFile('linha_invalida\r\n' + PRC_83);
    expect(r).toHaveLength(4);
  });
});

describe('catalogoLookup', () => {
  it('resolve produto via cadastro', () => {
    const idx  = buildCatalogoIndex(CADASTRO);
    const prod = resolverProduto('695815', new Map(), idx);
    expect(prod.nome).toBe('COD PAR 500MG 12CP');
  });
  it('prefere invent_DSP (tem EAN e classe)', () => {
    const dsp  = buildInventDspIndex(INVENT_DSP);
    const cat  = buildCatalogoIndex(CADASTRO);
    const prod = resolverProduto('695815', dsp, cat);
    expect(prod.ean).toBe('7899420506918');
    expect(prod.classe).toBe('A2');
  });
  it('extrai classe legal do sufixo', () => {
    const dsp = buildInventDspIndex(INVENT_DSP);
    expect(dsp.get('311910')?.classe).toBe('-B2');
  });
  it('placeholder para código inexistente', () => {
    const prod = resolverProduto('9999999', new Map(), new Map());
    expect(prod.nome).toContain('9999999');
  });
});

describe('normalizarNomeArea', () => {
  test.each([
    ['F CAIXA',          'FRENTE DE CAIXA'],
    ['f caixa',          'FRENTE DE CAIXA'],
    ['GELADEIRAS CAIXA', 'GELADEIRAS FRENTE CAIXA'],
    ['AVARIAS',          'AVARIAS E VENCIDOS'],
    ['B ATENDIMENTO',    'BALCÃO DE ATENDIMENTO'],
    ['P OTC',            'MEDICAMENTOS OTC'],
    ['G 1',              'G 1'],
    ['  g 3  ',          'G 3'],
  ])('normaliza "%s" → "%s"', (input, expected) => {
    expect(normalizarNomeArea(input)).toBe(expected);
  });
});
```

### `src/utils/__tests__/relatorioOutput.test.ts`

Cobrir três cenários:

**Cenário 1 — EVERALDO (INTERMITENTE, bloco 70.5%, zero erros):**
- `scoreQualidade` deve ser **< 100**
- RAIO-X: nenhum item exibido (todos zerados)
- DIRECIONAMENTO: deve conter `⚠️ O que precisa melhorar`
- Cabeçalho: sem "Perfil Operacional"

**Cenário 2 — ELEN (FREE, score 81, omissão 1, duplicação 3, erro 10):**
- RAIO-X: exibir área e produto quando disponível
- Rodapé: sem "colaborador" nem "medida disciplinar"
- Alerta de área crítica: usar linguagem versão FREE

**Cenário 3 — CLT com bloco em MEDICAMENTOS (limite 0%):**
- Alerta 🚨 aparece **antes** de qualquer outra seção
- Texto: versão CLT ("medida disciplinar", "CLT")
- `scoreQualidade` ≤ 80 (penalidade de 20 pts por área crítica)

**Commit:** `test: suite completa parsers e relatorios modulo avaliacao`
**Aguarde aprovação do Roberto antes de avançar.**

---

## FASE 11 — Verificação final

```bash
npx tsc --noEmit   # deve retornar 0 erros
npm test           # todos os testes devem passar
```

Reportar:
- Total de testes passando
- Confirmação de 0 erros TypeScript
- Lista de arquivos modificados/criados

**Commit:** `chore: verificacao final modulo avaliacao v2`

---

## Regras que nunca podem ser violadas

1. **Qualidade nunca atinge 100** quando há violações de bloco.
2. **"Perfil Operacional" removido permanentemente** — não reintroduzir.
3. **TTS** usa sempre `ttsService.speak(msg)` — nunca `speak()` com objeto de opções.
4. **API keys** apenas via variáveis de ambiente. Nunca hardcodar.
5. **Operações não-farmácia:** `detectarViolacoesBloco` retorna `[]` imediatamente.
6. **`normalizarNomeArea` obrigatória** em todo ponto de leitura de área do XLS.
7. **Múltiplos .prc:** acumular todos antes de calcular — nunca processar um só.
8. **Área sem entrada na tabela:** `console.warn`, não penalizar silenciosamente.
9. **Fase 0 obrigatória:** comparar com histórico antes de qualquer implementação.
