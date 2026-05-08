import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { AppScreen } from '@/components/AppScreen';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { ListItem } from '@/components/ListItem';
import { MetricCard } from '@/components/MetricCard';
import { SectionHeader } from '@/components/SectionHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { theme } from '@/constants/theme';
import { computeSupplierPerformance } from '@/services/purchase.service';
import {
  getInventory,
  getPriceRecords,
  getPurchaseOrders,
  upsertPurchaseOrder,
} from '@/services/storage.service';
import { PriceRecord, PurchaseOrder, SupplierPerformance } from '@/types';
import { displayDate } from '@/utils/date';
import { formatCurrency } from '@/utils/format';

type PriceTab = 'flagged' | 'history' | 'suppliers';

export default function AdminPricingScreen() {
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<PriceTab>('flagged');
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [priceRecords, setPriceRecords] = useState<PriceRecord[]>([]);
  const [performance, setPerformance] = useState<SupplierPerformance[]>([]);

  const load = useCallback(async () => {
    const [nextOrders, nextPrices] = await Promise.all([
      getPurchaseOrders(),
      getPriceRecords(),
    ]);
    setOrders(nextOrders);
    setPriceRecords(nextPrices);
    setPerformance(computeSupplierPerformance(nextPrices));
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const flaggedOrders = orders.filter((o) => o.status === 'flagged');
  const suspiciousRecords = priceRecords.filter((r) => r.status !== 'normal');

  const handleApprove = async (order: PurchaseOrder) => {
    await upsertPurchaseOrder({ ...order, status: 'verified', verifiedBy: 'admin-1', reviewNote: 'Approved by admin.' });
    await load();
  };

  const toneForStatus = (status: PriceRecord['status']): 'red' | 'amber' | 'green' => {
    if (status === 'suspicious') return 'red';
    if (status === 'high') return 'amber';
    return 'green';
  };

  const trendIcon = (trend: 'up' | 'down' | 'stable') => {
    if (trend === 'up') return '↑';
    if (trend === 'down') return '↓';
    return '→';
  };

  return (
    <AppScreen
      title="Pricing Control"
      subtitle="Anti-fraud monitoring and price history"
      loading={loading}
      onRefresh={load}>

      <View style={styles.metricRow}>
        <MetricCard
          label="Flagged orders"
          value={String(flaggedOrders.length)}
          detail="Need review"
          tone={flaggedOrders.length > 0 ? 'red' : 'green'}
        />
        <MetricCard
          label="Price alerts"
          value={String(suspiciousRecords.length)}
          detail="High deviation"
          tone={suspiciousRecords.length > 0 ? 'amber' : 'green'}
        />
      </View>

      <View style={styles.tabs}>
        {(['flagged', 'history', 'suppliers'] as PriceTab[]).map((t) => (
          <Pressable
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'flagged' ? 'Flagged' : t === 'history' ? 'History' : 'Suppliers'}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'flagged' && (
        flaggedOrders.length === 0 ? (
          <EmptyState
            title="No flagged orders"
            icon="shield-checkmark-outline"
            message="All purchase orders are within expected price ranges."
          />
        ) : (
          flaggedOrders.map((order) => (
            <Card key={order.id} style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <View>
                  <Text style={styles.orderTitle}>{displayDate(order.date)}</Text>
                  <Text style={styles.orderSub}>Submitted by {order.submittedBy}</Text>
                </View>
                <StatusBadge label="Flagged" tone="red" />
              </View>
              <View style={styles.costRow}>
                <View>
                  <Text style={styles.costLabel}>Planned</Text>
                  <Text style={styles.costValue}>{formatCurrency(order.totalPlannedCost)}</Text>
                </View>
                <View>
                  <Text style={styles.costLabel}>Actual</Text>
                  <Text style={[styles.costValue, { color: theme.colors.red }]}>
                    {formatCurrency(order.totalActualCost)}
                  </Text>
                </View>
                <View>
                  <Text style={styles.costLabel}>Variance</Text>
                  <Text style={[styles.costValue, { color: order.overallVariancePercent > 0 ? theme.colors.red : theme.colors.green }]}>
                    {order.overallVariancePercent > 0 ? '+' : ''}{order.overallVariancePercent.toFixed(1)}%
                  </Text>
                </View>
              </View>
              {order.items.filter((i) => i.flagged).map((item) => (
                <ListItem
                  key={item.itemId}
                  title={item.name}
                  subtitle={item.flagReason}
                  right={
                    <View style={styles.itemRight}>
                      <Text style={styles.itemPrice}>{formatCurrency(item.actualUnitPrice)}/{item.unit}</Text>
                      <StatusBadge
                        label={`${item.priceVariancePercent > 0 ? '+' : ''}${item.priceVariancePercent.toFixed(1)}%`}
                        tone={Math.abs(item.priceVariancePercent) >= 35 ? 'red' : 'amber'}
                      />
                    </View>
                  }
                />
              ))}
              <Pressable style={styles.approveBtn} onPress={() => void handleApprove(order)}>
                <Text style={styles.approveBtnText}>Approve order</Text>
              </Pressable>
            </Card>
          ))
        )
      )}

      {tab === 'history' && (
        <>
          <SectionHeader title="Recent price submissions" />
          <Card>
            {priceRecords.slice(0, 30).map((rec) => (
              <ListItem
                key={rec.id}
                title={rec.itemName}
                subtitle={`${displayDate(rec.date)} · ${rec.submittedBy}`}
                right={
                  <View style={styles.itemRight}>
                    <Text style={styles.itemPrice}>{formatCurrency(rec.unitPrice)}/{rec.unit}</Text>
                    <StatusBadge
                      label={rec.status === 'suspicious' ? 'Suspicious' : rec.status === 'high' ? 'High' : 'Normal'}
                      tone={toneForStatus(rec.status)}
                    />
                  </View>
                }
              />
            ))}
            {priceRecords.length === 0 && (
              <EmptyState title="No price records" message="Price records appear after orders are submitted." />
            )}
          </Card>
        </>
      )}

      {tab === 'suppliers' && (
        <>
          <SectionHeader title="Ingredient price analysis" />
          <Card>
            {performance.map((item) => (
              <ListItem
                key={item.itemId}
                title={item.itemName}
                subtitle={`${item.totalRecords} records · volatility ${item.priceVolatility.toFixed(1)}%`}
                right={
                  <View style={styles.itemRight}>
                    <Text style={styles.itemPrice}>avg {formatCurrency(item.avgUnitPrice)}/{item.unit}</Text>
                    <View style={styles.trendRow}>
                      <Text style={[
                        styles.trend,
                        item.trend === 'up' ? { color: theme.colors.red } :
                        item.trend === 'down' ? { color: theme.colors.green } :
                        { color: theme.colors.muted },
                      ]}>
                        {trendIcon(item.trend)}
                      </Text>
                      {item.flaggedCount > 0 ? (
                        <StatusBadge label={`${item.flaggedCount} flagged`} tone="amber" />
                      ) : null}
                    </View>
                  </View>
                }
              />
            ))}
            {performance.length === 0 && (
              <EmptyState title="No supplier data" message="Submit purchase orders to build price history." />
            )}
          </Card>
        </>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  metricRow: { flexDirection: 'row', gap: theme.spacing.md },
  tabs: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.sm,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: theme.colors.surface, ...theme.shadow },
  tabText: { color: theme.colors.muted, fontFamily: theme.font, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: theme.colors.text },
  orderCard: { gap: theme.spacing.sm },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  orderTitle: { color: theme.colors.text, fontFamily: theme.font, fontSize: 16, fontWeight: '700' },
  orderSub: { color: theme.colors.muted, fontFamily: theme.font, fontSize: 13, marginTop: 2 },
  costRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  costLabel: { color: theme.colors.muted, fontFamily: theme.font, fontSize: 12 },
  costValue: { color: theme.colors.text, fontFamily: theme.font, fontSize: 15, fontWeight: '700', marginTop: 2 },
  itemRight: { alignItems: 'flex-end', gap: 4 },
  itemPrice: { color: theme.colors.text, fontFamily: theme.font, fontSize: 13, fontWeight: '600' },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trend: { fontFamily: theme.font, fontSize: 16, fontWeight: '700' },
  approveBtn: {
    height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.colors.accent + '18', marginTop: 4,
  },
  approveBtnText: { color: theme.colors.accent, fontFamily: theme.font, fontSize: 14, fontWeight: '700' },
});
