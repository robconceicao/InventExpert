import React, { useState } from 'react';
import { Alert, Image, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import DocumentScanner from 'react-native-document-scanner-plugin';

export default function ScannerScreen() {
  const [scannedImages, setScannedImages] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  const handleScan = async (append = false) => {
    if (Platform.OS === 'web') {
      Alert.alert('Indisponível', 'O scanner automático não está disponível na versão web.');
      return;
    }
    try {
      setIsScanning(true);
      const result = await DocumentScanner.scanDocument({
        maxNumDocuments: 10,
      });
      if (result?.scannedImages?.length) {
        setScannedImages((prev) =>
          append ? [...prev, ...result.scannedImages] : result.scannedImages,
        );
      } else {
        Alert.alert('Aviso', 'Nenhuma imagem foi capturada.');
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível abrir o scanner.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleClear = () => {
    setScannedImages([]);
  };

  return (
    <ScrollView className="flex-1 bg-slate-50" contentContainerClassName="px-4 pb-8 pt-4">
      <View className="mb-4 rounded-xl bg-white p-4 shadow-sm">
        <Text className="text-base font-semibold text-slate-800">Scanner de Documentos</Text>
        <Text className="mt-2 text-sm text-slate-600">
          O scanner detecta automaticamente a folha, recorta o documento e aplica ajuste de perspectiva.
        </Text>
        <Pressable
          onPress={() => void handleScan(false)}
          className="mt-3 items-center rounded-lg bg-blue-600 py-2"
          disabled={isScanning}>
          <Text className="text-sm font-semibold text-white">
            {isScanning ? 'Abrindo scanner...' : 'Escanear documentos'}
          </Text>
        </Pressable>
        <View className="mt-2 flex-row gap-2">
          <Pressable
            onPress={() => void handleScan(true)}
            className="flex-1 items-center rounded-lg bg-slate-200 py-2"
            disabled={isScanning}>
            <Text className="text-sm font-semibold text-slate-700">Adicionar páginas</Text>
          </Pressable>
          <Pressable
            onPress={handleClear}
            className="flex-1 items-center rounded-lg bg-rose-600 py-2"
            disabled={isScanning}>
            <Text className="text-sm font-semibold text-white">Limpar</Text>
          </Pressable>
        </View>
        <Text className="mt-2 text-xs text-slate-500">
          Captura sequencial: o scanner abre e fecha a câmera por página.
        </Text>
      </View>

      <View className="rounded-xl bg-white p-4 shadow-sm">
        <Text className="text-base font-semibold text-slate-800">Pré-visualização</Text>
        {scannedImages.length === 0 ? (
          <Text className="mt-3 text-sm text-slate-500">Nenhuma imagem capturada.</Text>
        ) : (
          <View className="mt-3 flex-col gap-3">
            {scannedImages.map((uri, index) => (
              <View key={`${uri}-${index}`} className="rounded-lg border border-slate-200 p-2">
                <Text className="text-xs font-semibold text-slate-500">Página {index + 1}</Text>
                <Image source={{ uri }} className="mt-2 h-80 w-full rounded-lg" resizeMode="contain" />
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
