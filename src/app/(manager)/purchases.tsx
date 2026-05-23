import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { AppScreen } from '@/components/AppScreen';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { ListItem } from '@/components/ListItem';
import { MetricCard } from '@/components/MetricCard';
import { SectionHeader } from '@/components/SectionHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { theme } from '@/constants/theme';
import { verifyPurchaseOrder } from '@/services/purchase.service';
import { getPurchaseOrders, upsertPurchaseOrder } from '@/services/storage.service';
import { PurchaseOrder, PurchaseStatus } from '@/types';
import { displayDate } from '@/utils/date';
import { formatCurrency } from '@/utils/format';

type FilterTab = 'pending' | 'flagged' | 'verified' | 'all';

const STATUS_TONE: Record<PurchaseStatus, 'red' | 'amber' | 'green' | 'blue'> = {
  pending: 'amber',
  submitted: 'blue',
  verified: 'green',
  flagged: 'red',
  received: 'green',
};

export default function ManagerPurchasesScreen() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [filter, setFilter] = useState<FilterTab>('pending');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setOrders(await getPurchaseOrders());
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const filtered = orders.filter((o) => {
    if (filter === 'pending') return o.status === 'pending' || o.status === 'submitted';
    if (filter === 'flagged') return o.status === 'flagged';
    if (filter === 'verified') return o.status === 'verified';
    return true;
  });

  const pendingCount = orders.filter((o) => o.status === 'pending' || o.status === 'submitted').length;
  const flaggedCount = orders.filter((o) => o.status === 'flagged').length;

  const handleApprove = async (order: PurchaseOrder) => {
    const updated = verifyPurchaseOrder(order, 'manager-1', true, 'Prices verified and approved.');
    await upsertPurchaseOrder(updated);
    await load();
    Alert.alert('Approved', 'Purchase order has been verified.');
  };

  const handleReject = async (order: PurchaseOrder) => {
    Alert.prompt('Rejection reason', 'Note for the bozorchi:', async (note) => {
      const updated = verifyPurchaseOrder(order, 'manager-1', false, note ?? 'Rejected by manager.');
      await upsertPurchaseOrder(updated);
      await load();
    }, 'plain-text', 'Price discrepancy detected.');
  };

  return (
    <AppScreen
      title="Purchase Orders"
      subtitle="Verify receipts and validate pricing"
      loading={loading}
      onRefresh={load}>

      <View style={styles.metricRow}>
        <MetricCard label="To verify" value={String(pendingCount)} detail="Awaiting review" tone={pendingCount > 0 ? 'amber' : 'green'} />
        <MetricCard label="Flagged" value={String(flaggedCount)} detail="Price issues" tone={flaggedCount > 0 ? 'red' : 'green'} />
      </View>

      <View style={styles.tabs}>
        {([['pending', 'Pending'], ['flagged', 'Flagged'], ['verified', 'Verified'], ['all', 'All']] as [FilterTab, string][]).map(([t, label]) => (
          <Pressable key={t} style={[styles.tab, filter === t && styles.tabActive]} onPress={() => setFilter(t)}>
            <Text style={[styles.tabText, filter === t && styles.tabTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {filtered.length === 0 ? (
        <EmptyState title="No orders" message="No purchase orders in this category." icon="receipt-outline" />
      ) : (
        filtered.map((order) => {
          const flaggedItems = order.items.filter((i) => i.flagged);
          const isExpanded = expanded === order.id;
          return (
            <Card key={order.id} style={styles.orderCard}>
              <Pressable onPress={() => setExpanded(isExpanded ? null : order.id)}>
                <View style={styles.orderHeader}>
                  <View style={styles.orderInfo}>
                    <Text style={styles.orderDate}>{displayDate(order.date)}</Text>
                    <Text style={styles.orderSub}>
                      {order.items.length} items · by {order.submittedBy}
                    </Text>
                  </View>
                  <View style={styles.orderRight}>
                    <StatusBadge label={order.status} tone={STATUS_TONE[order.status]} />
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={theme.colors.muted}
                    />
                  </View>
                </View>

                <View style={styles.costSummary}>
                  <View>
                    <Text style={styles.costLabel}>Planned</Text>
                    <Text style={styles.costValue}>{formatCurrency(order.totalPlannedCost)}</Text>
                  </View>
                  <View>
                    <Text style={styles.costLabel}>Actual</Text>
                    <Text style={[styles.costValue, flaggedItems.length > 0 && { color: theme.colors.red }]}>
                      {formatCurrency(order.totalActualCost)}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.costLabel}>Variance</Text>
                    <Text style={[styles.costValue, { color: order.overallVariancePercent > 15 ? theme.colors.red : order.overallVariancePercent > 5 ? theme.colors.amber : theme.colors.green }]}>
                      {order.overallVariancePercent > 0 ? '+' : ''}{order.overallVariancePercent.toFixed(1)}%
                    </Text>
                  </View>
                </View>
              </Pressable>

              {isExpanded && (
                <>
                  <View style={styles.divider} />
                  {order.items.map((item) => (
                    <ListItem
                      key={item.itemId}
                      title={item.name}
                      subtitle={
                        item.flagged
                          ? item.flagReason
                          : `Planned ${formatCurrency(item.plannedUnitPrice)}/${item.unit}`
                      }
                      right={
                        <View style={styles.itemRight}>
                          <Text style={styles.itemPrice}>{formatCurrency(item.actualUnitPrice)}/{item.unit}</Text>
                          {Math.abs(item.priceVariancePercent) >= 5 ? (
                            <StatusBadge
                              label={`${item.priceVariancePercent > 0 ? '+' : ''}${item.priceVariancePercent.toFixed(1)}%`}
                              tone={item.flagged ? 'red' : 'amber'}
                            />
                          ) : null}
                        </View>
                      }
                    />
                  ))}

                  {order.reviewNote ? (
                    <View style={styles.noteBox}>
                      <Text style={styles.noteText}>{order.reviewNote}</Text>
                    </View>
                  ) : null}

                  {(order.status === 'submitted' || order.status === 'flagged' || order.status === 'pending') && (
                    <View style={styles.actionRow}>
                      <Pressable style={[styles.actionBtn, styles.approveBtn]} onPress={() => void handleApprove(order)}>
                        <Ionicons name="checkmark-outline" size={16} color={theme.colors.green} />
                        <Text style={[styles.actionBtnText, { color: theme.colors.green }]}>Approve</Text>
                      </Pressable>
                      <Pressable style={[styles.actionBtn, styles.rejectBtn]} onPress={() => void handleReject(order)}>
                        <Ionicons name="close-outline" size={16} color={theme.colors.red} />
                        <Text style={[styles.actionBtnText, { color: theme.colors.red }]}>Flag</Text>
                      </Pressable>
                    </View>
                  )}
                </>
              )}
            </Card>
          );
        })
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  metricRow: { flexDirection: 'row', gap: theme.spacing.md },
  tabs: { flexDirection: 'row', backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.sm, padding: 4, gap: 3 },
  tab: { flex: 1, paddingVertical: 7, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: theme.colors.surface, ...theme.shadow },
  tabText: { color: theme.colors.muted, fontFamily: theme.font, fontSize: 12, fontWeight: '600' },
  tabTextActive: { color: theme.colors.text },
  orderCard: { gap: theme.spacing.sm },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  orderInfo: { flex: 1 },
  orderDate: { color: theme.colors.text, fontFamily: theme.font, fontSize: 16, fontWeight: '700' },
  orderSub: { color: theme.colors.muted, fontFamily: theme.font, fontSize: 13, marginTop: 2 },
  orderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  costSummary: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8 },
  costLabel: { color: theme.colors.muted, fontFamily: theme.font, fontSize: 12 },
  costValue: { color: theme.colors.text, fontFamily: theme.font, fontSize: 15, fontWeight: '700', marginTop: 2 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.line },
  itemRight: { alignItems: 'flex-end', gap: 4 },
  itemPrice: { color: theme.colors.text, fontFamily: theme.font, fontSize: 13, fontWeight: '600' },
  noteBox: { padding: theme.spacing.sm, borderRadius: 10, backgroundColor: theme.colors.surfaceAlt },
  noteText: { color: theme.colors.muted, fontFamily: theme.font, fontSize: 13 },
  actionRow: { flexDirection: 'row', gap: theme.spacing.sm },
  actionBtn: { flex: 1, height: 42, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  approveBtn: { backgroundColor: theme.colors.green + '18' },
  rejectBtn: { backgroundColor: theme.colors.red + '18' },
  actionBtnText: { fontFamily: theme.font, fontSize: 14, fontWeight: '700' },
});
