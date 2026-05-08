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
import { MetricCard } from '@/components/MetricCard';
import { MiniChart } from '@/components/MiniChart';
import { NumberInput } from '@/components/NumberInput';
import { SectionHeader } from '@/components/SectionHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { theme } from '@/constants/theme';
import { calculateInventoryDaysRemaining, calculateWasteAnalytics, forecastNextDay } from '@/services/forecast.service';
import {
  addProductionRecord,
  deleteProductionRecord,
  getInventory,
  getProductionRecords,
  getSettings,
  updateInventory,
  updateProductionRecord,
} from '@/services/storage.service';
import { ForecastResult, InventoryItem, ProductionRecord, RestaurantSettings } from '@/types';
import { displayDate, sortByDateAsc, sortByDateDesc, todayKey } from '@/utils/date';
import { formatCurrency, formatKg, formatPercent, formatUnit } from '@/utils/format';
import { roundTo } from '@/utils/math';

type OpsTab = 'production' | 'inventory' | 'analytics';

interface ProductionForm {
  date: string;
  cookedKg: string;
  soldKg: string;
  pricePerKg: string;
}

export default function OperationsScreen() {
  const [tab, setTab] = useState<OpsTab>('production');
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<ProductionRecord[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState<ProductionForm>({ date: todayKey(), cookedKg: '10', soldKg: '8', pricePerKg: '85000' });
  const [errors, setErrors] = useState<Partial<ProductionForm>>({});

  const load = useCallback(async () => {
    const [nextRecords, inv, s] = await Promise.all([
      getProductionRecords(),
      getInventory(),
      getSettings(),
    ]);
    const sorted = sortByDateAsc(nextRecords);
    setRecords(sortByDateDesc(nextRecords));
    setInventory(inv);
    setSettings(s);
    setForecast(forecastNextDay(sorted, inv, s));
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const analytics = settings && forecast
    ? calculateWasteAnalytics(sortByDateAsc(records), settings, forecast)
    : null;

  const formWaste = useMemo(() => {
    const c = Number(form.cookedKg), s = Number(form.soldKg);
    return Number.isFinite(c) && Number.isFinite(s) ? roundTo(Math.max(0, c - s), 1) : 0;
  }, [form.cookedKg, form.soldKg]);

  const openForm = (record?: ProductionRecord) => {
    setErrors({});
    if (record) {
      setForm({ date: record.date, cookedKg: String(record.cookedKg), soldKg: String(record.soldKg), pricePerKg: String(record.pricePerKg) });
    } else {
      setForm({ date: todayKey(), cookedKg: String(settings?.defaultCookKg ?? 10), soldKg: '8', pricePerKg: String(settings?.pricePerKg ?? 85000) });
    }
    setModalVisible(true);
  };

  const validate = () => {
    const next: Partial<ProductionForm> = {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) next.date = 'Use YYYY-MM-DD.';
    const c = Number(form.cookedKg), s = Number(form.soldKg), p = Number(form.pricePerKg);
    if (!Number.isFinite(c) || c <= 0) next.cookedKg = 'Must be positive.';
    if (!Number.isFinite(s) || s < 0) next.soldKg = 'Cannot be negative.';
    if (s > c) next.soldKg = 'Cannot exceed cooked kg.';
    if (!Number.isFinite(p) || p <= 0) next.pricePerKg = 'Must be positive.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    const c = Number(form.cookedKg), s = Number(form.soldKg), p = Number(form.pricePerKg);
    const waste = roundTo(c - s, 1);
    await addProductionRecord({ id: `production-${form.date}`, date: form.date, cookedKg: c, soldKg: s, wasteKg: waste, pricePerKg: p, revenue: Math.round(s * p), wasteLoss: Math.round(waste * p) });
    setModalVisible(false);
    await load();
  };

  return (
    <AppScreen
      title="Operations"
      subtitle="Production, inventory, and waste analytics"
      loading={loading}
      onRefresh={load}
      right={
        tab === 'production' ? (
          <Pressable style={styles.addBtn} onPress={() => openForm()}>
            <Ionicons name="add" size={22} color={theme.colors.text} />
          </Pressable>
        ) : null
      }>

      <View style={styles.tabs}>
        {(['production', 'inventory', 'analytics'] as OpsTab[]).map((t) => (
          <Pressable key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'production' && (
        <>
          {records.slice(0, 14).length === 0 ? (
            <EmptyState title="No records" message="Add production records to start tracking." />
          ) : (
            <Card>
              {records.slice(0, 14).map((record) => {
                const wasteRate = record.cookedKg > 0 ? (record.wasteKg / record.cookedKg) * 100 : 0;
                return (
                  <Swipeable
                    key={record.id}
                    overshootRight={false}
                    renderRightActions={() => (
                      <View style={styles.swipeActions}>
                        <Pressable style={[styles.swipeAction, { backgroundColor: theme.colors.blue }]} onPress={() => openForm(record)}>
                          <Ionicons name="create-outline" size={20} color={theme.colors.surface} />
                        </Pressable>
                        <Pressable
                          style={[styles.swipeAction, { backgroundColor: theme.colors.red, borderTopRightRadius: 14, borderBottomRightRadius: 14 }]}
                          onPress={() => Alert.alert('Delete?', `Remove ${displayDate(record.date)}?`, [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Delete', style: 'destructive', onPress: () => void deleteProductionRecord(record.date).then(load) },
                          ])}>
                          <Ionicons name="trash-outline" size={20} color={theme.colors.surface} />
                        </Pressable>
                      </View>
                    )}>
                    <Pressable style={{ backgroundColor: theme.colors.surface }} onPress={() => openForm(record)}>
                      <ListItem
                        title={displayDate(record.date)}
                        subtitle={`${formatKg(record.cookedKg)} cooked · ${formatKg(record.soldKg)} sold`}
                        right={
                          <View style={{ alignItems: 'flex-end', gap: 4 }}>
                            <Text style={styles.recValue}>{formatCurrency(record.revenue)}</Text>
                            <StatusBadge label={formatPercent(wasteRate)} tone={wasteRate > 18 ? 'amber' : 'green'} />
                          </View>
                        }
                      />
                    </Pressable>
                  </Swipeable>
                );
              })}
            </Card>
          )}
        </>
      )}

      {tab === 'inventory' && (
        <>
          {forecast && (
            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <MetricCard
                label="Urgent"
                value={String(forecast.purchaseRecommendations.filter((r) => r.urgency === 'urgent').length)}
                detail="Items below requirement"
                tone="red"
              />
              <MetricCard
                label="Watch"
                value={String(forecast.purchaseRecommendations.filter((r) => r.urgency === 'watch').length)}
                detail="Below minimum stock"
                tone="amber"
              />
            </View>
          )}
          <Card>
            {inventory.map((item) => {
              const days = forecast ? calculateInventoryDaysRemaining(item, forecast) : 0;
              const urgency = forecast?.purchaseRecommendations.find((r) => r.itemId === item.id)?.urgency ?? 'ok';
              return (
                <ListItem
                  key={item.id}
                  title={item.name}
                  subtitle={`${formatUnit(item.currentStock, item.unit)} in stock · min ${formatUnit(item.minimumStock, item.unit)}`}
                  right={
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Text style={styles.recValue}>{days.toFixed(1)} days</Text>
                      {urgency !== 'ok' && <StatusBadge label={urgency === 'urgent' ? 'Urgent' : 'Watch'} tone={urgency === 'urgent' ? 'red' : 'amber'} />}
                    </View>
                  }
                />
              );
            })}
          </Card>
        </>
      )}

      {tab === 'analytics' && analytics && (
        <>
          <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
            <MetricCard label="Weekly waste" value={formatKg(analytics.weeklyWasteKg)} detail="Last 7 days" tone="amber" />
            <MetricCard label="Waste rate" value={formatPercent(analytics.wasteRate)} detail="Cooked vs wasted" tone="red" />
          </View>
          <MetricCard label="Money lost" value={formatCurrency(analytics.wasteLoss)} detail={`${analytics.trendPercent > 0 ? '+' : ''}${analytics.trendPercent.toFixed(1)}% vs last week`} tone={analytics.trendPercent > 0 ? 'red' : 'green'} />
          <SectionHeader title="Weekly trend" />
          <Card><MiniChart records={sortByDateAsc(records).slice(-7)} mode="waste" /></Card>
          <SectionHeader title="Insights" />
          {analytics.insights.map((insight, i) => (
            <Card key={i} style={styles.insightCard}>
              <Text style={styles.insightText}>{insight}</Text>
            </Card>
          ))}
        </>
      )}

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <AppScreen
          title="Production record"
          right={<Pressable style={styles.addBtn} onPress={() => setModalVisible(false)}><Ionicons name="close" size={22} color={theme.colors.text} /></Pressable>}>
          <Card style={{ gap: theme.spacing.md }}>
            <FormInput label="Date" value={form.date} error={errors.date} onChangeText={(v) => setForm((c) => ({ ...c, date: v }))} placeholder="YYYY-MM-DD" />
            <NumberInput label="Cooked" suffix="kg" value={form.cookedKg} error={errors.cookedKg} onChangeText={(v) => setForm((c) => ({ ...c, cookedKg: v }))} />
            <NumberInput label="Sold" suffix="kg" value={form.soldKg} error={errors.soldKg} onChangeText={(v) => setForm((c) => ({ ...c, soldKg: v }))} />
            <NumberInput label="Price per kg" suffix="UZS" value={form.pricePerKg} error={errors.pricePerKg} onChangeText={(v) => setForm((c) => ({ ...c, pricePerKg: v }))} />
            <View style={styles.autoCalc}>
              <Text style={styles.autoCalcLabel}>Auto-calculated waste</Text>
              <Text style={styles.autoCalcValue}>{formatKg(formWaste)}</Text>
            </View>
            <Pressable style={styles.primaryBtn} onPress={() => void save().catch(() => Alert.alert('Error', 'Could not save.'))}>
              <Text style={styles.primaryBtnText}>Save record</Text>
            </Pressable>
          </Card>
        </AppScreen>
      </Modal>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  addBtn: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.line },
  tabs: { flexDirection: 'row', backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.sm, padding: 4, gap: 4 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: theme.colors.surface, ...theme.shadow },
  tabText: { color: theme.colors.muted, fontFamily: theme.font, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: theme.colors.text },
  recValue: { color: theme.colors.text, fontFamily: theme.font, fontSize: 14, fontWeight: '700' },
  swipeActions: { flexDirection: 'row', alignItems: 'stretch', paddingVertical: 4 },
  swipeAction: { width: 60, alignItems: 'center', justifyContent: 'center' },
  insightCard: { padding: theme.spacing.md },
  insightText: { color: theme.colors.text, fontFamily: theme.font, fontSize: 14, lineHeight: 20 },
  autoCalc: { minHeight: 52, borderRadius: 14, backgroundColor: theme.colors.surfaceAlt, paddingHorizontal: theme.spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  autoCalcLabel: { color: theme.colors.muted, fontFamily: theme.font, fontSize: 14, fontWeight: '600' },
  autoCalcValue: { color: theme.colors.text, fontFamily: theme.font, fontSize: 16, fontWeight: '700' },
  primaryBtn: { height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primary },
  primaryBtnText: { color: theme.colors.surface, fontFamily: theme.font, fontSize: 16, fontWeight: '700' },
});
