import { useCallback, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Swipeable } from 'react-native-gesture-handler';

import { AppScreen } from '@/components/AppScreen';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { FormInput } from '@/components/FormInput';
import { ListItem } from '@/components/ListItem';
import { NumberInput } from '@/components/NumberInput';
import { SectionHeader } from '@/components/SectionHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { theme } from '@/constants/theme';
import { calculateWasteReductionAdvice } from '@/services/forecast.service';
import {
  addProductionRecord,
  deleteProductionRecord,
  getInventory,
  getProductionRecords,
  getSettings,
  updateProductionRecord,
} from '@/services/storage.service';
import { InventoryItem, ProductionRecord, RestaurantSettings, WasteReductionAdvice } from '@/types';
import { displayDate, sortByDateDesc, todayKey } from '@/utils/date';
import { formatCurrency, formatKg, formatPercent, formatUnit } from '@/utils/format';
import { roundTo } from '@/utils/math';

interface ProductionForm {
  date: string;
  cookedKg: string;
  soldKg: string;
  pricePerKg: string;
}

interface SaleForm {
  soldKg: string;
}

const emptyErrors: Partial<Record<keyof ProductionForm, string>> = {};

export default function ProductionScreen() {
  const [records, setRecords] = useState<ProductionRecord[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [saleModalVisible, setSaleModalVisible] = useState(false);
  const [errors, setErrors] = useState(emptyErrors);
  const [saleError, setSaleError] = useState('');
  const [saleForm, setSaleForm] = useState<SaleForm>({ soldKg: '1' });
  const [form, setForm] = useState<ProductionForm>({
    date: todayKey(),
    cookedKg: '10',
    soldKg: '8',
    pricePerKg: '85000',
  });

  const load = useCallback(async () => {
    const [nextRecords, nextInventory, nextSettings] = await Promise.all([
      getProductionRecords(),
      getInventory(),
      getSettings(),
    ]);
    setRecords(sortByDateDesc(nextRecords));
    setInventory(nextInventory);
    setSettings(nextSettings);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const todayRecord = records.find((record) => record.date === todayKey());
  const recentRecords = records.slice(0, 14);
  const wasteAdvice: WasteReductionAdvice | null =
    settings && todayRecord
      ? calculateWasteReductionAdvice(todayRecord, inventory, settings)
      : null;

  const formWaste = useMemo(() => {
    const cooked = Number(form.cookedKg);
    const sold = Number(form.soldKg);
    if (!Number.isFinite(cooked) || !Number.isFinite(sold)) {
      return 0;
    }

    return roundTo(Math.max(0, cooked - sold), 1);
  }, [form.cookedKg, form.soldKg]);

  const openForm = (record?: ProductionRecord) => {
    setErrors(emptyErrors);
    if (record) {
      setForm({
        date: record.date,
        cookedKg: String(record.cookedKg),
        soldKg: String(record.soldKg),
        pricePerKg: String(record.pricePerKg),
      });
    } else {
      setForm({
        date: todayKey(),
        cookedKg: String(settings?.defaultCookKg ?? 10),
        soldKg: '8',
        pricePerKg: String(settings?.pricePerKg ?? 85000),
      });
    }
    setModalVisible(true);
  };

  const openSale = () => {
    if (!todayRecord) {
      Alert.alert('No production today', 'Add today production before adding sales.');
      return;
    }

    setSaleError('');
    setSaleForm({ soldKg: '1' });
    setSaleModalVisible(true);
  };

  const saveSale = async () => {
    if (!todayRecord) {
      return;
    }

    const soldKg = Number(saleForm.soldKg);
    const nextSoldKg = roundTo(todayRecord.soldKg + soldKg, 1);

    if (!Number.isFinite(soldKg) || soldKg <= 0) {
      setSaleError('Sale quantity must be positive.');
      return;
    }

    if (nextSoldKg > todayRecord.cookedKg) {
      setSaleError(`Sale exceeds available production. Remaining: ${formatKg(todayRecord.cookedKg - todayRecord.soldKg)}.`);
      return;
    }

    const wasteKg = roundTo(todayRecord.cookedKg - nextSoldKg, 1);
    await updateProductionRecord({
      ...todayRecord,
      soldKg: nextSoldKg,
      wasteKg,
      revenue: Math.round(nextSoldKg * todayRecord.pricePerKg),
      wasteLoss: Math.round(wasteKg * todayRecord.pricePerKg),
    });
    setSaleModalVisible(false);
    await load();
  };

  const confirmDelete = (record: ProductionRecord) => {
    Alert.alert('Delete production record?', `${displayDate(record.date)} will be removed from local data.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteProductionRecord(record.date).then(load);
        },
      },
    ]);
  };

  const renderSwipeActions = (record: ProductionRecord) => {
    return (
      <View style={styles.swipeActions}>
        <Pressable style={[styles.swipeAction, styles.editAction]} onPress={() => openForm(record)}>
          <Ionicons name="create-outline" size={20} color={theme.colors.surface} />
          <Text style={styles.swipeActionText}>Edit</Text>
        </Pressable>
        <Pressable style={[styles.swipeAction, styles.deleteAction]} onPress={() => confirmDelete(record)}>
          <Ionicons name="trash-outline" size={20} color={theme.colors.surface} />
          <Text style={styles.swipeActionText}>Delete</Text>
        </Pressable>
      </View>
    );
  };

  const validate = () => {
    const nextErrors: Partial<Record<keyof ProductionForm, string>> = {};
    const cookedKg = Number(form.cookedKg);
    const soldKg = Number(form.soldKg);
    const pricePerKg = Number(form.pricePerKg);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) {
      nextErrors.date = 'Use YYYY-MM-DD.';
    }
    if (!Number.isFinite(cookedKg) || cookedKg <= 0) {
      nextErrors.cookedKg = 'Cooked quantity must be positive.';
    }
    if (!Number.isFinite(soldKg) || soldKg < 0) {
      nextErrors.soldKg = 'Sold quantity cannot be negative.';
    }
    if (soldKg > cookedKg) {
      nextErrors.soldKg = 'Sold kg cannot be greater than cooked kg.';
    }
    if (!Number.isFinite(pricePerKg) || pricePerKg <= 0) {
      nextErrors.pricePerKg = 'Price must be positive.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const save = async () => {
    if (!validate()) {
      return;
    }

    const cookedKg = Number(form.cookedKg);
    const soldKg = Number(form.soldKg);
    const pricePerKg = Number(form.pricePerKg);
    const wasteKg = roundTo(cookedKg - soldKg, 1);

    await addProductionRecord({
      id: `production-${form.date}`,
      date: form.date,
      cookedKg,
      soldKg,
      wasteKg,
      pricePerKg,
      revenue: Math.round(soldKg * pricePerKg),
      wasteLoss: Math.round(wasteKg * pricePerKg),
    });
    setModalVisible(false);
    await load();
  };

  return (
    <AppScreen
      title="Production"
      subtitle="Daily plov cooking, sales, and loss impact"
      loading={loading}
      onRefresh={load}
      right={
        <View style={styles.headerActions}>
          <Pressable style={styles.saleButton} onPress={openSale} accessibilityLabel="Add sale">
            <Ionicons name="cash-outline" size={18} color={theme.colors.surface} />
            <Text style={styles.saleButtonText}>Sale</Text>
          </Pressable>
          <Pressable style={styles.iconButton} onPress={() => openForm()} accessibilityLabel="Add record">
            <Ionicons name="add" size={24} color={theme.colors.text} />
          </Pressable>
        </View>
      }>
      {todayRecord ? (
        <Card>
          <View style={styles.summaryTop}>
            <View>
              <Text style={styles.cardTitle}>Today</Text>
              <Text style={styles.cardSub}>{displayDate(todayRecord.date)}</Text>
            </View>
            <View style={styles.todayActions}>
              <Pressable style={styles.smallButton} onPress={openSale}>
                <Text style={styles.smallButtonText}>Sale</Text>
              </Pressable>
              <Pressable style={styles.smallButton} onPress={() => openForm(todayRecord)}>
                <Text style={styles.smallButtonText}>Edit</Text>
              </Pressable>
            </View>
          </View>
          <View style={styles.kpiRow}>
            <View>
              <Text style={styles.kpiValue}>{formatKg(todayRecord.cookedKg)}</Text>
              <Text style={styles.kpiLabel}>Cooked</Text>
            </View>
            <View>
              <Text style={styles.kpiValue}>{formatKg(todayRecord.soldKg)}</Text>
              <Text style={styles.kpiLabel}>Sold</Text>
            </View>
            <View>
              <Text style={[styles.kpiValue, styles.loss]}>{formatKg(todayRecord.wasteKg)}</Text>
              <Text style={styles.kpiLabel}>Waste</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <ListItem title="Revenue" value={formatCurrency(todayRecord.revenue)} />
          <ListItem title="Waste loss" value={formatCurrency(todayRecord.wasteLoss)} />
          <ListItem
            title="Profit/loss impact"
            subtitle="Revenue less waste value"
            value={formatCurrency(todayRecord.revenue - todayRecord.wasteLoss)}
          />
        </Card>
      ) : (
        <EmptyState title="No record today" message="Add today's production to calculate waste and revenue." />
      )}

      {wasteAdvice && wasteAdvice.mode !== 'maintain' ? (
        <>
          <SectionHeader title="Next purchase advice" />
          <Card>
            <View style={styles.adviceHeader}>
              <View style={[styles.adviceIcon, wasteAdvice.mode === 'increase' && styles.growthIcon]}>
                <Ionicons
                  name={wasteAdvice.mode === 'increase' ? 'trending-up-outline' : 'bulb-outline'}
                  size={20}
                  color={wasteAdvice.mode === 'increase' ? theme.colors.green : theme.colors.amber}
                />
              </View>
              <View style={styles.adviceText}>
                <Text style={styles.adviceTitle}>
                  {wasteAdvice.mode === 'increase' ? 'Increase next batch' : 'Reduce next batch'}
                </Text>
                <Text style={styles.adviceBody}>{wasteAdvice.summary}</Text>
              </View>
            </View>
            <View style={styles.adviceStats}>
              <View style={styles.adviceStat}>
                <Text style={styles.adviceStatValue}>{formatKg(wasteAdvice.recommendedCookKg)}</Text>
                <Text style={styles.adviceStatLabel}>Next cook</Text>
              </View>
              <View style={styles.adviceStat}>
                <Text style={styles.adviceStatValue}>{formatKg(wasteAdvice.bufferedDemandKg)}</Text>
                <Text style={styles.adviceStatLabel}>{wasteAdvice.bufferPercent}% buffer</Text>
              </View>
              <View style={styles.adviceStat}>
                <Text style={styles.adviceStatValue}>
                  {formatKg(wasteAdvice.mode === 'increase' ? wasteAdvice.increaseKg : wasteAdvice.reductionKg)}
                </Text>
                <Text style={styles.adviceStatLabel}>
                  {wasteAdvice.mode === 'increase' ? 'Add by' : 'Reduce by'}
                </Text>
              </View>
            </View>
            <ListItem
              title={wasteAdvice.mode === 'increase' ? 'Potential extra revenue' : 'Estimated saving'}
              subtitle={wasteAdvice.mode === 'increase' ? 'Additional sale opportunity' : 'Avoided overproduction value'}
              value={formatCurrency(
                wasteAdvice.mode === 'increase'
                  ? wasteAdvice.possibleExtraRevenue
                  : wasteAdvice.possibleSavings,
              )}
            />
            <View style={styles.divider} />
            {wasteAdvice.ingredientAdvice.map((item) => (
              <ListItem
                key={item.itemId}
                title={item.name}
                subtitle={`Current batch used ${formatUnit(item.currentProductionUsage, item.unit)}`}
                value={`Buy ${formatUnit(item.recommendedUsage, item.unit)}`}
                right={
                  <View style={styles.recordRight}>
                    <Text style={styles.recordValue}>Buy {formatUnit(item.recommendedUsage, item.unit)}</Text>
                    {wasteAdvice.mode === 'increase' && item.addBy > 0 ? (
                      <StatusBadge label={`+${formatUnit(item.addBy, item.unit)}`} tone="green" />
                    ) : item.reduceBy > 0 ? (
                      <StatusBadge label={`-${formatUnit(item.reduceBy, item.unit)}`} tone="amber" />
                    ) : null}
                  </View>
                }
              />
            ))}
          </Card>
        </>
      ) : null}

      <SectionHeader title="Daily records" />
      <Card>
        {recentRecords.length === 0 ? (
          <EmptyState title="No production records" message="Seed or add data to begin planning." />
        ) : (
          recentRecords.map((record) => {
            const wasteRate = record.cookedKg > 0 ? (record.wasteKg / record.cookedKg) * 100 : 0;
            return (
              <Swipeable
                key={record.id}
                overshootRight={false}
                renderRightActions={() => renderSwipeActions(record)}>
                <Pressable style={styles.swipeRecord} onPress={() => openForm(record)}>
                  <ListItem
                    title={displayDate(record.date)}
                    subtitle={`${formatKg(record.cookedKg)} cooked · ${formatKg(record.soldKg)} sold`}
                    right={
                      <View style={styles.recordRight}>
                        <Text style={styles.recordValue}>{formatCurrency(record.revenue)}</Text>
                        <StatusBadge label={formatPercent(wasteRate)} tone={wasteRate > 18 ? 'amber' : 'green'} />
                      </View>
                    }
                  />
                </Pressable>
              </Swipeable>
            );
          })
        )}
      </Card>

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <AppScreen
          title="Production record"
          subtitle="Cooked and sold quantity are stored in kilograms"
          right={
            <Pressable style={styles.iconButton} onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={23} color={theme.colors.text} />
            </Pressable>
          }>
          <Card style={styles.formCard}>
            <FormInput
              label="Date"
              value={form.date}
              error={errors.date}
              onChangeText={(date) => setForm((current) => ({ ...current, date }))}
              placeholder="YYYY-MM-DD"
            />
            <NumberInput
              label="Cooked"
              suffix="kg"
              value={form.cookedKg}
              error={errors.cookedKg}
              onChangeText={(cookedKg) => setForm((current) => ({ ...current, cookedKg }))}
            />
            <NumberInput
              label="Sold"
              suffix="kg"
              value={form.soldKg}
              error={errors.soldKg}
              onChangeText={(soldKg) => setForm((current) => ({ ...current, soldKg }))}
            />
            <NumberInput
              label="Price per kg"
              suffix="UZS"
              value={form.pricePerKg}
              error={errors.pricePerKg}
              onChangeText={(pricePerKg) => setForm((current) => ({ ...current, pricePerKg }))}
            />
            <View style={styles.autocalc}>
              <Text style={styles.autocalcLabel}>Auto-calculated waste</Text>
              <Text style={styles.autocalcValue}>{formatKg(formWaste)}</Text>
            </View>
            <Pressable
              style={styles.primaryButton}
              onPress={() => {
                void save().catch(() => Alert.alert('Could not save', 'Please try again.'));
              }}>
              <Text style={styles.primaryButtonText}>Save record</Text>
            </Pressable>
          </Card>
        </AppScreen>
      </Modal>

      <Modal visible={saleModalVisible} animationType="slide" presentationStyle="pageSheet">
        <AppScreen
          title="Add sale"
          subtitle={
            todayRecord
              ? `${formatKg(todayRecord.cookedKg - todayRecord.soldKg)} available from today's production`
              : 'Record sold plov quantity'
          }
          right={
            <Pressable style={styles.iconButton} onPress={() => setSaleModalVisible(false)}>
              <Ionicons name="close" size={23} color={theme.colors.text} />
            </Pressable>
          }>
          <Card style={styles.formCard}>
            <NumberInput
              label="Sold quantity"
              suffix="kg"
              value={saleForm.soldKg}
              error={saleError}
              onChangeText={(soldKg) => setSaleForm({ soldKg })}
            />
            {todayRecord ? (
              <View style={styles.autocalc}>
                <Text style={styles.autocalcLabel}>Sold after save</Text>
                <Text style={styles.autocalcValue}>
                  {formatKg(roundTo(todayRecord.soldKg + Math.max(0, Number(saleForm.soldKg) || 0), 1))}
                </Text>
              </View>
            ) : null}
            <Pressable
              style={styles.primaryButton}
              onPress={() => {
                void saveSale().catch(() => Alert.alert('Could not save sale', 'Please try again.'));
              }}>
              <Text style={styles.primaryButtonText}>Save sale</Text>
            </Pressable>
          </Card>
        </AppScreen>
      </Modal>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
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
  saleButton: {
    height: 42,
    borderRadius: 15,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.colors.primary,
  },
  saleButtonText: {
    color: theme.colors.surface,
    fontFamily: theme.font,
    fontSize: 14,
    fontWeight: '700',
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  smallButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: theme.colors.surfaceAlt,
  },
  smallButtonText: {
    color: theme.colors.text,
    fontFamily: theme.font,
    fontSize: 13,
    fontWeight: '700',
  },
  todayActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  kpiRow: {
    marginTop: theme.spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  kpiValue: {
    color: theme.colors.text,
    fontFamily: theme.font,
    fontSize: 23,
    fontWeight: '700',
    letterSpacing: 0,
  },
  kpiLabel: {
    marginTop: 4,
    color: theme.colors.muted,
    fontFamily: theme.font,
    fontSize: 13,
  },
  loss: {
    color: theme.colors.amber,
  },
  divider: {
    marginTop: theme.spacing.md,
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.line,
  },
  recordRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  recordValue: {
    color: theme.colors.text,
    fontFamily: theme.font,
    fontSize: 14,
    fontWeight: '700',
  },
  adviceHeader: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    alignItems: 'flex-start',
  },
  adviceIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F0E5',
  },
  growthIcon: {
    backgroundColor: '#E8F3ED',
  },
  adviceText: {
    flex: 1,
    gap: 4,
  },
  adviceTitle: {
    color: theme.colors.text,
    fontFamily: theme.font,
    fontSize: 17,
    fontWeight: '700',
  },
  adviceBody: {
    color: theme.colors.muted,
    fontFamily: theme.font,
    fontSize: 14,
    lineHeight: 20,
  },
  adviceStats: {
    marginTop: theme.spacing.lg,
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  adviceStat: {
    flex: 1,
    minHeight: 70,
    borderRadius: 16,
    padding: theme.spacing.sm,
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceAlt,
  },
  adviceStatValue: {
    color: theme.colors.text,
    fontFamily: theme.font,
    fontSize: 15,
    fontWeight: '700',
  },
  adviceStatLabel: {
    marginTop: 4,
    color: theme.colors.muted,
    fontFamily: theme.font,
    fontSize: 12,
    fontWeight: '600',
  },
  swipeRecord: {
    backgroundColor: theme.colors.surface,
  },
  swipeActions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingVertical: 4,
  },
  swipeAction: {
    width: 82,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  editAction: {
    backgroundColor: theme.colors.blue,
  },
  deleteAction: {
    backgroundColor: theme.colors.red,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
  },
  swipeActionText: {
    color: theme.colors.surface,
    fontFamily: theme.font,
    fontSize: 12,
    fontWeight: '700',
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
  },
  autocalcLabel: {
    color: theme.colors.muted,
    fontFamily: theme.font,
    fontSize: 14,
    fontWeight: '600',
  },
  autocalcValue: {
    color: theme.colors.text,
    fontFamily: theme.font,
    fontSize: 17,
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
