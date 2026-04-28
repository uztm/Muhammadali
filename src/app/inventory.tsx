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
import {
  calculateInventoryDaysRemaining,
  forecastNextDay,
} from '@/services/forecast.service';
import {
  getInventory,
  getProductionRecords,
  getSettings,
  updateInventory,
} from '@/services/storage.service';
import { ForecastResult, InventoryItem } from '@/types';
import { formatKg, formatUnit } from '@/utils/format';

export default function InventoryScreen() {
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [stockValue, setStockValue] = useState('');
  const [minimumValue, setMinimumValue] = useState('');
  const [usageValue, setUsageValue] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [records, nextInventory, settings] = await Promise.all([
      getProductionRecords(),
      getInventory(),
      getSettings(),
    ]);
    setInventory(nextInventory);
    setForecast(forecastNextDay(records, nextInventory, settings));
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const openEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setStockValue(String(item.currentStock));
    setMinimumValue(String(item.minimumStock));
    setUsageValue(String(item.recipeUsagePerKg));
    setError('');
  };

  const saveItem = async () => {
    if (!editingItem) {
      return;
    }

    const currentStock = Number(stockValue);
    const minimumStock = Number(minimumValue);
    const recipeUsagePerKg = Number(usageValue);
    if (
      !Number.isFinite(currentStock) ||
      currentStock < 0 ||
      !Number.isFinite(minimumStock) ||
      minimumStock < 0 ||
      !Number.isFinite(recipeUsagePerKg) ||
      recipeUsagePerKg <= 0
    ) {
      setError('Stock values must be zero or greater, and recipe usage must be positive.');
      return;
    }

    await updateInventory(
      inventory.map((item) =>
        item.id === editingItem.id ? { ...item, currentStock, minimumStock, recipeUsagePerKg } : item,
      ),
    );
    setEditingItem(null);
    await load();
  };

  const urgentCount = forecast?.purchaseRecommendations.filter((item) => item.urgency === 'urgent').length ?? 0;

  return (
    <AppScreen
      title="Inventory"
      subtitle={forecast ? `Tomorrow production plan: ${formatKg(forecast.recommendedCookKg)}` : undefined}
      loading={loading}
      onRefresh={load}>
      {forecast ? (
        <>
          <Card>
            <View style={styles.summaryTop}>
              <View>
                <Text style={styles.cardTitle}>Stock health</Text>
                <Text style={styles.cardSub}>Connected to tomorrow forecast</Text>
              </View>
              <StatusBadge
                label={urgentCount > 0 ? `${urgentCount} urgent` : 'Covered'}
                tone={urgentCount > 0 ? 'red' : 'green'}
              />
            </View>
            <View style={styles.requirementGrid}>
              {forecast.ingredientsRequired.slice(0, 4).map((item) => (
                <View style={styles.requirement} key={item.itemId}>
                  <Text style={styles.reqValue}>{formatUnit(item.requiredTomorrow, item.unit)}</Text>
                  <Text style={styles.reqLabel}>{item.name}</Text>
                </View>
              ))}
            </View>
          </Card>

          <SectionHeader title="Purchase recommendations" />
          <Card>
            {forecast.purchaseRecommendations.length === 0 ? (
              <EmptyState
                title="No purchase needed"
                message="Current stock covers the forecasted plov production."
                icon="bag-check-outline"
              />
            ) : (
              forecast.purchaseRecommendations.map((item) => (
                <ListItem
                  key={item.itemId}
                  title={item.name}
                  subtitle={`Need ${formatUnit(item.requiredTomorrow, item.unit)} tomorrow · Stock ${formatUnit(item.currentStock, item.unit)}`}
                  right={
                    <View style={styles.purchaseRight}>
                      <Text style={styles.purchaseAmount}>
                        Buy {formatUnit(item.recommendedPurchase, item.unit)}
                      </Text>
                      <StatusBadge
                        label={item.urgency === 'urgent' ? 'Urgent' : 'Watch'}
                        tone={item.urgency === 'urgent' ? 'red' : 'amber'}
                      />
                    </View>
                  }
                />
              ))
            )}
          </Card>

          <SectionHeader title="Ingredient stock" />
          <Card>
            {inventory.map((item) => {
              const daysRemaining = calculateInventoryDaysRemaining(item, forecast);
              const lowStock = item.currentStock < item.minimumStock;
              return (
                <Pressable key={item.id} onPress={() => openEdit(item)}>
                  <ListItem
                    title={item.name}
                    subtitle={`${formatUnit(item.currentStock, item.unit)} on hand · ${daysRemaining} days · ${formatUnit(item.recipeUsagePerKg, item.unit)} per 1 kg`}
                    right={
                      <StatusBadge
                        label={lowStock ? 'Low stock' : 'OK'}
                        tone={lowStock ? 'amber' : 'green'}
                      />
                    }
                  />
                </Pressable>
              );
            })}
          </Card>
        </>
      ) : (
        <EmptyState title="Inventory unavailable" message="Seed demo data or add records to calculate stock." />
      )}

      <Modal visible={Boolean(editingItem)} animationType="slide" presentationStyle="pageSheet">
        <AppScreen
          title={editingItem?.name ?? 'Inventory'}
          subtitle="Update stock level, minimum stock, and recipe usage"
          right={
            <Pressable style={styles.iconButton} onPress={() => setEditingItem(null)}>
              <Ionicons name="close" size={23} color={theme.colors.text} />
            </Pressable>
          }>
          <Card style={styles.formCard}>
            <NumberInput
              label="Current stock"
              suffix={editingItem?.unit}
              value={stockValue}
              error={error}
              onChangeText={setStockValue}
            />
            <NumberInput
              label="Minimum stock"
              suffix={editingItem?.unit}
              value={minimumValue}
              onChangeText={setMinimumValue}
            />
            <NumberInput
              label="Used for 1 kg plov"
              suffix={editingItem?.unit}
              value={usageValue}
              onChangeText={setUsageValue}
            />
            {editingItem && forecast ? (
              <View style={styles.autocalc}>
                <Text style={styles.autocalcLabel}>Required for forecast</Text>
                <Text style={styles.autocalcValue}>
                  {formatUnit((Number(usageValue) || 0) * forecast.recommendedCookKg, editingItem.unit)}
                </Text>
              </View>
            ) : null}
            <Pressable
              style={styles.primaryButton}
              onPress={() => {
                void saveItem().catch(() => Alert.alert('Could not save', 'Please try again.'));
              }}>
              <Text style={styles.primaryButtonText}>Save stock</Text>
            </Pressable>
          </Card>
        </AppScreen>
      </Modal>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  cardTitle: {
    color: theme.colors.text,
    fontFamily: theme.font,
    fontSize: 18,
    fontWeight: '700',
  },
  cardSub: {
    marginTop: 4,
    color: theme.colors.muted,
    fontFamily: theme.font,
    fontSize: 13,
  },
  requirementGrid: {
    marginTop: theme.spacing.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  requirement: {
    width: '47%',
    minHeight: 72,
    borderRadius: 16,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceAlt,
  },
  reqValue: {
    color: theme.colors.text,
    fontFamily: theme.font,
    fontSize: 18,
    fontWeight: '700',
  },
  reqLabel: {
    marginTop: 4,
    color: theme.colors.muted,
    fontFamily: theme.font,
    fontSize: 13,
  },
  purchaseRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  purchaseAmount: {
    color: theme.colors.text,
    fontFamily: theme.font,
    fontSize: 14,
    fontWeight: '700',
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.line,
  },
  formCard: {
    gap: theme.spacing.md,
  },
  autocalc: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: theme.colors.surfaceAlt,
    paddingHorizontal: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  autocalcLabel: {
    flex: 1,
    color: theme.colors.muted,
    fontFamily: theme.font,
    fontSize: 14,
    fontWeight: '600',
  },
  autocalcValue: {
    color: theme.colors.text,
    fontFamily: theme.font,
    fontSize: 16,
    fontWeight: '700',
  },
  primaryButton: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
  },
  primaryButtonText: {
    color: theme.colors.surface,
    fontFamily: theme.font,
    fontSize: 16,
    fontWeight: '700',
  },
});
