import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { AppScreen } from '@/components/AppScreen';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { NumberInput } from '@/components/NumberInput';
import { SectionHeader } from '@/components/SectionHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { theme } from '@/constants/theme';
import { extractPriceRecords, submitPurchaseOrder } from '@/services/purchase.service';
import {
  addPriceRecords,
  getInventory,
  getPurchaseOrders,
  upsertPurchaseOrder,
} from '@/services/storage.service';
import { InventoryItem, PurchaseOrder } from '@/types';
import { displayDate, todayKey } from '@/utils/date';
import { formatCurrency } from '@/utils/format';

export default function BozorchiSubmitScreen() {
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [actualPrices, setActualPrices] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const [orders, inv] = await Promise.all([getPurchaseOrders(), getInventory()]);
    const todayOrder = orders.find((o) => o.date === todayKey() && o.status !== 'verified');
    setOrder(todayOrder ?? null);
    setInventory(inv);
    if (todayOrder) {
      const prices: Record<string, string> = {};
      for (const item of todayOrder.items) {
        prices[item.itemId] = String(item.actualUnitPrice || item.plannedUnitPrice);
      }
      setActualPrices(prices);
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const handleSubmit = async () => {
    if (!order) return;
    const actualItems = order.items.map((item) => ({
      itemId: item.itemId,
      actualQty: item.plannedQty,
      actualUnitPrice: Number(actualPrices[item.itemId] ?? item.plannedUnitPrice),
    }));
    const updated = submitPurchaseOrder(order, actualItems, 'bozorchi-1');
    const priceRecs = extractPriceRecords(updated, inventory);
    await Promise.all([
      upsertPurchaseOrder(updated),
      addPriceRecords(priceRecs),
    ]);
    setOrder(updated);
    Alert.alert(
      updated.status === 'flagged' ? 'Submitted with flags' : 'Submitted!',
      updated.status === 'flagged'
        ? 'Some prices exceeded expected ranges. Manager will review.'
        : 'Receipt submitted. Manager will verify the prices.',
    );
  };

  if (!order) {
    return (
      <AppScreen title="Submit Receipt" subtitle="Submit actual purchase prices for today" loading={loading}>
        <EmptyState
          title="No order today"
          message="Go to Shopping List, check off all items, then tap Create Purchase Order."
          icon="receipt-outline"
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen
      title="Submit Receipt"
      subtitle={`Today's purchase · ${displayDate(order.date)}`}
      loading={loading}
      onRefresh={load}>

      <Card style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View>
            <Text style={styles.summaryLabel}>Planned budget</Text>
            <Text style={styles.summaryValue}>{formatCurrency(order.totalPlannedCost)}</Text>
          </View>
          <StatusBadge
            label={order.status === 'pending' ? 'Draft' : order.status === 'submitted' ? 'Submitted' : order.status}
            tone={order.status === 'flagged' ? 'red' : order.status === 'verified' ? 'green' : 'amber'}
          />
        </View>
        <Text style={styles.summaryHint}>
          Enter the actual prices from your receipt for each ingredient.
        </Text>
      </Card>

      <SectionHeader title="Actual prices (per unit)" />
      <Card style={styles.formCard}>
        {order.items.map((item) => (
          <View key={item.itemId} style={styles.itemBlock}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemPlanned}>
              Planned {formatCurrency(item.plannedUnitPrice)}/{item.unit} · qty {item.plannedQty} {item.unit}
            </Text>
            <NumberInput
              label={`Actual price per ${item.unit}`}
              suffix="UZS"
              value={actualPrices[item.itemId] ?? ''}
              onChangeText={(v) => setActualPrices((c) => ({ ...c, [item.itemId]: v }))}
            />
          </View>
        ))}
      </Card>

      {(order.status === 'pending' || order.status === 'submitted' || order.status === 'flagged') && (
        <Pressable style={styles.submitBtn} onPress={() => void handleSubmit()}>
          <Ionicons name="cloud-upload-outline" size={20} color={theme.colors.surface} />
          <Text style={styles.submitBtnText}>Submit receipt</Text>
        </Pressable>
      )}

      {order.status === 'verified' && (
        <Card style={styles.verifiedCard}>
          <Ionicons name="checkmark-circle" size={24} color={theme.colors.green} />
          <View style={{ flex: 1 }}>
            <Text style={styles.verifiedText}>Verified by manager.</Text>
            {order.reviewNote ? <Text style={styles.verifiedNote}>{order.reviewNote}</Text> : null}
          </View>
        </Card>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  summaryCard: { gap: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  summaryLabel: { color: theme.colors.muted, fontFamily: theme.font, fontSize: 13 },
  summaryValue: { color: theme.colors.text, fontFamily: theme.font, fontSize: 22, fontWeight: '800', marginTop: 2 },
  summaryHint: { color: theme.colors.muted, fontFamily: theme.font, fontSize: 13, lineHeight: 18 },
  formCard: { gap: theme.spacing.lg },
  itemBlock: { gap: 4 },
  itemName: { color: theme.colors.text, fontFamily: theme.font, fontSize: 15, fontWeight: '700' },
  itemPlanned: { color: theme.colors.muted, fontFamily: theme.font, fontSize: 13, marginBottom: 4 },
  submitBtn: { height: 54, borderRadius: 17, backgroundColor: theme.colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  submitBtnText: { color: theme.colors.surface, fontFamily: theme.font, fontSize: 16, fontWeight: '700' },
  verifiedCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: theme.spacing.md },
  verifiedText: { color: theme.colors.green, fontFamily: theme.font, fontSize: 14, fontWeight: '600' },
  verifiedNote: { color: theme.colors.muted, fontFamily: theme.font, fontSize: 13, marginTop: 2 },
});
