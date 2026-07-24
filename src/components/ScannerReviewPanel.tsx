/**
 * Painel de revisão pós-scanner: grade de folhas com miniatura,
 * excluir / reescanear / inserir, reordenar por arrastar e preview ampliado.
 */
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import DraggableFlatList, {
  type RenderItemParams,
  ScaleDecorator,
} from "react-native-draggable-flatlist";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { FolhaEscaneada } from "../utils/folhaEscaneada";

export type ScannerReviewPanelProps = {
  folhas: FolhaEscaneada[];
  isBusy?: boolean;
  /** Título do header (default: Revisão do lote). */
  title?: string;
  /** Subtítulo do header (default: Confira antes de gerar o PDF). */
  subtitle?: string;
  onExcluir: (id: string) => void;
  onReescanear: (id: string) => void;
  onInserirDepois: (id: string) => void;
  onReordenar: (novaLista: FolhaEscaneada[]) => void;
  onConfirmar: () => void;
  onCancelar: () => void;
};

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

export default function ScannerReviewPanel({
  folhas,
  isBusy = false,
  title = "Revisão do lote",
  subtitle = "Confira antes de gerar o PDF",
  onExcluir,
  onReescanear,
  onInserirDepois,
  onReordenar,
  onConfirmar,
  onCancelar,
}: ScannerReviewPanelProps) {
  const insets = useSafeAreaInsets();
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [previewOrdem, setPreviewOrdem] = useState<number | null>(null);

  const openPreview = useCallback((folha: FolhaEscaneada) => {
    setPreviewUri(folha.uri);
    setPreviewOrdem(folha.ordem);
  }, []);

  const closePreview = useCallback(() => {
    setPreviewUri(null);
    setPreviewOrdem(null);
  }, []);

  const renderItem = useCallback(
    ({ item, drag, isActive }: RenderItemParams<FolhaEscaneada>) => (
      <ScaleDecorator activeScale={1.02}>
        <View style={[styles.card, isActive && styles.cardActive]}>
          {/* Topo: badge de ordem + dica de arraste */}
          <View style={styles.cardTop}>
            <View style={styles.orderBadge}>
              <Text style={styles.orderBadgeText}>{item.ordem}</Text>
            </View>
            <Text style={styles.folhaLabel}>Folha {item.ordem}</Text>
            <Pressable
              onLongPress={drag}
              disabled={isBusy || isActive}
              delayLongPress={120}
              style={({ pressed }) => [
                styles.dragPill,
                pressed && styles.dragPillPressed,
                isActive && styles.dragPillActive,
              ]}
              accessibilityLabel={`Arrastar folha ${item.ordem}`}
              accessibilityHint="Segure e arraste para reordenar"
            >
              <Ionicons
                name="reorder-three"
                size={22}
                color={isActive ? "#1D4ED8" : "#64748B"}
              />
              <Text style={[styles.dragPillText, isActive && styles.dragPillTextActive]}>
                Arrastar
              </Text>
            </Pressable>
          </View>

          {/* Miniatura — toque abre preview */}
          <Pressable
            onPress={() => openPreview(item)}
            disabled={isBusy}
            style={styles.thumbWrap}
            accessibilityLabel={`Ampliar folha ${item.ordem}`}
          >
            <Image
              source={{ uri: item.uri }}
              style={styles.thumb}
              resizeMode="cover"
            />
            <View style={styles.thumbOverlay}>
              <View style={styles.zoomChip}>
                <Ionicons name="expand-outline" size={14} color="#fff" />
                <Text style={styles.zoomChipText}>Ampliar</Text>
              </View>
            </View>
          </Pressable>

          {/* Ações: ícone + rótulo, alvos de toque generosos */}
          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [
                styles.actionBtn,
                styles.actionDanger,
                pressed && styles.actionPressed,
              ]}
              onPress={() => onExcluir(item.id)}
              disabled={isBusy}
              accessibilityLabel={`Excluir folha ${item.ordem}`}
            >
              <Ionicons name="trash-outline" size={18} color="#DC2626" />
              <Text style={styles.actionDangerText}>Excluir</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.actionBtn,
                styles.actionPrimary,
                pressed && styles.actionPressed,
              ]}
              onPress={() => onReescanear(item.id)}
              disabled={isBusy}
              accessibilityLabel={`Reescanear folha ${item.ordem}`}
            >
              <Ionicons name="camera-outline" size={18} color="#2563EB" />
              <Text style={styles.actionPrimaryText}>Reescanear</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.actionBtn,
                styles.actionInsert,
                pressed && styles.actionPressed,
              ]}
              onPress={() => onInserirDepois(item.id)}
              disabled={isBusy}
              accessibilityLabel={`Inserir folha depois da ${item.ordem}`}
            >
              <Ionicons name="add-circle-outline" size={18} color="#0F766E" />
              <Text style={styles.actionInsertText}>Inserir após</Text>
            </Pressable>
          </View>
        </View>
      </ScaleDecorator>
    ),
    [isBusy, onExcluir, onInserirDepois, onReescanear, openPreview],
  );

  const ListHeader = (
    <View style={styles.hintBar}>
      <Ionicons name="information-circle-outline" size={16} color="#1D4ED8" />
      <Text style={styles.hintText}>
        Toque na miniatura para ampliar · segure “Arrastar” para reordenar a
        sequência do PDF
      </Text>
    </View>
  );

  return (
    <GestureHandlerRootView style={styles.root}>
      <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 8) }]}>
          <Pressable
            onPress={onCancelar}
            disabled={isBusy}
            style={({ pressed }) => [styles.headerIconBtn, pressed && styles.headerIconBtnPressed]}
            accessibilityLabel="Fechar revisão"
          >
            <Ionicons name="close" size={24} color="#1E293B" />
          </Pressable>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={2}>
              {subtitle}
            </Text>
          </View>

          <View style={styles.countChip}>
            <Ionicons name="documents-outline" size={14} color="#1E40AF" />
            <Text style={styles.countChipText}>
              {folhas.length} {folhas.length === 1 ? "folha" : "folhas"}
            </Text>
          </View>
        </View>

        {/* Busy banner */}
        {isBusy ? (
          <View style={styles.busyBanner}>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.busyBannerText}>Abrindo scanner…</Text>
          </View>
        ) : null}

        {/* Lista */}
        {folhas.length === 0 ? (
          <View style={styles.emptyBox}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="images-outline" size={40} color="#94A3B8" />
            </View>
            <Text style={styles.emptyTitle}>Nenhuma folha no lote</Text>
            <Text style={styles.emptyText}>
              Volte e escaneie novamente, ou use “+ Adicionar Páginas” na tela
              do scanner.
            </Text>
          </View>
        ) : (
          <DraggableFlatList
            data={folhas}
            keyExtractor={(item) => item.id}
            onDragEnd={({ data }) => onReordenar(data)}
            renderItem={renderItem}
            ListHeaderComponent={ListHeader}
            containerStyle={styles.list}
            contentContainerStyle={styles.listContent}
            activationDistance={16}
            dragItemOverflow
          />
        )}

        {/* Footer fixo */}
        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [
              styles.btnCancel,
              pressed && styles.btnCancelPressed,
            ]}
            onPress={onCancelar}
            disabled={isBusy}
          >
            <Text style={styles.btnCancelText}>Voltar</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.btnConfirm,
              (folhas.length === 0 || isBusy) && styles.btnDisabled,
              pressed && folhas.length > 0 && !isBusy && styles.btnConfirmPressed,
            ]}
            onPress={onConfirmar}
            disabled={folhas.length === 0 || isBusy}
          >
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.btnConfirmText}>
              Confirmar{folhas.length > 0 ? ` (${folhas.length})` : ""}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Preview ampliado */}
      <Modal
        visible={previewUri != null}
        transparent
        animationType="fade"
        onRequestClose={closePreview}
      >
        <View style={styles.previewRoot}>
          <Pressable style={styles.previewBackdrop} onPress={closePreview} />
          <View style={[styles.previewSheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewTitle}>
                Folha {previewOrdem ?? "—"}
              </Text>
              <Pressable
                onPress={closePreview}
                style={styles.previewClose}
                accessibilityLabel="Fechar preview"
              >
                <Ionicons name="close" size={22} color="#fff" />
              </Pressable>
            </View>
            {previewUri ? (
              <Image
                source={{ uri: previewUri }}
                style={styles.previewImage}
                resizeMode="contain"
              />
            ) : null}
            <Text style={styles.previewHint}>Toque fora ou em ✕ para fechar</Text>
          </View>
        </View>
      </Modal>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F1F5F9" },
  container: { flex: 1 },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
  },
  headerIconBtnPressed: { backgroundColor: "#E2E8F0" },
  headerCenter: { flex: 1 },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 1,
  },
  countChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#DBEAFE",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  countChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1E40AF",
  },

  // ── Busy ────────────────────────────────────────────────────────────────
  busyBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#2563EB",
    paddingVertical: 10,
  },
  busyBannerText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 13,
  },

  // ── Hint ────────────────────────────────────────────────────────────────
  hintBar: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  hintText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: "#1E40AF",
  },

  // ── List ────────────────────────────────────────────────────────────────
  list: { flex: 1 },
  listContent: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },

  // ── Card ────────────────────────────────────────────────────────────────
  card: {
    marginBottom: 14,
    borderRadius: 16,
    backgroundColor: "#fff",
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardActive: {
    borderColor: "#3B82F6",
    backgroundColor: "#F8FAFF",
    shadowOpacity: 0.12,
    elevation: 6,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  orderBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  orderBadgeText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 13,
  },
  folhaLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: "#1E293B",
  },
  dragPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F1F5F9",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  dragPillPressed: { backgroundColor: "#E2E8F0" },
  dragPillActive: {
    backgroundColor: "#DBEAFE",
    borderColor: "#93C5FD",
  },
  dragPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
  },
  dragPillTextActive: { color: "#1D4ED8" },

  // ── Thumb ───────────────────────────────────────────────────────────────
  thumbWrap: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#E2E8F0",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  thumb: {
    width: "100%",
    height: 200,
  },
  thumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    alignItems: "flex-end",
    padding: 8,
    backgroundColor: "transparent",
  },
  zoomChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(15, 23, 42, 0.62)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  zoomChipText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },

  // ── Actions ─────────────────────────────────────────────────────────────
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingVertical: 8,
    borderWidth: 1,
  },
  actionPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  actionDanger: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  actionPrimary: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
  },
  actionInsert: {
    backgroundColor: "#F0FDFA",
    borderColor: "#99F6E4",
  },
  actionDangerText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#DC2626",
  },
  actionPrimaryText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2563EB",
  },
  actionInsertText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0F766E",
  },

  // ── Empty ───────────────────────────────────────────────────────────────
  emptyBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#334155",
    marginBottom: 6,
  },
  emptyText: {
    textAlign: "center",
    color: "#94A3B8",
    fontSize: 13,
    lineHeight: 19,
  },

  // ── Footer ──────────────────────────────────────────────────────────────
  footer: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  btnCancel: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    paddingVertical: 15,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  btnCancelPressed: { backgroundColor: "#E2E8F0" },
  btnCancelText: {
    fontWeight: "700",
    color: "#475569",
    fontSize: 15,
  },
  btnConfirm: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 15,
    backgroundColor: "#16A34A",
  },
  btnConfirmPressed: { backgroundColor: "#15803D" },
  btnConfirmText: {
    fontWeight: "800",
    color: "#fff",
    fontSize: 15,
  },
  btnDisabled: { opacity: 0.45 },

  // ── Preview ─────────────────────────────────────────────────────────────
  previewRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  previewBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.72)",
  },
  previewSheet: {
    backgroundColor: "#0F172A",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    maxHeight: SCREEN_H * 0.92,
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  previewTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
  previewClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  previewImage: {
    width: SCREEN_W,
    height: SCREEN_H * 0.68,
    backgroundColor: "#1E293B",
  },
  previewHint: {
    textAlign: "center",
    color: "#94A3B8",
    fontSize: 12,
    marginTop: 10,
  },
});
