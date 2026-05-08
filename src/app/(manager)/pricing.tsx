import { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { AppScreen } from '@/components/AppScreen';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { ListItem } from '@/components/ListItem';
import { NumberInput } from '@/components/NumberInput';
import { SectionHeader } from '@/components/SectionHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { theme } from '@/constants/theme';
import { ingredientBasePrices } from '@/constants/holidays';
import { computeSupplierPerformance, extractPriceRecords } from '@/services/purchase.service';
import {
  addPriceRecords,
  getInventory,
  getPriceRecords,
  getPurchaseOrders,
} from '@/services/storage.service';
import { InventoryItem, PriceRecord, SupplierPerformance } from '@/types';
import { formatCurrency } from '@/utils/format';
import { roundTo } from '@/utils/math';
import { todayKey } from '@/utils/date';

export default function ManagerPricingScreen() {
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [priceRecords, setPriceRecords] = useState<PriceRecord[]>([]);
  const [performance, setPerformance] = useState<SupplierPerformance[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [priceForm, setPriceForm] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const [inv, prices] = await Promise.all([getInventory(), getPriceRecords()]);
    setInventory(inv);
    setPriceRecords(prices);
    setPerformance(computeSupplierPerformance(prices));
    const initial: Record<string, string> = {};
    for (const item of inv) {
      const recent = prices.filter((p) => p.itemId === item.id).sort((a, b) => b.date.localeCompare(a.date))[0];
      initial[item.id] = String(recent?.unitPrice ?? ingredientBasePrices[item.id] ?? 10000);
    }
    setPriceForm(initial);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const handleSubmitPrices = async () => {
    const newRecords: PriceRecord[] = inventory.map((item) => {
      const price = Number(priceForm[item.id] ?? 0);
      const basePrice = ingredientBasePrices[item.id] ?? price;
      const deviation = roundTo(((price - basePrice) / basePrice) * 100, 1);
      const absDeviation = Math.abs(deviation);
      return {
        id: `price-${item.id}-${todayKey()}-${Date.now()}`,
        itemId: item.id,
        itemName: item.name,
        unitPrice: price,
        unit: item.unit,
        date: todayKey(),
        submittedBy: 'manager-1',
        status: absDeviation >= 35 ? 'suspicious' : absDeviation >= 20 ? 'high' : 'normal',
        deviationPercent: deviation,
      };
    });
    await addPriceRecords(newRecords);
    setModalVisible(false);
    await load();
    Alert.alert('Prices submitted', 'Market prices recorded and deviation analysis updated.');
  };

  const toneForStatus = (status: PriceRecord['status']): 'red' | 'amber' | 'green' => {
    if (status === 'suspicious') return 'red';
    if (status === 'high') return 'amber';
    return 'green';
  };

  return (
    <AppScreen
      title="Pricing"
      subtitle="Submit market prices and monitor deviations"
      loading={loading}
      onRefresh={load}
      right={
        <Pressable style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Ionicons name="add" size={22} color={theme.colors.text} />
        </Pressable>
      }>

      <SectionHeader title="Ingredient price analysis" />
      <Card>
        {performance.length === 0 ? (
          <EmptyState title="No price data" message="Submit market prices to build analysis." />
        ) : (
          performance.map((item) => {
            const recent = priceRecords.filter((r) => r.itemId === item.itemId).sort((a, b) => b.date.localeCompare(a.date))[0];
            return (
              <ListItem
                key={item.itemId}
                title={item.itemName}
                subtitle={`${item.totalRecords} records · min ${formatCurrency(item.minUnitPrice)} · max ${formatCurrency(item.maxUnitPrice)}`}
                right={
                  <View style={styles.itemRight}>
                    <Text style={styles.itemPrice}>{formatCurrency(item.avgUnitPrice)}/{item.unit}</Text>
                    {recent && recent.status !== 'normal' ? (
                      <StatusBadge
                        label={recent.status === 'suspicious' ? 'Suspicious' : 'High'}
                        tone={toneForStatus(recent.status)}
                      />
                    ) : (
                      <StatusBadge label={item.trend === 'up' ? '↑ Rising' : item.trend === 'down' ? '↓ Falling' : '→ Stable'} tone={item.trend === 'up' ? 'amber' : item.trend === 'down' ? 'green' : 'blue'} />
                    )}
                  </View>
                }
              />
            );
          })
        )}
      </Card>

      <SectionHeader title="Recent price submissions" />
      <Card>
        {priceRecords.length === 0 ? (
          <EmptyState title="No submissions" message="Add market prices to track history." />
        ) : (
          priceRecords.slice(0, 15).map((rec) => (
            <ListItem
              key={rec.id}
              title={rec.itemName}
              subtitle={`${rec.date} · ${rec.deviationPercent > 0 ? '+' : ''}${rec.deviationPercent.toFixed(1)}% from baseline`}
              right={
                <View style={styles.itemRight}>
                  <Text style={styles.itemPrice}>{formatCurrency(rec.unitPrice)}/{rec.unit}</Text>
                  <StatusBadge label={rec.status === 'suspicious' ? 'Suspicious' : rec.status === 'high' ? 'High' : 'Normal'} tone={toneForStatus(rec.status)} />
                </View>
              }
            />
          ))
        )}
      </Card>

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <AppScreen
          title="Submit market prices"
          subtitle="Enter today's receipt prices for each ingredient"
          right={
            <Pressable style={styles.addBtn} onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={22} color={theme.colors.text} />
            </Pressable>
          }>
          <Card style={styles.formCard}>
            {inventory.map((item) => (
              <NumberInput
                key={item.id}
                label={`${item.name} (per ${item.unit})`}
                suffix="UZS"
                value={priceForm[item.id] ?? ''}
                onChangeText={(v) => setPriceForm((c) => ({ ...c, [item.id]: v }))}
              />
            ))}
            <Pressable style={styles.submitBtn} onPress={() => void handleSubmitPrices()}>
              <Text style={styles.submitBtnText}>Submit prices</Text>
            </Pressable>
          </Card>
        </AppScreen>
      </Modal>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  addBtn: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.line },
  itemRight: { alignItems: 'flex-end', gap: 4 },
  itemPrice: { color: theme.colors.text, fontFamily: theme.font, fontSize: 13, fontWeight: '600' },
  formCard: { gap: theme.spacing.md },
  submitBtn: { height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primary },
  submitBtnText: { color: theme.colors.surface, fontFamily: theme.font, fontSize: 16, fontWeight: '700' },
});
