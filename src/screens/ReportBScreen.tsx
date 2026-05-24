import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert, KeyboardAvoidingView, Linking, Modal, Platform,
  Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import Share from "react-native-share";
import { enqueueSyncItem, syncQueue } from "../services/sync";
import type { ReportBFarmacias, ReportBMercados, ReportBOutros, ReportBMode } from "../types";
import {
  formatReportBFarmacias, formatReportBMercados, formatReportBOutros,
} from "../utils/parsers";

const KEY_MODE = "inventexpert:reportB:mode";
const KEY_F = "inventexpert:reportB:farmacias";
const KEY_M = "inventexpert:reportB:mercados";
const KEY_O = "inventexpert:reportB:outros";
const KEY_HIST = "inventexpert:reportB:history";

const initF = (): ReportBFarmacias => ({
  lojaNum:"", lojaNome:"", data: new Date().toLocaleDateString("pt-BR"),
  pivProgramado:"", pivRealizado:"", chegadaEquipe:"",
  inicioDeposito:"", terminoDeposito:"", inicioLoja:"", terminoLoja:"",
  inicioAuditoriaCliente:"", terminoAuditoriaCliente:"",
  inicioControlados:"", terminoControlados:"",
  inicioDivergencia:"", terminoDivergencia:"", qtdAlterados:"",
  inicioNaoContados:"", terminoNaoContados:"", qtdNaoContados:"",
  qtdEncontradosNaoContados:"", inicioRecontCliente:"", terminoRecontCliente:"",
  qtdItensRecontCliente:"", qtdAltRecontCliente:"",
  envioArquivo1:"", envioArquivo2:"", envioArquivo3:"",
  totalPecas:"", valorTotal:"", avalPrepDeposito:"", avalPrepLoja:"",
  satisfacao:"", responsavel:"", acuracidadeCliente:"", acuracidadeTerceirizada:"",
  suporteSolicitado: null, phCalculado:"", terminoInventario:"",
});

const initM = (): ReportBMercados => ({
  lojaNome:"", lojaNum:"", data: new Date().toLocaleDateString("pt-BR"),
  pivProgramado:"", pivRealizado:"", chegadaEquipe:"",
  inicioDeposito:"", terminoDeposito:"", inicioLoja:"", terminoLoja:"",
  inicioAuditoriaCliente:"", terminoAuditoriaCliente:"",
  inicioDivergencia:"", terminoDivergencia:"", qtdAlterados:"",
  inicioNaoContados:"", qtdNaoContados:"", qtdEncontradosNaoContados:"",
  terminoNaoContados:"", totalPecas:"", valorTotal:"",
  avalPrepDeposito:"", avalPrepLoja:"", satisfacao:"", responsavel:"",
  acuracidadeCliente:"", acuracidadeTerceirizada:"",
  suporteSolicitado: null, terminoInventario:"",
});

const initO = (): ReportBOutros => ({
  lojaNum:"", lojaNome:"", data: new Date().toLocaleDateString("pt-BR"),
  responsavel:"", qtdPessoas:"", chegadaEquipe:"",
  inicioDeposito:"", terminoDeposito:"", inicioLoja:"", terminoLoja:"",
  inicioAuditoriaCliente:"", terminoAuditoriaCliente:"",
  inicioDivergencia:"", terminoDivergencia:"",
  totalPecas:"", valorTotal:"", pctInv:"",
  avalEstoque:"", avalLoja:"", terminoInventario:"",
});

export default function ReportBScreen() {
  const [mode, setMode] = useState<ReportBMode>("farmacias");
  const [rf, setRf] = useState<ReportBFarmacias>(initF);
  const [rm, setRm] = useState<ReportBMercados>(initM);
  const [ro, setRo] = useState<ReportBOutros>(initO);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [attachment, setAttachment] = useState<{ uri: string; name: string } | null>(null);

  useFocusEffect(useCallback(() => {
    AsyncStorage.multiGet([KEY_MODE, KEY_F, KEY_M, KEY_O]).then(pairs => {
      const [modeRes, fRes, mRes, oRes] = pairs;
      if (modeRes[1]) setMode(modeRes[1] as ReportBMode);
      if (fRes[1]) setRf(JSON.parse(fRes[1]));
      if (mRes[1]) setRm(JSON.parse(mRes[1]));
      if (oRes[1]) setRo(JSON.parse(oRes[1]));
    });
  }, []));

  useEffect(() => { AsyncStorage.setItem(KEY_MODE, mode).catch(() => null); }, [mode]);
  useEffect(() => { AsyncStorage.setItem(KEY_F, JSON.stringify(rf)).catch(() => null); }, [rf]);
  useEffect(() => { AsyncStorage.setItem(KEY_M, JSON.stringify(rm)).catch(() => null); }, [rm]);
  useEffect(() => { AsyncStorage.setItem(KEY_O, JSON.stringify(ro)).catch(() => null); }, [ro]);

  const now = () => new Date().toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit" });

  const tf = <K extends keyof ReportBFarmacias>(label: string, key: K, numeric?: boolean) => (
    <View style={s.ig}>
      <Text style={s.label}>{label}</Text>
      <View style={s.tr}>
        <TextInput style={[s.input,{flex:1}]} value={String(rf[key])}
          onChangeText={t => setRf(p=>({...p,[key]:t}))}
          placeholder={numeric?"0":"00:00"} keyboardType={numeric?"numeric":"numbers-and-punctuation"} />
        {!numeric && <Pressable onPress={()=>setRf(p=>({...p,[key]:now()}))} style={s.nowBtn}>
          <Ionicons name="time-outline" size={18} color="#2563EB"/></Pressable>}
      </View>
    </View>
  );

  const tm = <K extends keyof ReportBMercados>(label: string, key: K, numeric?: boolean) => (
    <View style={s.ig}>
      <Text style={s.label}>{label}</Text>
      <View style={s.tr}>
        <TextInput style={[s.input,{flex:1}]} value={String(rm[key])}
          onChangeText={t => setRm(p=>({...p,[key]:t}))}
          placeholder={numeric?"0":"00:00"} keyboardType={numeric?"numeric":"numbers-and-punctuation"} />
        {!numeric && <Pressable onPress={()=>setRm(p=>({...p,[key]:now()}))} style={s.nowBtn}>
          <Ionicons name="time-outline" size={18} color="#2563EB"/></Pressable>}
      </View>
    </View>
  );

  const to = <K extends keyof ReportBOutros>(label: string, key: K, numeric?: boolean) => (
    <View style={s.ig}>
      <Text style={s.label}>{label}</Text>
      <View style={s.tr}>
        <TextInput style={[s.input,{flex:1}]} value={String(ro[key])}
          onChangeText={t => setRo(p=>({...p,[key]:t}))}
          placeholder={numeric?"0":"00:00"} keyboardType={numeric?"numeric":"numbers-and-punctuation"} />
        {!numeric && <Pressable onPress={()=>setRo(p=>({...p,[key]:now()}))} style={s.nowBtn}>
          <Ionicons name="time-outline" size={18} color="#2563EB"/></Pressable>}
      </View>
    </View>
  );

  const radF = (key: keyof ReportBFarmacias) => (
    <View style={s.row}>
      {([true,false] as const).map(v=>(
        <Pressable key={String(v)} onPress={()=>setRf(p=>({...p,[key]:v}))}
          style={[s.radio, rf[key]===v&&s.radioSel]}>
          <Text style={[s.radioTxt,rf[key]===v&&s.radioTxtSel]}>{v?"Sim":"Não"}</Text>
        </Pressable>
      ))}
    </View>
  );

  const radM = (key: keyof ReportBMercados) => (
    <View style={s.row}>
      {([true,false] as const).map(v=>(
        <Pressable key={String(v)} onPress={()=>setRm(p=>({...p,[key]:v}))}
          style={[s.radio, rm[key]===v&&s.radioSel]}>
          <Text style={[s.radioTxt,rm[key]===v&&s.radioTxtSel]}>{v?"Sim":"Não"}</Text>
        </Pressable>
      ))}
    </View>
  );

  const getPreview = () => {
    if (mode==="farmacias") return formatReportBFarmacias(rf);
    if (mode==="mercados") return formatReportBMercados(rm);
    return formatReportBOutros(ro);
  };

  const handleSendWhatsApp = async () => {
    const msg = getPreview();
    if (attachment) {
      if (Platform.OS === "web") {
        Alert.alert("Aviso", "O envio de arquivos no Web deve ser feito manualmente.");
        return;
      }
      try {
        await Share.shareSingle({
          social: Share.Social.WHATSAPP as any,
          message: msg,
          url: attachment.uri,
        });
      } catch (err: any) {
        if (err.message !== "User did not share") {
          // Fallback to normal share if WhatsApp direct fails
          Share.open({ message: msg, url: attachment.uri, subject: "Relatório de Inventário" }).catch(() => null);
        }
      }
    } else {
      const url = Platform.OS==="web"
        ? `https://wa.me/?text=${encodeURIComponent(msg)}`
        : `whatsapp://send?text=${encodeURIComponent(msg)}`;
      Linking.openURL(url).catch(()=>Alert.alert("Erro","Não foi possível abrir o WhatsApp"));
    }
  };

  const pickDocument = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        setAttachment({ uri: res.assets[0].uri, name: res.assets[0].name });
      }
    } catch {
      Alert.alert("Erro", "Falha ao anexar arquivo.");
    }
  };

  const handleNativeShare = async () => {
    const msg = getPreview();
    const options: any = { message: msg, subject: "Relatório de Inventário" };
    if (attachment) {
      options.url = attachment.uri;
    }
    try {
      await Share.open(options);
    } catch (err: any) {
      if (err.message !== "User did not share") console.log(err);
    }
  };

  const handleArchive = async (clear: boolean) => {
    try {
      const stored = await AsyncStorage.getItem(KEY_HIST);
      const hist = stored ? JSON.parse(stored) : [];
      hist.push({ savedAt: new Date().toISOString(), mode, report: mode==="farmacias"?rf:mode==="mercados"?rm:ro });
      await AsyncStorage.setItem(KEY_HIST, JSON.stringify(hist));
      await enqueueSyncItem("reportB", { mode });
      void syncQueue();
      if (clear) {
        if (mode==="farmacias") setRf(initF());
        else if (mode==="mercados") setRm(initM());
        else setRo(initO());
        Alert.alert("Arquivado","Dados salvos e formulário limpo.");
      } else Alert.alert("Arquivado","Dados salvos com sucesso.");
    } catch { Alert.alert("Erro","Não foi possível arquivar."); }
  };

  const handleClear = () => Alert.alert("Limpar?","Apagará os dados sem salvar.",[
    {text:"Cancelar",style:"cancel"},
    {text:"Limpar",style:"destructive",onPress:()=>{
      if (mode==="farmacias") setRf(initF());
      else if (mode==="mercados") setRm(initM());
      else setRo(initO());
    }},
  ]);

  const modeLabels: Record<ReportBMode,string> = {
    farmacias:"Farmácias", mercados:"Mercados", outros:"Outros Estab.",
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#2563EB"/>
      <KeyboardAvoidingView behavior={Platform.OS==="ios"?"padding":undefined} style={{flex:1}}>

        {/* Seletor de modo */}
        <View style={s.modeSel}>
          {(["farmacias","mercados","outros"] as ReportBMode[]).map(m=>(
            <Pressable key={m} onPress={()=>setMode(m)}
              style={[s.modeBtn, mode===m&&s.modeBtnActive]}>
              <Text style={[s.modeTxt, mode===m&&s.modeTxtActive]} numberOfLines={2}>
                {modeLabels[m]}
              </Text>
            </Pressable>
          ))}
        </View>

        <ScrollView contentContainerStyle={s.scroll}>

          {/* ═══ FARMÁCIAS ═══ */}
          {mode==="farmacias" && <>
            <View style={s.sec}>
              <Text style={s.secTitle}>1. Identificação</Text>
              <View style={s.row}>
                <View style={s.half}>{tf("Nº Loja","lojaNum",true)}</View>
                <View style={s.half}>{tf("Data","data")}</View>
              </View>
              {tf("Loja","lojaNome")}
              <View style={s.row}>
                <View style={s.half}>{tf("PIV Prog.","pivProgramado",true)}</View>
                <View style={s.half}>{tf("PIV Real.","pivRealizado",true)}</View>
              </View>
            </View>
            <View style={s.sec}>
              <Text style={s.secTitle}>2. Cronograma</Text>
              {tf("Chegada Equipe","chegadaEquipe")}
              <View style={s.row}><View style={s.half}>{tf("Ini. Cont. Dep.","inicioDeposito")}</View><View style={s.half}>{tf("Fim Cont. Dep.","terminoDeposito")}</View></View>
              <View style={s.row}><View style={s.half}>{tf("Ini. Cont. Loja","inicioLoja")}</View><View style={s.half}>{tf("Fim Cont. Loja","terminoLoja")}</View></View>
              <View style={s.row}><View style={s.half}>{tf("Ini. Audit. Cli.","inicioAuditoriaCliente")}</View><View style={s.half}>{tf("Fim Audit. Cli.","terminoAuditoriaCliente")}</View></View>
              <View style={s.row}><View style={s.half}>{tf("Ini. Diverg. Ctrl.","inicioControlados")}</View><View style={s.half}>{tf("Fim Diverg. Ctrl.","terminoControlados")}</View></View>
              <View style={s.row}><View style={s.half}>{tf("Ini. Diverg.","inicioDivergencia")}</View><View style={s.half}>{tf("Fim Diverg.","terminoDivergencia")}</View></View>
              {tf("Itens Alt. Diverg.","qtdAlterados",true)}
              <View style={s.row}><View style={s.half}>{tf("Ini. N. Cont.","inicioNaoContados")}</View><View style={s.half}>{tf("Fim N. Cont.","terminoNaoContados")}</View></View>
              {tf("Itens N. Cont.","qtdNaoContados",true)}
              {tf("Enc. no N. Cont.","qtdEncontradosNaoContados",true)}
              <View style={s.row}><View style={s.half}>{tf("Ini. Recont. Cli.","inicioRecontCliente")}</View><View style={s.half}>{tf("Fim Recont. Cli.","terminoRecontCliente")}</View></View>
              {tf("Qtd. Itens Recont. Cli.","qtdItensRecontCliente",true)}
              {tf("Qtd. Alt. Recont. Cli.","qtdAltRecontCliente",true)}
            </View>
            <View style={s.sec}>
              <Text style={s.secTitle}>3. Envio de Arquivos</Text>
              {tf("Envio 1º Arq.","envioArquivo1")}
              {tf("Envio 2º Arq.","envioArquivo2")}
              {tf("Envio 3º Arq.","envioArquivo3")}
            </View>
            <View style={s.sec}>
              <Text style={s.secTitle}>4. Resultado</Text>
              {tf("Total Peças","totalPecas",true)}
              {tf("Valor Total (R$)","valorTotal",true)}
              <View style={s.row}><View style={s.half}>{tf("Aval. Prep. Dep.","avalPrepDeposito",true)}</View><View style={s.half}>{tf("Aval. Prep. Loja","avalPrepLoja",true)}</View></View>
              <View style={s.row}><View style={s.half}>{tf("Acur. Cli. (%)","acuracidadeCliente",true)}</View><View style={s.half}>{tf("Acur. Terc. (%)","acuracidadeTerceirizada",true)}</View></View>
              <View style={s.row}><View style={s.half}>{tf("Satisfação","satisfacao",true)}</View><View style={s.half}>{tf("PH Calc.","phCalculado",true)}</View></View>
              {tf("Responsável","responsavel")}
              <Text style={s.label}>Houve Suporte?</Text>
              {radF("suporteSolicitado")}
              {tf("Fim Inventário","terminoInventario")}
            </View>
          </>}

          {/* ═══ MERCADOS ═══ */}
          {mode==="mercados" && <>
            <View style={s.sec}>
              <Text style={s.secTitle}>1. Identificação</Text>
              {tm("Loja","lojaNome")}
              <View style={s.row}><View style={s.half}>{tm("Nº Loja","lojaNum",true)}</View><View style={s.half}>{tm("Data","data")}</View></View>
              <View style={s.row}><View style={s.half}>{tm("PIV Prog.","pivProgramado",true)}</View><View style={s.half}>{tm("PIV Real.","pivRealizado",true)}</View></View>
            </View>
            <View style={s.sec}>
              <Text style={s.secTitle}>2. Cronograma</Text>
              {tm("Chegada Equipe","chegadaEquipe")}
              <View style={s.row}><View style={s.half}>{tm("Ini. Cont. Dep.","inicioDeposito")}</View><View style={s.half}>{tm("Fim Cont. Dep.","terminoDeposito")}</View></View>
              <View style={s.row}><View style={s.half}>{tm("Ini. Cont. Loja","inicioLoja")}</View><View style={s.half}>{tm("Fim Cont. Loja","terminoLoja")}</View></View>
              <View style={s.row}><View style={s.half}>{tm("Ini. Audit. Cli.","inicioAuditoriaCliente")}</View><View style={s.half}>{tm("Fim Audit. Cli.","terminoAuditoriaCliente")}</View></View>
              <View style={s.row}><View style={s.half}>{tm("Ini. Diverg.","inicioDivergencia")}</View><View style={s.half}>{tm("Fim Diverg.","terminoDivergencia")}</View></View>
              {tm("Itens Alt. Diverg.","qtdAlterados",true)}
              {tm("Ini. N. Cont.","inicioNaoContados")}
              {tm("Itens N. Cont.","qtdNaoContados",true)}
              {tm("Enc. no N. Cont.","qtdEncontradosNaoContados",true)}
              {tm("Fim N. Cont.","terminoNaoContados")}
            </View>
            <View style={s.sec}>
              <Text style={s.secTitle}>3. Resultado</Text>
              {tm("Total Peças","totalPecas",true)}
              {tm("Valor Total (R$)","valorTotal",true)}
              <View style={s.row}><View style={s.half}>{tm("Aval. Prep. Dep.","avalPrepDeposito",true)}</View><View style={s.half}>{tm("Aval. Prep. Loja","avalPrepLoja",true)}</View></View>
              <View style={s.row}><View style={s.half}>{tm("Acur. Cli. (%)","acuracidadeCliente",true)}</View><View style={s.half}>{tm("Acur. Terc. (%)","acuracidadeTerceirizada",true)}</View></View>
              {tm("Satisfação","satisfacao",true)}
              {tm("Responsável","responsavel")}
              <Text style={s.label}>Houve Suporte?</Text>
              {radM("suporteSolicitado")}
              {tm("Fim Inventário","terminoInventario")}
            </View>
          </>}

          {/* ═══ OUTROS ═══ */}
          {mode==="outros" && <>
            <View style={s.sec}>
              <Text style={s.secTitle}>1. Identificação</Text>
              <View style={s.row}><View style={s.half}>{to("Nº Loja","lojaNum",true)}</View><View style={s.half}>{to("Data","data")}</View></View>
              {to("Loja","lojaNome")}
              {to("Responsável","responsavel")}
              {to("Qtd. Pessoas","qtdPessoas",true)}
            </View>
            <View style={s.sec}>
              <Text style={s.secTitle}>2. Cronograma</Text>
              {to("Chegada Equipe","chegadaEquipe")}
              <View style={s.row}><View style={s.half}>{to("Ini. Cont. Dep.","inicioDeposito")}</View><View style={s.half}>{to("Fim Cont. Dep.","terminoDeposito")}</View></View>
              <View style={s.row}><View style={s.half}>{to("Ini. Cont. Loja","inicioLoja")}</View><View style={s.half}>{to("Fim Cont. Loja","terminoLoja")}</View></View>
              <View style={s.row}><View style={s.half}>{to("Ini. Audit. Cli.","inicioAuditoriaCliente")}</View><View style={s.half}>{to("Fim Audit. Cli.","terminoAuditoriaCliente")}</View></View>
              <View style={s.row}><View style={s.half}>{to("Ini. Diverg.","inicioDivergencia")}</View><View style={s.half}>{to("Fim Diverg.","terminoDivergencia")}</View></View>
            </View>
            <View style={s.sec}>
              <Text style={s.secTitle}>3. Resultado</Text>
              {to("Total Peças","totalPecas",true)}
              {to("Valor Total (R$)","valorTotal",true)}
              {to("% Inv.","pctInv",true)}
              <View style={s.row}><View style={s.half}>{to("Aval. Est. (%)","avalEstoque",true)}</View><View style={s.half}>{to("Aval. Loja (%)","avalLoja",true)}</View></View>
              {to("Fim Inventário","terminoInventario")}
            </View>
          </>}

          {/* Botões de ação */}
          <Pressable style={s.btnPrimary} onPress={()=>setPreviewVisible(true)}>
            <Ionicons name="logo-whatsapp" size={20} color="#fff"/>
            <Text style={s.btnTxt}>Gerar Relatório</Text>
          </Pressable>
          <View style={[s.row,{marginTop:8,gap:8}]}>
            <Pressable style={[s.btnClear,{flex:1}]} onPress={handleClear}>
              <Text style={s.btnTxtDanger}>Limpar</Text>
            </Pressable>
            <Pressable style={[s.btnClear,{flex:1,backgroundColor:"#E2E8F0"}]} onPress={()=>void handleArchive(true)}>
              <Text style={[s.btnTxtDanger,{color:"#334155"}]}>Limpar/Arquivar</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal preview */}
      <Modal visible={previewVisible} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <Text style={s.secTitle}>Pré-visualização</Text>
            <ScrollView style={s.previewBox}>
              <Text>{getPreview()}</Text>
            </ScrollView>

            {/* Anexos */}
            <View style={s.attachBox}>
              <View style={{flex:1}}>
                <Text style={s.label} numberOfLines={1}>
                  {attachment ? `📎 ${attachment.name}` : "Nenhum arquivo anexado (ex: .zip)"}
                </Text>
              </View>
              <Pressable style={s.btnAttach} onPress={pickDocument}>
                <Text style={s.btnAttachTxt}>{attachment ? "Trocar" : "Anexar"}</Text>
              </Pressable>
              {attachment && (
                <Pressable style={[s.btnAttach, {backgroundColor: "#FEE2E2", marginLeft: 8}]} onPress={() => setAttachment(null)}>
                  <Ionicons name="trash" size={14} color="#DC2626" />
                </Pressable>
              )}
            </View>

            <View style={s.row}>
              <Pressable style={s.btnBack} onPress={()=>setPreviewVisible(false)}>
                <Text>Voltar</Text>
              </Pressable>
              <Pressable style={[s.btnPrimary, { flex: 1, backgroundColor: "#25D366", marginTop: 0 }]} onPress={handleSendWhatsApp}>
                <Text style={s.btnTxt}>WhatsApp</Text>
              </Pressable>
              <Pressable style={[s.btnPrimary, { flex: 1, backgroundColor: "#DB4437", marginTop: 0 }]} onPress={handleNativeShare}>
                <Text style={s.btnTxt}>Email / Mais</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:"#F8FAFC"},
  modeSel:{flexDirection:"row",backgroundColor:"#EFF6FF",padding:8,gap:6},
  modeBtn:{flex:1,padding:10,borderRadius:10,alignItems:"center",backgroundColor:"#fff",borderWidth:1,borderColor:"#CBD5E1"},
  modeBtnActive:{backgroundColor:"#2563EB",borderColor:"#2563EB"},
  modeTxt:{fontSize:11,fontWeight:"bold",color:"#64748B",textAlign:"center"},
  modeTxtActive:{color:"#fff"},
  scroll:{padding:16},
  sec:{backgroundColor:"#fff",padding:16,borderRadius:12,marginBottom:16,elevation:2},
  secTitle:{fontSize:15,fontWeight:"bold",color:"#1E40AF",marginBottom:10,textTransform:"uppercase"},
  label:{fontSize:12,fontWeight:"600",color:"#64748B",marginTop:8},
  input:{borderWidth:1,borderColor:"#E2E8F0",borderRadius:8,padding:10,marginTop:4,fontSize:15,color:"#1E293B"},
  row:{flexDirection:"row",gap:8,alignItems:"center",marginTop:6},
  half:{flex:1},
  ig:{marginBottom:6},
  tr:{flexDirection:"row",alignItems:"center",gap:6},
  nowBtn:{padding:9,backgroundColor:"#EFF6FF",borderRadius:8,marginTop:4},
  radio:{flex:1,padding:10,borderWidth:1,borderColor:"#CBD5E1",borderRadius:8,alignItems:"center"},
  radioSel:{backgroundColor:"#EFF6FF",borderColor:"#2563EB"},
  radioTxt:{color:"#64748B",fontWeight:"bold"},
  radioTxtSel:{color:"#2563EB"},
  btnPrimary:{backgroundColor:"#2563EB",padding:15,borderRadius:12,alignItems:"center",flexDirection:"row",justifyContent:"center",gap:8,marginTop:10},
  btnClear:{backgroundColor:"#FEE2E2",padding:13,borderRadius:12,alignItems:"center"},
  btnTxt:{color:"#fff",fontWeight:"bold",fontSize:15},
  btnTxtDanger:{color:"#DC2626",fontWeight:"bold"},
  overlay:{flex:1,backgroundColor:"rgba(0,0,0,0.5)",justifyContent:"center",padding:20},
  modalBox:{backgroundColor:"#fff",borderRadius:16,padding:20,maxHeight:"85%"},
  previewBox:{backgroundColor:"#F1F5F9",padding:12,borderRadius:8,marginVertical:10},
  btnBack:{padding:13,alignItems:"center",backgroundColor:"#E2E8F0",borderRadius:12},
  attachBox:{flexDirection:"row",alignItems:"center",backgroundColor:"#F8FAFC",padding:10,borderRadius:8,marginBottom:15,borderWidth:1,borderColor:"#E2E8F0"},
  btnAttach:{paddingVertical:6,paddingHorizontal:12,backgroundColor:"#E2E8F0",borderRadius:6},
  btnAttachTxt:{fontSize:12,fontWeight:"bold",color:"#334155"},
});
