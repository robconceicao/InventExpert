# SPEC 0003 — Ficha de conferente nunca é sobrescrita por homônimo

- **Estado:** APROVADA
- **Autor:** Roberto
- **Data:** 2026-09-06
- **Entrega relacionada:** achado deixado em aberto na revisão do PR #21

> **Nota de processo:** esta spec foi escrita *depois* do código, invertendo o fluxo do
> `specs/README.md`, e só então aprovada pelo Roberto. Fica registrado porque o ciclo
> seguinte precisa nascer sabendo — a spec vale como contrato daqui em diante, não como
> descrição retroativa do que já estava pronto. Ver seção 10.

---

## 1. Objetivo

O líder que gera as fichas de toda a equipe recebe uma ficha por conferente — mesmo
quando duas pessoas produzem o mesmo nome de arquivo. Hoje uma delas desaparece sem
aviso, e o app informa que as duas foram salvas.

## 2. Escopo

- [ ] `desambiguarNomes()` em `src/utils/nomeArquivo.ts`, puro e testável
- [ ] `salvarArquivosEmLote()` numera colisões antes de gravar, em todas as plataformas
- [ ] `ResultadoLote` ganha `renomeados: { de, para }[]`
- [ ] `InventExpImportScreen` informa no alerta final quais fichas saíram numeradas
- [ ] Suíte `src/utils/__tests__/nomeArquivo.test.ts`, um teste por caso da seção 7

### Não-escopo

- **Mudar como o nome da ficha é montado.** `Avaliacao_<matrícula>_<NOME>.pdf` continua
  igual, inclusive o corte em 40 caracteres e o `sem_matricula`. Trocar o padrão muda o
  nome de arquivos que o cliente já arquivou.
- **Bloquear a geração quando há homônimo.** Entregar duas fichas numeradas é melhor que
  não entregar nenhuma; a decisão de quem é quem é do líder, que conhece a equipe.
- **Sanitizar caracteres proibidos** (`CON`, `PRN`, `:`), já cobertos pelo
  `replace(/[^\w\s-]/g, "")` do gerador de nome.
- **Unificar com o `parseRow` de `parseInventoryCheckersCsv`.** Nada a ver com esta
  entrega.
- **Deduplicar a planilha consolidada.** É um arquivo só, não tem lote.

## 3. Decisões de arquitetura

| # | Decisão | Justificativa | Alternativa descartada |
|---|---------|---------------|------------------------|
| D1 | Numerar na fronteira de IO (`salvarArquivosEmLote`), não no gerador de nome | É a função que grava; protege qualquer chamador presente ou futuro, inclusive um que monte nomes por outro critério | Numerar em `nomeArquivoFicha`/`nomeArquivoFichaV21` — deixaria a garantia dependendo de cada call site lembrar |
| D2 | Sufixo ` (2)`, ` (3)` antes da extensão | Convenção que o usuário já reconhece de download de navegador e do Android | `_2` — combina com o resto do nome, mas se confunde com parte da matrícula |
| D3 | Comparação sem distinguir caixa | O destino pode ser cartão FAT32, onde `JOAO.pdf` e `joao.pdf` são o mesmo arquivo | Comparar exato — correto em ext4, silenciosamente errado no cartão |
| D4 | Renomear e avisar, nunca renomear calado | Ficha individual é lida junto com a pessoa avaliada; entregar a do colega é pior que não entregar | Renomear em silêncio — resolve o arquivo perdido, mantém o risco de troca de destinatário |
| D5 | Utilitário puro em módulo separado | `export.ts` importa `expo-file-system` e `expo-sharing`; o Jest roda em `testEnvironment: node` sem mock de RN | Testar `export.ts` com mocks — mesma razão que já separou `fileFormat` de `fileImport` |

## 4. Restrições

- A ordem de saída acompanha a ordem de entrada: é a ordem do ranking na tela.
- O primeiro arquivo de um nome repetido **não** muda — só os seguintes recebem sufixo.
- Nenhuma mudança no conteúdo das fichas, só no nome do arquivo.
- Vale para PDF e para o `.html` que a web entrega quando o `expo-print` não gera PDF.

## 5. Interfaces e contratos de dados

```typescript
export interface NomesDesambiguados {
  /** Mesma ordem e mesmo tamanho da entrada, sem repetição (ignorando caixa). */
  nomes: string[];
  /** Só o que mudou. Vazio quando não houve colisão — nunca null. */
  renomeados: { de: string; para: string }[];
}

export function desambiguarNomes(entrada: string[]): NomesDesambiguados;

export type ResultadoLote = {
  salvos: number;
  falhas: { nome: string; motivo: string }[];
  pasta?: string;
  via: "download" | "pasta" | "compartilhamento" | "cancelado";
  /** Vazio quando não houve colisão, e nos caminhos cancelados. */
  renomeados: { de: string; para: string }[];
};
```

## 6. Dependências

| Dependência | Estado | No escopo? |
|-------------|--------|------------|
| `salvarArquivosEmLote` (SAF/web/share) | JÁ EXISTE | — |
| `nomeArquivoFicha` / `nomeArquivoFichaV21` | JÁ EXISTE, não muda | — |
| `src/utils/nomeArquivo.ts` | A CRIAR | Sim |

## 7. Casos extremos

| # | Caso | Comportamento esperado |
|---|------|------------------------|
| E1 | Nomes todos distintos | Lista devolvida idêntica; `renomeados` vazio |
| E2 | Dois homônimos sem matrícula | Primeiro intacto, segundo vira ` (2)` |
| E3 | Quatro ou mais iguais | Numeração segue: `(2)`, `(3)`, `(4)` |
| E4 | O lote já traz `f (2).pdf` e dois `f.pdf` | O segundo `f.pdf` pula para `(3)`, sem colidir |
| E5 | `Ficha.pdf` e `FICHA.pdf` | Tratados como o mesmo nome (D3) |
| E6 | Extensão `.html` (web sem `expo-print`) | Sufixo antes da extensão, `.html` preservada |
| E7 | Nome sem extensão | Sufixo no fim |
| E8 | Ponto no meio do nome (`Av_1.2_JOAO.pdf`) | Só a última extensão conta |
| E9 | Lote vazio | `{ nomes: [], renomeados: [] }`, sem exceção |
| E10 | 30 homônimos | 30 nomes distintos |

## 8. Questões em aberto

| # | Pergunta | Dono | Estado |
|---|----------|------|--------|
| Q1 | O líder deveria ser impedido de gerar o lote quando há homônimo sem matrícula, em vez de receber fichas numeradas? | Roberto | ABERTA — resolvida como não-escopo por ora |
| Q2 | A linha de baseline de testes do `CLAUDE.md` deveria citar `npm run check` em vez de um número congelado? O `specs/README.md` já aponta "três baselines conflitantes" como sintoma | Roberto | RESOLVIDA — sim; ADR 0002 registra a decisão e o custo aceito |

## 9. Critérios de aceitação

- [ ] `npm run check` termina sem erro
- [ ] Testes em `src/utils/__tests__/nomeArquivo.test.ts`, um por caso da seção 7:
  - [ ] E1 → `deixa nomes distintos exatamente como estão`
  - [ ] E2 → `numera o repetido sem tocar no primeiro`
  - [ ] E3 → `numera três ou mais em sequência`
  - [ ] E4 → `não colide com um sufixo que já venha no lote`
  - [ ] E5 → `compara ignorando caixa — o destino pode ser FAT32`
  - [ ] E6 → `preserva a extensão, inclusive .html da web`
  - [ ] E7 → `nome sem extensão recebe o sufixo no fim`
  - [ ] E8 → `ponto no meio do nome não vira extensão falsa`
  - [ ] E9 → `lote vazio não quebra`
  - [ ] E10 → `garante unicidade em lote grande de homônimos`
- [ ] Nenhum arquivo fora desta lista foi tocado: `src/utils/nomeArquivo.ts`,
      `src/utils/__tests__/nomeArquivo.test.ts`, `src/utils/export.ts`,
      `src/screens/InventExpImportScreen.tsx`, `CLAUDE.md`,
      `specs/0003-nomes-de-ficha-em-lote.md`,
      `specs/decisions/0002-baseline-de-teste-por-comando.md` (Q2)

## 10. Registro de realimentação

| Data | Achado | Classificação | O que foi feito |
|------|--------|---------------|-----------------|
| 2026-09-06 | Spec escrita depois do código, invertendo o fluxo do `specs/README.md` | LACUNA DE SPEC | Registrado aqui; spec fica RASCUNHO até leitura do Roberto, e o PR não merge antes disso |
| 2026-09-06 | Baseline do `CLAUDE.md` estava em 428/29; o valor real na `main` é 437/29. O número foi medido numa base defasada e mergeado errado no PR #21 | BUG DE CÓDIGO (documentação) | Corrigido nesta entrega; virou a questão Q2 |
| 2026-09-06 | Spec aprovada pelo Roberto após leitura, já com o código escrito. `npm run check` verde no commit `a56f4e6` (448 testes / 30 suites, tsc 0 erros) | — | Estado RASCUNHO → APROVADA; auditoria pelo agente verificador segue pendente |
| 2026-09-06 | Q2 respondida pelo Roberto: trocar o número congelado pelo comando | LACUNA DE SPEC | `CLAUDE.md` passa a mandar rodar `npm run check`; decisão e alternativas descartadas em `specs/decisions/0002-baseline-de-teste-por-comando.md` |
