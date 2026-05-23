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
import { getPurchaseOrders } from '@/services/storage.service';
import { PurchaseOrder, PurchaseStatus } from '@/types';
import { displayDate } from '@/utils/date';
import { formatCurrency } from '@/utils/format';

const STATUS_TONE: Record<PurchaseStatus, 'red' | 'amber' | 'green' | 'blue'> = {
  pending: 'amber',
  submitted: 'blue',
  verified: 'green',
  flagged: 'red',
  received: 'green',
};

export default function BozorchiHistoryScreen() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setOrders(await getPurchaseOrders());
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const myOrders = orders.filter((o) => o.submittedBy === 'bozorchi-1');
  const verifiedCount = myOrders.filter((o) => o.status === 'verified').length;
  const flaggedCount = myOrders.filter((o) => o.status === 'flagged').length;

  return (
    <AppScreen
      title="Purchase History"
      subtitle="Your submitted orders and review status"
      loading={loading}
      onRefresh={load}>

      <View style={styles.metricRow}>
        <MetricCard label="Total orders" value={String(myOrders.length)} detail="All time" tone="blue" />
        <MetricCard label="Verified" value={String(verifiedCount)} detail={`${flaggedCount} flagged`} tone={flaggedCount > 0 ? 'amber' : 'green'} />
      </View>

      {myOrders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          message="Your purchase submissions will appear here."
          icon="time-outline"
        />
      ) : (
        myOrders.map((order) => {
          const isExpanded = expanded === order.id;
          const flaggedItems = order.items.filter((i) => i.flagged);
          return (
            <Card key={order.id} style={styles.orderCard}>
              <Pressable onPress={() => setExpanded(isExpanded ? null : order.id)}>
                <View style={styles.orderHeader}>
                  <View>
                    <Text style={styles.orderDate}>{displayDate(order.date)}</Text>
                    <Text style={styles.orderSub}>{order.items.length} items</Text>
                  </View>
                  <View style={styles.orderRight}>
                    <StatusBadge label={order.status} tone={STATUS_TONE[order.status]} />
                  </View>
                </View>
                <View style={styles.costRow}>
                  <View>
                    <Text style={styles.costLabel}>Actual spend</Text>
                    <Text style={styles.costValue}>{formatCurrency(order.totalActualCost)}</Text>
                  </View>
                  <View>
                    <Text style={styles.costLabel}>vs planned</Text>
                    <Text style={[styles.costValue, {
                      color: order.overallVariancePercent > 15 ? theme.colors.red :
                        order.overallVariancePercent > 5 ? theme.colors.amber : theme.colors.green
                    }]}>
                      {order.overallVariancePercent > 0 ? '+' : ''}{order.overallVariancePercent.toFixed(1)}%
                    </Text>
                  </View>
                  {flaggedItems.length > 0 ? (
                    <View>
                      <Text style={styles.costLabel}>Flagged items</Text>
                      <Text style={[styles.costValue, { color: theme.colors.red }]}>{flaggedItems.length}</Text>
                    </View>
                  ) : null}
                </View>
              </Pressable>

              {isExpanded && (
                <>
                  <View style={styles.divider} />
                  {order.items.map((item) => (
                    <ListItem
                      key={item.itemId}
                      title={item.name}
                      subtitle={`${item.actualQty} ${item.unit} purchased`}
                      right={
                        <View style={styles.itemRight}>
                          <Text style={styles.itemPrice}>{formatCurrency(item.actualUnitPrice)}/{item.unit}</Text>
                          {item.flagged ? (
                            <StatusBadge label={`+${item.priceVariancePercent.toFixed(1)}%`} tone="red" />
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
  orderCard: { gap: theme.spacing.sm },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  orderDate: { color: theme.colors.text, fontFamily: theme.font, fontSize: 16, fontWeight: '700' },
  orderSub: { color: theme.colors.muted, fontFamily: theme.font, fontSize: 13, marginTop: 2 },
  orderRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  costRow: { flexDirection: 'row', gap: 24, paddingTop: 8 },
  costLabel: { color: theme.colors.muted, fontFamily: theme.font, fontSize: 12 },
  costValue: { color: theme.colors.text, fontFamily: theme.font, fontSize: 15, fontWeight: '700', marginTop: 2 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.line },
  itemRight: { alignItems: 'flex-end', gap: 4 },
  itemPrice: { color: theme.colors.text, fontFamily: theme.font, fontSize: 13, fontWeight: '600' },
  noteBox: { padding: theme.spacing.sm, borderRadius: 10, backgroundColor: theme.colors.surfaceAlt },
  noteText: { color: theme.colors.muted, fontFamily: theme.font, fontSize: 13 },
});
