import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import type { AttendanceCollaborator, AttendanceData } from '@/src/types';
import { formatAttendanceMessage, formatDateInput, parseWhatsAppScale } from '@/src/utils/parsers';
import { shareCsvFile } from '@/src/utils/export';

const STORAGE_KEY = 'inventexpert:attendance';
const HISTORY_KEY = 'inventexpert:attendance:history';

const emptyData: AttendanceData = {
  data: '',
  loja: '',
  enderecoLoja: '',
  colaboradores: [],
};

export default function AttendanceScreen() {
  const [rawText, setRawText] = useState('');
  const [attendance, setAttendance] = useState<AttendanceData>(emptyData);
  const [previewVisible, setPreviewVisible] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as AttendanceData;
        setAttendance({
          data: parsed.data ?? '',
          loja: parsed.loja ?? '',
          enderecoLoja: parsed.enderecoLoja ?? '',
          colaboradores: (parsed.colaboradores ?? []).map((item) => {
            const legacy = item as AttendanceCollaborator & { presente?: boolean };
            return {
              ...item,
              status: legacy.status ?? (legacy.presente ? 'PRESENTE' : 'NAO_DEFINIDO'),
              substituto: legacy.substituto ?? '',
            };
          }),
        });
      }
    };
    void loadData();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(attendance)).catch(() => null);
  }, [attendance]);

  const handleParse = () => {
    const parsed = parseWhatsAppScale(rawText);
    setAttendance(parsed);
  };

  const togglePresence = (
    collaborator: AttendanceCollaborator,
    status: AttendanceCollaborator['status'],
  ) => {
    setAttendance((prev) => ({
      ...prev,
      colaboradores: prev.colaboradores.map((item) =>
        item.id === collaborator.id ? { ...item, status } : item,
      ),
    }));
  };

  const previewMessage = useMemo(() => formatAttendanceMessage(attendance), [attendance]);

  const handleOpenPreview = () => {
    if (!attendance.data.trim() || !attendance.loja.trim()) {
      Alert.alert('Campos obrigatórios', 'Preencha Data e Loja antes de enviar.');
      return;
    }
    setPreviewVisible(true);
  };

  const handleSendWhatsApp = () => {
    const url = `whatsapp://send?text=${encodeURIComponent(previewMessage)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Erro', 'Não foi possível abrir o WhatsApp.');
    });
  };

  const handleArchiveAndClear = async () => {
    try {
      const storedHistory = await AsyncStorage.getItem(HISTORY_KEY);
      const history = storedHistory ? (JSON.parse(storedHistory) as Array<Record<string, unknown>>) : [];
      history.push({
        savedAt: new Date().toISOString(),
        attendance,
      });
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch {
      Alert.alert('Erro', 'Não foi possível arquivar os dados.');
      return;
    }

    await handleExportHistory();

    setRawText('');
    setAttendance(emptyData);
    Alert.alert('Dados arquivados', 'A escala foi arquivada e o formulário foi limpo.');
  };

  const handleExportHistory = async () => {
    try {
      const storedHistory = await AsyncStorage.getItem(HISTORY_KEY);
      const history = storedHistory
        ? (JSON.parse(storedHistory) as Array<{ savedAt: string; attendance: AttendanceData }>)
        : [];
      if (history.length === 0) {
        Alert.alert('Sem dados', 'Não há dados arquivados para exportar.');
        return;
      }
      const headers = [
        'savedAt',
        'data',
        'loja',
        'enderecoLoja',
        'colaboradorNome',
        'status',
        'substituto',
      ];
      const rows = history.flatMap((item) => {
        const base = [item.savedAt, item.attendance.data, item.attendance.loja, item.attendance.enderecoLoja];
        if (!item.attendance.colaboradores || item.attendance.colaboradores.length === 0) {
          return [[...base, '', '', '']];
        }
        return item.attendance.colaboradores.map((collaborator) => [
          ...base,
          collaborator.nome,
          collaborator.status,
          collaborator.substituto ?? '',
        ]);
      });
      const filename = `inventexpert_escala_${new Date().toISOString().slice(0, 10)}.csv`;
      await shareCsvFile(filename, headers, rows);
    } catch {
      Alert.alert('Erro', 'Não foi possível exportar o histórico.');
    }
  };

  return (
    <ScrollView className="flex-1 bg-slate-50" contentContainerClassName="px-4 pb-8 pt-4">
      <View className="mb-4 rounded-xl bg-white p-4 shadow-sm">
        <Text className="text-base font-semibold text-slate-800">Parser de Escala (WhatsApp)</Text>
        <Text className="mt-2 text-sm text-slate-600">
          Cole o texto do WhatsApp e clique em processar.
        </Text>
        <TextInput
          value={rawText}
          onChangeText={setRawText}
          multiline
          placeholder="Cole aqui o texto bruto da escala"
          className="mt-3 min-h-[140px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900"
          textAlignVertical="top"
        />
        <Pressable
          onPress={handleParse}
          className="mt-3 items-center rounded-lg bg-blue-600 py-2">
          <Text className="text-sm font-semibold text-white">Processar escala</Text>
        </Pressable>
      </View>

      <View className="mb-4 rounded-xl bg-white p-4 shadow-sm">
        <Text className="text-base font-semibold text-slate-800">Detalhes da Escala</Text>
        <View className="mt-3">
          <Text className="text-sm font-semibold text-slate-700">Data</Text>
          <TextInput
            value={attendance.data}
            onChangeText={(text) =>
              setAttendance((prev) => ({ ...prev, data: formatDateInput(text) }))
            }
            className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900"
          />
        </View>
        <View className="mt-3">
          <Text className="text-sm font-semibold text-slate-700">Loja</Text>
          <TextInput
            value={attendance.loja}
            onChangeText={(text) => setAttendance((prev) => ({ ...prev, loja: text }))}
            className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900"
          />
        </View>
        <View className="mt-3">
          <Text className="text-sm font-semibold text-slate-700">Endereço da Loja</Text>
          <TextInput
            value={attendance.enderecoLoja}
            onChangeText={(text) => setAttendance((prev) => ({ ...prev, enderecoLoja: text }))}
            className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900"
          />
        </View>
      </View>

      <View className="rounded-xl bg-white p-4 shadow-sm">
        <Text className="text-base font-semibold text-slate-800">Presença</Text>
        {attendance.colaboradores.length === 0 ? (
          <Text className="mt-3 text-sm text-slate-500">
            Nenhum colaborador identificado ainda.
          </Text>
        ) : (
          attendance.colaboradores.map((collaborator) => (
            <View key={collaborator.id} className="mt-3 rounded-lg border border-slate-200 px-3 py-2">
              <Text className="text-sm font-medium text-slate-800">{collaborator.nome}</Text>
              <View className="mt-2 flex-row gap-3">
                <Pressable
                  onPress={() => togglePresence(collaborator, 'PRESENTE')}
                  className={`h-9 w-9 items-center justify-center rounded-full ${
                    collaborator.status === 'PRESENTE' ? 'bg-emerald-600' : 'bg-slate-200'
                  }`}>
                  <Ionicons
                    name="checkmark"
                    size={18}
                    color={collaborator.status === 'PRESENTE' ? '#fff' : '#0F172A'}
                  />
                </Pressable>
                <Pressable
                  onPress={() => togglePresence(collaborator, 'AUSENTE')}
                  className={`h-9 w-9 items-center justify-center rounded-full ${
                    collaborator.status === 'AUSENTE' ? 'bg-rose-600' : 'bg-slate-200'
                  }`}>
                  <Ionicons
                    name="close"
                    size={18}
                    color={collaborator.status === 'AUSENTE' ? '#fff' : '#0F172A'}
                  />
                </Pressable>
              </View>
              <View className="mt-3">
                <Text className="text-xs font-semibold text-slate-600">Substituição (se houver)</Text>
                <TextInput
                  value={collaborator.substituto ?? ''}
                  onChangeText={(text) =>
                    setAttendance((prev) => ({
                      ...prev,
                      colaboradores: prev.colaboradores.map((item) =>
                        item.id === collaborator.id ? { ...item, substituto: text } : item,
                      ),
                    }))
                  }
                  placeholder="Nome do substituto"
                  className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900"
                />
              </View>
            </View>
          ))
        )}
      </View>

      <Pressable
        onPress={handleOpenPreview}
        className="mt-4 items-center rounded-xl bg-blue-600 py-3">
        <Text className="text-base font-semibold text-white">Enviar Escala</Text>
      </Pressable>
      <Pressable
        onPress={() =>
          Alert.alert(
            'Arquivar e limpar',
            'Isso limpará a escala, mas os dados ficarão arquivados para análise.',
            [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Arquivar', onPress: () => void handleArchiveAndClear() },
            ],
          )
        }
        className="mt-2 items-center rounded-xl bg-slate-200 py-3">
        <Text className="text-base font-semibold text-slate-700">Arquivar e limpar</Text>
      </Pressable>
      <Pressable
        onPress={() => void handleExportHistory()}
        className="mt-2 items-center rounded-xl bg-slate-900 py-3">
        <Text className="text-base font-semibold text-white">Exportar histórico (CSV)</Text>
      </Pressable>

      <Modal visible={previewVisible} transparent animationType="fade">
        <View className="flex-1 items-center justify-center bg-black/50 px-4">
          <View className="w-full max-w-md rounded-xl bg-white p-4">
            <Text className="text-base font-semibold text-slate-800">Pré-visualização</Text>
            <ScrollView className="mt-3 max-h-96 rounded-lg border border-slate-200 p-3">
              <Text className="text-sm text-slate-700">{previewMessage}</Text>
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
  );
}
