import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { ModalidadeContratoCanonico } from '../types';

/**
 * Marcação da modalidade de contratação, aberta ao anexar o RProInv_Produtividade.
 *
 * O relatório individual muda de linguagem conforme o vínculo, e o arquivo de
 * produtividade não informa isso. Sem esta tela, todo relatório saía com a
 * linguagem de CLT — inclusive o de quem presta serviço sem contrato.
 *
 * A tela não permite sair sem marcar todo mundo. É proposital: o esquecimento
 * de um único nome produz um documento que trata prestador como empregado, e o
 * documento circula.
 */

export interface ConferenteParaMarcar {
  matricula: string;
  nome: string;
  modalidade: ModalidadeContratoCanonico | null;
  /** true quando a marcação veio do cadastro, não desta sessão. */
  jaConhecido: boolean;
}

interface Props {
  visivel: boolean;
  conferentes: ConferenteParaMarcar[];
  salvando?: boolean;
  onConfirmar: (conferentes: ConferenteParaMarcar[]) => void;
  onCancelar: () => void;
}

const OPCOES: {
  valor: ModalidadeContratoCanonico;
  rotulo: string;
  descricao: string;
  cor: string;
}[] = [
  {
    valor: 'CLT',
    rotulo: 'CLT',
    descricao: 'Contrato tradicional',
    cor: '#1D4ED8',
  },
  {
    valor: 'INTERMITENTE',
    rotulo: 'Intermitente',
    descricao: 'Vínculo por convocação',
    cor: '#B45309',
  },
  {
    valor: 'FREE',
    rotulo: 'Freelance',
    descricao: 'Prestador, sem vínculo',
    cor: '#047857',
  },
];

export default function ModalidadeContratoModal({
  visivel,
  conferentes,
  salvando = false,
  onConfirmar,
  onCancelar,
}: Props) {
  const [lista, setLista] = useState<ConferenteParaMarcar[]>(conferentes);

  // A lista chega depois da leitura do arquivo; ressincroniza quando muda.
  React.useEffect(() => setLista(conferentes), [conferentes]);

  const faltam = useMemo(() => lista.filter((c) => !c.modalidade).length, [lista]);
  const novos = useMemo(() => lista.filter((c) => !c.jaConhecido).length, [lista]);

  const marcar = (matricula: string, modalidade: ModalidadeContratoCanonico) => {
    setLista((atual) =>
      atual.map((c) => (c.matricula === matricula ? { ...c, modalidade } : c)),
    );
  };

  /** Aplica a mesma modalidade a quem ainda está sem marcação. */
  const marcarRestantes = (modalidade: ModalidadeContratoCanonico) => {
    setLista((atual) => atual.map((c) => (c.modalidade ? c : { ...c, modalidade })));
  };

  return (
    <Modal visible={visivel} animationType="slide" transparent onRequestClose={onCancelar}>
      <View style={s.fundo}>
        <View style={s.caixa}>
          <View style={s.cabecalho}>
            <Text style={s.titulo}>Modalidade de contratação</Text>
            <Pressable onPress={onCancelar} hitSlop={12}>
              <Ionicons name="close" size={24} color="#64748B" />
            </Pressable>
          </View>

          <Text style={s.explicacao}>
            O relatório individual muda de linguagem conforme o vínculo. Quem presta
            serviço sem contrato não recebe menção a medida disciplinar, convocação
            ou Código de Conduta.
          </Text>

          <View style={s.resumo}>
            <Text style={faltam > 0 ? s.resumoAlerta : s.resumoOk}>
              {faltam > 0
                ? `${faltam} conferente(s) ainda sem modalidade`
                : 'Todos marcados'}
            </Text>
            {novos > 0 && (
              <Text style={s.resumoInfo}>
                {novos} não constavam no cadastro e precisam de conferência
              </Text>
            )}
          </View>

          {faltam > 0 && (
            <View style={s.atalhos}>
              <Text style={s.atalhoRotulo}>Aplicar aos que faltam:</Text>
              {OPCOES.map((o) => (
                <Pressable
                  key={o.valor}
                  style={s.atalhoBtn}
                  onPress={() => marcarRestantes(o.valor)}
                >
                  <Text style={[s.atalhoTexto, { color: o.cor }]}>{o.rotulo}</Text>
                </Pressable>
              ))}
            </View>
          )}

          <ScrollView style={s.lista} contentContainerStyle={{ paddingBottom: 8 }}>
            {lista.map((c) => (
              <View key={c.matricula} style={s.linha}>
                <View style={s.identificacao}>
                  <Text style={s.nome} numberOfLines={1}>
                    {c.nome}
                  </Text>
                  <Text style={s.matricula}>
                    {c.matricula}
                    {c.jaConhecido ? ' · do cadastro' : ' · novo'}
                  </Text>
                </View>
                <View style={s.opcoes}>
                  {OPCOES.map((o) => {
                    const ativo = c.modalidade === o.valor;
                    return (
                      <Pressable
                        key={o.valor}
                        onPress={() => marcar(c.matricula, o.valor)}
                        style={[
                          s.opcao,
                          ativo && { backgroundColor: o.cor, borderColor: o.cor },
                        ]}
                      >
                        <Text style={[s.opcaoTexto, ativo && s.opcaoTextoAtivo]}>
                          {o.rotulo}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={s.legenda}>
            {OPCOES.map((o) => (
              <Text key={o.valor} style={s.legendaItem}>
                <Text style={{ color: o.cor, fontWeight: '700' }}>{o.rotulo}</Text>
                {`  ${o.descricao}`}
              </Text>
            ))}
          </View>

          <View style={s.rodape}>
            <Pressable style={s.btnCancelar} onPress={onCancelar}>
              <Text style={s.btnCancelarTexto}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[s.btnConfirmar, (faltam > 0 || salvando) && s.btnDesabilitado]}
              disabled={faltam > 0 || salvando}
              onPress={() => onConfirmar(lista)}
            >
              {salvando ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={s.btnConfirmarTexto}>
                  {faltam > 0 ? `Faltam ${faltam}` : 'Confirmar'}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  fundo: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'flex-end',
  },
  caixa: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
    maxHeight: '92%',
  },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  titulo: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  explicacao: { fontSize: 12, color: '#475569', lineHeight: 17, marginBottom: 10 },
  resumo: { marginBottom: 10 },
  resumoAlerta: { fontSize: 13, fontWeight: '700', color: '#B91C1C' },
  resumoOk: { fontSize: 13, fontWeight: '700', color: '#047857' },
  resumoInfo: { fontSize: 11, color: '#64748B', marginTop: 2 },
  atalhos: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  atalhoRotulo: { fontSize: 11, color: '#64748B', marginRight: 2 },
  atalhoBtn: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  atalhoTexto: { fontSize: 11, fontWeight: '600' },
  lista: { flexGrow: 0 },
  linha: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  identificacao: { marginBottom: 6 },
  nome: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  matricula: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  opcoes: { flexDirection: 'row', gap: 6 },
  opcao: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: 'center',
  },
  opcaoTexto: { fontSize: 12, fontWeight: '600', color: '#475569' },
  opcaoTextoAtivo: { color: '#FFFFFF' },
  legenda: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 2,
  },
  legendaItem: { fontSize: 11, color: '#64748B' },
  rodape: { flexDirection: 'row', gap: 10, marginTop: 14 },
  btnCancelar: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
  },
  btnCancelarTexto: { fontSize: 14, fontWeight: '600', color: '#475569' },
  btnConfirmar: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#1F3864',
    alignItems: 'center',
  },
  btnDesabilitado: { opacity: 0.45 },
  btnConfirmarTexto: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});
