import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { AppScreen } from '@/components/AppScreen';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { ListItem } from '@/components/ListItem';
import { SectionHeader } from '@/components/SectionHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { theme } from '@/constants/theme';
import {
  getInventory,
  getPurchaseOrders,
  updateInventory,
  upsertPurchaseOrder,
} from '@/services/storage.service';
import { InventoryItem, PurchaseOrder, PurchaseOrderItem } from '@/types';
import { displayDate } from '@/utils/date';
import { formatCurrency } from '@/utils/format';

const BROWN = '#7C5C3E';

interface ReceivedDraft {
  itemId: string;
  receivedQty: string;
}

export default function DeliveriesScreen() {
  const [loading, setLoading] = useState(true);
  const [pendingOrders, setPendingOrders] = useState<PurchaseOrder[]>([]);
  const [doneOrders, setDoneOrders] = useState<PurchaseOrder[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [reviewing, setReviewing] = useState<PurchaseOrder | null>(null);
  const [draft, setDraft] = useState<ReceivedDraft[]>([]);
  const [warehouseNote, setWarehouseNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [orders, inv] = await Promise.all([getPurchaseOrders(), getInventory()]);
    // Pending = submitted or flagged orders not yet accepted by warehouse
    setPendingOrders(orders.filter((o) => o.status === 'submitted' || o.status === 'flagged'));
    setDoneOrders(orders.filter((o) => o.status === 'received' || o.status === 'verified'));
    setInventory(inv);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const openReview = (order: PurchaseOrder) => {
    setReviewing(order);
    // Pre-fill received qty with bozorchi's actual qty
    setDraft(
      order.items.map((item) => ({
        itemId: item.itemId,
        receivedQty: String(item.actualQty),
      })),
    );
    setWarehouseNote('');
  };

  const updateDraft = (itemId: string, value: string) => {
    setDraft((prev) =>
      prev.map((d) => (d.itemId === itemId ? { ...d, receivedQty: value } : d)),
    );
  };

  const handleAccept = async () => {
    if (!reviewing) return;
    setSaving(true);

    const updatedItems: PurchaseOrderItem[] = reviewing.items.map((item) => {
      const d = draft.find((x) => x.itemId === item.itemId);
      return { ...item, receivedQty: parseFloat(d?.receivedQty ?? '0') || 0 };
    });

    const accepted: PurchaseOrder = {
      ...reviewing,
      items: updatedItems,
      status: 'received',
      warehouseAcceptedBy: 'warehouseman-1',
      warehouseAcceptedAt: new Date().toISOString(),
      warehouseNote: warehouseNote.trim(),
    };

    // Update stock: add receivedQty to each inventory item
    const updatedInventory = inventory.map((inv) => {
      const item = updatedItems.find((i) => i.itemId === inv.id);
      if (!item || item.receivedQty === 0) return inv;
      return {
        ...inv,
        currentStock: Math.round((inv.currentStock + item.receivedQty) * 100) / 100,
      };
    });

    await Promise.all([upsertPurchaseOrder(accepted), updateInventory(updatedInventory)]);

    setInventory(updatedInventory);
    setReviewing(null);
    await load();

    const shortages = updatedItems.filter((i) => i.receivedQty < i.actualQty);
    Alert.alert(
      'Delivery accepted',
      shortages.length > 0
        ? `Stock updated. ${shortages.length} item(s) received less than purchased — manager can review.`
        : 'All items received. Stock levels updated.',
    );
    setSaving(false);
  };

  if (reviewing) {
    return (
      <View style={styles.fullScreen}>
        <View style={styles.reviewHeader}>
          <Pressable onPress={() => setReviewing(null)} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={20} color={theme.colors.muted} />
            <Text style={styles.backText}>Cancel</Text>
          </Pressable>
          <Text style={styles.reviewTitle}>{displayDate(reviewing.date)}</Text>
          <Pressable
            style={[styles.acceptBtn, saving && { opacity: 0.5 }]}
            onPress={() => void handleAccept()}
            disabled={saving}>
            <Text style={styles.acceptBtnText}>{saving ? 'Saving…' : 'Accept'}</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.reviewContent}>
          <Card style={styles.orderSummary}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Submitted by bozorchi</Text>
              <StatusBadge
                label={reviewing.status === 'flagged' ? 'Flagged' : 'Submitted'}
                tone={reviewing.status === 'flagged' ? 'red' : 'amber'}
              />
            </View>
            <Text style={styles.summaryValue}>{formatCurrency(reviewing.totalActualCost)}</Text>
            <Text style={styles.summaryHint}>
              Check each item below. The quantity from bozorchi is pre-filled.
              Adjust the received quantity if anything is missing or short.
            </Text>
          </Card>

          <Text style={styles.sectionLabel}>Items to check</Text>

          {reviewing.items.map((item) => {
            const d = draft.find((x) => x.itemId === item.itemId);
            const received = parseFloat(d?.receivedQty ?? '0') || 0;
            const shortage = received < item.actualQty;
            return (
              <View key={item.itemId} style={styles.itemCard}>
                <View style={styles.itemCardHeader}>
                  <Text style={styles.itemCardName}>{item.name}</Text>
                  {item.flagged ? (
                    <StatusBadge label="Price flagged" tone="red" />
                  ) : null}
                </View>
                <View style={styles.itemQtyRow}>
                  <View style={styles.qtyInfo}>
                    <Text style={styles.qtyInfoLabel}>Planned</Text>
                    <Text style={styles.qtyInfoValue}>
                      {item.plannedQty} {item.unit}
                    </Text>
                  </View>
                  <View style={styles.qtyInfo}>
                    <Text style={styles.qtyInfoLabel}>Purchased</Text>
                    <Text style={styles.qtyInfoValue}>
                      {item.actualQty} {item.unit}
                    </Text>
                  </View>
                  <View style={styles.qtyInputWrap}>
                    <Text style={styles.qtyInfoLabel}>Received</Text>
                    <TextInput
                      style={[styles.qtyInput, shortage && styles.qtyInputShort]}
                      value={d?.receivedQty ?? ''}
                      onChangeText={(v) => updateDraft(item.itemId, v)}
                      keyboardType="numeric"
                      placeholder={String(item.actualQty)}
                      placeholderTextColor={theme.colors.subtle}
                    />
                  </View>
                </View>
                {shortage && (
                  <Text style={styles.shortageWarning}>
                    ⚠ Short by {(item.actualQty - received).toFixed(2)} {item.unit}
                  </Text>
                )}
              </View>
            );
          })}

          <Text style={styles.sectionLabel}>Warehouse note (optional)</Text>
          <TextInput
            style={styles.noteInput}
            value={warehouseNote}
            onChangeText={setWarehouseNote}
            placeholder="Any remarks about the delivery..."
            placeholderTextColor={theme.colors.subtle}
            multiline
          />

          <Pressable
            style={[styles.acceptBtnLarge, saving && { opacity: 0.5 }]}
            onPress={() => void handleAccept()}
            disabled={saving}>
            <Ionicons name="checkmark-circle-outline" size={22} color="#fff" />
            <Text style={styles.acceptBtnLargeText}>
              {saving ? 'Saving…' : 'Accept & Update Stock'}
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <AppScreen
      title="Deliveries"
      subtitle="Accept bozorchi purchases"
      loading={loading}
      onRefresh={load}>

      {pendingOrders.length === 0 && doneOrders.length === 0 ? (
        <EmptyState
          title="No purchases yet"
          message="When bozorchi submits a purchase receipt, it will appear here for you to accept."
          icon="arrow-down-circle-outline"
        />
      ) : null}

      {pendingOrders.length > 0 && (
        <>
          <SectionHeader title={`Waiting for acceptance (${pendingOrders.length})`} />
          {pendingOrders.map((order) => (
            <Pressable key={order.id} onPress={() => openReview(order)}>
              <Card style={styles.orderCard}>
                <View style={styles.orderCardRow}>
                  <View style={styles.orderCardInfo}>
                    <Text style={styles.orderDate}>{displayDate(order.date)}</Text>
                    <Text style={styles.orderItems}>
                      {order.items.length} item(s) · {formatCurrency(order.totalActualCost)}
                    </Text>
                    {order.status === 'flagged' && (
                      <Text style={styles.flaggedNote}>
                        {order.items.filter((i) => i.flagged).length} price(s) flagged by manager
                      </Text>
                    )}
                  </View>
                  <View style={styles.orderCardRight}>
                    <StatusBadge
                      label={order.status === 'flagged' ? 'Flagged' : 'Pending'}
                      tone={order.status === 'flagged' ? 'red' : 'amber'}
                    />
                    <Ionicons name="chevron-forward" size={16} color={theme.colors.subtle} style={{ marginTop: 4 }} />
                  </View>
                </View>
              </Card>
            </Pressable>
          ))}
        </>
      )}

      {doneOrders.length > 0 && (
        <>
          <SectionHeader title="Accepted" />
          {doneOrders.map((order) => {
            const shortages = order.items.filter((i) => i.receivedQty < i.actualQty);
            return (
              <Card key={order.id} style={styles.doneCard}>
                <View style={styles.orderCardRow}>
                  <View style={styles.orderCardInfo}>
                    <Text style={styles.orderDate}>{displayDate(order.date)}</Text>
                    <Text style={styles.orderItems}>
                      {order.items.length} item(s) · {formatCurrency(order.totalActualCost)}
                    </Text>
                    {shortages.length > 0 && (
                      <Text style={styles.flaggedNote}>
                        {shortages.length} item(s) received short
                      </Text>
                    )}
                    {order.warehouseNote ? (
                      <Text style={styles.warehouseNote}>Note: {order.warehouseNote}</Text>
                    ) : null}
                  </View>
                  <StatusBadge label="Received" tone="green" />
                </View>
                <View style={styles.itemsDetail}>
                  {order.items.map((item) => (
                    <View key={item.itemId} style={styles.itemDetailRow}>
                      <Text style={styles.itemDetailName}>{item.name}</Text>
                      <Text style={[
                        styles.itemDetailQty,
                        item.receivedQty < item.actualQty ? { color: theme.colors.amber } : { color: theme.colors.green },
                      ]}>
                        {item.receivedQty} / {item.actualQty} {item.unit}
                      </Text>
                    </View>
                  ))}
                </View>
              </Card>
            );
          })}
        </>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  fullScreen: { flex: 1, backgroundColor: theme.colors.background },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 60,
    paddingBottom: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.line,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, minWidth: 70 },
  backText: { color: theme.colors.muted, fontFamily: theme.font, fontSize: 15 },
  reviewTitle: { color: theme.colors.text, fontFamily: theme.font, fontSize: 17, fontWeight: '700' },
  acceptBtn: { backgroundColor: BROWN, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7, minWidth: 70, alignItems: 'center' },
  acceptBtnText: { color: '#fff', fontFamily: theme.font, fontSize: 15, fontWeight: '700' },
  reviewContent: { padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: 60 },
  orderSummary: { gap: theme.spacing.sm },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { color: theme.colors.muted, fontFamily: theme.font, fontSize: 13 },
  summaryValue: { color: theme.colors.text, fontFamily: theme.font, fontSize: 24, fontWeight: '800' },
  summaryHint: { color: theme.colors.muted, fontFamily: theme.font, fontSize: 13, lineHeight: 18 },
  sectionLabel: { color: theme.colors.muted, fontFamily: theme.font, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  itemCard: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.line, padding: theme.spacing.md, gap: theme.spacing.sm },
  itemCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemCardName: { color: theme.colors.text, fontFamily: theme.font, fontSize: 15, fontWeight: '700' },
  itemQtyRow: { flexDirection: 'row', gap: theme.spacing.sm },
  qtyInfo: { flex: 1, gap: 2 },
  qtyInfoLabel: { color: theme.colors.muted, fontFamily: theme.font, fontSize: 11, fontWeight: '600' },
  qtyInfoValue: { color: theme.colors.text, fontFamily: theme.font, fontSize: 15, fontWeight: '600' },
  qtyInputWrap: { flex: 1, gap: 2 },
  qtyInput: { backgroundColor: theme.colors.surfaceAlt, borderRadius: 8, borderWidth: 1.5, borderColor: theme.colors.line, padding: theme.spacing.sm, fontFamily: theme.font, fontSize: 16, color: theme.colors.text, textAlign: 'center' },
  qtyInputShort: { borderColor: theme.colors.amber, backgroundColor: theme.colors.amber + '15' },
  shortageWarning: { color: theme.colors.amber, fontFamily: theme.font, fontSize: 13, fontWeight: '600' },
  noteInput: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.line, padding: theme.spacing.md, fontFamily: theme.font, fontSize: 15, color: theme.colors.text, minHeight: 72, textAlignVertical: 'top' },
  acceptBtnLarge: { height: 56, borderRadius: 17, backgroundColor: BROWN, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  acceptBtnLargeText: { color: '#fff', fontFamily: theme.font, fontSize: 17, fontWeight: '700' },
  orderCard: { gap: theme.spacing.xs },
  orderCardRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  orderCardInfo: { flex: 1, gap: 3 },
  orderDate: { color: theme.colors.text, fontFamily: theme.font, fontSize: 16, fontWeight: '700' },
  orderItems: { color: theme.colors.muted, fontFamily: theme.font, fontSize: 13 },
  flaggedNote: { color: theme.colors.red, fontFamily: theme.font, fontSize: 12, fontWeight: '600' },
  orderCardRight: { alignItems: 'flex-end' },
  doneCard: { gap: theme.spacing.sm },
  warehouseNote: { color: theme.colors.muted, fontFamily: theme.font, fontSize: 12, fontStyle: 'italic' },
  itemsDetail: { gap: 4, borderTopWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.line, paddingTop: theme.spacing.sm },
  itemDetailRow: { flexDirection: 'row', justifyContent: 'space-between' },
  itemDetailName: { color: theme.colors.text, fontFamily: theme.font, fontSize: 13 },
  itemDetailQty: { fontFamily: theme.font, fontSize: 13, fontWeight: '600' },
});
