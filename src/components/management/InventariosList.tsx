import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  TextInput,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '../../services/supabase';
import { InventariosService, useInventariosCrud } from '../../modules/inventarios';
import { ClientesService } from '../../modules/clientes';
import type { IInventario, IInventarioInput } from '../../modules/inventarios';
import type { ICliente } from '../../modules/clientes';

const invService = new InventariosService(supabase!);
const cliService = new ClientesService(supabase!);

export default function InventariosList() {
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState<Partial<IInventario>>({});

  // Para o dropdown de clientes
  const [clientes, setClientes] = useState<ICliente[]>([]);
  const [loadingClientes, setLoadingClientes] = useState(false);

  const filtros = useMemo(() => ({}), []);
  const { inventarios, loading, recarregar, criar, atualizar, cancelar } =
    useInventariosCrud(invService, filtros, false);

  useEffect(() => {
    if (modalVisible && clientes.length === 0) {
      setLoadingClientes(true);
      cliService.listar({}, true).then((res) => {
        if (res.sucesso) setClientes(res.dados ?? []);
        setLoadingClientes(false);
      });
    }
  }, [modalVisible, clientes.length]);

  const handleSalvar = async () => {
    try {
      if (form.id) {
        await atualizar(form.id, form);
        Alert.alert('Sucesso', 'Inventário actualizado com sucesso!');
      } else {
        await criar(form as IInventarioInput);
        Alert.alert('Sucesso', 'Inventário agendado com sucesso!');
      }
      setModalVisible(false);
      setForm({});
    } catch (e) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Erro ao guardar.');
    }
  };

  const handleCancelar = (id: string, dataStr: string) => {
    Alert.alert(
      'Cancelar Inventário',
      `Tem a certeza que deseja cancelar o inventário do dia ${dataStr}?`,
      [
        { text: 'Voltar', style: 'cancel' },
        { text: 'Cancelar', style: 'destructive', onPress: () => void cancelar(id) },
      ]
    );
  };

  const renderItem = ({ item }: { item: IInventario }) => {
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{item.clientes?.nome || 'Cliente Desconhecido'}</Text>
          <View style={[styles.badge, item.status === 'AGENDADO' ? styles.badgeAgendado : styles.badgeAndamento]}>
            <Text style={[styles.badgeText, item.status === 'AGENDADO' ? styles.badgeTextAgendado : styles.badgeTextAndamento]}>
              {item.status}
            </Text>
          </View>
        </View>
        <Text style={styles.cardSub}>
          <Ionicons name="calendar-outline" size={12} /> Data: {item.data}
        </Text>
        <Text style={styles.cardSub}>
          <Ionicons name="people-outline" size={12} /> Headcount: {item.headcount} conferentes
        </Text>
        {item.observacoes ? (
          <Text style={[styles.cardSub, { fontStyle: 'italic', marginTop: 8 }]}>
            {item.observacoes}
          </Text>
        ) : null}
        <View style={styles.actionsBox}>
          <Pressable
            style={styles.actionBtn}
            onPress={() => {
              setForm(item);
              setModalVisible(true);
            }}
          >
            <Ionicons name="pencil" size={16} color="#2563EB" />
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={() => handleCancelar(item.id, item.data)}>
            <Ionicons name="close-circle" size={16} color="#DC2626" />
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#334155' }}>Agenda Activa</Text>
          <Text style={{ fontSize: 13, color: '#94A3B8' }}>{inventarios.length} previstos</Text>
        </View>
        <Pressable
          style={styles.addBtn}
          onPress={() => {
            setForm({ tipo_operacao: 'FARMACIA', headcount: 10 });
            setModalVisible(true);
          }}
        >
          <Ionicons name="calendar" size={20} color="#FFF" />
        </Pressable>
      </View>

      {/* Lista */}
      {loading && !inventarios.length ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : (
        <FlatList
          data={inventarios}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={recarregar} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>Nenhuma agenda futura encontrada.</Text>
            </View>
          }
        />
      )}

      {/* Modal de Formulário */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaContent title={form.id ? 'Editar Inventário' : 'Novo Agendamento'} onClose={() => setModalVisible(false)}>
          <ScrollView contentContainerStyle={styles.formContainer}>

            {!form.id && (
              <>
                <Text style={styles.label}>Cliente *</Text>
                {loadingClientes ? (
                  <ActivityIndicator size="small" />
                ) : (
                  <View style={styles.clientPicker}>
                    {clientes.slice(0, 10).map(c => (
                      <Pressable
                        key={c.id}
                        style={[styles.clientBtn, form.cliente_id === c.id && styles.clientBtnActive]}
                        onPress={() => setForm(f => ({ ...f, cliente_id: c.id }))}
                      >
                        <Text style={[styles.clientBtnText, form.cliente_id === c.id && styles.clientBtnTextActive]}>
                          {c.nome} ({c.cidade}-{c.estado})
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </>
            )}

            <Text style={styles.label}>Data (YYYY-MM-DD) *</Text>
            <TextInput
              style={styles.input}
              value={form.data}
              onChangeText={(t) => setForm((f) => ({ ...f, data: t }))}
              placeholder="Ex: 2026-12-31"
              editable={!form.id} // data não deve ser alterada facilmente, cancelar e recriar é melhor. mas ok.
            />

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Headcount *</Text>
                <TextInput
                  style={styles.input}
                  value={form.headcount ? String(form.headcount) : ''}
                  onChangeText={(t) => setForm((f) => ({ ...f, headcount: parseInt(t) || 0 }))}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Hora Início</Text>
                <TextInput
                  style={styles.input}
                  value={form.hora_inicio || ''}
                  onChangeText={(t) => setForm((f) => ({ ...f, hora_inicio: t }))}
                  placeholder="Ex: 08:00"
                />
              </View>
            </View>

            <Text style={styles.label}>Observações Livres</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              value={form.observacoes || ''}
              onChangeText={(t) => setForm((f) => ({ ...f, observacoes: t }))}
              multiline
            />

            <Pressable style={styles.submitBtn} onPress={handleSalvar}>
              <Text style={styles.submitText}>GUARDAR</Text>
            </Pressable>
          </ScrollView>
        </SafeAreaContent>
      </Modal>
    </View>
  );
}

// Wrapper local
function SafeAreaContent({ children, title, onClose }: any) {
  return (
    <View style={styles.modalScreen}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>{title}</Text>
        <Pressable onPress={onClose}>
          <Ionicons name="close" size={24} color="#000" />
        </Pressable>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  headerRow: { flexDirection: 'row', gap: 12, padding: 16, alignItems: 'center' },
  addBtn: { width: 48, height: 48, backgroundColor: '#2563EB', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  card: { backgroundColor: '#FFF', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#1E293B', flex: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  badgeAgendado: { backgroundColor: '#FEF3C7' },
  badgeAndamento: { backgroundColor: '#D1FAE5' },
  badgeText: { fontSize: 10, fontWeight: 'bold' },
  badgeTextAgendado: { color: '#B45309' },
  badgeTextAndamento: { color: '#047857' },
  cardSub: { fontSize: 13, color: '#64748B', marginTop: 4 },
  actionsBox: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12 },
  actionBtn: { padding: 4 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#94A3B8' },
  modalScreen: { flex: 1, backgroundColor: '#F8FAFC' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  formContainer: { padding: 20 },
  label: { fontSize: 14, fontWeight: '500', color: '#475569', marginBottom: 4, marginTop: 16 },
  input: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 12, fontSize: 15 },
  submitBtn: { backgroundColor: '#2563EB', borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 32 },
  submitText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  clientPicker: { gap: 6, marginTop: 4 },
  clientBtn: { padding: 10, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 6, backgroundColor: '#FFF' },
  clientBtnActive: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  clientBtnText: { fontSize: 13, color: '#475569' },
  clientBtnTextActive: { color: '#2563EB', fontWeight: 'bold' }
});
