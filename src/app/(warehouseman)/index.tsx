import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';

import { AppScreen } from '@/components/AppScreen';
import { Card } from '@/components/Card';
import { ListItem } from '@/components/ListItem';
import { SectionHeader } from '@/components/SectionHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { theme } from '@/constants/theme';
import { logout } from '@/services/auth.service';
import { getInventory } from '@/services/storage.service';
import { InventoryItem } from '@/types';

const BROWN = '#7C5C3E';

function stockTone(item: InventoryItem): 'red' | 'amber' | 'green' {
  if (item.currentStock <= item.minimumStock * 0.5) return 'red';
  if (item.currentStock <= item.minimumStock) return 'amber';
  return 'green';
}

function stockLabel(item: InventoryItem): string {
  if (item.currentStock <= item.minimumStock * 0.5) return 'Critical';
  if (item.currentStock <= item.minimumStock) return 'Low';
  return 'OK';
}

export default function WarehouseStock() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  const load = useCallback(async () => {
    const inv = await getInventory();
    setInventory(inv);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const handleLogout = async () => {
    await logout();
    router.replace('/login' as any);
  };

  const criticalItems = inventory.filter((i) => i.currentStock <= i.minimumStock * 0.5);
  const lowItems = inventory.filter((i) => i.currentStock > i.minimumStock * 0.5 && i.currentStock <= i.minimumStock);
  const okItems = inventory.filter((i) => i.currentStock > i.minimumStock);

  return (
    <AppScreen
      title="Warehouse"
      subtitle="Current stock levels"
      loading={loading}
      onRefresh={load}
      right={
        <Pressable style={styles.logoutBtn} onPress={() => void handleLogout()}>
          <Ionicons name="log-out-outline" size={20} color={theme.colors.muted} />
        </Pressable>
      }>

      <View style={styles.metricRow}>
        <View style={[styles.metricBox, { borderColor: theme.colors.red + '60', backgroundColor: theme.colors.red + '10' }]}>
          <Text style={[styles.metricValue, { color: theme.colors.red }]}>{criticalItems.length}</Text>
          <Text style={styles.metricLabel}>Critical</Text>
        </View>
        <View style={[styles.metricBox, { borderColor: theme.colors.amber + '60', backgroundColor: theme.colors.amber + '10' }]}>
          <Text style={[styles.metricValue, { color: theme.colors.amber }]}>{lowItems.length}</Text>
          <Text style={styles.metricLabel}>Low stock</Text>
        </View>
        <View style={[styles.metricBox, { borderColor: theme.colors.green + '60', backgroundColor: theme.colors.green + '10' }]}>
          <Text style={[styles.metricValue, { color: theme.colors.green }]}>{okItems.length}</Text>
          <Text style={styles.metricLabel}>OK</Text>
        </View>
      </View>

      {criticalItems.length > 0 && (
        <>
          <SectionHeader title="Critical — needs urgent purchase" />
          <Card>
            {criticalItems.map((item) => (
              <ListItem
                key={item.id}
                title={item.name}
                subtitle={`Min: ${item.minimumStock} ${item.unit}`}
                right={
                  <View style={styles.stockRight}>
                    <Text style={[styles.stockQty, { color: theme.colors.red }]}>
                      {item.currentStock} {item.unit}
                    </Text>
                    <StatusBadge label="Critical" tone="red" />
                  </View>
                }
              />
            ))}
          </Card>
        </>
      )}

      {lowItems.length > 0 && (
        <>
          <SectionHeader title="Low stock — needs purchase" />
          <Card>
            {lowItems.map((item) => (
              <ListItem
                key={item.id}
                title={item.name}
                subtitle={`Min: ${item.minimumStock} ${item.unit}`}
                right={
                  <View style={styles.stockRight}>
                    <Text style={[styles.stockQty, { color: theme.colors.amber }]}>
                      {item.currentStock} {item.unit}
                    </Text>
                    <StatusBadge label="Low" tone="amber" />
                  </View>
                }
              />
            ))}
          </Card>
        </>
      )}

      {okItems.length > 0 && (
        <>
          <SectionHeader title="Sufficient stock" />
          <Card>
            {okItems.map((item) => (
              <ListItem
                key={item.id}
                title={item.name}
                subtitle={`Min: ${item.minimumStock} ${item.unit}`}
                right={
                  <View style={styles.stockRight}>
                    <Text style={[styles.stockQty, { color: theme.colors.green }]}>
                      {item.currentStock} {item.unit}
                    </Text>
                    <StatusBadge label="OK" tone="green" />
                  </View>
                }
              />
            ))}
          </Card>
        </>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  logoutBtn: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.line },
  metricRow: { flexDirection: 'row', gap: theme.spacing.sm },
  metricBox: { flex: 1, borderRadius: theme.radius.md, borderWidth: 1, padding: theme.spacing.md, alignItems: 'center', gap: 4 },
  metricValue: { fontFamily: theme.font, fontSize: 28, fontWeight: '800' },
  metricLabel: { fontFamily: theme.font, fontSize: 12, fontWeight: '600', color: theme.colors.muted },
  stockRight: { alignItems: 'flex-end', gap: 4 },
  stockQty: { fontFamily: theme.font, fontSize: 15, fontWeight: '700' },
});
