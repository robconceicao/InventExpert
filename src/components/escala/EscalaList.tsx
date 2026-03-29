import React from 'react';
import { View, Text, StyleSheet, SectionList, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ListarEscalaRow } from '../../types';

interface GroupedEscala {
  lideres: ListarEscalaRow[];
  conferentes: ListarEscalaRow[];
  reservas: ListarEscalaRow[];
}

interface EscalaListProps {
  agrupamento: GroupedEscala;
  escalaRaw: ListarEscalaRow[];
  onConfirm: (escalaId: string, confirm: boolean) => void;
}

export default function EscalaList({ agrupamento, onConfirm }: EscalaListProps) {
  const sections = [
    { title: 'Líderes', data: agrupamento.lideres, badgeColor: '#3B82F6' },
    { title: 'Conferentes', data: agrupamento.conferentes, badgeColor: '#10B981' },
    { title: 'Reservas (Backup)', data: agrupamento.reservas, badgeColor: '#F59E0B' },
  ].filter(s => s.data.length > 0);

  const renderItem = ({ item }: { item: ListarEscalaRow }) => {
    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.nome}>{item.colaboradores?.nome || 'N/A'}</Text>
          <View style={[styles.badge, item.confirmado ? styles.badgeOn : styles.badgeOff]}>
            <Text style={[styles.badgeText, item.confirmado ? styles.badgeTextOn : styles.badgeTextOff]}>
              {item.confirmado ? 'CONFIRMADO' : 'PENDENTE'}
            </Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoText}>
            <Ionicons name="location-outline" size={12} /> {item.colaboradores?.cidade}
          </Text>
          <Text style={styles.infoText}>
            <Ionicons name="star-outline" size={12} /> Score: {item.score?.toFixed(1) || '0.0'}
          </Text>
        </View>

        <View style={styles.actionsBox}>
          {!item.confirmado ? (
            <Pressable
              style={[styles.btnAction, styles.btnConfirm]}
              onPress={() => onConfirm(item.id, true)}
            >
              <Ionicons name="checkmark-circle-outline" size={16} color="#FFF" />
              <Text style={styles.btnConfirmText}>Confirmar</Text>
            </Pressable>
          ) : (
            <Pressable
              style={[styles.btnAction, styles.btnRevoke]}
              onPress={() => onConfirm(item.id, false)}
            >
              <Ionicons name="close-circle-outline" size={16} color="#475569" />
              <Text style={styles.btnRevokeText}>Desfazer</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  const renderSectionHeader = ({ section }: any) => (
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionColorLine, { backgroundColor: section.badgeColor }]} />
      <Text style={styles.sectionTitle}>{section.title} ({section.data.length})</Text>
    </View>
  );

  return (
    <SectionList
      sections={sections}
      keyExtractor={(i) => i.id}
      renderItem={renderItem}
      renderSectionHeader={renderSectionHeader}
      contentContainerStyle={{ paddingBottom: 24, paddingHorizontal: 4 }}
      showsVerticalScrollIndicator={false}
      stickySectionHeadersEnabled={false}
    />
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  sectionColorLine: {
    width: 4,
    height: 16,
    borderRadius: 2,
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#334155',
  },
  card: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nome: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeOn: { backgroundColor: '#D1FAE5' },
  badgeOff: { backgroundColor: '#FEF3C7' },
  badgeText: { fontSize: 10, fontWeight: 'bold' },
  badgeTextOn: { color: '#047857' },
  badgeTextOff: { color: '#B45309' },
  infoRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 6,
  },
  infoText: {
    fontSize: 12,
    color: '#64748B',
  },
  actionsBox: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
  },
  btnAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    gap: 6,
  },
  btnConfirm: { backgroundColor: '#10B981' },
  btnConfirmText: { color: '#FFF', fontSize: 13, fontWeight: '500' },
  btnRevoke: { backgroundColor: '#F1F5F9' },
  btnRevokeText: { color: '#475569', fontSize: 13, fontWeight: '500' },
});
