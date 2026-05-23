import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';

import { AppScreen } from '@/components/AppScreen';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { ListItem } from '@/components/ListItem';
import { SectionHeader } from '@/components/SectionHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { theme } from '@/constants/theme';
import { logout } from '@/services/auth.service';
import { buildPurchaseOrderFromPlan } from '@/services/purchase.service';
import {
  getDailyPlan,
  getInventory,
  getPurchaseOrders,
  upsertDailyPlan,
  upsertPurchaseOrder,
} from '@/services/storage.service';
import { DailyPlan, InventoryItem, PurchaseOrder, ShoppingItem } from '@/types';
import { todayKey } from '@/utils/date';
import { formatCurrency } from '@/utils/format';

export default function BozorchiShoppingList() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [existingOrder, setExistingOrder] = useState<PurchaseOrder | null>(null);
  const [lowStockItems, setLowStockItems] = useState<InventoryItem[]>([]);

  const load = useCallback(async () => {
    const [todayPlan, orders, inventory] = await Promise.all([
      getDailyPlan(todayKey()),
      getPurchaseOrders(),
      getInventory(),
    ]);
    setPlan(todayPlan);
    setExistingOrder(orders.find((o) => o.date === todayKey()) ?? null);
    setLowStockItems(inventory.filter((i) => i.currentStock <= i.minimumStock));
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const handleCheck = async (itemId: string, checked: boolean) => {
    if (!plan) return;
    const updated: DailyPlan = {
      ...plan,
      shoppingList: plan.shoppingList.map((item) =>
        item.itemId === itemId ? { ...item, purchased: checked } : item,
      ),
    };
    await upsertDailyPlan(updated);
    setPlan(updated);
  };

  const handleCreateOrder = async () => {
    if (!plan) return;
    const order = buildPurchaseOrderFromPlan(plan, 'bozorchi-1');
    await upsertPurchaseOrder(order);
    setExistingOrder(order);
    Alert.alert('Order created', 'Go to Submit tab to enter actual prices and submit receipts.');
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/login' as any);
  };

  const totalEstimatedCost = plan?.shoppingList.reduce((s, i) => s + i.estimatedCost, 0) ?? 0;
  const purchasedCount = plan?.shoppingList.filter((i) => i.purchased).length ?? 0;
  const totalItems = plan?.shoppingList.length ?? 0;
  const allDone = purchasedCount === totalItems && totalItems > 0;

  return (
    <AppScreen
      title="Shopping List"
      subtitle={`Today · ${todayKey()}`}
      loading={loading}
      onRefresh={load}
      right={
        <Pressable style={styles.logoutBtn} onPress={() => void handleLogout()}>
          <Ionicons name="log-out-outline" size={20} color={theme.colors.muted} />
        </Pressable>
      }>

      {lowStockItems.length > 0 ? (
        <View style={styles.stockAlert}>
          <Ionicons name="alert-circle-outline" size={16} color={theme.colors.red} />
          <Text style={styles.stockAlertText}>
            {lowStockItems.length} warehouse item(s) below minimum — manager notified.{' '}
            {lowStockItems.map((i) => `${i.name} (${i.currentStock} ${i.unit})`).join(', ')}
          </Text>
        </View>
      ) : null}

      {!plan ? (
        <EmptyState
          title="No plan today"
          message="Contact your manager to generate today's shopping plan."
          icon="cart-outline"
        />
      ) : (
        <>
          <Card style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View>
                <Text style={styles.summaryTitle}>Total estimated</Text>
                <Text style={styles.summaryValue}>{formatCurrency(totalEstimatedCost)}</Text>
              </View>
              <View style={styles.progressBox}>
                <Text style={styles.progressText}>{purchasedCount}/{totalItems}</Text>
                <Text style={styles.progressLabel}>items done</Text>
              </View>
            </View>
            {plan.plannedCookKg > 0 ? (
              <View style={styles.cookInfo}>
                <Ionicons name="restaurant-outline" size={14} color={theme.colors.muted} />
                <Text style={styles.cookInfoText}>
                  Cook target: {plan.plannedCookKg} kg · Forecast: {plan.forecastKg} kg
                </Text>
              </View>
            ) : null}
            {plan.holidayName ? (
              <View style={[styles.cookInfo, { backgroundColor: theme.colors.blue + '18', borderRadius: 8, padding: 8, marginTop: 4 }]}>
                <Ionicons name="star-outline" size={14} color={theme.colors.blue} />
                <Text style={[styles.cookInfoText, { color: theme.colors.blue }]}>
                  {plan.holidayName} — expect higher demand
                </Text>
              </View>
            ) : null}
          </Card>

          <SectionHeader title="Items to purchase" />
          <Card>
            {plan.shoppingList.map((item) => (
              <Pressable key={item.itemId} onPress={() => void handleCheck(item.itemId, !item.purchased)}>
                <ListItem
                  title={item.name}
                  subtitle={`Est. ${formatCurrency(item.estimatedUnitPrice)}/${item.unit}`}
                  right={
                    <View style={styles.itemRight}>
                      <Text style={styles.itemQty}>{item.quantity} {item.unit}</Text>
                      <View style={[styles.checkbox, item.purchased && styles.checkboxDone]}>
                        {item.purchased ? (
                          <Ionicons name="checkmark" size={14} color={theme.colors.surface} />
                        ) : null}
                      </View>
                    </View>
                  }
                />
              </Pressable>
            ))}
          </Card>

          {existingOrder ? (
            <Card style={styles.orderStatus}>
              <View style={styles.orderStatusRow}>
                <Text style={styles.orderStatusText}>Order created</Text>
                <StatusBadge
                  label={existingOrder.status}
                  tone={existingOrder.status === 'flagged' ? 'red' : existingOrder.status === 'verified' ? 'green' : 'amber'}
                />
              </View>
              <Text style={styles.orderStatusSub}>
                Go to Submit tab to enter actual prices and submit receipts.
              </Text>
            </Card>
          ) : (
            <Pressable
              style={[styles.createOrderBtn, !allDone && styles.createOrderBtnDisabled]}
              onPress={() => void handleCreateOrder()}>
              <Ionicons name="checkmark-circle-outline" size={20} color={allDone ? theme.colors.surface : theme.colors.subtle} />
              <Text style={[styles.createOrderBtnText, !allDone && { color: theme.colors.subtle }]}>
                {allDone ? 'Create purchase order' : `Mark all items (${totalItems - purchasedCount} remaining)`}
              </Text>
            </Pressable>
          )}
        </>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  logoutBtn: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.line },
  summaryCard: { gap: theme.spacing.sm },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  summaryTitle: { color: theme.colors.muted, fontFamily: theme.font, fontSize: 13 },
  summaryValue: { color: theme.colors.text, fontFamily: theme.font, fontSize: 24, fontWeight: '800', marginTop: 2 },
  progressBox: { alignItems: 'flex-end' },
  progressText: { color: theme.colors.text, fontFamily: theme.font, fontSize: 20, fontWeight: '700' },
  progressLabel: { color: theme.colors.muted, fontFamily: theme.font, fontSize: 12, marginTop: 2 },
  cookInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cookInfoText: { color: theme.colors.muted, fontFamily: theme.font, fontSize: 13, flex: 1 },
  itemRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemQty: { color: theme.colors.text, fontFamily: theme.font, fontSize: 14, fontWeight: '700' },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: theme.colors.line, alignItems: 'center', justifyContent: 'center' },
  checkboxDone: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  orderStatus: { gap: 6 },
  orderStatusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderStatusText: { color: theme.colors.text, fontFamily: theme.font, fontSize: 16, fontWeight: '700' },
  orderStatusSub: { color: theme.colors.muted, fontFamily: theme.font, fontSize: 13, lineHeight: 18 },
  createOrderBtn: { height: 54, borderRadius: 17, backgroundColor: theme.colors.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  createOrderBtnDisabled: { backgroundColor: theme.colors.surfaceAlt },
  createOrderBtnText: { color: theme.colors.surface, fontFamily: theme.font, fontSize: 16, fontWeight: '700' },
  stockAlert: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: theme.colors.red + '10', borderRadius: theme.radius.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.red + '40', padding: theme.spacing.md },
  stockAlertText: { flex: 1, color: theme.colors.text, fontFamily: theme.font, fontSize: 13, lineHeight: 18 },
});
