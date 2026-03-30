import React, { useMemo, useState } from 'react';
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
import { ClientesService, useClientes } from '../../modules/clientes';
import type { ICliente, IClienteInput } from '../../modules/clientes';
import { pickAndParseExcel } from '../../utils/excelParser';

const clientesService = new ClientesService(supabase!);

export default function ClientesList() {
  const [busca, setBusca] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [importing, setImporting] = useState(false);
  const [form, setForm] = useState<Partial<ICliente>>({});

  // Usa o hook com o filtro da caixa de busca
  const filtros = useMemo(() => ({ busca }), [busca]);
  const { clientes, loading, recarregar, criar, atualizar, desativar, inserirLote } = useClientes(clientesService, filtros, true);

  const handleSalvar = async () => {
    try {
      if (form.id) {
        await atualizar(form.id, form);
        Alert.alert('Sucesso', 'Cliente actualizado com sucesso!');
      } else {
        await criar(form as IClienteInput);
        Alert.alert('Sucesso', 'Cliente cadastrado com sucesso!');
      }
      setModalVisible(false);
      setForm({});
    } catch (e) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Erro ao guardar.');
    }
  };

  const handleImportar = async () => {
    setImporting(true);
    try {
      const { dados, erro } = await pickAndParseExcel<IClienteInput>();
      if (erro) {
        Alert.alert('Erro', erro);
        return;
      }
      if (dados.length === 0) return;

      const total = await inserirLote(dados);
      Alert.alert('Sucesso', `Importados ${total} clientes com sucesso!`);
    } catch (e) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Falha na importação.');
    } finally {
      setImporting(false);
    }
  };

  const handleDesativar = (id: string, nome: string) => {
    Alert.alert(
      'Atenção',
      `Tem a certeza que deseja desactivar ${nome}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Desactivar', style: 'destructive', onPress: () => void desativar(id) },
      ]
    );
  };

  const renderItem = ({ item }: { item: ICliente }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{item.nome}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{item.segmento || 'GERAL'}</Text>
        </View>
      </View>
      <Text style={styles.cardSub}>
        <Ionicons name="location-outline" size={12} /> {item.cidade} - {item.estado}
      </Text>
      <Text style={styles.cardSub}>
        <Ionicons name="barcode-outline" size={12} /> Código: {item.codigo_loja || 'N/A'}
      </Text>
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
        <Pressable
          style={styles.actionBtn}
          onPress={() => handleDesativar(item.id, item.nome)}
        >
          <Ionicons name="trash" size={16} color="#DC2626" />
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Busca e Novo */}
      <View style={styles.headerRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color="#94A3B8" />
          <TextInput
            placeholder="Buscar por nome ou código..."
            style={styles.searchInput}
            value={busca}
            onChangeText={setBusca}
            autoCapitalize="none"
          />
        </View>
        <Pressable
          style={[styles.addBtn, { backgroundColor: '#10B981', marginRight: 8 }]}
          onPress={handleImportar}
          disabled={importing}
        >
          {importing ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Ionicons name="download-outline" size={20} color="#FFF" />
          )}
        </Pressable>
        <Pressable
          style={styles.addBtn}
          onPress={() => {
            setForm({ segmento: 'FARMACIA', estado: 'SP' });
            setModalVisible(true);
          }}
        >
          <Ionicons name="add" size={24} color="#FFF" />
        </Pressable>
      </View>

      {/* Lista */}
      {loading && !clientes.length ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : (
        <FlatList
          data={clientes}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={recarregar} />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>Nenhum cliente encontrado.</Text>
            </View>
          }
        />
      )}

      {/* Modal de Formulário */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaContent title={form.id ? 'Editar Cliente' : 'Novo Cliente'} onClose={() => setModalVisible(false)}>
          <ScrollView contentContainerStyle={styles.formContainer}>
            <Text style={styles.label}>Nome da Loja *</Text>
            <TextInput
              style={styles.input}
              value={form.nome}
              onChangeText={(t) => setForm((f) => ({ ...f, nome: t }))}
              placeholder="Ex: Farmácia Central"
            />

            <Text style={styles.label}>Código da Loja</Text>
            <TextInput
              style={styles.input}
              value={form.codigo_loja}
              onChangeText={(t) => setForm((f) => ({ ...f, codigo_loja: t }))}
              placeholder="Ex: SP-001"
            />

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Cidade *</Text>
                <TextInput
                  style={styles.input}
                  value={form.cidade}
                  onChangeText={(t) => setForm((f) => ({ ...f, cidade: t }))}
                />
              </View>
              <View style={{ width: 80 }}>
                <Text style={styles.label}>UF *</Text>
                <TextInput
                  style={styles.input}
                  value={form.estado}
                  onChangeText={(t) => setForm((f) => ({ ...f, estado: t }))}
                  maxLength={2}
                  autoCapitalize="characters"
                />
              </View>
            </View>

            <Text style={styles.label}>Telefone</Text>
            <TextInput
              style={styles.input}
              value={form.telefone}
              onChangeText={(t) => setForm((f) => ({ ...f, telefone: t }))}
              placeholder="(11) 99999-9999"
              keyboardType="phone-pad"
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

// Wrapper local para safe area modal com header
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
  headerRow: { flexDirection: 'row', gap: 12, padding: 16 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: '#E2E8F0', height: 48 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15 },
  addBtn: { width: 48, height: 48, backgroundColor: '#2563EB', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  card: { backgroundColor: '#FFF', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#1E293B', flex: 1 },
  badge: { backgroundColor: '#DBEAFE', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 10, fontWeight: 'bold', color: '#1E40AF' },
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
});
