import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Linking } from 'react-native';

import TimeInput from '@/src/components/TimeInput';
import type { ReportB } from '@/src/types';
import {
  formatCurrencyInput,
  formatDateNow,
  formatDateInput,
  formatPercentInput,
  formatReportB,
  isValidDate,
  isValidTime,
  parseCurrencyInput,
  parsePercentInput,
} from '@/src/utils/parsers';

const STORAGE_KEY = 'inventexpert:reportB';
const PHOTO_STORAGE_KEY = 'inventexpert:reportB:photos';

const createInitialState = (): ReportB => ({
  cliente: '',
  lojaNum: '',
  enderecoLoja: '',
  data: formatDateNow(),
  pivProgramado: 0,
  pivRealizado: 0,
  chegadaEquipe: '',
  inicioDeposito: '',
  terminoDeposito: '',
  inicioLoja: '',
  terminoLoja: '',
  inicioAuditoriaCliente: '',
  terminoAuditoriaCliente: '',
  inicioDivergencia: '',
  terminoDivergencia: '',
  inicioNaoContados: '',
  terminoNaoContados: '',
  qtdAlterados: 0,
  qtdNaoContados: 0,
  qtdEncontradosNaoContados: 0,
  totalPecas: 0,
  valorFinanceiro: 0,
  arquivo1: '',
  arquivo2: '',
  arquivo3: '',
  avalPrepDeposito: 0,
  avalPrepLoja: 0,
  acuracidadeCliente: 0,
  acuracidadeTerceirizada: 0,
  satisfacao: 1,
  responsavel: '',
  suporteSolicitado: 'N/A',
  terminoInventario: '',
});

const numberToInput = (value: number) => (value === 0 ? '' : `${value}`);
const percentToInput = (value: number) =>
  value === 0 ? '' : `${String(value).replace('.', ',')}%`;

type ReportBPercentKey =
  | 'avalPrepDeposito'
  | 'avalPrepLoja'
  | 'acuracidadeCliente'
  | 'acuracidadeTerceirizada';

export default function ReportBScreen() {
  const [report, setReport] = useState<ReportB>(createInitialState);
  const [valorFinanceiroText, setValorFinanceiroText] = useState('');
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [suporteSelecionado, setSuporteSelecionado] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [percentText, setPercentText] = useState<Record<ReportBPercentKey, string>>({
    avalPrepDeposito: '',
    avalPrepLoja: '',
    acuracidadeCliente: '',
    acuracidadeTerceirizada: '',
  });

  useEffect(() => {
    const loadData = async () => {
      const [stored, storedPhotos] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        AsyncStorage.getItem(PHOTO_STORAGE_KEY),
      ]);
      if (stored) {
        const parsed = JSON.parse(stored) as ReportB;
        setReport(parsed);
        setSuporteSelecionado(true);
        setValorFinanceiroText(
          parsed.valorFinanceiro ? formatCurrencyInput(String(parsed.valorFinanceiro * 100)) : '',
        );
        setPercentText({
          avalPrepDeposito: percentToInput(parsed.avalPrepDeposito),
          avalPrepLoja: percentToInput(parsed.avalPrepLoja),
          acuracidadeCliente: percentToInput(parsed.acuracidadeCliente),
          acuracidadeTerceirizada: percentToInput(parsed.acuracidadeTerceirizada),
        });
      }
      if (storedPhotos) {
        setPhotoUris(JSON.parse(storedPhotos) as string[]);
      }
    };
    void loadData();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(report)).catch(() => null);
  }, [report]);

  useEffect(() => {
    AsyncStorage.setItem(PHOTO_STORAGE_KEY, JSON.stringify(photoUris)).catch(() => null);
  }, [photoUris]);

  const setField = <K extends keyof ReportB>(key: K, value: ReportB[K]) => {
    setReport((prev) => ({ ...prev, [key]: value }));
  };

  const setPercentField = (key: ReportBPercentKey, text: string) => {
    const formatted = formatPercentInput(text, 0, 100, 2);
    const withSuffix = formatted ? `${formatted}%` : '';
    setPercentText((prev) => ({ ...prev, [key]: withSuffix }));
    setField(key, parsePercentInput(formatted, 0));
  };

  const handlePickImages = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissão necessária', 'Conceda acesso à galeria para anexar fotos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 10,
    });

    if (!result.canceled) {
      const uris = result.assets.map((asset) => asset.uri);
      setPhotoUris((prev) => Array.from(new Set([...prev, ...uris])));
    }
  };

  const handleRemovePhoto = (uri: string) => {
    setPhotoUris((prev) => prev.filter((item) => item !== uri));
  };

  const movePhoto = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= photoUris.length) {
      return;
    }
    setPhotoUris((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const validateRequired = () => {
    const missing: string[] = [];
    if (!report.cliente.trim()) missing.push('Cliente');
    if (!report.lojaNum.trim()) missing.push('Número da Loja');
    if (!report.data.trim()) missing.push('Data do Inventário');
    if (!report.chegadaEquipe.trim()) missing.push('HR de chegada da equipe');
    if (!report.terminoInventario.trim()) missing.push('Término do inventário');
    if (!report.responsavel.trim()) missing.push('Responsável pelo inventário');
    if (!suporteSelecionado) missing.push('Houve solicitação de suporte');
    if (photoUris.length === 0) missing.push('Anexos de fotos');

    if (missing.length > 0) {
      Alert.alert(
        'Campos obrigatórios',
        `Preencha os campos: ${missing.join(', ')}.`,
      );
      return false;
    }

    if (!isValidDate(report.data)) {
      Alert.alert('Data inválida', 'Informe uma data válida no formato DD/MM/AAAA.');
      return false;
    }

    const invalidTimes: string[] = [];
    const timeFields: Array<[string, string]> = [
      ['HR de chegada da equipe', report.chegadaEquipe],
      ['Início da contagem do Depósito', report.inicioDeposito],
      ['Término da contagem do Depósito', report.terminoDeposito],
      ['Início da contagem da Loja', report.inicioLoja],
      ['Término da contagem da Loja', report.terminoLoja],
      ['Início da auditoria do cliente', report.inicioAuditoriaCliente],
      ['Término da auditoria do cliente', report.terminoAuditoriaCliente],
      ['Início da divergência', report.inicioDivergencia],
      ['Término da divergência', report.terminoDivergencia],
      ['Início dos não contados', report.inicioNaoContados],
      ['Término dos não contados', report.terminoNaoContados],
      ['Envio do 1º arquivo', report.arquivo1],
      ['Envio do 2º arquivo', report.arquivo2],
      ['Envio do 3º arquivo', report.arquivo3],
      ['Término do inventário', report.terminoInventario],
    ];

    timeFields.forEach(([label, value]) => {
      if (value.trim().length > 0 && !isValidTime(value)) {
        invalidTimes.push(label);
      }
    });

    if (invalidTimes.length > 0) {
      Alert.alert(
        'Horários inválidos',
        `Verifique os campos: ${invalidTimes.join(', ')}.`,
      );
      return false;
    }

    if (report.satisfacao < 1 || report.satisfacao > 5) {
      Alert.alert('Satisfação inválida', 'Informe um valor entre 1 e 5.');
      return false;
    }
    return true;
  };

  const handleSendMessage = async () => {
    if (!validateRequired()) {
      return;
    }
    const message = formatReportB(report);
    const url = `whatsapp://send?text=${encodeURIComponent(message)}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Erro', 'Não foi possível abrir o WhatsApp.');
    }
  };

  const handleSharePhotos = async () => {
    if (photoUris.length === 0) {
      Alert.alert('Aviso', 'Adicione fotos antes de compartilhar.');
      return;
    }
    const isShareAvailable = await Sharing.isAvailableAsync();
    if (!isShareAvailable) {
      Alert.alert('Aviso', 'Compartilhamento de imagens não disponível neste dispositivo.');
      return;
    }

    try {
      const imageTags: string[] = [];
      for (const uri of photoUris) {
        const manipulated = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: 1600 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true },
        );
        if (manipulated.base64) {
          imageTags.push(
            `<img src="data:image/jpeg;base64,${manipulated.base64}" style="width:100%;margin:0 0 16px 0;" />`,
          );
        }
      }

      if (imageTags.length === 0) {
        Alert.alert('Aviso', 'Não foi possível preparar as imagens.');
        return;
      }

      const html = `<html><body style="margin:0;padding:16px;">${imageTags.join(
        '',
      )}</body></html>`;
      const file = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(file.uri);
      await FileSystem.deleteAsync(file.uri, { idempotent: true });
    } catch {
      for (const uri of photoUris) {
        await Sharing.shareAsync(uri);
      }
    }
  };

  const handleOpenPreview = () => {
    if (!validateRequired()) {
      return;
    }
    setPreviewVisible(true);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      className="flex-1 bg-slate-50">
      <ScrollView contentContainerClassName="px-4 pb-8 pt-4">
        <View className="mb-4 rounded-xl bg-white p-4 shadow-sm">
          <Text className="text-base font-semibold text-slate-800">Identificação</Text>
          <View className="mt-3">
            <Text className="text-sm font-semibold text-slate-700">Cliente</Text>
            <TextInput
              value={report.cliente}
              onChangeText={(text) => setField('cliente', text)}
              className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900"
            />
          </View>
          <View className="mt-3">
            <Text className="text-sm font-semibold text-slate-700">Número da Loja</Text>
            <TextInput
              value={report.lojaNum}
              onChangeText={(text) => setField('lojaNum', text)}
              className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900"
            />
          </View>
          <View className="mt-3">
            <Text className="text-sm font-semibold text-slate-700">Data do Inventário</Text>
            <TextInput
              value={report.data}
              onChangeText={(text) => setField('data', formatDateInput(text))}
              placeholder="DD/MM/AAAA"
              className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900"
            />
          </View>
          <View className="mt-3">
            <Text className="text-sm font-semibold text-slate-700">Endereço da Loja</Text>
            <TextInput
              value={report.enderecoLoja}
              onChangeText={(text) => setField('enderecoLoja', text)}
              placeholder="Ex: Rua, número, bairro"
              className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900"
            />
          </View>
          <View className="mt-3">
            <Text className="text-sm font-semibold text-slate-700">PIV Programado</Text>
            <TextInput
              value={numberToInput(report.pivProgramado)}
              onChangeText={(text) => setField('pivProgramado', Number(text) || 0)}
              keyboardType="numeric"
              className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900"
            />
          </View>
          <View className="mt-3">
            <Text className="text-sm font-semibold text-slate-700">PIV Realizado</Text>
            <TextInput
              value={numberToInput(report.pivRealizado)}
              onChangeText={(text) => setField('pivRealizado', Number(text) || 0)}
              keyboardType="numeric"
              className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900"
            />
          </View>
        </View>

        <View className="mb-4 rounded-xl bg-white p-4 shadow-sm">
          <Text className="text-base font-semibold text-slate-800">Cronograma Operacional</Text>
          <TimeInput
            label="HR de chegada da equipe"
            value={report.chegadaEquipe}
            onChange={(value) => setField('chegadaEquipe', value)}
            required
          />
          <TimeInput
            label="Início da contagem do Depósito"
            value={report.inicioDeposito}
            onChange={(value) => setField('inicioDeposito', value)}
          />
          <TimeInput
            label="Término da contagem do Depósito"
            value={report.terminoDeposito}
            onChange={(value) => setField('terminoDeposito', value)}
          />
          <TimeInput
            label="Início da contagem da Loja"
            value={report.inicioLoja}
            onChange={(value) => setField('inicioLoja', value)}
          />
          <TimeInput
            label="Término da contagem da Loja"
            value={report.terminoLoja}
            onChange={(value) => setField('terminoLoja', value)}
          />
        </View>

        <View className="mb-4 rounded-xl bg-white p-4 shadow-sm">
          <Text className="text-base font-semibold text-slate-800">Auditoria e Divergências</Text>
          <TimeInput
            label="Início da auditoria do cliente"
            value={report.inicioAuditoriaCliente}
            onChange={(value) => setField('inicioAuditoriaCliente', value)}
          />
          <TimeInput
            label="Término da auditoria do cliente"
            value={report.terminoAuditoriaCliente}
            onChange={(value) => setField('terminoAuditoriaCliente', value)}
          />
          <TimeInput
            label="Início da divergência"
            value={report.inicioDivergencia}
            onChange={(value) => setField('inicioDivergencia', value)}
          />
          <TimeInput
            label="Término da divergência"
            value={report.terminoDivergencia}
            onChange={(value) => setField('terminoDivergencia', value)}
          />
          <TimeInput
            label="Início dos não contados"
            value={report.inicioNaoContados}
            onChange={(value) => setField('inicioNaoContados', value)}
          />
          <TimeInput
            label="Término dos não contados"
            value={report.terminoNaoContados}
            onChange={(value) => setField('terminoNaoContados', value)}
          />
        </View>

        <View className="mb-4 rounded-xl bg-white p-4 shadow-sm">
          <Text className="text-base font-semibold text-slate-800">Resultado</Text>
          <View className="mt-3">
            <Text className="text-sm font-semibold text-slate-700">Qtd. de itens alterados</Text>
            <TextInput
              value={numberToInput(report.qtdAlterados)}
              onChangeText={(text) => setField('qtdAlterados', Number(text) || 0)}
              keyboardType="numeric"
              className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900"
            />
          </View>
          <View className="mt-3">
            <Text className="text-sm font-semibold text-slate-700">Qtd. de itens não contados</Text>
            <TextInput
              value={numberToInput(report.qtdNaoContados)}
              onChangeText={(text) => setField('qtdNaoContados', Number(text) || 0)}
              keyboardType="numeric"
              className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900"
            />
          </View>
          <View className="mt-3">
            <Text className="text-sm font-semibold text-slate-700">Itens encontrados no não contados</Text>
            <TextInput
              value={numberToInput(report.qtdEncontradosNaoContados)}
              onChangeText={(text) => setField('qtdEncontradosNaoContados', Number(text) || 0)}
              keyboardType="numeric"
              className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900"
            />
          </View>
          <View className="mt-3">
            <Text className="text-sm font-semibold text-slate-700">Total de peças</Text>
            <TextInput
              value={numberToInput(report.totalPecas)}
              onChangeText={(text) => setField('totalPecas', Number(text) || 0)}
              keyboardType="numeric"
              className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900"
            />
          </View>
          <View className="mt-3">
            <Text className="text-sm font-semibold text-slate-700">Valor financeiro total</Text>
            <TextInput
              value={valorFinanceiroText}
              onChangeText={(text) => {
                const masked = formatCurrencyInput(text);
                setValorFinanceiroText(masked);
                setField('valorFinanceiro', parseCurrencyInput(masked));
              }}
              keyboardType="numeric"
              className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900"
            />
          </View>
        </View>

        <View className="mb-4 rounded-xl bg-white p-4 shadow-sm">
          <Text className="text-base font-semibold text-slate-800">Envio de Arquivos</Text>
          <TimeInput
            label="Envio do 1º arquivo"
            value={report.arquivo1}
            onChange={(value) => setField('arquivo1', value)}
          />
          <TimeInput
            label="Envio do 2º arquivo"
            value={report.arquivo2}
            onChange={(value) => setField('arquivo2', value)}
          />
          <TimeInput
            label="Envio do 3º arquivo"
            value={report.arquivo3}
            onChange={(value) => setField('arquivo3', value)}
          />
        </View>

        <View className="mb-4 rounded-xl bg-white p-4 shadow-sm">
          <Text className="text-base font-semibold text-slate-800">Anexos de Fotos</Text>
          <Text className="mt-2 text-sm text-slate-600">
            Adicione as fotos dos relatórios gerenciais antes do envio.
          </Text>
          <Pressable
            onPress={handlePickImages}
            className="mt-3 items-center rounded-lg bg-blue-600 py-2">
            <Text className="text-sm font-semibold text-white">Adicionar fotos</Text>
          </Pressable>
          {photoUris.length === 0 ? (
            <Text className="mt-3 text-sm text-slate-500">Nenhuma foto anexada.</Text>
          ) : (
            <View className="mt-3 flex-row flex-wrap gap-3">
              {photoUris.map((uri, index) => (
                <View key={uri} className="relative">
                  <Image source={{ uri }} className="h-20 w-20 rounded-lg" />
                  <View className="absolute bottom-1 left-1 rounded-md bg-slate-900/70 px-1">
                    <Text className="text-[10px] font-semibold text-white">{index + 1}</Text>
                  </View>
                  <View className="absolute bottom-1 right-1 flex-row gap-1">
                    <Pressable
                      onPress={() => movePhoto(index, index - 1)}
                      className="h-6 w-6 items-center justify-center rounded-full bg-slate-900/70">
                      <Ionicons name="arrow-up" size={12} color="#fff" />
                    </Pressable>
                    <Pressable
                      onPress={() => movePhoto(index, index + 1)}
                      className="h-6 w-6 items-center justify-center rounded-full bg-slate-900/70">
                      <Ionicons name="arrow-down" size={12} color="#fff" />
                    </Pressable>
                  </View>
                  <Pressable
                    onPress={() => handleRemovePhoto(uri)}
                    className="absolute -right-2 -top-2 h-6 w-6 items-center justify-center rounded-full bg-rose-600">
                    <Ionicons name="close" size={14} color="#fff" />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>

        <View className="mb-4 rounded-xl bg-white p-4 shadow-sm">
          <Text className="text-base font-semibold text-slate-800">Indicadores de Qualidade</Text>
          <View className="mt-3">
            <Text className="text-sm font-semibold text-slate-700">Avaliação de preparação do depósito</Text>
            <TextInput
              value={percentText.avalPrepDeposito}
              onChangeText={(text) => setPercentField('avalPrepDeposito', text)}
              keyboardType="numeric"
              className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900"
            />
          </View>
          <View className="mt-3">
            <Text className="text-sm font-semibold text-slate-700">Avaliação de preparação da loja</Text>
            <TextInput
              value={percentText.avalPrepLoja}
              onChangeText={(text) => setPercentField('avalPrepLoja', text)}
              keyboardType="numeric"
              className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900"
            />
          </View>
          <View className="mt-3">
            <Text className="text-sm font-semibold text-slate-700">Acuracidade cliente (%)</Text>
            <TextInput
              value={percentText.acuracidadeCliente}
              onChangeText={(text) => setPercentField('acuracidadeCliente', text)}
              keyboardType="numeric"
              className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900"
            />
          </View>
          <View className="mt-3">
            <Text className="text-sm font-semibold text-slate-700">Acuracidade terceirizada (%)</Text>
            <TextInput
              value={percentText.acuracidadeTerceirizada}
              onChangeText={(text) => setPercentField('acuracidadeTerceirizada', text)}
              keyboardType="numeric"
              className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900"
            />
          </View>
          <View className="mt-3">
            <Text className="text-sm font-semibold text-slate-700">Satisfação (1 a 5)</Text>
            <TextInput
              value={numberToInput(report.satisfacao)}
              onChangeText={(text) => {
                const digits = text.replace(/\D/g, '').slice(0, 1);
                if (!digits) {
                  setField('satisfacao', 0);
                  return;
                }
                const asNumber = Math.min(5, Math.max(1, Number(digits)));
                setField('satisfacao', asNumber);
              }}
              keyboardType="numeric"
              className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900"
            />
          </View>
        </View>

        <View className="mb-4 rounded-xl bg-white p-4 shadow-sm">
          <Text className="text-base font-semibold text-slate-800">Finalização</Text>
          <View className="mt-3">
            <Text className="text-sm font-semibold text-slate-700">Responsável pelo inventário</Text>
            <TextInput
              value={report.responsavel}
              onChangeText={(text) => setField('responsavel', text)}
              className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900"
            />
          </View>
          <TimeInput
            label="Término do inventário"
            value={report.terminoInventario}
            onChange={(value) => setField('terminoInventario', value)}
          />
          <View className="mt-3">
            <Text className="text-sm font-semibold text-slate-700">Houve solicitação de suporte</Text>
            <Text className="text-xs text-slate-500">Seleção obrigatória</Text>
            <View className="mt-3 flex-row gap-2">
              {(['Sim', 'Não', 'N/A'] as const).map((option) => (
                <Pressable
                  key={option}
                  onPress={() => {
                    setSuporteSelecionado(true);
                    setField('suporteSolicitado', option);
                  }}
                  className={`rounded-lg px-4 py-2 ${
                    report.suporteSolicitado === option ? 'bg-blue-600' : 'bg-slate-200'
                  }`}>
                  <Text
                    className={`text-sm font-semibold ${
                      report.suporteSolicitado === option ? 'text-white' : 'text-slate-700'
                    }`}>
                    {option}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        <Pressable
          onPress={handleOpenPreview}
          className="mt-2 items-center rounded-xl bg-blue-600 py-3">
          <Text className="text-base font-semibold text-white">Enviar Resumo de Inventário</Text>
        </Pressable>

        <Modal visible={previewVisible} transparent animationType="fade">
          <View className="flex-1 items-center justify-center bg-black/50 px-4">
            <View className="w-full max-w-md rounded-xl bg-white p-4">
              <Text className="text-base font-semibold text-slate-800">Pré-visualização</Text>
              <ScrollView className="mt-3 max-h-96 rounded-lg border border-slate-200 p-3">
                <Text className="text-sm text-slate-700">{formatReportB(report)}</Text>
              </ScrollView>
              <View className="mt-4 flex-row gap-2">
                <Pressable
                  onPress={() => setPreviewVisible(false)}
                  className="flex-1 items-center rounded-lg bg-slate-200 py-2">
                  <Text className="text-sm font-semibold text-slate-700">Voltar</Text>
                </Pressable>
                <Pressable
                  onPress={async () => {
                    setPreviewVisible(false);
                    await handleSendMessage();
                    Alert.alert(
                      'Enviar fotos',
                      'Depois de enviar a mensagem no WhatsApp, volte ao app para enviar as fotos em PDF.',
                      [
                        { text: 'Cancelar', style: 'cancel' },
                        {
                          text: 'Enviar fotos (PDF)',
                          onPress: () => {
                            void handleSharePhotos();
                          },
                        },
                      ],
                    );
                  }}
                  className="flex-1 items-center rounded-lg bg-blue-600 py-2">
                  <Text className="text-sm font-semibold text-white">Enviar mensagem</Text>
                </Pressable>
                <Pressable
                  onPress={() => void handleSharePhotos()}
                  className="flex-1 items-center rounded-lg bg-slate-900 py-2">
                  <Text className="text-sm font-semibold text-white">Enviar fotos (PDF)</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
