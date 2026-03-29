import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  FlatList,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../services/supabase';
import { EscalaService } from '../modules/escala/service';
import {
  useEscala,
  useInventarios,
  usePreviewComposicao,
} from '../modules/escala/controller';
import type { Inventario } from '../types';

import EscalaList from '../components/escala/EscalaList';

const escalaService = new EscalaService(supabase!);

export default function EscalaDashboardScreen() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Hook para listar inventários que estão AGENDADOS
  const { inventarios, loading: loadingInv, recarregar: recarregarInv } =
    useInventarios(escalaService, 'AGENDADO');

  // Hooks para a escala do inventário selecionado
  const {
    escala,
    agrupado,
    loading: loadingEscala,
    gerando,
    gerarEscala,
    confirmarColaborador,
  } = useEscala(escalaService, selectedId);

  const { preview, loading: loadingPreview } = usePreviewComposicao(escalaService, selectedId);

  const handleGerarEscala = () => {
    Alert.alert(
      'Gerar Escala',
      'O motor de inteligência logística vai calcular a melhor equipa disponível. Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Gerar', onPress: () => void gerarEscala() },
      ]
    );
  };

  const renderInventarioCard = ({ item }: { item: Inventario }) => {
    const isSelected = item.id === selectedId;
    return (
      <Pressable
        style={[styles.invCard, isSelected && styles.invCardActive]}
        onPress={() => setSelectedId(item.id)}
      >
        <Ionicons
          name="storefront"
          size={20}
          color={isSelected ? '#2563EB' : '#94A3B8'}
        />
        <View style={styles.invInfo}>
          <Text style={[styles.invTitle, isSelected && styles.invTitleActive]}>
            {item.clientes?.nome || 'Loja Desconhecida'}
          </Text>
          <Text style={styles.invDate}>{item.data}</Text>
        </View>
        <View style={styles.invHeadcountBox}>
          <Text style={styles.invHeadcount}>{item.headcount}</Text>
          <Text style={styles.invHeadcountLabel}>Conf.</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Selector */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Motor de Escalas</Text>
        <Text style={styles.headerSub}>Selecione um inventário para planear</Text>
      </View>

      <View style={styles.invListContainer}>
        {loadingInv && !inventarios.length ? (
          <ActivityIndicator size="small" color="#2563EB" style={{ margin: 12 }} />
        ) : (
          <FlatList
            data={inventarios}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(i) => i.id.toString()}
            renderItem={renderInventarioCard}
            contentContainerStyle={styles.invList}
            ListEmptyComponent={
              <Text style={{ margin: 16, color: '#64748B' }}>
                Nenhum inventário "AGENDADO" encontrado.
              </Text>
            }
          />
        )}
      </View>

      {/* Main Content Area */}
      {selectedId ? (
        <View style={styles.workspace}>
          {loadingPreview || loadingEscala ? (
            <ActivityIndicator size="large" color="#2563EB" style={{ marginTop: 40 }} />
          ) : (
            <>
              {escala.length > 0 ? (
                // Já existe escala gerada
                <View style={styles.escalaContainer}>
                  <View style={styles.escalaHeader}>
                    <Text style={styles.escalaTitle}>Escala Gerada</Text>
                    <Pressable style={styles.btnRegerate} onPress={handleGerarEscala}>
                      <Ionicons name="refresh" size={16} color="#475569" />
                      <Text style={styles.btnRegenText}>Recalcular</Text>
                    </Pressable>
                  </View>
                  <EscalaList
                    agrupamento={agrupado}
                    onConfirm={confirmarColaborador}
                    escalaRaw={escala}
                  />
                </View>
              ) : (
                // Nenhuma escala gerada -> Mostrar Preview
                <View style={styles.previewContainer}>
                  <Ionicons name="hardware-chip-outline" size={48} color="#94A3B8" />
                  <Text style={styles.previewTitle}>Nenhuma Equipa Definida</Text>
                  
                  {preview && (
                    <View style={styles.statsBox}>
                      <View style={styles.stat}>
                        <Text style={styles.statValue}>{preview.total_necessario}</Text>
                        <Text style={styles.statLabel}>Necessário</Text>
                      </View>
                      <View style={styles.statDivider} />
                      <View style={styles.stat}>
                        <Text style={[styles.statValue, preview.disponiveis < preview.total_necessario ? {color: '#DC2626'} : {}]}>
                          {preview.disponiveis}
                        </Text>
                        <Text style={styles.statLabel}>Disponíveis</Text>
                      </View>
                      <View style={styles.statDivider} />
                      <View style={styles.stat}>
                        <Text style={styles.statValue}>{preview.na_cidade}</Text>
                        <Text style={styles.statLabel}>Na Cidade</Text>
                      </View>
                    </View>
                  )}

                  <Pressable
                    style={[styles.btnGerar, gerando && styles.btnGerando]}
                    onPress={handleGerarEscala}
                    disabled={gerando}
                  >
                    {gerando ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <>
                        <Ionicons name="flash" size={18} color="#FFF" />
                        <Text style={styles.btnGerarText}>Gerar Escala com IA</Text>
                      </>
                    )}
                  </Pressable>
                  <Text style={styles.helpText}>
                    O classificador aplicará +20% na pontuação base para os nativos da cidade da loja.
                  </Text>
                </View>
              )}
            </>
          )}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={64} color="#E2E8F0" />
          <Text style={styles.emptyText}>Por favor, seleccione um inventário acima.</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { padding: 16, backgroundColor: '#FFF' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#1E293B' },
  headerSub: { fontSize: 14, color: '#64748B', marginTop: 4 },
  invListContainer: {
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 8,
  },
  invList: { paddingHorizontal: 16, gap: 12 },
  invCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minWidth: 200,
  },
  invCardActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  invInfo: { marginLeft: 10, flex: 1 },
  invTitle: { fontSize: 14, fontWeight: '600', color: '#334155' },
  invTitleActive: { color: '#1E3A8A' },
  invDate: { fontSize: 12, color: '#64748B', marginTop: 2 },
  invHeadcountBox: { alignItems: 'center', backgroundColor: '#FFF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  invHeadcount: { fontSize: 14, fontWeight: 'bold', color: '#0F172A' },
  invHeadcountLabel: { fontSize: 9, color: '#64748B' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  emptyText: { color: '#94A3B8', fontSize: 16, marginTop: 16 },
  workspace: { flex: 1 },
  previewContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  previewTitle: { fontSize: 20, fontWeight: 'bold', color: '#1E293B', marginTop: 16 },
  statsBox: { flexDirection: 'row', backgroundColor: '#FFF', padding: 16, borderRadius: 12, marginVertical: 24, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: 'bold', color: '#334155' },
  statLabel: { fontSize: 12, color: '#64748B', marginTop: 4 },
  statDivider: { width: 1, backgroundColor: '#E2E8F0', marginHorizontal: 16 },
  btnGerar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#7C3AED', paddingVertical: 16, paddingHorizontal: 32, borderRadius: 100, gap: 8 },
  btnGerando: { backgroundColor: '#A78BFA' },
  btnGerarText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  helpText: { textAlign: 'center', fontSize: 12, color: '#94A3B8', marginTop: 16, paddingHorizontal: 32 },
  escalaContainer: { flex: 1, padding: 16 },
  escalaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  escalaTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E293B' },
  btnRegerate: { flexDirection: 'row', alignItems: 'center', padding: 8, backgroundColor: '#F1F5F9', borderRadius: 6, gap: 4 },
  btnRegenText: { fontSize: 12, color: '#475569', fontWeight: '500' },
});
