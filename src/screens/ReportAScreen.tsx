import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
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
import type { ReportA } from '@/src/types';
import {
  formatFloatInput,
  formatPercentInput,
  formatReportA,
  isValidTime,
  parseFloatInput,
  parsePercentInput,
} from '@/src/utils/parsers';

const STORAGE_KEY = 'inventexpert:reportA';
const HISTORY_KEY = 'inventexpert:reportA:history';

const createInitialState = (): ReportA => ({
  lojaNum: '',
  lojaNome: '',
  enderecoLoja: '',
  qtdColaboradores: 0,
  lider: '',
  hrChegada: '',
  inicioEstoque: '',
  terminoEstoque: '',
  inicioLoja: '',
  terminoLoja: '',
  inicioDivergencia: '',
  terminoDivergencia: '',
  terminoInventario: '',
  avanco22h: 0,
  avanco00h: 0,
  avanco01h: 0,
  avanco03h: 0,
  avanco04h: 0,
  arquivo1: '',
  arquivo2: '',
  arquivo3: '',
  avalEstoque: 0,
  avalLoja: 0,
  acuracidade: 0,
  percentualAuditoria: 0,
  ph: 0,
  satisfacao: 1,
  contagemAntecipada: 'N/A',
});

const numberToInput = (value: number) => (value === 0 ? '' : `${value}`);
const percentToInput = (value: number) =>
  value === 0 ? '' : `${String(value).replace('.', ',')}%`;
const floatToInput = (value: number) => (value === 0 ? '' : `${value}`.replace('.', ','));

type ReportAPercentKey =
  | 'avanco22h'
  | 'avanco00h'
  | 'avanco01h'
  | 'avanco03h'
  | 'avanco04h'
  | 'avalEstoque'
  | 'avalLoja'
  | 'acuracidade'
  | 'percentualAuditoria';

export default function ReportAScreen() {
  const [report, setReport] = useState<ReportA>(createInitialState);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [phText, setPhText] = useState('');
  const [percentText, setPercentText] = useState<Record<ReportAPercentKey, string>>({
    avanco22h: '',
    avanco00h: '',
    avanco01h: '',
    avanco03h: '',
    avanco04h: '',
    avalEstoque: '',
    avalLoja: '',
    acuracidade: '',
    percentualAuditoria: '',
  });

  useEffect(() => {
    const loadData = async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ReportA;
        setReport(parsed);
        setPhText(floatToInput(parsed.ph));
        setPercentText({
          avanco22h: percentToInput(parsed.avanco22h),
          avanco00h: percentToInput(parsed.avanco00h),
          avanco01h: percentToInput(parsed.avanco01h),
          avanco03h: percentToInput(parsed.avanco03h),
          avanco04h: percentToInput(parsed.avanco04h),
          avalEstoque: percentToInput(parsed.avalEstoque),
          avalLoja: percentToInput(parsed.avalLoja),
          acuracidade: percentToInput(parsed.acuracidade),
          percentualAuditoria: percentToInput(parsed.percentualAuditoria),
        });
      }
    };
    void loadData();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(report)).catch(() => null);
  }, [report]);

  useEffect(() => {
    const scheduleAdvanceAlerts = async () => {
      if (Constants.appOwnership === 'expo') {
        return;
      }
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        return;
      }

      await Notifications.cancelAllScheduledNotificationsAsync();

      const scheduleFor = async (label: string, hours: number, minutes: number) => {
        const now = new Date();
        const target = new Date();
        target.setHours(hours, minutes, 0, 0);
        target.setMinutes(target.getMinutes() - 5);
        if (target.getTime() <= now.getTime()) {
          target.setDate(target.getDate() + 1);
        }
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Inventário - Avanço',
            body: `Prepare-se para lançar o avanço das ${label}.`,
            sound: true,
          },
          trigger: {
            hour: target.getHours(),
            minute: target.getMinutes(),
            repeats: true,
          },
        });
      };

      await scheduleFor('22:00', 22, 0);
      await scheduleFor('00:00', 0, 0);
      await scheduleFor('01:00', 1, 0);
      await scheduleFor('03:00', 3, 0);
      await scheduleFor('04:00', 4, 0);
    };

    void scheduleAdvanceAlerts();
  }, []);

  const setField = <K extends keyof ReportA>(key: K, value: ReportA[K]) => {
    setReport((prev) => ({ ...prev, [key]: value }));
  };

  const setPercentField = (key: ReportAPercentKey, text: string) => {
    const formatted = formatPercentInput(text, 0, 100, 2);
    const withSuffix = formatted ? `${formatted}%` : '';
    setPercentText((prev) => ({ ...prev, [key]: withSuffix }));
    setField(key, parsePercentInput(formatted, 0));
  };

  const validateRequired = () => {
    const missing: string[] = [];
    if (!report.lojaNum.trim()) missing.push('Nº da loja');
    if (!report.lojaNome.trim()) missing.push('Nome da Loja');
    if (!report.qtdColaboradores) missing.push('Qtd. de colaboradores');
    if (!report.lider.trim()) missing.push('Líder do Inventário');
    if (!report.hrChegada.trim()) missing.push('Horário de chegada em loja');

    if (missing.length > 0) {
      Alert.alert(
        'Campos obrigatórios',
        `Preencha os campos: ${missing.join(', ')}.`,
      );
      return false;
    }

    const invalidTimes: string[] = [];
    const timeFields: Array<[string, string]> = [
      ['Horário de chegada em loja', report.hrChegada],
      ['Início da contagem de estoque', report.inicioEstoque],
      ['Término da contagem de estoque', report.terminoEstoque],
      ['Início da contagem da loja', report.inicioLoja],
      ['Término da contagem da loja', report.terminoLoja],
      ['Início da divergência', report.inicioDivergencia],
      ['Término da divergência', report.terminoDivergencia],
      ['Término do inventário', report.terminoInventario],
      ['Envio do 1º arquivo', report.arquivo1],
      ['Envio do 2º arquivo', report.arquivo2],
      ['Envio do 3º arquivo', report.arquivo3],
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

  const handleSendWhatsApp = () => {
    if (!validateRequired()) {
      return;
    }
    const message = formatReportA(report);
    const url = `whatsapp://send?text=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Erro', 'Não foi possível abrir o WhatsApp.');
    });
  };

  const handleOpenPreview = () => {
    if (!validateRequired()) {
      return;
    }
    setPreviewVisible(true);
  };

  const handleArchiveAndClear = async () => {
    try {
      const storedHistory = await AsyncStorage.getItem(HISTORY_KEY);
      const history = storedHistory ? (JSON.parse(storedHistory) as Array<Record<string, unknown>>) : [];
      history.push({
        savedAt: new Date().toISOString(),
        report,
      });
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch {
      Alert.alert('Erro', 'Não foi possível arquivar os dados.');
      return;
    }

    setReport(createInitialState());
    setPhText('');
    setPercentText({
      avanco22h: '',
      avanco00h: '',
      avanco01h: '',
      avanco03h: '',
      avanco04h: '',
      avalEstoque: '',
      avalLoja: '',
      acuracidade: '',
      percentualAuditoria: '',
    });
    Alert.alert('Dados arquivados', 'Os dados foram arquivados e o formulário foi limpo.');
  };

  const headerBadge = useMemo(() => report.contagemAntecipada, [report]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      className="flex-1 bg-slate-50">
      <ScrollView contentContainerClassName="px-4 pb-8 pt-4">
        <View className="mb-4 rounded-xl bg-white p-4 shadow-sm">
          <Text className="text-base font-semibold text-slate-800">Identificação</Text>
          <View className="mt-3">
            <Text className="text-sm font-semibold text-slate-700">Nº da loja</Text>
            <TextInput
              value={report.lojaNum}
              onChangeText={(text) => setField('lojaNum', text)}
              placeholder="Ex: 005"
              className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900"
            />
          </View>
          <View className="mt-3">
            <Text className="text-sm font-semibold text-slate-700">Nome da Loja</Text>
            <TextInput
              value={report.lojaNome}
              onChangeText={(text) => setField('lojaNome', text)}
              placeholder="Ex: Loja Exemplo"
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
            <Text className="text-sm font-semibold text-slate-700">Qtd. de colaboradores</Text>
            <TextInput
              value={numberToInput(report.qtdColaboradores)}
              onChangeText={(text) => setField('qtdColaboradores', Number(text) || 0)}
              keyboardType="numeric"
              className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900"
            />
          </View>
          <View className="mt-3">
            <Text className="text-sm font-semibold text-slate-700">Líder do Inventário</Text>
            <TextInput
              value={report.lider}
              onChangeText={(text) => setField('lider', text)}
              className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900"
            />
          </View>
        </View>

        <View className="mb-4 rounded-xl bg-white p-4 shadow-sm">
          <Text className="text-base font-semibold text-slate-800">Cronograma</Text>
          <TimeInput
            label="Horário de chegada em loja"
            value={report.hrChegada}
            onChange={(value) => setField('hrChegada', value)}
            required
          />
          <TimeInput
            label="Início da contagem de estoque"
            value={report.inicioEstoque}
            onChange={(value) => setField('inicioEstoque', value)}
          />
          <TimeInput
            label="Término da contagem de estoque"
            value={report.terminoEstoque}
            onChange={(value) => setField('terminoEstoque', value)}
          />
          <TimeInput
            label="Início da contagem da loja"
            value={report.inicioLoja}
            onChange={(value) => setField('inicioLoja', value)}
          />
          <TimeInput
            label="Término da contagem da loja"
            value={report.terminoLoja}
            onChange={(value) => setField('terminoLoja', value)}
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
            label="Término do inventário"
            value={report.terminoInventario}
            onChange={(value) => setField('terminoInventario', value)}
          />
        </View>

        <View className="mb-4 rounded-xl bg-white p-4 shadow-sm">
          <Text className="text-base font-semibold text-slate-800">Avanço (%)</Text>
          <View className="mt-3">
            <Text className="text-sm font-semibold text-slate-700">Avanço 22:00</Text>
            <TextInput
              value={percentText.avanco22h}
              onChangeText={(text) => setPercentField('avanco22h', text)}
              keyboardType="numeric"
              className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900"
            />
          </View>
          <View className="mt-3">
            <Text className="text-sm font-semibold text-slate-700">Avanço 00:00</Text>
            <TextInput
              value={percentText.avanco00h}
              onChangeText={(text) => setPercentField('avanco00h', text)}
              keyboardType="numeric"
              className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900"
            />
          </View>
          <View className="mt-3">
            <Text className="text-sm font-semibold text-slate-700">Avanço 01:00</Text>
            <TextInput
              value={percentText.avanco01h}
              onChangeText={(text) => setPercentField('avanco01h', text)}
              keyboardType="numeric"
              className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900"
            />
          </View>
          <View className="mt-3">
            <Text className="text-sm font-semibold text-slate-700">Avanço 03:00</Text>
            <TextInput
              value={percentText.avanco03h}
              onChangeText={(text) => setPercentField('avanco03h', text)}
              keyboardType="numeric"
              className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900"
            />
          </View>
          <View className="mt-3">
            <Text className="text-sm font-semibold text-slate-700">Avanço 04:00</Text>
            <TextInput
              value={percentText.avanco04h}
              onChangeText={(text) => setPercentField('avanco04h', text)}
              keyboardType="numeric"
              className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900"
            />
          </View>
        </View>

        <View className="mb-4 rounded-xl bg-white p-4 shadow-sm">
          <Text className="text-base font-semibold text-slate-800">Gestão de Arquivos</Text>
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
          <Text className="text-base font-semibold text-slate-800">Indicadores</Text>
          <View className="mt-3">
            <Text className="text-sm font-semibold text-slate-700">Avaliação do estoque (%)</Text>
            <TextInput
              value={percentText.avalEstoque}
              onChangeText={(text) => setPercentField('avalEstoque', text)}
              keyboardType="numeric"
              className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900"
            />
          </View>
          <View className="mt-3">
            <Text className="text-sm font-semibold text-slate-700">Avaliação da loja (%)</Text>
            <TextInput
              value={percentText.avalLoja}
              onChangeText={(text) => setPercentField('avalLoja', text)}
              keyboardType="numeric"
              className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900"
            />
          </View>
          <View className="mt-3">
            <Text className="text-sm font-semibold text-slate-700">Acuracidade (%)</Text>
            <TextInput
              value={percentText.acuracidade}
              onChangeText={(text) => setPercentField('acuracidade', text)}
              keyboardType="numeric"
              className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900"
            />
          </View>
          <View className="mt-3">
            <Text className="text-sm font-semibold text-slate-700">Percentual de auditoria (%)</Text>
            <TextInput
              value={percentText.percentualAuditoria}
              onChangeText={(text) => setPercentField('percentualAuditoria', text)}
              keyboardType="numeric"
              className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900"
            />
          </View>
          <View className="mt-3">
            <Text className="text-sm font-semibold text-slate-700">PH (Produtividade/Hora)</Text>
            <TextInput
              value={phText}
              onChangeText={(text) => {
                const formatted = formatFloatInput(text);
                setPhText(formatted);
                setField('ph', parseFloatInput(formatted));
              }}
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
          <Text className="text-base font-semibold text-slate-800">Gerenciamento</Text>
          <View className="mt-3">
            <Text className="text-sm font-semibold text-slate-700">Contagem antecipada</Text>
            <Text className="text-xs text-slate-500">Selecionado: {headerBadge}</Text>
            <View className="mt-3 flex-row gap-2">
              {(['Sim', 'Não', 'N/A'] as const).map((option) => (
                <Pressable
                  key={option}
                  onPress={() => setField('contagemAntecipada', option)}
                  className={`rounded-lg px-4 py-2 ${
                    report.contagemAntecipada === option ? 'bg-blue-600' : 'bg-slate-200'
                  }`}>
                  <Text
                    className={`text-sm font-semibold ${
                      report.contagemAntecipada === option ? 'text-white' : 'text-slate-700'
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
          <Text className="text-base font-semibold text-white">Enviar Andamento de Inventário</Text>
        </Pressable>
        <Pressable
          onPress={() =>
            Alert.alert(
              'Arquivar e limpar',
              'Isso limpará o formulário, mas os dados ficarão arquivados para análise.',
              [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Arquivar', onPress: () => void handleArchiveAndClear() },
              ],
            )
          }
          className="mt-2 items-center rounded-xl bg-slate-200 py-3">
          <Text className="text-base font-semibold text-slate-700">Arquivar e limpar</Text>
        </Pressable>

        <Modal visible={previewVisible} transparent animationType="fade">
          <View className="flex-1 items-center justify-center bg-black/50 px-4">
            <View className="w-full max-w-md rounded-xl bg-white p-4">
              <Text className="text-base font-semibold text-slate-800">Pré-visualização</Text>
              <ScrollView className="mt-3 max-h-96 rounded-lg border border-slate-200 p-3">
                <Text className="text-sm text-slate-700">{formatReportA(report)}</Text>
              </ScrollView>
              <View className="mt-4 flex-row gap-2">
                <Pressable
                  onPress={() => setPreviewVisible(false)}
                  className="flex-1 items-center rounded-lg bg-slate-200 py-2">
                  <Text className="text-sm font-semibold text-slate-700">Voltar</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setPreviewVisible(false);
                    handleSendWhatsApp();
                  }}
                  className="flex-1 items-center rounded-lg bg-blue-600 py-2">
                  <Text className="text-sm font-semibold text-white">Enviar WhatsApp</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
