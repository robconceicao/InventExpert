/**
 * Motor invisível do filtro "folha escaneada".
 *
 * Um WebView de 0x0 hospeda um canvas 2D — único lugar disponível no app para
 * mexer em pixels (expo-image-manipulator só faz geometria e o plugin de
 * scanner não expõe modo P&B). Os pixels nunca cruzam a ponte RN: entra base64,
 * volta base64 já filtrado.
 *
 * Qualquer falha (WebView não pronto, timeout, imagem inválida) devolve a folha
 * original — o PDF ainda aplica o filtro CSS equivalente, então o usuário nunca
 * fica sem saída por causa deste caminho.
 */

import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
} from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";
import {
  base64DeDataUri,
  base64Seguro,
  buildScanFilterHtml,
  parseScanFilterMensagem,
  SCAN_FILTER_PADRAO,
  type ScanFilterConfig,
} from "../utils/scanFilter";

const TIMEOUT_MS = 25000;

export interface ScanFilterEngineRef {
  /**
   * Filtra as folhas na ordem recebida.
   * Folhas que falharem voltam com a URI original (nunca descarta captura).
   */
  filtrarUris(
    uris: string[],
    onProgresso?: (feitas: number, total: number) => void,
  ): Promise<{ uris: string[]; falhas: number }>;
}

interface Pendente {
  resolve: (base64: string) => void;
  reject: (erro: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface Props {
  config?: ScanFilterConfig;
}

function ScanFilterEngineBase(
  { config = SCAN_FILTER_PADRAO }: Props,
  ref: React.Ref<ScanFilterEngineRef>,
) {
  const webRef = useRef<WebView>(null);
  const pendentes = useRef(new Map<string, Pendente>());
  const prontoRef = useRef(false);
  const aguardandoPronto = useRef<(() => void)[]>([]);
  const seq = useRef(0);

  const aguardarPronto = useCallback(async (): Promise<boolean> => {
    if (prontoRef.current) return true;
    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(prontoRef.current), TIMEOUT_MS);
      aguardandoPronto.current.push(() => {
        clearTimeout(timer);
        resolve(true);
      });
    });
  }, []);

  const onMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    const msg = parseScanFilterMensagem(event.nativeEvent.data);
    if (!msg) return;

    if (msg.id === "__pronto__") {
      prontoRef.current = true;
      aguardandoPronto.current.splice(0).forEach((fn) => fn());
      return;
    }

    const pendente = pendentes.current.get(msg.id);
    if (!pendente) return;
    pendentes.current.delete(msg.id);
    clearTimeout(pendente.timer);
    if (msg.ok) pendente.resolve(msg.base64);
    else pendente.reject(new Error(msg.erro));
  }, []);

  /** Envia uma imagem para o canvas e espera o retorno filtrado. */
  const filtrarBase64 = useCallback(
    (base64: string): Promise<string> =>
      new Promise<string>((resolve, reject) => {
        const web = webRef.current;
        if (!web) {
          reject(new Error("Filtro indisponível."));
          return;
        }
        if (!base64Seguro(base64)) {
          reject(new Error("Base64 inválido."));
          return;
        }
        seq.current += 1;
        const id = `f${seq.current}`;
        const timer = setTimeout(() => {
          pendentes.current.delete(id);
          reject(new Error("Tempo esgotado no filtro."));
        }, TIMEOUT_MS);
        pendentes.current.set(id, { resolve, reject, timer });
        // Base64 não contém aspas nem barras invertidas — seguro interpolar
        web.injectJavaScript(
          `window.__filtrarFolha && window.__filtrarFolha("${id}","${base64.replace(/\s/g, "")}");true;`,
        );
      }),
    [],
  );

  const filtrarUri = useCallback(
    async (uri: string, indice: number): Promise<string> => {
      // Normaliza para JPEG base64 (o redimensionamento acontece no canvas,
      // que já reduz para config.maxDimensao antes de processar).
      // rotate:0 força o re-encode sem girar — mesmo padrão já usado na tela
      const normalizada = await ImageManipulator.manipulateAsync(
        uri,
        [{ rotate: 0 }],
        {
          compress: 0.92,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        },
      );
      const entrada = normalizada.base64
        ? base64DeDataUri(normalizada.base64)
        : await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          });

      const filtrada = await filtrarBase64(entrada);
      const destino = `${FileSystem.cacheDirectory}scan_pb_${Date.now()}_${indice}.jpg`;
      await FileSystem.writeAsStringAsync(destino, filtrada, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return destino;
    },
    [filtrarBase64],
  );

  useImperativeHandle(
    ref,
    () => ({
      async filtrarUris(uris, onProgresso) {
        const total = uris.length;
        if (total === 0) return { uris: [], falhas: 0 };

        const pronto = await aguardarPronto();
        if (!pronto) {
          console.warn("[ScanFilter] WebView não ficou pronto — folhas mantidas em cor.");
          return { uris, falhas: total };
        }

        const saida: string[] = [];
        let falhas = 0;
        for (let i = 0; i < total; i++) {
          try {
            saida.push(await filtrarUri(uris[i], i));
          } catch (e) {
            console.warn("[ScanFilter] Falha na folha", i + 1, e);
            saida.push(uris[i]);
            falhas += 1;
          }
          onProgresso?.(i + 1, total);
        }
        return { uris: saida, falhas };
      },
    }),
    [aguardarPronto, filtrarUri],
  );

  return (
    // 1x1 em vez de 0x0 (alguns WebViews Android não inicializam sem área) e
    // absoluto para não empurrar o layout da tela
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: 1,
        height: 1,
        opacity: 0,
      }}
      pointerEvents="none"
    >
      <WebView
        ref={webRef}
        originWhitelist={["*"]}
        source={{ html: buildScanFilterHtml(config) }}
        onMessage={onMessage}
        javaScriptEnabled
        androidLayerType="software"
        // A página é estática e local — nada carrega da rede
        cacheEnabled={false}
        style={{ width: 1, height: 1, backgroundColor: "transparent" }}
      />
    </View>
  );
}

const ScanFilterEngine = forwardRef<ScanFilterEngineRef, Props>(
  ScanFilterEngineBase,
);
ScanFilterEngine.displayName = "ScanFilterEngine";

export default ScanFilterEngine;
