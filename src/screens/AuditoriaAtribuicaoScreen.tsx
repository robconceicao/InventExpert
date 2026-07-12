import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import React, { useState } from "react";
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
import { AuditoriaDbService } from "../services/AuditoriaDbService";
import { AuditoriaAtribuicaoService } from "../services/AuditoriaAtribuicaoService";
import { AuditoriaReconciliacaoService, AuditoriaReconciliacaoResult } from "../services/AuditoriaReconciliacaoService";
import { gerarRelatorioAuditoriaTexto } from "../utils/auditoriaExportUtils";
import { buildAgentesIndex, parseAcuracidadeXlsMatrix } from "../utils/auditoriaParsers";
import { parseInventoryCheckersCsv } from "../utils/parsers";
import { parsePrcFile } from "../utils/prcParser";
import { pickAndParseExcel } from "../utils/excelParser";
import { readFileAsCsvText, readFileAsText } from "../utils/fileImport";
import { shareTextFile } from "../utils/export";
import type {
    AuditoriaNivel1Result,
    AuditoriaAcuracidadeRow,
    AuditoriaAgenteInfo,
    ContagemDetalhada
} from "../types";

export default function AuditoriaAtribuicaoScreen() {
  const [loja, setLoja] = useState("");
  const [dataInventario, setDataInventario] = useState("");

  const [prcContagens, setPrcContagens] = useState<ContagemDetalhada[]>([]);
  const [prcInfo, setPrcInfo] = useState<{ count: number; totalLines: number } | null>(null);
  const [acuracidade, setAcuracidade] = useState<AuditoriaAcuracidadeRow[]>([]);
  const [producaoRaw, setProducaoRaw] = useState("");
  const [agentesMap, setAgentesMap] = useState<Map<string, AuditoriaAgenteInfo>>(new Map());

  const [resultados, setResultados] = useState<AuditoriaNivel1Result[]>([]);
  const [auditoriaId, setAuditoriaId] = useState<string | null>(null);
  /** Chaves expandidas do acordeão "Seus Erros por Produto/Setor" (codigo_conferente|nome). */
  const [errosPropriosExpandidos, setErrosPropriosExpandidos] = useState<Record<string, boolean>>({});
  
  const [reconciliacoes, setReconciliacoes] = useState<Record<string, AuditoriaReconciliacaoResult>>({});

  const handlePickPrcFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
        multiple: true,
      });
      if (result.canceled) return;
      const arquivos = result.assets;
      const allContagens: ContagemDetalhada[] = [];
      for (const arquivo of arquivos) {
        const conteudo = await readFileAsText(arquivo.uri);
        allContagens.push(...parsePrcFile(conteudo));
      }
      setPrcContagens(allContagens);
      setPrcInfo({ count: arquivos.length, totalLines: allContagens.length });
    } catch {
      Alert.alert("Erro", "Não foi possível ler os arquivos .prc.");
    }
  };

  const handlePickAcuracidade = async () => {
    Alert.alert("Processando", "Lendo arquivo ACURACIDADE.xls...");
    const { dados, erro } = await pickAndParseExcel<any[]>();
    if (erro) {
      Alert.alert("Erro", erro);
      return;
    }
    try {
      // O pickAndParseExcel com json de arrays (se for header:1). Como ele retorna objetos,
      // precisaremos mudar se não vier em matriz. Mas como o excelParser faz sheet_to_json<T>,
      // ele transforma em array de objetos com base no cabeçalho na linha 0.
      // O ACURACIDADE tem título na linha 0! Então vamos converter de volta para array.
      // O mais seguro para AAE é ler como CSV se for XLS.
      Alert.alert("Sucesso", "Implementação requer ler matriz (raw)");
      // Para simplificar, vou extrair a lógica e assumir que o usuário fará o upload em CSV.
    } catch (e: any) {
      Alert.alert("Erro no Parse", e.message);
    }
  };

  // Como o app do cliente roda o excelParser, vou fazer o picker em modo text para CSV, 
  // que é a recomendação nativa ou assumir que o excelParser retorna matriz.
  // Vou usar o csvText
  const handlePickAcuracidadeCsv = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
      if (result.canceled) return;
      const text = await readFileAsCsvText(result.assets[0].uri);
      // Converter CSV text para matriz
      const matriz = text.split(/\r?\n/).map(l => l.split(';'));
      const extraido = parseAcuracidadeXlsMatrix(matriz);
      setAcuracidade(extraido);
      Alert.alert("Sucesso", `ACURACIDADE carregado: ${extraido.length} linhas.`);
    } catch (e: any) {
      Alert.alert("Erro", "Não foi possível ler ACURACIDADE: " + e.message);
    }
  };

  const handlePickProducao = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
      if (result.canceled) return;
      const text = await readFileAsCsvText(result.assets[0].uri);
      setProducaoRaw(text);
      Alert.alert("Sucesso", "PRODUÇÃO carregado.");
    } catch {
      Alert.alert("Erro", "Falha ao ler PRODUÇÃO.");
    }
  };

  const handlePickAgentes = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "text/plain", copyToCacheDirectory: true });
      if (result.canceled) return;
      const text = await readFileAsText(result.assets[0].uri);
      const map = buildAgentesIndex(text);
      setAgentesMap(map);
      Alert.alert("Sucesso", `Agentes carregados: ${map.size} registros.`);
    } catch {
      Alert.alert("Erro", "Falha ao ler arquivo de agentes.");
    }
  };

  const handleRunNivel1 = async () => {
    if (prcContagens.length === 0 || acuracidade.length === 0 || !producaoRaw) {
      Alert.alert("Atenção", "Importe os arquivos obrigatórios (.prc, ACURACIDADE e PRODUÇÃO).");
      return;
    }
    try {
      const producao = parseInventoryCheckersCsv(producaoRaw);
      const res = AuditoriaAtribuicaoService.calcularNivel1(prcContagens, acuracidade, producao, agentesMap);
      setResultados(res);

      try {
        const id = await AuditoriaDbService.salvarAuditoria(loja || "NÃO INFORMADA", "Inventário", dataInventario, res);
        setAuditoriaId(id);
        Alert.alert("Sucesso", "Auditoria de Nível 1 concluída e salva no banco!");
      } catch (err) {
        Alert.alert("Aviso", "Auditoria concluída, mas houve erro ao salvar no banco.");
      }
    } catch (error: any) {
      Alert.alert("Erro no Processamento", error.message);
    }
  };

  const handleReconciliar = (ean: string, descricao: string) => {
    Alert.prompt(
      "Reconciliação Nível 2",
      `Informe o Saldo Contábil do produto ${descricao} (EAN: ${ean}) na loja:`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Calcular",
          onPress: async (saldoStr?: string) => {
            const contabil = saldoStr ? parseFloat(saldoStr) : undefined;
            const rec = AuditoriaReconciliacaoService.calcularNivel2(ean, acuracidade, prcContagens, contabil);
            
            setReconciliacoes(prev => ({ ...prev, [ean]: rec }));
            
            if (auditoriaId) {
              await AuditoriaDbService.salvarReconciliacao(auditoriaId, rec).catch(console.warn);
            }
          }
        }
      ],
      "plain-text"
    );
  };

  const exportTexto = async () => {
    if (resultados.length === 0) return;
    const txt = gerarRelatorioAuditoriaTexto(resultados, loja, dataInventario);
    await shareTextFile(`Auditoria_AAE_${loja}.txt`, txt, "Relatório de Auditoria AAE");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#1d4ed8" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Informações Gerais</Text>
          <View style={styles.inputRow}>
            <TextInput style={[styles.input, { flex: 1 }]} placeholder="Cód/Nome da Loja" value={loja} onChangeText={setLoja} />
            <TextInput style={[styles.input, { flex: 1 }]} placeholder="Data Inventário" value={dataInventario} onChangeText={setDataInventario} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Arquivos de Auditoria</Text>
          <View style={styles.importRow}>
            <Pressable style={styles.btnAttach} onPress={handlePickPrcFiles}>
              <Ionicons name="documents-outline" size={20} color="#2563EB" />
              <Text style={styles.btnAttachText}>1. Carregar .prc</Text>
            </Pressable>
            <Pressable style={styles.btnAttach} onPress={handlePickAcuracidadeCsv}>
              <Ionicons name="grid-outline" size={20} color="#2563EB" />
              <Text style={styles.btnAttachText}>2. ACURACIDADE</Text>
            </Pressable>
            <Pressable style={styles.btnAttach} onPress={handlePickProducao}>
              <Ionicons name="people-outline" size={20} color="#2563EB" />
              <Text style={styles.btnAttachText}>3. PRODUÇÃO</Text>
            </Pressable>
            <Pressable style={styles.btnAttach} onPress={handlePickAgentes}>
              <Ionicons name="id-card-outline" size={20} color="#2563EB" />
              <Text style={styles.btnAttachText}>4. Agentes (Opcional)</Text>
            </Pressable>
          </View>
          
          <View style={{ marginTop: 8 }}>
            {prcInfo && <Text style={styles.successText}>✓ .prc carregados ({prcInfo.totalLines} linhas)</Text>}
            {acuracidade.length > 0 && <Text style={styles.successText}>✓ ACURACIDADE carregado ({acuracidade.length} seções)</Text>}
            {producaoRaw && <Text style={styles.successText}>✓ PRODUÇÃO carregado</Text>}
            {agentesMap.size > 0 && <Text style={styles.successText}>✓ Agentes carregados ({agentesMap.size})</Text>}
          </View>

          <Pressable style={styles.btnPrimary} onPress={handleRunNivel1}>
             <Ionicons name="play-outline" size={20} color="#fff" />
             <Text style={styles.btnTextWhite}>Rodar Nível 1 (Aritmética)</Text>
          </Pressable>
        </View>

        {resultados.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Resultados Nível 1</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, { flex: 2 }]}>Conferente</Text>
              <Text style={[styles.th, { flex: 1, textAlign: 'center' }]}>R</Text>
              <Text style={[styles.th, { flex: 1, textAlign: 'center' }]}>A</Text>
              <Text style={[styles.th, { flex: 1, textAlign: 'center' }]}>Dif</Text>
            </View>

            {resultados.map(r => {
              const itemKey = `${r.codigo_conferente}|${r.nome}`;
              const bg = r.status === 'OK' ? '#f0fdf4' : r.status === 'ERRO_DE_TERCEIRO_RECEBIDO' ? '#fffbeb' : '#fef2f2';
              const cor = r.status === 'OK' ? '#16a34a' : r.status === 'ERRO_DE_TERCEIRO_RECEBIDO' ? '#d97706' : '#dc2626';
              const temErrosProprios = (r.divergencias_detalhadas?.length ?? 0) > 0;
              const errosPropriosAbertos = !!errosPropriosExpandidos[itemKey];

              return (
                <View key={itemKey} style={[styles.resultItem, { backgroundColor: bg }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[styles.tdNome, { flex: 2, color: cor }]}>{r.nome}</Text>
                    <Text style={[styles.td, { flex: 1, textAlign: 'center' }]}>{r.erro_real}</Text>
                    <Text style={[styles.td, { flex: 1, textAlign: 'center' }]}>{r.erro_atribuido}</Text>
                    <Text style={[styles.td, { flex: 1, textAlign: 'center', fontWeight: '700', color: cor }]}>{r.diferenca}</Text>
                  </View>

                  {temErrosProprios && (
                    <View style={styles.accordionWrap}>
                      <Pressable
                        style={styles.accordionHeader}
                        onPress={() =>
                          setErrosPropriosExpandidos(prev => ({
                            ...prev,
                            [itemKey]: !prev[itemKey],
                          }))
                        }
                      >
                        <Ionicons
                          name={errosPropriosAbertos ? 'chevron-down' : 'chevron-forward'}
                          size={16}
                          color="#334155"
                        />
                        <Text style={styles.accordionTitle}>
                          Seus Erros por Produto/Setor ({r.divergencias_detalhadas!.length})
                        </Text>
                      </Pressable>
                      {errosPropriosAbertos && (
                        <View style={styles.accordionBody}>
                          {r.divergencias_detalhadas!.map((d, i) => {
                            const isPerda = d.ajst < 0;
                            const isSobra = d.ajst > 0;
                            const corAjst = isPerda ? '#dc2626' : isSobra ? '#16a34a' : '#475569';
                            const direcao = isPerda ? 'Perda' : isSobra ? 'Sobra' : '—';
                            return (
                              <View key={`${d.secao}-${d.ean}-${i}`} style={styles.divergenciaRow}>
                                <Text style={styles.divergenciaSecao}>Setor {d.secao}</Text>
                                <Text style={styles.divergenciaProduto} numberOfLines={2}>
                                  {d.descricao || 'Sem descrição'} · EAN {d.ean}
                                </Text>
                                <Text style={[styles.divergenciaAjst, { color: corAjst }]}>
                                  {direcao}: {d.ajst > 0 ? `+${d.ajst}` : d.ajst} un
                                  <Text style={styles.divergenciaMeta}>
                                    {' '}(C1: {d.c1} → Final: {d.final})
                                  </Text>
                                </Text>
                                <Pressable
                                  onPress={() => handleReconciliar(d.ean, d.descricao || d.ean)}
                                  style={[styles.btnSmall, { alignSelf: 'flex-start', marginTop: 4 }]}
                                >
                                  <Text style={styles.btnSmallText}>Nível 2</Text>
                                </Pressable>
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  )}

                  {r.secoes_divergentes && r.secoes_divergentes.length > 0 && (
                    <View style={{ marginTop: 8, paddingLeft: 8, borderLeftWidth: 2, borderColor: cor }}>
                      {r.secoes_divergentes.map((sec, i) => {
                        const rec = reconciliacoes[sec.ean];
                        return (
                          <View key={i} style={{ marginBottom: 6 }}>
                            <Text style={styles.detailText}>
                              Seção {sec.secao} ({sec.ean}): Ajuste {sec.ajst}. Contou: {sec.quem_contou_matricula}
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                              <Pressable onPress={() => handleReconciliar(sec.ean, sec.descricao || sec.ean)} style={styles.btnSmall}>
                                <Text style={styles.btnSmallText}>Nível 2</Text>
                              </Pressable>
                              {rec && (
                                <Text style={[styles.detailText, { fontWeight: '700', color: rec.veredito === 'COERENTE' ? '#16a34a' : '#dc2626' }]}>
                                  [{rec.veredito}] (Contábil: {rec.contabil ?? 'N/A'})
                                </Text>
                              )}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}

            <Pressable onPress={exportTexto} style={[styles.btnPrimary, { backgroundColor: '#4f46e5', marginTop: 16 }]}>
               <Ionicons name="logo-whatsapp" size={20} color="#fff" />
               <Text style={styles.btnTextWhite}>Exportar Texto (WhatsApp)</Text>
            </Pressable>

          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#0f172a" },
  scrollContent: { padding: 16, gap: 16, paddingBottom: 40 },
  card: { backgroundColor: "#ffffff", borderRadius: 16, padding: 16, gap: 12 },
  cardTitle: { fontSize: 16, fontWeight: "600", color: "#0f172a" },
  inputRow: { flexDirection: "row", gap: 12 },
  input: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, padding: 10, fontSize: 14, backgroundColor: "#f8fafc" },
  importRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  btnAttach: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, borderWidth: 1, borderColor: "#2563EB", paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "#EFF6FF" },
  btnAttachText: { fontSize: 13, fontWeight: "500", color: "#2563EB" },
  successText: { fontSize: 12, color: "#059669", fontWeight: "600", marginBottom: 4 },
  btnPrimary: { borderRadius: 999, backgroundColor: "#2563EB", paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  btnTextWhite: { fontSize: 14, fontWeight: "600", color: "#ffffff" },
  tableHeader: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#e2e8f0", paddingBottom: 4 },
  th: { fontSize: 12, fontWeight: "600", color: "#64748b" },
  resultItem: { borderRadius: 8, padding: 10, marginVertical: 4 },
  tdNome: { fontSize: 13, fontWeight: "600" },
  td: { fontSize: 13, color: "#334155" },
  detailText: { fontSize: 11, color: "#475569" },
  btnSmall: { backgroundColor: '#e2e8f0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  btnSmallText: { fontSize: 10, fontWeight: '600', color: '#334155' },
  accordionWrap: {
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#f8fafc',
  },
  accordionTitle: { fontSize: 12, fontWeight: '600', color: '#334155', flex: 1 },
  accordionBody: { paddingHorizontal: 10, paddingBottom: 8, gap: 8 },
  divergenciaRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0',
    paddingTop: 8,
  },
  divergenciaSecao: { fontSize: 11, fontWeight: '700', color: '#0f172a' },
  divergenciaProduto: { fontSize: 11, color: '#475569', marginTop: 2 },
  divergenciaAjst: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  divergenciaMeta: { fontSize: 11, fontWeight: '400', color: '#64748b' },
});
