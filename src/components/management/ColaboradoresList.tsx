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
import { ColaboradoresService, useColaboradores } from '../../modules/colaboradores';
import type { IColaborador, IColaboradorInput } from '../../modules/colaboradores';
import { pickAndParseExcel } from '../../utils/excelParser';

const colsService = new ColaboradoresService(supabase!);

export default function ColaboradoresList() {
  const [busca, setBusca] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [importing, setImporting] = useState(false);
  const [form, setForm] = useState<Partial<IColaborador>>({});

  // Filtros memoizados
  const filtros = useMemo(() => ({ busca }), [busca]);
  const { colaboradores, loading, recarregar, criar, atualizar, desativar, inserirLote } =
    useColaboradores(colsService, filtros, true);

  const handleSalvar = async () => {
    try {
      if (form.id) {
        await atualizar(form.id, form);
        Alert.alert('Sucesso', 'Colaborador actualizado com sucesso!');
      } else {
        await criar(form as IColaboradorInput);
        Alert.alert('Sucesso', 'Colaborador cadastrado com sucesso!');
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
      const { dados, erro } = await pickAndParseExcel<IColaboradorInput>();
      if (erro) {
        Alert.alert('Erro', erro);
        return;
      }
      if (dados.length === 0) return;

      const total = await inserirLote(dados);
      Alert.alert('Sucesso', `Importados ${total} colaboradores com sucesso!`);
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

  const renderItem = ({ item }: { item: IColaborador }) => {
    const isLider = item.funcao === 'LIDER';
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{item.nome}</Text>
          <View style={[styles.badge, isLider ? styles.badgeLider : styles.badgeConf]}>
            <Text style={[styles.badgeText, isLider ? styles.badgeTextLider : styles.badgeTextConf]}>
              {item.funcao}
            </Text>
          </View>
        </View>
        <Text style={styles.cardSub}>
          <Ionicons name="location-outline" size={12} /> {item.cidade} - {item.estado}
        </Text>
        <Text style={styles.cardSub}>
          <Ionicons name="call-outline" size={12} /> {item.telefone || 'Sem telefone'}
        </Text>
        <Text style={styles.cardSub}>
          <Ionicons name="id-card-outline" size={12} /> {item.matricula || 'Sem matrícula'}
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
          <Pressable style={styles.actionBtn} onPress={() => handleDesativar(item.id, item.nome)}>
            <Ionicons name="trash" size={16} color="#DC2626" />
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Busca e Novo */}
      <View style={styles.headerRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color="#94A3B8" />
          <TextInput
            placeholder="Buscar por nome ou matrícula..."
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
            setForm({ funcao: 'CONFERENTE', estado: 'SP' });
            setModalVisible(true);
          }}
        >
          <Ionicons name="person-add" size={20} color="#FFF" />
        </Pressable>
      </View>

      {/* Lista */}
      {loading && !colaboradores.length ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : (
        <FlatList
          data={colaboradores}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={recarregar} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>Nenhum colaborador encontrado.</Text>
            </View>
          }
        />
      )}

      {/* Modal de Formulário */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaContent title={form.id ? 'Editar Colaborador' : 'Novo Colaborador'} onClose={() => setModalVisible(false)}>
          <ScrollView contentContainerStyle={styles.formContainer}>
            <Text style={styles.label}>Nome Completo *</Text>
            <TextInput
              style={styles.input}
              value={form.nome}
              onChangeText={(t) => setForm((f) => ({ ...f, nome: t }))}
              placeholder="Ex: João da Silva"
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

            <Text style={styles.label}>Telefone / WhatsApp *</Text>
            <TextInput
              style={styles.input}
              value={form.telefone}
              onChangeText={(t) => setForm((f) => ({ ...f, telefone: t }))}
              placeholder="(11) 99999-9999"
              keyboardType="phone-pad"
            />

            <Text style={styles.label}>Matrícula (opcional)</Text>
            <TextInput
              style={styles.input}
              value={form.matricula}
              onChangeText={(t) => setForm((f) => ({ ...f, matricula: t }))}
              placeholder="Ex: 12345"
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
  headerRow: { flexDirection: 'row', gap: 12, padding: 16 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: '#E2E8F0', height: 48 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15 },
  addBtn: { width: 48, height: 48, backgroundColor: '#2563EB', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  card: { backgroundColor: '#FFF', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#1E293B', flex: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  badgeLider: { backgroundColor: '#1E40AF' },
  badgeConf: { backgroundColor: '#DBEAFE' },
  badgeText: { fontSize: 10, fontWeight: 'bold' },
  badgeTextLider: { color: '#FFF' },
  badgeTextConf: { color: '#1E40AF' },
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
