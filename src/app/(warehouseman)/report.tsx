import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { AppScreen } from '@/components/AppScreen';
import { Card } from '@/components/Card';
import { ListItem } from '@/components/ListItem';
import { SectionHeader } from '@/components/SectionHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { theme } from '@/constants/theme';
import { getInventory, getPurchaseOrders } from '@/services/storage.service';
import { InventoryItem, PurchaseOrder } from '@/types';
import { displayDate } from '@/utils/date';
import { formatCurrency } from '@/utils/format';

export default function WarehouseReport() {
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [receivedOrders, setReceivedOrders] = useState<PurchaseOrder[]>([]);

  const load = useCallback(async () => {
    const [inv, orders] = await Promise.all([getInventory(), getPurchaseOrders()]);
    setInventory(inv);
    setReceivedOrders(orders.filter((o) => o.status === 'received' || o.status === 'verified'));
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7);

  const monthOrders = receivedOrders.filter((o) => o.date.startsWith(thisMonth));
  const totalShortages = monthOrders.reduce(
    (acc, o) => acc + o.items.filter((i) => i.receivedQty < i.actualQty).length,
    0,
  );

  const needPurchase = inventory.filter((i) => i.currentStock <= i.minimumStock);

  return (
    <AppScreen
      title="Report"
      subtitle={`Warehouse · ${today}`}
      loading={loading}
      onRefresh={load}>

      <View style={styles.summaryRow}>
        <View style={[styles.summaryBox, { backgroundColor: '#7C5C3E18' }]}>
          <Text style={[styles.summaryValue, { color: '#7C5C3E' }]}>{inventory.length}</Text>
          <Text style={styles.summaryLabel}>Total items</Text>
        </View>
        <View style={[styles.summaryBox, { backgroundColor: theme.colors.red + '12' }]}>
          <Text style={[styles.summaryValue, { color: theme.colors.red }]}>
            {needPurchase.length}
          </Text>
          <Text style={styles.summaryLabel}>Need purchase</Text>
        </View>
        <View style={[styles.summaryBox, { backgroundColor: theme.colors.blue + '12' }]}>
          <Text style={[styles.summaryValue, { color: theme.colors.blue }]}>{monthOrders.length}</Text>
          <Text style={styles.summaryLabel}>Received this month</Text>
        </View>
      </View>

      {totalShortages > 0 && (
        <Card style={styles.alertCard}>
          <View style={styles.alertRow}>
            <Text style={styles.alertIcon}>⚠️</Text>
            <Text style={styles.alertText}>
              {totalShortages} shortage(s) this month — items received less than purchased.
            </Text>
          </View>
        </Card>
      )}

      <SectionHeader title="Current stock — all items" />
      <Card>
        {inventory.map((item) => {
          const low = item.currentStock <= item.minimumStock;
          const critical = item.currentStock <= item.minimumStock * 0.5;
          return (
            <ListItem
              key={item.id}
              title={item.name}
              subtitle={`Min required: ${item.minimumStock} ${item.unit}`}
              right={
                <View style={styles.itemRight}>
                  <Text
                    style={[
                      styles.stockValue,
                      critical
                        ? { color: theme.colors.red }
                        : low
                        ? { color: theme.colors.amber }
                        : { color: theme.colors.green },
                    ]}>
                    {item.currentStock} {item.unit}
                  </Text>
                  <StatusBadge
                    label={critical ? 'Critical' : low ? 'Low' : 'OK'}
                    tone={critical ? 'red' : low ? 'amber' : 'green'}
                  />
                </View>
              }
            />
          );
        })}
      </Card>

      {needPurchase.length > 0 && (
        <>
          <SectionHeader title="Purchase needed" />
          <Card style={styles.purchaseCard}>
            <Text style={styles.purchaseNote}>
              Below minimum stock. Manager and Bozorchi are notified.
            </Text>
            {needPurchase.map((item) => (
              <View key={item.id} style={styles.purchaseRow}>
                <Text style={styles.purchaseName}>{item.name}</Text>
                <Text style={styles.purchaseQty}>
                  Has {item.currentStock} / Min {item.minimumStock} {item.unit}
                </Text>
              </View>
            ))}
          </Card>
        </>
      )}

      {monthOrders.length > 0 && (
        <>
          <SectionHeader title="Received deliveries this month" />
          {monthOrders.map((order) => {
            const shortages = order.items.filter((i) => i.receivedQty < i.actualQty);
            return (
              <Card key={order.id} style={styles.deliveryCard}>
                <View style={styles.deliveryHeader}>
                  <Text style={styles.deliveryDate}>{displayDate(order.date)}</Text>
                  <StatusBadge
                    label={shortages.length > 0 ? `${shortages.length} short` : 'Full'}
                    tone={shortages.length > 0 ? 'amber' : 'green'}
                  />
                </View>
                <Text style={styles.deliveryCost}>{formatCurrency(order.totalActualCost)}</Text>
                {shortages.length > 0 && (
                  <Text style={styles.shortageNote}>
                    {shortages.map((s) => `${s.name}: got ${s.receivedQty}/${s.actualQty} ${s.unit}`).join(' · ')}
                  </Text>
                )}
                {order.warehouseNote ? (
                  <Text style={styles.warehouseNote}>Note: {order.warehouseNote}</Text>
                ) : null}
              </Card>
            );
          })}
        </>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  summaryRow: { flexDirection: 'row', gap: theme.spacing.sm },
  summaryBox: { flex: 1, borderRadius: theme.radius.md, padding: theme.spacing.md, alignItems: 'center', gap: 4 },
  summaryValue: { fontFamily: theme.font, fontSize: 26, fontWeight: '800' },
  summaryLabel: { fontFamily: theme.font, fontSize: 11, fontWeight: '600', color: theme.colors.muted, textAlign: 'center' },
  alertCard: { backgroundColor: theme.colors.amber + '14', borderColor: theme.colors.amber + '40' },
  alertRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  alertIcon: { fontSize: 16 },
  alertText: { flex: 1, color: theme.colors.text, fontFamily: theme.font, fontSize: 14, lineHeight: 20 },
  itemRight: { alignItems: 'flex-end', gap: 4 },
  stockValue: { fontFamily: theme.font, fontSize: 14, fontWeight: '700' },
  purchaseCard: { gap: theme.spacing.sm },
  purchaseNote: { color: theme.colors.muted, fontFamily: theme.font, fontSize: 13, lineHeight: 18, marginBottom: 4 },
  purchaseRow: { paddingVertical: 4, borderTopWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.line },
  purchaseName: { color: theme.colors.text, fontFamily: theme.font, fontSize: 14, fontWeight: '600' },
  purchaseQty: { color: theme.colors.muted, fontFamily: theme.font, fontSize: 13 },
  deliveryCard: { gap: 4 },
  deliveryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  deliveryDate: { color: theme.colors.text, fontFamily: theme.font, fontSize: 15, fontWeight: '700' },
  deliveryCost: { color: theme.colors.muted, fontFamily: theme.font, fontSize: 13 },
  shortageNote: { color: theme.colors.amber, fontFamily: theme.font, fontSize: 12, lineHeight: 17 },
  warehouseNote: { color: theme.colors.muted, fontFamily: theme.font, fontSize: 12, fontStyle: 'italic' },
});
