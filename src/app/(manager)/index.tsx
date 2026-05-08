import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';

import { AppScreen } from '@/components/AppScreen';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { InsightCard } from '@/components/InsightCard';
import { ListItem } from '@/components/ListItem';
import { MetricCard } from '@/components/MetricCard';
import { SectionHeader } from '@/components/SectionHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { theme } from '@/constants/theme';
import { logout } from '@/services/auth.service';
import { forecastNextDay } from '@/services/forecast.service';
import {
  getDailyPlans,
  getInventory,
  getProductionRecords,
  getPurchaseOrders,
  getSettings,
} from '@/services/storage.service';
import { DailyPlan, ForecastResult, ProductionRecord, PurchaseOrder } from '@/types';
import { displayDate, sortByDateAsc, todayKey } from '@/utils/date';
import { formatCurrency, formatKg } from '@/utils/format';
import { sum } from '@/utils/math';

export default function ManagerDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<ProductionRecord[]>([]);
  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [todayPlan, setTodayPlan] = useState<DailyPlan | null>(null);

  const load = useCallback(async () => {
    const [nextRecords, inventory, settings, nextOrders, plans] = await Promise.all([
      getProductionRecords(),
      getInventory(),
      getSettings(),
      getPurchaseOrders(),
      getDailyPlans(),
    ]);
    const sorted = sortByDateAsc(nextRecords);
    setRecords(sorted);
    setForecast(forecastNextDay(sorted, inventory, settings));
    setOrders(nextOrders);
    setTodayPlan(plans.find((p) => p.date === todayKey()) ?? null);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const todayRecord = records.find((r) => r.date === todayKey()) ?? records.at(-1);
  const last7 = records.slice(-7);
  const weeklyRevenue = sum(last7.map((r) => r.revenue));
  const pendingOrders = orders.filter((o) => o.status === 'submitted' || o.status === 'pending');
  const flaggedOrders = orders.filter((o) => o.status === 'flagged');

  const handleLogout = async () => {
    await logout();
    router.replace('/login' as any);
  };

  return (
    <AppScreen
      title="Manager"
      subtitle="Osh Markazi Operations"
      loading={loading}
      onRefresh={load}
      right={
        <Pressable style={styles.logoutBtn} onPress={() => void handleLogout()}>
          <Ionicons name="log-out-outline" size={20} color={theme.colors.muted} />
        </Pressable>
      }>

      <View style={styles.metricRow}>
        <MetricCard
          label="To verify"
          value={String(pendingOrders.length)}
          detail="Purchase orders"
          tone={pendingOrders.length > 0 ? 'amber' : 'green'}
        />
        <MetricCard
          label="Flagged"
          value={String(flaggedOrders.length)}
          detail="Price issues"
          tone={flaggedOrders.length > 0 ? 'red' : 'green'}
        />
      </View>

      {forecast ? (
        <InsightCard
          title={forecast.holidayName ? `Tomorrow · ${forecast.holidayName}` : 'Tomorrow forecast'}
          body={`${formatKg(forecast.recommendedCookKg)} recommended · ${forecast.confidence}% confidence. ${forecast.message}`}
          icon="sparkles-outline"
          tone="blue"
        />
      ) : null}

      {flaggedOrders.length > 0 ? (
        <>
          <SectionHeader title="Price alerts" />
          <Card>
            {flaggedOrders.slice(0, 3).map((order) => (
              <ListItem
                key={order.id}
                title={displayDate(order.date)}
                subtitle={`${order.items.filter((i) => i.flagged).length} flagged items · ${order.overallVariancePercent > 0 ? '+' : ''}${order.overallVariancePercent.toFixed(1)}% overall`}
                right={<StatusBadge label="Flagged" tone="red" />}
              />
            ))}
          </Card>
        </>
      ) : null}

      {todayPlan ? (
        <>
          <SectionHeader title="Today's shopping plan" />
          <Card>
            <ListItem title="Planned cook" value={formatKg(todayPlan.plannedCookKg)} />
            <ListItem title="Forecast demand" value={formatKg(todayPlan.forecastKg)} />
            <ListItem
              title="Ingredient budget"
              value={formatCurrency(todayPlan.shoppingList.reduce((s, i) => s + i.estimatedCost, 0))}
            />
            {todayPlan.holidayName ? (
              <ListItem title="Holiday" value={todayPlan.holidayName} right={<StatusBadge label={`×${todayPlan.holidayMultiplier}`} tone="blue" />} />
            ) : null}
          </Card>
        </>
      ) : null}

      {todayRecord ? (
        <>
          <SectionHeader title="Today's production" />
          <Card>
            <View style={styles.prodRow}>
              <View>
                <Text style={styles.prodValue}>{formatKg(todayRecord.cookedKg)}</Text>
                <Text style={styles.prodLabel}>Cooked</Text>
              </View>
              <View>
                <Text style={styles.prodValue}>{formatKg(todayRecord.soldKg)}</Text>
                <Text style={styles.prodLabel}>Sold</Text>
              </View>
              <View>
                <Text style={[styles.prodValue, { color: theme.colors.amber }]}>{formatKg(todayRecord.wasteKg)}</Text>
                <Text style={styles.prodLabel}>Waste</Text>
              </View>
            </View>
          </Card>
        </>
      ) : (
        <EmptyState title="No production today" message="Add today's production record." icon="restaurant-outline" />
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  logoutBtn: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.line },
  metricRow: { flexDirection: 'row', gap: theme.spacing.md },
  prodRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  prodValue: { color: theme.colors.text, fontFamily: theme.font, fontSize: 24, fontWeight: '700' },
  prodLabel: { marginTop: 4, color: theme.colors.muted, fontFamily: theme.font, fontSize: 13, fontWeight: '600' },
});
