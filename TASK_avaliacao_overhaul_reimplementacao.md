# Task — Reimplementação do Overhaul do Módulo Avaliação

> Baseline atual: 30 testes / 4 suites / 0 erros TS — não regredir.
> Este documento é a spec completa. Ler junto com ANTIGRAVITY_CONTEXT_InventExpert.md.
> **Regra geral: nenhuma fase começa sem aprovação do Roberto. Nenhuma fase
> termina sem `tsc --noEmit` limpo + Jest verde + commit feito.**

---

## Contexto

O overhaul do módulo Avaliação foi implementado anteriormente em arquivos
locais que nunca foram commitados. Um reset de branch descartou todo o
trabalho. Esta task reconstrói tudo a partir da especificação consolidada.

Os arquivos de teste já restaurados contêm comentários `// a reimplementar`
que indicam exatamente onde cada feature precisa ser reconectada.

---

## FASE 0 — Revisão e Plano (sem editar código)

Antes de tocar em qualquer arquivo:

1. Leia `ANTIGRAVITY_CONTEXT_InventExpert.md` na íntegra.
2. Leia os 4 arquivos de teste atuais e liste todos os comentários
   `// a reimplementar` encontrados.
3. Gere um **Implementation Plan** listando:
   - Quais arquivos serão criados (novos)
   - Quais arquivos serão editados (existentes)
   - A ordem obrigatória de execução (dependências entre passos)
   - Riscos de regressão nos 30 testes atuais

**Aguarde aprovação do Roberto antes de avançar.**

---

## FASE 1 — Tipos e Interfaces (`src/types/index.ts`)

Adicionar ao contrato de tipos:

```typescript
// Violação de limite de bloco por área
interface ViolacaoBloco {
  area: string;
  pctBloco: number;
  limitePermitido: number;
  critica: boolean;
}

// Acurácia por seção (RAIO-X)
interface SectionAccuracyRecord {
  area: string;
  totalItens: number;
  erros: number;
  pctErro: number;
  pctBloco: number;
  violacaoBloco: ViolacaoBloco | null;
}

// Campo matricula em InventoryCheckerInput
interface InventoryCheckerInput {
  // ... campos existentes ...
  matricula?: string;
  itensPulados?: number;
}
```

Adicionar também:
- Perfis comportamentais: `PULA_ITENS | FANTASMA | DESATENTO_GERAL | EQUILIBRADO`
- Tipos de modalidade contratual: `CLT | INTERMITENTE | FREE_LANCE`

**Validação:** `tsc --noEmit` → 0 erros.
**Commit:** `feat: adicionar tipos ViolacaoBloco, SectionAccuracyRecord e perfis comportamentais`
**Aguarde aprovação do Roberto antes de avançar.**

---

## FASE 2 — Configuração de Limites de Bloco (`src/config/inventoryEvalConfig.ts`)

Adicionar tabela de limites por área para operações de farmácia:

| Área | Limite | Crítica |
|---|---|---|
| MEDICAMENTOS | 0% | sim |
| PSICOTRÓPICOS | 0% | sim |
| ANTIBIÓTICOS | 0% | sim |
| GELADEIRAS MEDICAMENTOS | 0% | sim |
| SALA DE APLICAÇÃO | 0% | sim |
| MEDICAMENTOS CARTELADOS | 30% | não |
| OTC / MIP (caixa) | 5% | não |
| ESTOQUE FRENTE DE CAIXA | 90% | não |
| FRENTE DE CAIXA | 15% | não |
| GELADEIRAS FRENTE CAIXA | 15% | não |
| Demais áreas | 20% | não |

Regras:
- Operações **não-farmácia** → sem penalidade de bloco (retornar array vazio).
- `console.warn` obrigatório quando uma área chega sem entrada na tabela.

**Validação:** `tsc --noEmit` → 0 erros.
**Commit:** `feat: adicionar tabela de limites de bloco por area para farmacias`
**Aguarde aprovação do Roberto antes de avançar.**

---

## FASE 3 — Motor de Avaliação (`src/services/InventoryEvaluationService.ts`)

### 3a — Função `calcularPerfilComportamental`

```typescript
// Penalidades calibradas:
// omissão: 0.7 pt/item
// duplicação: 0.2 pt/item
// Perfis: PULA_ITENS, FANTASMA, DESATENTO_GERAL, EQUILIBRADO
function calcularPerfilComportamental(checker: InventoryCheckerInput): PerfilComportamental
```

### 3b — Lógica de bloco por área

- Calcular `pctBloco` por área a partir dos dados de seção.
- Comparar com a tabela de limites da Fase 2.
- Gerar array de `ViolacaoBloco[]`.
- Penalidade de qualidade por violação:
  - Área crítica (0%): −20 pontos
  - Demais: penalidade proporcional ao excesso
- **Qualidade nunca pode atingir 100 quando há qualquer violação de bloco.**

### 3c — Integração com `SectionAccuracyRecord`

- Cada área processada gera um `SectionAccuracyRecord` com bloco% e violação.
- Dados do `.prc` alimentam o RAIO-X quando disponíveis.

### 3d — Exclusão do líder

- O líder da operação (vindo do módulo Andamento) deve ser excluído
  automaticamente das avaliações. Não avaliar, não penalizar.

**Validação:** `tsc --noEmit` → 0 erros + todos os testes verdes.
**Commit:** `feat: reimplementar calcularPerfilComportamental e penalidades de bloco por area`
**Aguarde aprovação do Roberto antes de avançar.**

---

## FASE 4 — Relatórios (`src/utils/inventExpReports.ts`)

### Seção SUAS SEÇÕES — ACURÁCIA
Restaurar com bloco% por área e flag visual para áreas críticas violadas.

### Seção RAIO-X DA QUALIDADE OPERACIONAL
Exibir por área: total de itens, erros, % erro, % bloco, status de violação.

### Seção DIRECIONAMENTO
Deve conter **positivos e pontos de melhora** — não apenas elogios.

### Seção COMO A NOTA FOI CALCULADA
Incluir: valores numéricos + explicação do método + motivo da penalidade
(quando houver violação de bloco).

### Linguagem por modalidade contratual
- **CLT:** linguagem padrão de colaborador
- **Intermitente:** linguagem de prestador intermitente
- **Free Lance:** sem termos que sugiram vínculo empregatício

### Regras fixas
- Campo **"Perfil Operacional" permanece removido** — não reintroduzir.
- Relatório PDF (expo-print) deve espelhar exatamente o relatório texto.

**Validação:** `tsc --noEmit` → 0 erros + todos os testes verdes.
**Commit:** `feat: restaurar secoes RAIO-X, ACURACIA e DIRECIONAMENTO nos relatorios`
**Aguarde aprovação do Roberto antes de avançar.**

---

## FASE 5 — Parsers (`src/utils/inventoryImportParsers.ts`)

Verificar e garantir que a função `normalizarNomeArea` contém os de-paras:

| Input (XLS real) | Normalizado |
|---|---|
| F CAIXA | FRENTE DE CAIXA |
| GELADEIRAS CAIXA | GELADEIRAS FRENTE CAIXA |

- Qualquer área sem match na tabela de limites deve disparar `console.warn`
  — nunca falhar silenciosamente.
- Auto-detectar total de peças e duração a partir do arquivo de produtividade
  (não receber como parâmetro manual).

**Validação:** `tsc --noEmit` → 0 erros + todos os testes verdes.
**Commit:** `feat: garantir normalizarNomeArea e auto-deteccao de totais no parser`
**Aguarde aprovação do Roberto antes de avançar.**

---

## FASE 6 — Reconectar testes e validar baseline final

1. Remover todos os comentários `// a reimplementar` dos arquivos de teste.
2. Descomentar / restaurar os blocos de teste que estavam desativados.
3. Rodar `npm test -- --verbose` e confirmar:
   - **4 test suites**
   - **58 testes passando** (ou justificar qualquer diferença)
   - **0 falhas**
4. Rodar `tsc --noEmit` → **0 erros**.

**Commit final:** `test: restaurar suíte completa — baseline 58 testes`
**Aguarde aprovação do Roberto antes de fechar a task.**

---

## Checklist de encerramento

Antes de declarar a task concluída, confirmar:

- [ ] `tsc --noEmit` → 0 erros
- [ ] Jest → 58 testes / 4 suites / 0 falhas
- [ ] Todos os commits feitos com mensagens descritivas
- [ ] Nenhuma regressão no perfil ATACADO implementado anteriormente
- [ ] "Perfil Operacional" não reintroduzido em nenhum relatório
- [ ] `expo-speech` não utilizado em nenhum arquivo novo (TTS = `ttsService`)
- [ ] Nenhuma chave de API hardcoded
