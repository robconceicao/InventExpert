import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import Canvas, { Image as CanvasImage } from 'react-native-canvas';

const THRESHOLD = 160;

export default function ScannerScreen() {
  const cameraRef = useRef<CameraView>(null);
  const canvasRef = useRef<Canvas | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [rawBase64, setRawBase64] = useState<string | null>(null);
  const [processedUri, setProcessedUri] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const rawPreviewUri = rawBase64 ? `data:image/jpeg;base64,${rawBase64}` : null;

  const handleCapture = async () => {
    if (!cameraRef.current) {
      return;
    }
    const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.7 });
    if (photo.base64) {
      setRawBase64(photo.base64);
      setProcessedUri(null);
    }
  };

  const handlePickFromGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      setRawBase64(result.assets[0].base64);
      setProcessedUri(null);
    }
  };

  const processImage = useCallback(
    async (canvas: Canvas) => {
      if (!rawBase64 || isProcessing) {
        return;
      }
      setIsProcessing(true);
      const ctx = canvas.getContext('2d');
      const image = new CanvasImage(canvas);
      image.src = `data:image/jpeg;base64,${rawBase64}`;
      image.addEventListener('load', async () => {
        canvas.width = image.width;
        canvas.height = image.height;
        ctx.drawImage(image, 0, 0, image.width, image.height);
        const imageData = await ctx.getImageData(0, 0, image.width, image.height);
        const { data } = imageData;
        for (let i = 0; i < data.length; i += 4) {
          const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
          const value = avg > THRESHOLD ? 255 : 0;
          data[i] = value;
          data[i + 1] = value;
          data[i + 2] = value;
        }
        ctx.putImageData(imageData, 0, 0);
        const url = await canvas.toDataURL('image/png');
        setProcessedUri(url);
        setIsProcessing(false);
      });
    },
    [rawBase64, isProcessing],
  );

  useEffect(() => {
    if (canvasRef.current && rawBase64) {
      void processImage(canvasRef.current);
    }
  }, [processImage, rawBase64]);

  if (!permission) {
    return null;
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 px-6">
        <Text className="text-center text-base font-semibold text-slate-800">
          Precisamos de permissão para acessar a câmera.
        </Text>
        <Pressable
          onPress={requestPermission}
          className="mt-4 items-center rounded-xl bg-blue-600 px-4 py-2">
          <Text className="text-sm font-semibold text-white">Conceder permissão</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-slate-50" contentContainerClassName="px-4 pb-8 pt-4">
      <View className="mb-4 rounded-xl bg-white p-4 shadow-sm">
        <Text className="text-base font-semibold text-slate-800">Scanner de Documentos</Text>
        <Text className="mt-2 text-sm text-slate-600">
          Fotografe o relatório e aplique o filtro de alto contraste.
        </Text>
        <View className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          <CameraView ref={cameraRef} style={{ height: 320 }} />
        </View>
        <Pressable onPress={handleCapture} className="mt-3 items-center rounded-lg bg-blue-600 py-2">
          <Text className="text-sm font-semibold text-white">Capturar foto</Text>
        </Pressable>
        <Pressable
          onPress={handlePickFromGallery}
          className="mt-2 items-center rounded-lg bg-slate-200 py-2">
          <Text className="text-sm font-semibold text-slate-700">Selecionar da galeria</Text>
        </Pressable>
      </View>

      <View className="rounded-xl bg-white p-4 shadow-sm">
        <Text className="text-base font-semibold text-slate-800">Pré-visualização</Text>
        {processedUri ? (
          <Image source={{ uri: processedUri }} className="mt-4 h-80 w-full rounded-lg" resizeMode="contain" />
        ) : rawPreviewUri ? (
          <>
            <Image source={{ uri: rawPreviewUri }} className="mt-4 h-80 w-full rounded-lg" resizeMode="contain" />
            <Text className="mt-3 text-sm text-slate-500">
              Processando para efeito Xerox/Scanner...
            </Text>
            <Canvas ref={canvasRef} style={{ width: 0, height: 0 }} />
          </>
        ) : (
          <Text className="mt-3 text-sm text-slate-500">Nenhuma imagem capturada.</Text>
        )}
      </View>
    </ScrollView>
  );
}
