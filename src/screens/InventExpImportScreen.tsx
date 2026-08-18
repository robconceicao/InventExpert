import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import React, { useMemo, useState } from "react";
import {
    Alert,
    Linking,
    Platform,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CheckerFeedbackReport } from "../components/CheckerFeedbackReport";
import {
    getLimitesBlocoFallback,
    INVENTORY_PROFILES,
    type LimiteBlocoRow,
} from "../config/inventoryEvalConfig";
import { getLimitesBlocoArea } from "../repositories/limitesBlocoRepository";
import { getSecaoLookup } from "../repositories/secaoLookupRepository";
import {
    evaluateChecker,
    sortRanking,
} from "../services/InventoryEvaluationService";
import { canPublishProdutividade, resolveAppRole } from "../services/authz";
import { ProdutividadePublishService } from "../services/ProdutividadePublishService";
import { isSupabaseConfigured, supabase } from "../services/supabase";
import type {
    AuditoriaAgenteInfo,
    ContagemDetalhada,
    ModalidadeContratoCanonico,
    InventoryCheckerEvaluation,
    InventoryOperationType,
    SectionAccuracyRecord,
} from "../types";
import {
    buildCatalogoIndex,
    buildInventDspIndex,
    resolverProduto,
} from "../utils/catalogoLookup";
import {
    type ArquivoGerado,
    renderizarPdfBase64,
    salvarArquivosEmLote,
    shareCsvFile,
    sharePdfFromHtml,
    shareTextFile,
    shareXlsxWorkbook,
} from "../utils/export";
import {
    montarWorkbookConsolidado,
    montarWorkbookConsolidadoV21,
    nomeArquivoConsolidado,
} from "../utils/avaliacaoConsolidadaXlsx";
import { generateInventExpIndividualReportHtml } from "../utils/inventExpReportHtml";
import { ErroLeituraArquivo, readFileAsCsvText, readFileAsText } from "../utils/fileImport";
import {
    generateInventExpGerencialReportText,
    generateInventExpIndividualReportText,
} from "../utils/inventExpReports";
import {
    enriquecerSecoesComBloco,
    extractProductivityTotals,
    filtrarContagensDoConferente,
    filtrarSecoesDoConferente,
    resolverAreasNasContagens,
} from "../utils/inventoryImportParsers";
import { areasSemLimiteCadastrado } from "../utils/inventExpUtils";
import { parseInventoryCheckersCsv } from "../utils/parsers";
import { parsePrcFiles } from "../utils/prcParser";
import { pickSheetAsMatrix } from "../utils/excelParser";
import { buildAgentesIndex } from "../utils/auditoriaParsers";
import {
  montarCadastroProduto,
  parseAcuracidadeMatrix,
  parseAuditoriaDirigida,
  parseControladosMatrix,
  parseBlocoMatrix,
  parseDobroMatrix,
  parseNaoContadosMatrix,
  parseProdSecaoMatrix,
  prodSecaoParaSecoes,
  type BlocoRow,
  type DobroRow,
} from "../utils/avaliacaoV3Parsers";
import {
    construirMapaAreas,
    type MapaAreas,
    type ProdSecaoRow,
} from "../services/AreaMappingService";
import { gerarRelatorioV3Html, gerarRelatorioV3Texto } from "../utils/inventExpReportV3";
import ModalidadeContratoModal, {
  type ConferenteParaMarcar,
} from "../components/ModalidadeContratoModal";
import {
  getModalidades,
  salvarModalidades,
} from "../repositories/modalidadeRepository";
import {
  atribuirDivergencias,
  conferirBloco,
  conferirReconciliacao,
  contarDobroPorConferente,
  type AcuracidadeRow,
  type ConferenciaBloco,
} from "../services/ErroAtribuicaoService";
import { atribuirNaoContados, type NaoContadoInput } from "../services/NaoContadoService";
import {
  avaliarConferenteV3,
  medianaProdutividade,
  ordenarRankingV3,
  type AvaliacaoV3,
} from "../services/AvaliacaoV3Service";


/**
 * O picker nunca filtra por MIME.
 *
 * Os arquivos do inventário (.xls do Crystal Reports, .prc do coletor,
 * cadastro.txt, invent_DSP.old) chegam do Android como
 * `application/octet-stream`: qualquer lista de `type` deixa esses arquivos
 * cinza e impossíveis de selecionar. Quem valida o formato é o leitor, pelo
 * conteúdo — ver `src/utils/fileFormat.ts`.
 */
const PICKER_QUALQUER_ARQUIVO = {
  type: "*/*",
  copyToCacheDirectory: true,
} as const;

/** Base64 de texto UTF-8 — `btoa()` cru estoura com acento. */
function btoaUtf8(texto: string): string {
  const bytes = new TextEncoder().encode(texto);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/** Usa a mensagem específica do leitor quando existir; senão, a genérica. */
function mensagemDeErro(erro: unknown, padrao: string): string {
  return erro instanceof ErroLeituraArquivo ? erro.message : padrao;
}

const EXAMPLE_INVENTEXP_CSV = `NOME DO CONFERENTE;PRODUTIVIDADE;QTDE. VOLUMES;1a1;BLOCO;HORAS ESTIMADAS;ERRO;% ERRO
AMANDA DE OLIVEIRA P...;395,33;752;0;18;1,9;13;1,73%
ANA CLAUDIA SILVA;802,26;5549;4487;374;6,9;13;0,23%
CAMILA FERREIRA;1046,31;5573;1190;451;5,3;0;0,00%`;

export default function InventExpImportScreen() {
  const [operationType, setOperationType] =
    useState<InventoryOperationType>("FARMACIA");
  const [rawText, setRawText] = useState("");
  const [evaluations, setEvaluations] = useState<InventoryCheckerEvaluation[]>(
    [],
  );
  const [prcInfo, setPrcInfo] = useState<{
    count: number;
    totalLines: number;
    enderecosForaPadrao: number;
    datas: string[];
    ignoradas: number;
  } | null>(null);
  const [prcContagens, setPrcContagens] = useState<ContagemDetalhada[]>([]);

  // --- entradas do motor v3 ---
  const [prodSecaoRows, setProdSecaoRows] = useState<ProdSecaoRow[]>([]);
  const [acuracidade, setAcuracidade] = useState<AcuracidadeRow[]>([]);
  const [naoContadosArq, setNaoContadosArq] = useState<NaoContadoInput[]>([]);
  const [auditoriaTexto, setAuditoriaTexto] = useState("");
  const [saldoAuditoriaText, setSaldoAuditoriaText] = useState("");
  const [controlados, setControlados] = useState<Set<string>>(new Set());
  const [dobroRows, setDobroRows] = useState<DobroRow[]>([]);
  const [modalidades, setModalidades] = useState<Map<string, ModalidadeContratoCanonico>>(new Map());
  const [modalVisivel, setModalVisivel] = useState(false);
  const [paraMarcar, setParaMarcar] = useState<ConferenteParaMarcar[]>([]);
  const [salvandoModalidade, setSalvandoModalidade] = useState(false);
  const [blocoRows, setBlocoRows] = useState<BlocoRow[]>([]);
  const [agentesMap, setAgentesMap] = useState<Map<string, AuditoriaAgenteInfo>>(new Map());
  const [avaliacoesV3, setAvaliacoesV3] = useState<AvaliacaoV3[]>([]);
  const [diagV3, setDiagV3] = useState<{
    secoesMapeadas: number;
    areasNaoConformes: number;
    divergencias: number;
    orfas: number;
    compartilhadas: number;
    reconciliacaoOk: boolean;
    falhasReconciliacao: { matricula: string; esperado: number; apurado: number }[];
    naoContados: number;
    naoContadosAlta: number;
    dobro: number;
    bloco: ConferenciaBloco | null;
  } | null>(null);
  const [medianaEquipe, setMedianaEquipe] = useState(0);

  const [cadastroText, setCadastroText] = useState("");
  const [inventDspText, setInventDspText] = useState("");
  const [producaoSecao, setProducaoSecao] = useState<SectionAccuracyRecord[]>([]);
  /** Nome do líder (Acompanhamento) — excluído da avaliação automática */
  const [leaderName, setLeaderName] = useState("");
  const [processing, setProcessing] = useState(false);
  /** Publicação no histórico de produtividade (escala) */
  const [publishDate, setPublishDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [publishRef, setPublishRef] = useState("");
  const [publishing, setPublishing] = useState(false);
  /** Trava o botão enquanto as fichas da equipe são renderizadas. */
  const [gerandoFichas, setGerandoFichas] = useState(false);
  /** Áreas do inventário sem limite de bloco na tabela — bloco não verificado. */
  const [areasSemLimiteBloco, setAreasSemLimiteBloco] = useState<string[]>([]);
  /**
   * Rótulo do arquivo sendo lido, ou null.
   *
   * Um ACURACIDADE de 6 MB leva vários segundos entre escolher o arquivo e o
   * botão ficar verde. Sem sinal na tela, a leitura em andamento é
   * indistinguível de "não aconteceu nada" — foi assim que uma leitura lenta
   * passou por arquivo não anexado.
   */
  const [lendoArquivo, setLendoArquivo] = useState<string | null>(null);

  /** Envolve um anexo com o aviso de "lendo" e um erro sempre visível. */
  const comLeitura = async (rotulo: string, fn: () => Promise<void>) => {
    if (lendoArquivo) {
      Alert.alert("Aguarde", `Ainda lendo ${lendoArquivo}.`);
      return;
    }
    setLendoArquivo(rotulo);
    try {
      await fn();
    } catch (e: any) {
      Alert.alert("Erro", `Falha ao ler ${rotulo}: ${e?.message ?? e}`);
    } finally {
      setLendoArquivo(null);
    }
  };

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync(PICKER_QUALQUER_ARQUIVO);
      if (result.canceled) return;
      const file = result.assets[0];
      const text = await readFileAsCsvText(
        file.uri,
        file.mimeType ?? undefined,
        file.name ?? undefined,
      );
      setRawText(text);
      await abrirMarcacaoModalidade(text);
    } catch (e) {
      Alert.alert("Erro", mensagemDeErro(e, "Não foi possível ler o arquivo."));
    }
  };

  const handlePickPrcFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        ...PICKER_QUALQUER_ARQUIVO,
        multiple: true,
      });
      if (result.canceled) return;

      const arquivos = result.assets;
      const conteudos: string[] = [];
      for (const arquivo of arquivos) {
        conteudos.push(await readFileAsText(arquivo.uri, arquivo.name ?? undefined));
      }

      const r = parsePrcFiles(conteudos);
      setPrcContagens(r.contagens);
      setPrcInfo({
        count: arquivos.length,
        totalLines: r.contagens.length,
        enderecosForaPadrao: r.enderecosForaPadrao,
        datas: r.datasDistintas,
        ignoradas: r.linhasIgnoradas,
      });

      const avisos: string[] = [];
      if (r.datasDistintas.length > 1) {
        avisos.push(
          `Relógio: ${r.datasDistintas.length} datas distintas (${r.datasDistintas.join(", ")}). ` +
            "Volume e sequência valem; hora absoluta, não.",
        );
      }
      if (r.enderecosForaPadrao > 0) {
        avisos.push(
          `${r.enderecosForaPadrao} endereço(s) fora do padrão — digitação manual no coletor.`,
        );
      }
      Alert.alert(
        "Arquivos .prc",
        `✓ ${arquivos.length} arquivo(s) · ${r.contagens.length.toLocaleString("pt-BR")} bipadas` +
          (avisos.length ? `\n\n⚠ ${avisos.join("\n⚠ ")}` : ""),
      );
    } catch (e) {
      Alert.alert("Erro", mensagemDeErro(e, "Não foi possível ler os arquivos .prc."));
    }
  };

  const handlePickCadastro = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync(PICKER_QUALQUER_ARQUIVO);
      if (result.canceled) return;
      const file = result.assets[0];
      setCadastroText(await readFileAsText(file.uri, file.name ?? undefined));
      Alert.alert("Sucesso", "cadastro.txt carregado.");
    } catch (e) {
      Alert.alert("Erro", mensagemDeErro(e, "Falha ao ler cadastro.txt."));
    }
  };

  const handlePickInventDsp = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync(PICKER_QUALQUER_ARQUIVO);
      if (result.canceled) return;
      const file = result.assets[0];
      setInventDspText(await readFileAsText(file.uri, file.name ?? undefined));
      Alert.alert("Sucesso", "invent_DSP carregado.");
    } catch (e) {
      Alert.alert("Erro", mensagemDeErro(e, "Falha ao ler invent_DSP."));
    }
  };

  /**
   * Um único arquivo alimenta os dois motores: as linhas viram `ProdSecaoRow`
   * para o mapa de áreas do v3 e `SectionAccuracyRecord` para o motor v2.1.
   */
  const handlePickProducaoSecao = async () =>
    comLeitura("PROD_SEÇÃO", async () => {
    try {
      const { matriz, erro, cancelado, nome } = await pickSheetAsMatrix();
      if (cancelado) return;
      if (erro) { Alert.alert("Erro", erro); return; }
      if (matriz.length === 0) {
        Alert.alert("Nada foi lido", `"${nome ?? "O arquivo"}" não produziu nenhuma linha.`);
        return;
      }

      const linhas = parseProdSecaoMatrix(matriz);
      if (linhas.length === 0) {
        Alert.alert(
          "PROD_SEÇÃO",
          "Nenhuma linha reconhecida. Confira se o arquivo tem as colunas AREA, MATRICULA e Qtd(C1).",
        );
        return;
      }
      setProdSecaoRows(linhas);
      setProducaoSecao(prodSecaoParaSecoes(linhas));
      const areas = new Set(linhas.map((l) => l.area)).size;
      Alert.alert(
        "PROD_SEÇÃO carregado",
        `${linhas.length} combinação(ões) · ${areas} área(s) físicas`,
      );
    } catch (e: any) {
      Alert.alert("Erro", "Falha ao ler PROD_SEÇÃO: " + (e?.message ?? ""));
    }
  });

  const handlePickAcuracidade = async () =>
    comLeitura("ACURACIDADE", async () => {
    try {
      const { matriz, erro, cancelado, nome } = await pickSheetAsMatrix();
      if (cancelado) return;
      if (erro) { Alert.alert("Erro", erro); return; }
      if (matriz.length === 0) {
        Alert.alert("Nada foi lido", `"${nome ?? "O arquivo"}" não produziu nenhuma linha.`);
        return;
      }
      const linhas = parseAcuracidadeMatrix(matriz);
      setAcuracidade(linhas);
      const div = linhas.filter((l) => l.ajuste !== 0).length;
      if (linhas.length === 0) {
        Alert.alert(
          "ACURACIDADE sem linhas",
          `O cabeçalho foi encontrado em "${nome ?? "arquivo"}", mas nenhuma linha tinha SEÇÃO e EAN preenchidos.`,
        );
        return;
      }
      Alert.alert(
        "ACURACIDADE carregado",
        `${nome ?? "Arquivo"}\n${linhas.length.toLocaleString("pt-BR")} itens · ${div} com divergência`,
      );
    } catch (e: any) {
      Alert.alert("Erro", "Falha ao ler ACURACIDADE: " + (e?.message ?? ""));
    }
  });

  const handlePickNaoContados = async () =>
    comLeitura("NÃO CONTADOS", async () => {
    try {
      const { matriz, erro, cancelado, nome } = await pickSheetAsMatrix();
      if (cancelado) return;
      if (erro) { Alert.alert("Erro", erro); return; }
      if (matriz.length === 0) {
        Alert.alert("Nada foi lido", `"${nome ?? "O arquivo"}" não produziu nenhuma linha.`);
        return;
      }
      const itens = parseNaoContadosMatrix(matriz);
      setNaoContadosArq(itens);
      Alert.alert("NÃO CONTADOS carregado", `${itens.length} produto(s) sem coleta`);
    } catch (e: any) {
      Alert.alert("Erro", "Falha ao ler NAO CONTADOS: " + (e?.message ?? ""));
    }
  });

  const handlePickDobro = async () =>
    comLeitura("DOBRO", async () => {
    try {
      const { matriz, erro, cancelado, nome } = await pickSheetAsMatrix();
      if (cancelado) return;
      if (erro) { Alert.alert("Erro", erro); return; }
      if (matriz.length === 0) {
        Alert.alert("Nada foi lido", `"${nome ?? "O arquivo"}" não produziu nenhuma linha.`);
        return;
      }
      const linhas = parseDobroMatrix(matriz);
      setDobroRows(linhas);
      Alert.alert("DOBRO carregado", `${linhas.length} bipada(s) em duplicidade`);
    } catch {
      Alert.alert("Erro", "Falha ao ler DOBRO.");
    }
  });

  const handlePickBloco = async () =>
    comLeitura("BLOCO", async () => {
    try {
      const { matriz, erro, cancelado, nome } = await pickSheetAsMatrix();
      if (cancelado) return;
      if (erro) { Alert.alert("Erro", erro); return; }
      if (matriz.length === 0) {
        Alert.alert("Nada foi lido", `"${nome ?? "O arquivo"}" não produziu nenhuma linha.`);
        return;
      }
      const linhas = parseBlocoMatrix(matriz);
      setBlocoRows(linhas);
      Alert.alert(
        "BLOCO carregado",
        `${linhas.length} linha(s). Serve de conferência independente da seção e da regra de bloco.`,
      );
    } catch {
      Alert.alert("Erro", "Falha ao ler BLOCO.");
    }
  });

  const handlePickControlados = async () =>
    comLeitura("CONTROLADOS", async () => {
    try {
      const { matriz, erro, cancelado, nome } = await pickSheetAsMatrix();
      if (cancelado) return;
      if (erro) { Alert.alert("Erro", erro); return; }
      if (matriz.length === 0) {
        Alert.alert("Nada foi lido", `"${nome ?? "O arquivo"}" não produziu nenhuma linha.`);
        return;
      }
      const eans = parseControladosMatrix(matriz);
      setControlados(eans);
      Alert.alert("CONTROLADOS carregado", `${eans.size} código(s) de barras`);
    } catch {
      Alert.alert("Erro", "Falha ao ler CONTROLADOS.");
    }
  });

  /** Arquivo de saldo/auditoria do CadProd — traz o custo unitário. */
  const handlePickSaldoAuditoria = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
      if (result.canceled) return;
      const texto = await readFileAsText(result.assets[0].uri);
      setSaldoAuditoriaText(texto);
      Alert.alert("Sucesso", "Saldo/custo do CadProd carregado.");
    } catch {
      Alert.alert("Erro", "Falha ao ler o arquivo de saldo do CadProd.");
    }
  };

  const handlePickAgentes = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
      if (result.canceled) return;
      const texto = await readFileAsText(result.assets[0].uri);
      const map = buildAgentesIndex(texto);
      setAgentesMap(map);
      Alert.alert("Sucesso", `${map.size} agente(s) indexado(s).`);
    } catch {
      Alert.alert("Erro", "Falha ao ler agentes.txt / CadFun.txt.");
    }
  };

  /**
   * Abre a marcação de modalidade logo após a leitura do arquivo de produtividade.
   *
   * O relatório individual muda de linguagem conforme o vínculo, e o arquivo não
   * traz essa informação. Quem já tem marcação no cadastro vem preenchido; os
   * demais aparecem em branco e precisam de escolha explícita.
   */
  const abrirMarcacaoModalidade = async (texto: string) => {
    const conferentes = parseInventoryCheckersCsv(texto).filter((c) => c.matricula);
    if (conferentes.length === 0) {
      Alert.alert(
        "Nenhum conferente reconhecido",
        "Confira se o arquivo é o RProInv_Produtividade e se tem as colunas de matrícula e nome.",
      );
      return;
    }

    const conhecidas = await getModalidades(conferentes.map((c) => c.matricula!));
    const chave = (m: string) => m.replace(/\D/g, "") || m;

    setParaMarcar(
      conferentes.map((c) => ({
        matricula: c.matricula!,
        nome: c.nome,
        modalidade: conhecidas.get(chave(c.matricula!)) ?? null,
        jaConhecido: conhecidas.has(chave(c.matricula!)),
      })),
    );
    setModalVisivel(true);
  };

  const confirmarModalidades = async (lista: ConferenteParaMarcar[]) => {
    setSalvandoModalidade(true);
    try {
      const sincronizou = await salvarModalidades(
        lista.map((c) => ({ matricula: c.matricula, nome: c.nome, modalidade: c.modalidade })),
      );

      const mapa = new Map<string, ModalidadeContratoCanonico>();
      for (const c of lista) {
        if (c.modalidade) mapa.set(c.matricula.replace(/\D/g, "") || c.matricula, c.modalidade);
      }
      setModalidades(mapa);
      setModalVisivel(false);

      const free = lista.filter((c) => c.modalidade === "FREE").length;
      Alert.alert(
        "Modalidades registradas",
        `${lista.length} conferente(s) marcados` +
          (free > 0 ? ` · ${free} como prestador de serviço` : "") +
          (sincronizou
            ? ""
            : "\n\nAtenção: não foi possível gravar no cadastro. A marcação vale só neste aparelho até a próxima sincronização."),
      );
    } finally {
      setSalvandoModalidade(false);
    }
  };

  /** Conferentes do arquivo que ainda estão sem modalidade definida. */
  const semModalidade = useMemo(() => {
    if (rawText.length === 0) return [];
    return parseInventoryCheckersCsv(rawText)
      .filter((c) => c.matricula)
      .filter((c) => !modalidades.has(c.matricula!.replace(/\D/g, "") || c.matricula!))
      .map((c) => c.nome);
  }, [rawText, modalidades]);

  /**
   * Motor v3 — só roda quando as três entradas essenciais estão presentes:
   * .prc, PROD_SEÇÃO e ACURACIDADE. Sem qualquer uma delas não há mapa de
   * áreas nem divergência para atribuir, e a tela segue apenas com o v2.1.
   */
  const processarV3 = (
    parsed: ReturnType<typeof parseInventoryCheckersCsv>,
    contagens: ContagemDetalhada[],
    leader?: string,
    /** Mapa já construído pelo v2.1 — reaproveitado para não pagar duas vezes
     *  a busca por permutação do `construirMapaAreas()`. */
    mapaPronto?: MapaAreas | null,
  ) => {
    if (contagens.length === 0 || prodSecaoRows.length === 0 || acuracidade.length === 0) {
      setAvaliacoesV3([]);
      setDiagV3(null);
      return;
    }

    const mapa = mapaPronto ?? construirMapaAreas(prodSecaoRows, contagens);

    const { custoPorEan, familiaPorEan } = montarCadastroProduto(
      inventDspText,
      saldoAuditoriaText,
    );

    const datasValidas = new Set(
      (prcInfo?.datas ?? []).length > 0
        ? [...(prcInfo?.datas ?? [])].sort().slice(-2)
        : [],
    );

    const atribuicao = atribuirDivergencias(acuracidade, contagens, mapa, {
      custoPorEan,
      eansControlados: controlados,
      datasValidas: datasValidas.size > 0 ? datasValidas : undefined,
    });

    // Conferência obrigatória: a soma atribuída tem de reproduzir Erro (Qtde).
    const erroPorMatricula = new Map<string, number>();
    for (const p of parsed) {
      if (p.matricula) erroPorMatricula.set(p.matricula, p.erro || 0);
    }
    const falhas = conferirReconciliacao(atribuicao, erroPorMatricula);

    const itensNaoContados = [
      ...parseAuditoriaDirigida(auditoriaTexto),
      ...naoContadosArq,
    ];
    const naoContados = atribuirNaoContados(
      itensNaoContados,
      acuracidade,
      contagens,
      mapa,
      atribuicao.divergencias,
      { familiaPorEan },
    );

    // A mediana precisa das peças/h já sem a auditoria dirigida, então roda
    // uma primeira passada só para obter o ritmo de cada conferente.
    const contexto0 = { medianaProdutividade: 1, mapa, datasValidas, agentes: agentesMap };
    const ritmos: number[] = [];
    for (const item of parsed) {
      if (!item.matricula) continue;
      const r = avaliarConferenteV3(
        { ...item, matricula: item.matricula, valorContado: 1, valorAjustado: 0, horas: 1 },
        operationType,
        contagens,
        [],
        [],
        contexto0,
        0,
        0,
        leader,
      );
      if (r) ritmos.push(r.produtividade);
    }
    const mediana = medianaProdutividade(ritmos);
    setMedianaEquipe(mediana);

    const dobroPorConferente = contarDobroPorConferente(dobroRows, contagens);

    const contexto = { medianaProdutividade: mediana, mapa, datasValidas, agentes: agentesMap };
    const resultados: AvaliacaoV3[] = [];
    for (const item of parsed) {
      if (!item.matricula) continue;
      const r = avaliarConferenteV3(
        {
          ...item,
          matricula: item.matricula,
          valorContado: item.valorC1 ?? 0,
          valorAjustado: item.valorAjuste ?? 0,
          horas: item.horas ?? 0,
        },
        operationType,
        contagens,
        atribuicao.divergencias,
        naoContados,
        contexto,
        atribuicao.auditadosPorMatricula.get(item.matricula) ?? 0,
        dobroPorConferente.get(item.matricula) ?? 0,
        leader,
      );
      if (r) resultados.push(r);
    }

    setAvaliacoesV3(ordenarRankingV3(resultados));
    setDiagV3({
      secoesMapeadas: mapa.secaoParaArea.size,
      areasNaoConformes: mapa.naoConformes.length,
      divergencias: atribuicao.divergencias.length,
      orfas: atribuicao.orfas.length,
      compartilhadas: atribuicao.divergencias.filter((d) => d.compartilhada).length,
      reconciliacaoOk: falhas.length === 0,
      falhasReconciliacao: falhas,
      naoContados: naoContados.length,
      naoContadosAlta: naoContados.filter((n) => n.nivel === "ALTA" && n.peso > 0).length,
      dobro: dobroRows.length,
      bloco: blocoRows.length > 0 ? conferirBloco(blocoRows, contagens) : null,
    });

    if (falhas.length > 0) {
      Alert.alert(
        "Reconciliação não fechou",
        `${falhas.length} conferente(s) com soma de divergências diferente do Erro (Qtde) do sistema. ` +
          "A cadeia de atribuição quebrou — não publicar a avaliação antes de investigar.",
      );
    }
  };

  const handleProcess = async () => {
    const parsed = parseInventoryCheckersCsv(rawText);
    if (parsed.length === 0) {
      Alert.alert(
        "Dados inválidos",
        "Cole a tabela ou anexe CSV/Excel.\nColunas obrigatórias: Nome, Qtde, Qtde1a1, Produtividade, Erro.",
      );
      return;
    }

    setProcessing(true);
    try {
      const { totalPecas, duracaoHoras } = extractProductivityTotals(rawText);

      // A modalidade define a linguagem do relatório individual. Sem ela o
      // gerador cai em CLT, o que produziria documento com termos de vínculo
      // para quem presta serviço sem contrato.
      for (const item of parsed) {
        const k = (item.matricula || "").replace(/\D/g, "") || item.matricula || "";
        const mod = modalidades.get(k);
        if (mod) {
          item.modalidadeContrato = mod;
          item.modalidade = mod;
        }
      }
      const catalogoIdx = buildCatalogoIndex(cadastroText);
      const inventDspIdx = buildInventDspIndex(inventDspText);

      // --- lookups UMA vez (sem N+1) ---
      const secaoRows = await getSecaoLookup(operationType);
      const secaoMap = new Map<string, string>();
      for (const s of secaoRows) {
        secaoMap.set(s.codigo_secao, s.nome_area);
        const stripped = s.codigo_secao.replace(/^0+/, "");
        if (stripped) secaoMap.set(stripped, s.nome_area);
      }

      /*
       * Mapa Seção → Área do próprio evento, por cima do `secao_lookup`.
       *
       * `secao_lookup` é opcional e costuma estar vazia: quando está, o v2.1
       * não conseguia casar contagem com área, `enriquecerSecoesComBloco()`
       * não achava nenhuma bipada da área e o bloco% caía no valor da planilha
       * — sem erro nenhum. Numa planilha sem coluna de bloco isso zera o
       * percentual e a violação passa despercebida, contra a regra de que
       * Qualidade nunca pode ser 100 com violação de bloco.
       *
       * `construirMapaAreas()` resolve isso sem depender do banco: reconstrói
       * o mapa a partir do PROD_SEÇÃO + `.prc`. É específico deste inventário,
       * então vence o lookup global quando os dois existem.
       */
      const mapaAreas =
        prodSecaoRows.length > 0 && prcContagens.length > 0
          ? construirMapaAreas(prodSecaoRows, prcContagens)
          : null;

      if (mapaAreas) {
        for (const [secao, area] of mapaAreas.secaoParaArea) {
          secaoMap.set(secao, area);
          const semZeros = secao.replace(/^0+/, "");
          if (semZeros) secaoMap.set(semZeros, area);
          secaoMap.set(secao.padStart(6, "0"), area);
        }
      } else if (secaoRows.length === 0) {
        console.warn(
          "[InventExp] Sem secao_lookup e sem PROD_SEÇÃO: área da contagem fica " +
            "sendo o código da seção, e o bloco% por área vem da planilha.",
        );
      }

      let limites: LimiteBlocoRow[] = await getLimitesBlocoArea(operationType);
      if (!limites.length) {
        limites = getLimitesBlocoFallback(operationType);
      }

      // Área sem limite cadastrado nao tem bloco verificado. Isso precisa
      // aparecer: no L2601 só 3 das 25 areas casavam, e ANTIBIOTICOS, PSICO e
      // THERMOLABS — todas criticas — passavam sem conferencia nenhuma.
      const areasSemLimite = areasSemLimiteCadastrado(
        [...new Set(producaoSecao.map((s) => s.area_nome ?? s.area ?? ""))],
        limites,
      );
      setAreasSemLimiteBloco(areasSemLimite);

      // Resolve produto + área em todas as contagens .prc acumuladas
      let contagensAtualizadas = resolverAreasNasContagens(
        prcContagens,
        secaoMap,
      );
      contagensAtualizadas = contagensAtualizadas.map((c) => {
        const prod = resolverProduto(
          c.produto_codigo,
          inventDspIdx,
          catalogoIdx,
        );
        return {
          ...c,
          produto_nome: prod.nome,
          produto_ean: prod.ean,
          produto_classe: prod.classe,
        };
      });
      setPrcContagens(contagensAtualizadas);

      const leader = leaderName.trim() || undefined;
      const numConferentes = parsed.length;

      const evaluated: InventoryCheckerEvaluation[] = [];
      for (const item of parsed) {
        const contagens = filtrarContagensDoConferente(
          contagensAtualizadas,
          item.matricula,
          item.nome,
        );
        let secoesDoConferente = filtrarSecoesDoConferente(
          producaoSecao,
          item.matricula,
          item.nome,
        );
        secoesDoConferente = enriquecerSecoesComBloco(
          secoesDoConferente,
          contagens,
          limites,
        );

        const input = {
          ...item,
          contagensDetalhadas: contagens,
          sectionAccuracy: secoesDoConferente,
        };

        const ev = evaluateChecker(
          input,
          operationType,
          totalPecas,
          duracaoHoras || 5,
          numConferentes,
          undefined,
          secoesDoConferente,
          limites,
          leader,
        );
        if (ev) evaluated.push(ev);
      }

      setEvaluations(sortRanking(evaluated));
      if (evaluated.length === 0) {
        Alert.alert(
          "Sem avaliações",
          "Nenhum conferente restante após exclusão de líderes / filtros.",
        );
      }

      processarV3(parsed, contagensAtualizadas, leader, mapaAreas);
    } catch (e) {
      console.warn("[InventExp] Erro ao processar avaliação:", e);
      Alert.alert("Erro", "Falha ao processar a avaliação. Verifique os arquivos.");
    } finally {
      setProcessing(false);
    }
  };

  const resumo = useMemo(() => {
    if (evaluations.length === 0) return null;
    const totalConferentes = evaluations.length;
    const totalItens = evaluations.reduce((s, e) => s + e.input.qtde, 0);
    const totalErros = evaluations.reduce((s, e) => s + e.input.erro, 0);
    const taxaMediaErro = totalItens > 0 ? (totalErros / totalItens) * 100 : 0;
    const produtividadeMedia =
      evaluations.reduce((s, e) => s + e.input.produtividade, 0) /
      evaluations.length;
    const scoreMedio =
      evaluations.reduce((s, e) => s + e.scoreFinal, 0) / evaluations.length;
    return {
      totalConferentes,
      totalItens,
      taxaMediaErro: Math.round(taxaMediaErro * 100) / 100,
      produtividadeMedia: Math.round(produtividadeMedia * 10) / 10,
      scoreMedio: Math.round(scoreMedio * 10) / 10,
    };
  }, [evaluations]);

  const handleExportCsv = async () => {
    if (evaluations.length === 0) {
      Alert.alert("Sem dados", "Processe os dados primeiro.");
      return;
    }
    const headers = [
      "Rank",
      "Operacao",
      "Nome",
      "Qtde",
      "Qtde1a1",
      "Produtividade_itens_h",
      "Erro",
      "Pct_Erro_%",
      "Pct_Bloco_%",
      "Score_Qualidade",
      "Score_Produtividade",
      "Score_Aderencia",
      "Score_Final",
      "Nivel",
      "Tags",
    ];
    const rows = evaluations.map((e, i) => [
      i + 1,
      e.operationType,
      e.input.nome,
      e.input.qtde,
      e.input.qtde1a1,
      e.input.produtividade,
      e.input.erro,
      e.pctErro.toFixed(2),
      e.pctBloco.toFixed(2),
      Math.round(e.scoreQualidade),
      Math.round(e.scoreProdutividade),
      Math.round(e.scoreAderencia),
      e.scoreFinal,
      e.nivel,
      e.tags.join(" | "),
    ]);
    await shareCsvFile(
      `resultado_avaliacao_${new Date().toISOString().slice(0, 10)}.csv`,
      headers,
      rows,
    );
  };

  const top3 = useMemo(() => evaluations.slice(0, 3), [evaluations]);

  const radarRisco = useMemo(
    () =>
      evaluations.filter(
        (e) =>
          e.nivel === "CRITICO" ||
          e.tags.includes("🚨 Risco de Contagem Superficial"),
      ),
    [evaluations],
  );

  const profile = INVENTORY_PROFILES[operationType];

  const handleExportGerencial = async () => {
    if (!resumo || evaluations.length === 0) {
      Alert.alert("Sem dados", "Processe os dados primeiro.");
      return;
    }
    const text = generateInventExpGerencialReportText(
      operationType,
      evaluations,
      resumo,
    );
    await shareTextFile(
      `relatorio_gerencial_avaliacao_${new Date()
        .toISOString()
        .slice(0, 10)}.txt`,
      text,
      "Exportar Relatório Gerencial Avaliação",
    );
  };

  const handleSendIndividualWhatsApp = (
    ev: InventoryCheckerEvaluation,
    index: number,
  ) => {
    const text = generateInventExpIndividualReportText(
      operationType,
      ev,
      index + 1,
      evaluations.length,
      undefined,
      ev.secoes,
      ev.violacoes,
    );
    const waUrl =
      Platform.OS === "web"
        ? `https://wa.me/?text=${encodeURIComponent(text)}`
        : `whatsapp://send?text=${encodeURIComponent(text)}`;
    Linking.openURL(waUrl).catch(() =>
      Alert.alert(
        "Erro",
        "Não foi possível abrir o WhatsApp neste dispositivo.",
      ),
    );
  };

  const handleExportIndividualPdf = async (
    ev: InventoryCheckerEvaluation,
    index: number,
  ) => {
    const html = generateInventExpIndividualReportHtml(
      operationType,
      ev,
      index + 1,
      evaluations.length,
      undefined,
      ev.secoes,
      ev.violacoes,
    );
    await sharePdfFromHtml(
      nomeArquivoFichaV21(ev),
      html,
      "Exportar ficha de avaliação",
    );
  };

  /**
   * Ficha individual do v3, com áreas, erro localizado e não contados.
   * A linguagem sai adequada ao vínculo — o gerador lê `avaliacao.modalidade`.
   */
  /** Referência do inventário usada nos nomes de arquivo e nos cabeçalhos. */
  const lojaRef = publishRef.trim() || "inventario";

  const contextoFichaV3 = (posicao: number) => ({
    operacao: operationType,
    dataInventario: new Date().toLocaleDateString("pt-BR"),
    loja: publishRef.trim() || undefined,
    posicao,
    totalConferentes: avaliacoesV3.length,
    medianaEquipe,
  });

  /** `Avaliacao_<Matricula>_<Nome>.pdf`, como no padrão do relatório-modelo. */
  const nomeArquivoFicha = (a: AvaliacaoV3) => {
    const nome = (a.nome || "conferente")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "_")
      .slice(0, 40);
    return `Avaliacao_${a.matricula || "sem_matricula"}_${nome}.pdf`;
  };

  /** Mesmo padrão de nome para as fichas do motor v2.1. */
  const nomeArquivoFichaV21 = (ev: InventoryCheckerEvaluation) => {
    const nome = (ev.nome || ev.input.nome || "conferente")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "_")
      .slice(0, 40);
    return `Avaliacao_${ev.matricula || ev.input.matricula || "sem_matricula"}_${nome}.pdf`;
  };

  const exportarFichaV3 = async (a: AvaliacaoV3, posicao: number) => {
    const html = gerarRelatorioV3Html(a, contextoFichaV3(posicao));
    await sharePdfFromHtml(
      nomeArquivoFicha(a),
      html,
      a.modalidade === "FREE"
        ? "Exportar ficha — prestador de serviço"
        : "Exportar ficha de avaliação",
    );
  };

  /** Mesma ficha, em texto, pelo WhatsApp — a linguagem já sai pela modalidade. */
  const enviarFichaV3WhatsApp = (a: AvaliacaoV3, posicao: number) => {
    const texto = gerarRelatorioV3Texto(a, contextoFichaV3(posicao));
    const url =
      Platform.OS === "web"
        ? `https://wa.me/?text=${encodeURIComponent(texto)}`
        : `whatsapp://send?text=${encodeURIComponent(texto)}`;
    Linking.openURL(url).catch(() =>
      Alert.alert("Erro", "Não foi possível abrir o WhatsApp neste dispositivo."),
    );
  };

  /**
   * Ficha de cada conferente, independentemente do motor que gerou a avaliação.
   *
   * O v3 exige `.prc` + PROD_SEÇÃO + ACURACIDADE. Quando falta algum, quem
   * responde é o v2.1 — e o líder continua precisando entregar a ficha de cada
   * pessoa. Amarrar os entregáveis só ao v3 deixava a tela sem nenhuma opção de
   * download individual justamente no caminho mais comum.
   */
  type FichaEmitivel = {
    chave: string;
    nome: string;
    nomeArquivo: string;
    html: () => string;
    texto: () => string;
  };

  const fichas: FichaEmitivel[] = useMemo(() => {
    if (avaliacoesV3.length > 0) {
      return avaliacoesV3.map((a, i) => ({
        chave: a.matricula || a.nome,
        nome: a.nome,
        nomeArquivo: nomeArquivoFicha(a),
        html: () => gerarRelatorioV3Html(a, contextoFichaV3(i + 1)),
        texto: () => gerarRelatorioV3Texto(a, contextoFichaV3(i + 1)),
      }));
    }
    return evaluations.map((ev, i) => ({
      chave: ev.matricula || ev.input.nome,
      nome: ev.nome || ev.input.nome,
      nomeArquivo: nomeArquivoFichaV21(ev),
      html: () =>
        generateInventExpIndividualReportHtml(
          operationType,
          ev,
          i + 1,
          evaluations.length,
          undefined,
          ev.secoes,
          ev.violacoes,
        ),
      texto: () =>
        generateInventExpIndividualReportText(
          operationType,
          ev,
          i + 1,
          evaluations.length,
          undefined,
          ev.secoes,
          ev.violacoes,
        ),
    }));
  }, [avaliacoesV3, evaluations, operationType, medianaEquipe, publishRef]);

  /**
   * Gera a ficha de todos os conferentes de uma vez.
   *
   * No Android o usuário escolhe a pasta uma única vez e os PDFs caem lá; na
   * web cada um baixa pelo navegador. Sem isso, "baixar a ficha de cada
   * conferente" viraria uma janela de compartilhamento por pessoa.
   */
  const handleGerarTodasAsFichas = async () => {
    if (fichas.length === 0) {
      Alert.alert("Sem avaliações", "Processe a avaliação antes de gerar as fichas.");
      return;
    }
    setGerandoFichas(true);
    try {
      const arquivos: ArquivoGerado[] = [];
      const semPdf: string[] = [];

      for (const ficha of fichas) {
        const html = ficha.html();
        const base64 = await renderizarPdfBase64(html);
        if (base64) {
          arquivos.push({
            nome: ficha.nomeArquivo,
            base64,
            mimeType: "application/pdf",
          });
        } else {
          // Web: o expo-print não gera PDF — entrega o HTML, que imprime igual.
          semPdf.push(ficha.nome);
          arquivos.push({
            nome: ficha.nomeArquivo.replace(/\.pdf$/i, ".html"),
            base64: btoaUtf8(html),
            mimeType: "text/html;charset=utf-8",
          });
        }
      }

      const r = await salvarArquivosEmLote(arquivos, "Salvar fichas de avaliação");

      if (r.via === "cancelado") {
        Alert.alert("Cancelado", "Nenhuma ficha foi salva.");
        return;
      }
      const destino =
        r.via === "pasta"
          ? "na pasta escolhida"
          : r.via === "download"
            ? "na pasta de downloads"
            : "pelo compartilhamento";
      Alert.alert(
        "Fichas geradas",
        `${r.salvos} de ${arquivos.length} ficha(s) ${destino}.` +
          (r.falhas.length ? `\n\nFalharam: ${r.falhas.map((f) => f.nome).join(", ")}` : "") +
          (semPdf.length ? `\n\nNo navegador as fichas saem em HTML — imprima como PDF.` : ""),
      );
    } catch (e) {
      console.warn("[InventExp] Falha ao gerar fichas em lote:", e);
      Alert.alert("Erro", "Falha ao gerar as fichas da equipe.");
    } finally {
      setGerandoFichas(false);
    }
  };

  /** Planilha consolidada — a visão do líder, com as oito abas de análise. */
  const handleExportarConsolidado = async () => {
    if (avaliacoesV3.length === 0 && evaluations.length === 0) {
      Alert.alert("Sem avaliações", "Processe a avaliação antes de gerar a planilha.");
      return;
    }
    try {
      const base = {
        loja: lojaRef,
        dataInventario: publishDate,
        operacao: operationType,
        medianaEquipe,
        emitidoPor: leaderName.trim() || undefined,
      };
      // Sem os três arquivos do v3 a planilha sai reduzida, com uma aba de
      // ressalvas dizendo o que falta — melhor que não entregar nada ao líder.
      const wb =
        avaliacoesV3.length > 0
          ? montarWorkbookConsolidado(avaliacoesV3, {
              ...base,
              diagnostico: diagV3
                ? {
                    ...diagV3,
                    enderecosForaPadrao: prcInfo?.enderecosForaPadrao,
                    datasDistintas: prcInfo?.datas,
                    arquivosPrc: prcInfo?.count,
                    areasSemLimiteBloco,
                  }
                : null,
            })
          : montarWorkbookConsolidadoV21(evaluations, base);
      await shareXlsxWorkbook(
        nomeArquivoConsolidado(lojaRef),
        wb,
        "Avaliação geral do inventário",
      );
    } catch (e) {
      console.warn("[InventExp] Falha ao gerar consolidado:", e);
      Alert.alert("Erro", "Falha ao gerar a planilha consolidada.");
    }
  };

  const handlePublishProdutividade = async () => {
    if (evaluations.length === 0) {
      Alert.alert("Sem dados", "Processe a avaliação antes de publicar.");
      return;
    }
    if (!isSupabaseConfigured || !supabase) {
      Alert.alert(
        "Supabase",
        "Configure EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY no .env.",
      );
      return;
    }
    const role = await resolveAppRole();
    if (!canPublishProdutividade(role)) {
      Alert.alert(
        "Acesso restrito",
        "Publicar no histórico requer perfil LIDER ou ADMIN.",
      );
      return;
    }
    if (!publishRef.trim()) {
      Alert.alert(
        "Referência obrigatória",
        "Informe a loja ou código do evento (ex.: LOJA-123) para publicação idempotente.",
      );
      return;
    }

    setPublishing(true);
    try {
      const svc = new ProdutividadePublishService(supabase);
      const res = await svc.publicar({
        evaluations,
        dataInventario: publishDate.trim(),
        inventarioRef: publishRef.trim(),
        operationType,
      });

      const parts: string[] = [
        `Publicados: ${res.publicados} (${res.inseridos} novos, ${res.atualizados} actualizados).`,
      ];
      if (res.naoEncontrados.length) {
        parts.push(
          `Sem match em colaboradores: ${res.naoEncontrados.slice(0, 8).join(", ")}` +
            (res.naoEncontrados.length > 8
              ? ` (+${res.naoEncontrados.length - 8})`
              : "") +
            ".",
        );
      }
      if (res.erros.length) {
        parts.push(`Erros: ${res.erros.slice(0, 3).join(" | ")}`);
      }

      Alert.alert(
        res.publicados > 0 ? "Histórico actualizado" : "Publicação incompleta",
        parts.join("\n\n"),
      );
    } catch (e) {
      Alert.alert(
        "Erro",
        e instanceof Error ? e.message : "Falha ao publicar produtividade.",
      );
    } finally {
      setPublishing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#1d4ed8" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.segmentContainer}>
          {(
            [
              "FARMACIA",
              "SUPERMERCADO",
              "HIPERMERCADO",
              "ATACADO",
              "LOJA_GERAL",
            ] as InventoryOperationType[]
          ).map((type) => {
            const active = operationType === type;
            return (
              <Pressable
                key={type}
                onPress={() => setOperationType(type)}
                style={[
                  styles.segmentButton,
                  active && styles.segmentButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.segmentLabel,
                    active && styles.segmentLabelActive,
                  ]}
                >
                  {type}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Arquivos obrigatórios</Text>
          <Text style={styles.subtitle}>
            Sem os três, a avaliação sai apenas com produtividade e erro total —
            sem área física, sem erro localizado e sem cobertura.
          </Text>
          <View style={styles.importRow}>
            <Pressable style={[styles.btnAttach, rawText.length > 0 && styles.btnAttachDone]} onPress={() => void handlePickFile()}>
              <Ionicons name="people-outline" size={20} color={rawText.length ? "#059669" : "#2563EB"} />
              <Text style={[styles.btnAttachText, rawText.length > 0 && styles.btnAttachTextGreen]}>RProInv_Produtividade</Text>
            </Pressable>
            <Pressable style={[styles.btnAttach, prodSecaoRows.length > 0 && styles.btnAttachDone]} onPress={handlePickProducaoSecao}>
              <Ionicons name="grid-outline" size={20} color={prodSecaoRows.length ? "#059669" : "#2563EB"} />
              <Text style={[styles.btnAttachText, prodSecaoRows.length > 0 && styles.btnAttachTextGreen]}>PROD_SEÇÃO</Text>
            </Pressable>
            <Pressable
              style={[
                styles.btnAttach,
                acuracidade.length > 0 && styles.btnAttachDone,
                lendoArquivo === "ACURACIDADE" && styles.btnDisabled,
              ]}
              onPress={handlePickAcuracidade}
              disabled={lendoArquivo !== null}
            >
              <Ionicons name="analytics-outline" size={20} color={acuracidade.length ? "#059669" : "#2563EB"} />
              <Text style={[styles.btnAttachText, acuracidade.length > 0 && styles.btnAttachTextGreen]}>
                {lendoArquivo === "ACURACIDADE" ? "Lendo…" : "ACURACIDADE"}
              </Text>
            </Pressable>
            <Pressable style={[styles.btnAttach, prcInfo && styles.btnAttachDone]} onPress={handlePickPrcFiles}>
              <Ionicons name="documents-outline" size={20} color={prcInfo ? "#059669" : "#2563EB"} />
              <Text style={[styles.btnAttachText, prcInfo && styles.btnAttachTextGreen]}>Arquivos .prc</Text>
            </Pressable>
          </View>

          {rawText.length > 0 && (
            <Text style={styles.prcPreview}>✓ RProInv_Produtividade carregado</Text>
          )}
          {prcInfo && (
            <>
              <Text style={styles.prcPreview}>
                ✓ {prcInfo.count} arquivo(s) .prc ·{" "}
                {prcInfo.totalLines.toLocaleString("pt-BR")} bipadas
              </Text>
              {prcInfo.datas.length > 1 && (
                <Text style={styles.warnText}>
                  ⚠ Relógio de coletor: {prcInfo.datas.length} datas distintas (
                  {prcInfo.datas.join(", ")}). Volume e sequência valem; hora absoluta, não.
                </Text>
              )}
              {prcInfo.enderecosForaPadrao > 0 && (
                <Text style={styles.warnText}>
                  ⚠ {prcInfo.enderecosForaPadrao} endereço(s) fora do padrão — digitação
                  manual no coletor.
                </Text>
              )}
            </>
          )}
          {prodSecaoRows.length > 0 && (
            <Text style={styles.prcPreview}>
              ✓ PROD_SEÇÃO · {prodSecaoRows.length} combinações ·{" "}
              {new Set(prodSecaoRows.map((r) => r.area)).size} áreas
            </Text>
          )}
          {acuracidade.length > 0 && (
            <Text style={styles.prcPreview}>
              ✓ ACURACIDADE · {acuracidade.length.toLocaleString("pt-BR")} itens ·{" "}
              {acuracidade.filter((a) => a.ajuste !== 0).length} divergências
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Arquivos complementares</Text>
          <Text style={styles.subtitle}>
            Cada um habilita uma parte da análise. A ausência vira ressalva no relatório.
            O CadProd são dois arquivos: o invent_DSP liga EAN ao código, o de saldo traz o custo.
          </Text>
          <View style={styles.importRow}>
            <Pressable style={[styles.btnAttach, naoContadosArq.length > 0 && styles.btnAttachDone]} onPress={handlePickNaoContados}>
              <Ionicons name="alert-circle-outline" size={20} color={naoContadosArq.length ? "#059669" : "#2563EB"} />
              <Text style={[styles.btnAttachText, naoContadosArq.length > 0 && styles.btnAttachTextGreen]}>NÃO CONTADOS</Text>
            </Pressable>
            <Pressable style={[styles.btnAttach, dobroRows.length > 0 && styles.btnAttachDone]} onPress={handlePickDobro}>
              <Ionicons name="copy-outline" size={20} color={dobroRows.length ? "#059669" : "#2563EB"} />
              <Text style={[styles.btnAttachText, dobroRows.length > 0 && styles.btnAttachTextGreen]}>DOBRO</Text>
            </Pressable>
            <Pressable style={[styles.btnAttach, blocoRows.length > 0 && styles.btnAttachDone]} onPress={handlePickBloco}>
              <Ionicons name="cube-outline" size={20} color={blocoRows.length ? "#059669" : "#2563EB"} />
              <Text style={[styles.btnAttachText, blocoRows.length > 0 && styles.btnAttachTextGreen]}>BLOCO</Text>
            </Pressable>
            <Pressable style={[styles.btnAttach, controlados.size > 0 && styles.btnAttachDone]} onPress={handlePickControlados}>
              <Ionicons name="medkit-outline" size={20} color={controlados.size ? "#059669" : "#2563EB"} />
              <Text style={[styles.btnAttachText, controlados.size > 0 && styles.btnAttachTextGreen]}>CONTROLADOS</Text>
            </Pressable>
            <Pressable style={[styles.btnAttach, inventDspText ? styles.btnAttachDone : null]} onPress={handlePickInventDsp}>
              <Ionicons name="server-outline" size={20} color={inventDspText ? "#059669" : "#2563EB"} />
              <Text style={[styles.btnAttachText, inventDspText ? styles.btnAttachTextGreen : null]}>CadProd 1 · invent_DSP</Text>
            </Pressable>
            <Pressable style={[styles.btnAttach, saldoAuditoriaText ? styles.btnAttachDone : null]} onPress={handlePickSaldoAuditoria}>
              <Ionicons name="pricetag-outline" size={20} color={saldoAuditoriaText ? "#059669" : "#2563EB"} />
              <Text style={[styles.btnAttachText, saldoAuditoriaText ? styles.btnAttachTextGreen : null]}>CadProd 2 · saldo/custo</Text>
            </Pressable>
            <Pressable style={[styles.btnAttach, agentesMap.size > 0 && styles.btnAttachDone]} onPress={handlePickAgentes}>
              <Ionicons name="id-card-outline" size={20} color={agentesMap.size ? "#059669" : "#2563EB"} />
              <Text style={[styles.btnAttachText, agentesMap.size > 0 && styles.btnAttachTextGreen]}>Agentes / CadFun</Text>
            </Pressable>
            <Pressable style={[styles.btnAttach, cadastroText ? styles.btnAttachDone : null]} onPress={handlePickCadastro}>
              <Ionicons name="document-text-outline" size={20} color={cadastroText ? "#059669" : "#2563EB"} />
              <Text style={[styles.btnAttachText, cadastroText ? styles.btnAttachTextGreen : null]}>cadastro.txt</Text>
            </Pressable>
          </View>
          {naoContadosArq.length > 0 && (
            <Text style={styles.prcPreview}>
              ✓ NÃO CONTADOS · {naoContadosArq.length} produtos
            </Text>
          )}
          {dobroRows.length > 0 && (
            <Text style={styles.prcPreview}>✓ DOBRO · {dobroRows.length} bipadas em duplicidade</Text>
          )}
          {blocoRows.length > 0 && (
            <Text style={styles.prcPreview}>✓ BLOCO · {blocoRows.length} linhas</Text>
          )}
          {controlados.size > 0 && (
            <Text style={styles.prcPreview}>✓ CONTROLADOS · {controlados.size} códigos</Text>
          )}
          {agentesMap.size > 0 && (
            <Text style={styles.prcPreview}>✓ Agentes · {agentesMap.size} registros</Text>
          )}
          {saldoAuditoriaText ? (
            <Text style={styles.prcPreview}>✓ Custo unitário do CadProd carregado</Text>
          ) : null}

          <Text style={styles.subtitle}>
            Auditoria dirigida — transcreva a folha assinada, uma linha por produto:
            EAN; descrição; quantidade; preço unitário
          </Text>
          <TextInput
            value={auditoriaTexto}
            onChangeText={setAuditoriaTexto}
            placeholder={"007896585628206;COLIDIS 10ML;14;111,59\n007896094606600;TAMARINE 12MG 4CS;18;12,88"}
            placeholderTextColor="#94A3B8"
            multiline
            style={styles.auditoriaArea}
            textAlignVertical="top"
          />
          {auditoriaTexto.trim().length > 0 && (
            <Text style={styles.prcPreview}>
              ✓ {parseAuditoriaDirigida(auditoriaTexto).length} item(ns) recuperado(s)
            </Text>
          )}

          <Text style={styles.subtitle}>
            Líder da operação (excluído da avaliação automática)
          </Text>
          <TextInput
            value={leaderName}
            onChangeText={setLeaderName}
            placeholder="Nome do líder (opcional)"
            placeholderTextColor="#94A3B8"
            style={styles.leaderInput}
            autoCapitalize="characters"
          />
        </View>

        {semModalidade.length > 0 && (
          <View style={[styles.card, styles.cardAlerta]}>
            <Text style={styles.cardTitle}>Modalidade pendente</Text>
            <Text style={styles.erroText}>
              {semModalidade.length} conferente(s) sem modalidade de contratação. O
              relatório individual muda de linguagem conforme o vínculo, então a
              avaliação não roda enquanto houver pendência.
            </Text>
            <Text style={styles.prcPreview}>{semModalidade.join(" · ")}</Text>
            <Pressable
              style={styles.btnPrimary}
              onPress={() => void abrirMarcacaoModalidade(rawText)}
            >
              <Text style={styles.btnTextWhite}>Marcar modalidades</Text>
            </Pressable>
          </View>
        )}

        {rawText.length > 0 && semModalidade.length === 0 && (
          <Pressable
            style={styles.btnSecundario}
            onPress={() => void abrirMarcacaoModalidade(rawText)}
          >
            <Ionicons name="pricetags-outline" size={18} color="#1F3864" />
            <Text style={styles.btnSecundarioTexto}>Revisar modalidades de contratação</Text>
          </Pressable>
        )}

        <Pressable
          style={[
            styles.btnPrimary,
            (rawText.length === 0 || processing || semModalidade.length > 0) && { opacity: 0.5 },
          ]}
          onPress={() => void handleProcess()}
          disabled={rawText.length === 0 || processing || semModalidade.length > 0}
        >
          <Text style={styles.btnTextWhite}>
            {processing ? "Processando…" : "Processar Avaliação"}
          </Text>
        </Pressable>

        {diagV3 && (
          <View style={[styles.card, !diagV3.reconciliacaoOk && styles.cardAlerta]}>
            <Text style={styles.cardTitle}>Conferência da atribuição</Text>
            <Text style={diagV3.reconciliacaoOk ? styles.okText : styles.erroText}>
              {diagV3.reconciliacaoOk
                ? "✓ Reconciliação fechou: a soma das divergências atribuídas reproduz o Erro (Qtde) do sistema, conferente a conferente."
                : `✗ Reconciliação NÃO fechou em ${diagV3.falhasReconciliacao.length} conferente(s). Não publicar antes de investigar.`}
            </Text>
            {!diagV3.reconciliacaoOk &&
              diagV3.falhasReconciliacao.slice(0, 6).map((f) => (
                <Text key={f.matricula} style={styles.warnText}>
                  · {f.matricula}: sistema {f.esperado} · apurado {f.apurado}
                </Text>
              ))}
            <Text style={styles.prcPreview}>
              Seções mapeadas: {diagV3.secoesMapeadas}
              {diagV3.areasNaoConformes > 0
                ? ` · ${diagV3.areasNaoConformes} combinação(ões) de área fora da tolerância`
                : " · todas as áreas conformes"}
            </Text>
            <Text style={styles.prcPreview}>
              Divergências atribuídas: {diagV3.divergencias}
              {diagV3.orfas > 0 ? ` · ${diagV3.orfas} órfã(s)` : ""}
              {diagV3.compartilhadas > 0 ? ` · ${diagV3.compartilhadas} compartilhada(s)` : ""}
            </Text>
            <Text style={styles.prcPreview}>
              Não contados: {diagV3.naoContados} · {diagV3.naoContadosAlta} com falha comprovada · confiança
              ALTA (os únicos que pesam na nota)
            </Text>
            {diagV3.dobro > 0 && (
              <Text style={styles.prcPreview}>
                Itens em dobro: {diagV3.dobro} bipadas repetidas (indicador de método, não erro
                de quantidade)
              </Text>
            )}
            {diagV3.bloco && (
              <Text
                style={
                  diagV3.bloco.coberturaPct >= 95 && diagV3.bloco.cpfDivergente === 0
                    ? styles.okText
                    : styles.warnText
                }
              >
                {diagV3.bloco.coberturaPct >= 95 && diagV3.bloco.cpfDivergente === 0
                  ? `✓ BLOCO confere: ${diagV3.bloco.coberturaPct}% dos ${diagV3.bloco.totalRelatorio} itens do relatório batem com as bipadas, e nenhum CPF divergiu. Seção e regra de bloco estão corretas.`
                  : `⚠ BLOCO: cobertura de ${diagV3.bloco.coberturaPct}% · ${diagV3.bloco.comQuantidadeUm} com quantidade 1 · ${diagV3.bloco.semBipada} sem bipada · ${diagV3.bloco.cpfDivergente} com CPF divergente. Layout do coletor pode ter mudado.`}
              </Text>
            )}
          </View>
        )}

        {avaliacoesV3.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Ranking v3 — quatro eixos</Text>
            <Text style={styles.subtitle}>
              Acuracidade 35% · Produtividade 25% · Valor 25% · Cobertura 15%
            </Text>
            {avaliacoesV3.map((a, i) => (
              <View key={a.matricula} style={styles.v3Row}>
                <Text style={styles.v3Pos}>{i + 1}º</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.v3Nome}>{a.nome}</Text>
                  <Text style={styles.v3Meta}>
                    {a.modalidade === "FREE"
                      ? "Prestador de serviço"
                      : a.modalidade === "INTERMITENTE"
                        ? "Intermitente"
                        : "CLT"}
                    {" · "}
                    {a.areas.map((x) => x.area).join(" · ") || "sem área mapeada"}
                  </Text>
                  <Text style={styles.v3Meta}>
                    {a.produtividade.toLocaleString("pt-BR")} pç/h · {a.itensComErro} item(ns)
                    com erro · {a.unidadesEmErro} un · {a.naoContados.length} não contado(s)
                    {a.relogioOk ? "" : " · relógio fora de data"}
                  </Text>
                </View>
                <View style={styles.v3Acoes}>
                  <Text style={styles.v3Nota}>{a.nota.toFixed(1)}</Text>
                  <Pressable
                    onPress={() => void exportarFichaV3(a, i + 1)}
                    hitSlop={8}
                    style={styles.v3BotaoAcao}
                    accessibilityLabel={`Baixar ficha de ${a.nome}`}
                  >
                    <Ionicons name="document-text-outline" size={18} color="#1F3864" />
                    <Text style={styles.v3BotaoTexto}>PDF</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => enviarFichaV3WhatsApp(a, i + 1)}
                    hitSlop={8}
                    style={styles.v3BotaoAcao}
                    accessibilityLabel={`Enviar ficha de ${a.nome} por WhatsApp`}
                  >
                    <Ionicons name="logo-whatsapp" size={18} color="#128C7E" />
                  </Pressable>
                </View>
              </View>
            ))}
            <Text style={styles.prcPreview}>
              A linguagem de cada ficha segue a modalidade de contratação: prestador
              de serviço não recebe posição no ranking nem instrução de trabalho.
            </Text>
          </View>
        )}

        {fichas.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Entregáveis da avaliação</Text>
            <Text style={styles.subtitle}>
              Dois documentos, públicos diferentes: a ficha é do conferente, a
              planilha é do líder.
            </Text>
            {avaliacoesV3.length === 0 && (
              <Text style={styles.warnText}>
                Motor v2.1: sem .prc, PROD_SEÇÃO e ACURACIDADE a ficha sai sem área
                física, erro localizado e não contados — e a planilha, com menos abas.
              </Text>
            )}

            <Pressable
              style={[styles.btnPrimary, gerandoFichas && styles.btnDisabled]}
              onPress={() => void handleGerarTodasAsFichas()}
              disabled={gerandoFichas}
            >
              <Ionicons name="people-outline" size={18} color="#FFF" />
              <Text style={styles.btnTextWhite}>
                {gerandoFichas
                  ? "Gerando fichas…"
                  : `Fichas de toda a equipe (${fichas.length} PDF)`}
              </Text>
            </Pressable>
            <Text style={styles.prcPreview}>
              {Platform.OS === "android"
                ? "Escolha a pasta uma vez e todas as fichas são gravadas lá."
                : Platform.OS === "web"
                  ? "Cada ficha baixa pelo navegador, em HTML pronto para imprimir."
                  : "Uma janela de compartilhamento por ficha."}
            </Text>

            <Pressable
              style={styles.btnPrimary}
              onPress={() => void handleExportarConsolidado()}
            >
              <Ionicons name="grid-outline" size={18} color="#FFF" />
              <Text style={styles.btnTextWhite}>Avaliação geral do inventário (XLSX)</Text>
            </Pressable>
            <Text style={styles.prcPreview}>
              Oito abas: Resumo, Ranking, Por_Conferente, Erros_Detalhados,
              Nao_Contados, Mapa_Areas, Ressalvas e Metodologia. É o documento de
              análise do líder e o registro de rastreabilidade do inventário.
            </Text>

            {!publishRef.trim() && (
              <Text style={styles.warnText}>
                Preencha a referência (loja / evento) no fim da tela — ela nomeia os
                arquivos e identifica o inventário nos cabeçalhos.
              </Text>
            )}

            {areasSemLimiteBloco.length > 0 && (
              <Text style={styles.warnText}>
                ⚠ {areasSemLimiteBloco.length} área(s) sem limite de bloco cadastrado —
                o bloco NÃO foi verificado nelas:{" "}
                {areasSemLimiteBloco.slice(0, 8).join(", ")}
                {areasSemLimiteBloco.length > 8 ? ` e mais ${areasSemLimiteBloco.length - 8}` : ""}.
                Cadastre em limites_bloco_area antes de tratar a nota como final.
              </Text>
            )}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Importar dados dos conferentes</Text>
          <Text style={styles.subtitle}>
            Cole a tabela (vírgula, ponto e vírgula ou tab) ou anexe arquivo
            CSV/Excel. Colunas: Nome, Qtde, Qtde1a1, Produtividade (itens/h),
            Erro (qtde).
          </Text>
          <View style={styles.importRow}>
            <Pressable onPress={() => void handlePickFile()} style={styles.btnAttach}>
              <Ionicons name="attach" size={20} color="#2563EB" />
              <Text style={styles.btnAttachText}>Anexar CSV/Excel</Text>
            </Pressable>
          </View>
          <TextInput
            value={rawText}
            onChangeText={setRawText}
            placeholder={EXAMPLE_INVENTEXP_CSV}
            placeholderTextColor="#94A3B8"
            multiline
            style={styles.textArea}
            textAlignVertical="top"
          />
          <Pressable
            onPress={() => void handleProcess()}
            style={[styles.btnPrimary, processing && { opacity: 0.5 }]}
            disabled={processing}
          >
            <Ionicons name="calculator-outline" size={20} color="#fff" />
            <Text style={styles.btnTextWhite}>
              {processing ? "Processando…" : "Processar Avaliação"}
            </Text>
          </Pressable>
        </View>

        {resumo && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Resumo da Avaliação</Text>
              <View style={styles.resumoGrid}>
                <View style={styles.resumoItem}>
                  <Text style={styles.resumoValue}>
                    {resumo.totalConferentes}
                  </Text>
                  <Text style={styles.resumoLabel}>Conferentes</Text>
                </View>
                <View style={styles.resumoItem}>
                  <Text style={styles.resumoValue}>
                    {resumo.totalItens.toLocaleString("pt-BR")}
                  </Text>
                  <Text style={styles.resumoLabel}>Itens contados</Text>
                </View>
                <View style={styles.resumoItem}>
                  <Text style={styles.resumoValue}>
                    {resumo.taxaMediaErro}%
                  </Text>
                  <Text style={styles.resumoLabel}>Taxa média erro</Text>
                </View>
                <View style={styles.resumoItem}>
                  <Text style={styles.resumoValue}>
                    {resumo.produtividadeMedia}
                  </Text>
                  <Text style={styles.resumoLabel}>Prod/h média</Text>
                </View>
                <View style={styles.resumoItem}>
                  <Text style={styles.resumoValue}>{resumo.scoreMedio}</Text>
                  <Text style={styles.resumoLabel}>Score médio</Text>
                </View>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Top 3 MVPs</Text>
              <View style={styles.mvpRow}>
                {top3.map((ev, index) => (
                  <View key={ev.input.nome} style={styles.mvpCard}>
                    <Text style={styles.mvpRank}>{index + 1}º</Text>
                    <Text style={styles.mvpName}>{ev.input.nome}</Text>
                    <Text style={[styles.mvpScore, { color: ev.nivelColor }]}>
                      {ev.scoreFinal}
                    </Text>
                    <Text style={styles.mvpLevel}>{ev.nivel}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Ranking Avaliação</Text>
              <View style={styles.tableHeader}>
                <Text style={[styles.th, { flex: 0.5 }]}>#</Text>
                <Text style={[styles.th, { flex: 1.7 }]}>Conferente</Text>
                <Text style={[styles.th, { flex: 0.8 }]}>Score</Text>
                <Text style={[styles.th, { flex: 0.9 }]}>% Erro</Text>
                <Text style={[styles.th, { flex: 1.1 }]}>Prod/h</Text>
                <Text style={[styles.th, { flex: 1 }]}>Bloco%</Text>
                <Text style={[styles.th, { flex: 1.2 }]}>Ficha</Text>
              </View>
              {evaluations.map((ev, index) => (
                <View key={ev.input.nome} style={styles.tableRow}>
                  <Text style={[styles.tdRank, { flex: 0.5 }]}>
                    {index + 1}º
                  </Text>
                  <Text style={[styles.tdNome, { flex: 1.7 }]}>
                    {ev.input.nome}
                  </Text>
                  <Text
                    style={[
                      styles.tdScore,
                      { flex: 0.8, color: ev.nivelColor },
                    ]}
                  >
                    {ev.scoreFinal}
                  </Text>
                  <Text style={[styles.td, { flex: 0.9 }]}>
                    {ev.pctErro.toFixed(2)}%
                  </Text>
                  <Text style={[styles.td, { flex: 1.1 }]}>
                    {ev.input.produtividade}
                  </Text>
                  <Text style={[styles.td, { flex: 1 }]}>
                    {ev.pctBloco.toFixed(1)}%
                  </Text>
                  <View style={[styles.v3Acoes, { flex: 1.2 }]}>
                    <Pressable
                      onPress={() => void handleExportIndividualPdf(ev, index)}
                      hitSlop={8}
                      style={styles.v3BotaoAcao}
                      accessibilityLabel={`Baixar ficha de ${ev.input.nome}`}
                    >
                      <Ionicons name="document-text-outline" size={16} color="#1F3864" />
                    </Pressable>
                    <Pressable
                      onPress={() => handleSendIndividualWhatsApp(ev, index)}
                      hitSlop={8}
                      style={styles.v3BotaoAcao}
                      accessibilityLabel={`Enviar ficha de ${ev.input.nome} por WhatsApp`}
                    >
                      <Ionicons name="logo-whatsapp" size={16} color="#128C7E" />
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>

            {radarRisco.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Radar de Risco</Text>
                <Text style={styles.cardSubtitle}>
                  Conferentes com risco de contagem superficial ou classificação
                  crítica.
                </Text>
                {radarRisco.map((ev) => (
                  <View key={ev.input.nome} style={styles.riskRow}>
                    <View style={styles.riskHeader}>
                      <View
                        style={[
                          styles.riskDot,
                          { backgroundColor: ev.nivelColor },
                        ]}
                      />
                      <Text style={styles.riskName}>{ev.input.nome}</Text>
                      <Text style={styles.riskScore}>{ev.scoreFinal}</Text>
                    </View>
                    <Text style={styles.riskMeta}>
                      % Erro: {ev.pctErro.toFixed(2)}% | Bloco:{" "}
                      {ev.pctBloco.toFixed(1)}% | Prod/h:{" "}
                      {ev.input.produtividade}
                    </Text>
                    {ev.tags.length > 0 && (
                      <Text style={styles.riskTags}>{ev.tags.join(" · ")}</Text>
                    )}
                  </View>
                ))}
              </View>
            )}

            {evaluations[0] && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>
                  Exemplo de recibo do conferente
                </Text>
                <CheckerFeedbackReport
                  evaluation={evaluations[0]}
                  operationType={operationType}
                  secoes={evaluations[0].secoes}
                />
              </View>
            )}

            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                Publicar no histórico (produtividade / escala)
              </Text>
              <Text style={styles.cardSubtitle}>
                Grava scores em Supabase para o motor de escala. Idempotente por
                colaborador + data + referência. Requer matrícula ou nome único
                em Colaboradores.
              </Text>
              <Text style={styles.subtitle}>Data do inventário (YYYY-MM-DD)</Text>
              <TextInput
                value={publishDate}
                onChangeText={setPublishDate}
                placeholder="2026-07-16"
                placeholderTextColor="#94A3B8"
                style={styles.leaderInput}
                autoCapitalize="none"
              />
              <Text style={styles.subtitle}>Referência (loja / evento)</Text>
              <TextInput
                value={publishRef}
                onChangeText={setPublishRef}
                placeholder="Ex.: LOJA-042 ou INV-2026-07-16"
                placeholderTextColor="#94A3B8"
                style={styles.leaderInput}
                autoCapitalize="characters"
              />
              <Pressable
                onPress={() => void handlePublishProdutividade()}
                style={[
                  styles.btnPrimary,
                  {
                    backgroundColor: "#0f766e",
                    opacity: publishing ? 0.5 : 1,
                  },
                ]}
                disabled={publishing}
              >
                <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
                <Text style={styles.btnTextWhite}>
                  {publishing
                    ? "A publicar…"
                    : "Publicar scores no histórico"}
                </Text>
              </Pressable>
            </View>

            <View style={styles.exportRow}>
              <Pressable
                onPress={() => void handleExportCsv()}
                style={styles.btnExport}
              >
                <Ionicons name="download-outline" size={20} color="#fff" />
                <Text style={styles.btnTextWhite}>Exportar CSV Avaliação</Text>
              </Pressable>
              <Pressable
                onPress={() => void handleExportGerencial()}
                style={[styles.btnExport, { backgroundColor: "#4f46e5" }]}
              >
                <Ionicons name="document-text-outline" size={20} color="#fff" />
                <Text style={styles.btnTextWhite}>Relatório Gerencial</Text>
              </Pressable>

            </View>
          </>
        )}
      </ScrollView>

      <ModalidadeContratoModal
        visivel={modalVisivel}
        conferentes={paraMarcar}
        salvando={salvandoModalidade}
        onConfirmar={(l) => void confirmarModalidades(l)}
        onCancelar={() => setModalVisivel(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: "#1d4ed8",
  },
  headerLogo: {
    width: 36,
    height: 36,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ffffff",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
  },
  segmentContainer: {
    flexDirection: "row",
    backgroundColor: "#dbeafe",
    borderRadius: 999,
    padding: 4,
    gap: 4,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentButtonActive: {
    backgroundColor: "#1d4ed8",
  },
  segmentLabel: {
    fontSize: 12,
    color: "#1e293b",
    fontWeight: "500",
  },
  segmentLabelActive: {
    color: "#ffffff",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
  },
  cardSubtitle: {
    fontSize: 12,
    color: "#64748b",
  },
  subtitle: {
    fontSize: 13,
    color: "#64748b",
  },
  importRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  btnAttach: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#2563EB",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#EFF6FF",
  },
  btnAttachText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#2563EB",
  },
  btnAttachGreen: {
    borderColor: "#059669",
    backgroundColor: "#f0fdf4",
  },
  btnAttachTextGreen: {
    color: "#059669",
  },
  btnSecundario: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1F3864",
    marginBottom: 10,
  },
  btnSecundarioTexto: { fontSize: 13, fontWeight: "600", color: "#1F3864" },
  btnAttachDone: { borderColor: "#059669", backgroundColor: "#ECFDF5" },
  cardAlerta: { borderColor: "#DC2626", borderWidth: 1.5 },
  warnText: { fontSize: 12, color: "#B45309", marginTop: 4, lineHeight: 17 },
  okText: { fontSize: 13, color: "#047857", fontWeight: "600", lineHeight: 18 },
  erroText: { fontSize: 13, color: "#B91C1C", fontWeight: "700", lineHeight: 18 },
  auditoriaArea: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    padding: 10,
    minHeight: 90,
    fontSize: 12,
    color: "#0F172A",
    backgroundColor: "#F8FAFC",
    marginTop: 6,
  },
  v3Row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  v3Pos: { width: 30, fontSize: 13, fontWeight: "700", color: "#64748B" },
  v3Nome: { fontSize: 14, fontWeight: "600", color: "#0F172A" },
  v3Meta: { fontSize: 11, color: "#64748B", marginTop: 2 },
  v3Export: { alignItems: "center", gap: 2 },
  v3Acoes: { alignItems: "center", flexDirection: "row", gap: 6 },
  v3BotaoAcao: {
    alignItems: "center",
    backgroundColor: "#EEF2FA",
    borderRadius: 8,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  v3BotaoTexto: { color: "#1F3864", fontSize: 12, fontWeight: "700" },
  btnDisabled: { opacity: 0.6 },
  v3Nota: { fontSize: 18, fontWeight: "800", color: "#1F3864", width: 54, textAlign: "right" },
  prcPreview: {
    fontSize: 12,
    color: "#059669",
    fontWeight: "600",
    marginBottom: 4,
  },
  leaderInput: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: "#0f172a",
    backgroundColor: "#F8FAFC",
  },
  textArea: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 10,
    minHeight: 120,
    fontSize: 13,
    fontFamily: "System",
    color: "#0f172a",
    backgroundColor: "#F8FAFC",
  },
  btnPrimary: {
    marginTop: 8,
    borderRadius: 999,
    backgroundColor: "#2563EB",
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  btnTextWhite: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
  },
  resumoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  resumoItem: {
    width: "30%",
    minWidth: 96,
  },
  resumoValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
  },
  resumoLabel: {
    fontSize: 11,
    color: "#64748b",
  },
  mvpRow: {
    flexDirection: "row",
    gap: 10,
  },
  mvpCard: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    gap: 4,
  },
  mvpRank: {
    fontSize: 12,
    color: "#64748b",
  },
  mvpName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
    textAlign: "center",
  },
  mvpScore: {
    fontSize: 18,
    fontWeight: "700",
  },
  mvpLevel: {
    fontSize: 11,
    color: "#475569",
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
    paddingBottom: 4,
    marginBottom: 4,
  },
  th: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f1f5f9",
  },
  td: {
    fontSize: 11,
    color: "#475569",
  },
  tdRank: {
    fontSize: 11,
    color: "#64748b",
  },
  tdNome: {
    fontSize: 12,
    color: "#0f172a",
  },
  tdScore: {
    fontSize: 12,
    fontWeight: "600",
  },
  riskRow: {
    borderRadius: 12,
    backgroundColor: "#fef2f2",
    padding: 10,
    marginTop: 8,
    gap: 4,
  },
  riskHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  riskDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  riskName: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#7f1d1d",
  },
  riskScore: {
    fontSize: 13,
    fontWeight: "600",
    color: "#7f1d1d",
  },
  riskMeta: {
    fontSize: 11,
    color: "#7f1d1d",
  },
  riskTags: {
    fontSize: 11,
    color: "#7f1d1d",
    fontStyle: "italic",
  },
  exportRow: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 8,
  },
  btnExport: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 999,
    backgroundColor: "#059669",
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
});
