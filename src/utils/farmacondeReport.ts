import { Linking, Alert } from "react-native";

export interface FarmacondeData {
  lojaCliente: string;
  filialLoja: string;
  lider: string;
  qtdEquipe: string;
  qtdFaltas: string;
  
  inicioContagem: string;
  fimContagem: string;
  percentualInventario: string;
  
  naoContadosInicio: string;
  naoContadosTotal: string;
  naoContadosFim: string;
  
  div1Inicio: string;
  div1Controlados: string;
  div1Negativos: string;
  div1Positivos: string;
  div1Total: string;
  div1Fim: string;
  
  div2Inicio: string;
  div2Negativos: string;
  div2Positivos: string;
  div2Total: string;
  div2Fim: string;
}

export function generateFarmacondeText(data: FarmacondeData): string {
  return `INVENTÁRIO:
Loja/Cliente: ${data.lojaCliente}
Filial da loja: ${data.filialLoja}
Líder: ${data.lider}
Quantidade Equipe: ${data.qtdEquipe}
Quantidade de faltas: ${data.qtdFaltas}

Mapeamento:
Início Contagem (Geral): ${data.inicioContagem}
Fim Contagem (Geral): ${data.fimContagem}
% do Inventário: ${data.percentualInventario}

Não Contados
Início (zerados): ${data.naoContadosInicio}
Total de Itens: ${data.naoContadosTotal}
Fim (zerados): ${data.naoContadosFim}

1º Divergência
Início da divergência: ${data.div1Inicio}
Itens Controlados: ${data.div1Controlados}
Itens Negativos (perdas): ${data.div1Negativos}
Itens Positivos (sobras): ${data.div1Positivos}
Total de Itens: ${data.div1Total}
Fim da divergência: ${data.div1Fim}

2º Divergência
Início da divergência: ${data.div2Inicio}
Itens Negativos (perdas): ${data.div2Negativos}
Itens Positivos (sobras): ${data.div2Positivos}
Total de Itens: ${data.div2Total}
Fim da divergência: ${data.div2Fim}`;
}

export async function sendFarmacondeReport(data: FarmacondeData) {
  const text = generateFarmacondeText(data);
  const encodedMessage = encodeURIComponent(text);
  // Default to a wa.me link without number to let user pick contact
  const url = `https://wa.me/?text=${encodedMessage}`;

  try {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert("Erro", "O WhatsApp não está instalado no dispositivo.");
    }
  } catch (error) {
    Alert.alert("Erro", "Falha ao abrir o WhatsApp.");
  }
}
