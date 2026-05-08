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
import { MiniChart } from '@/components/MiniChart';
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
import { DailyPlan, ForecastResult, ProductionRecord, PurchaseOrder, RestaurantSettings } from '@/types';
import { displayDate, sortByDateAsc, todayKey } from '@/utils/date';
import { formatCurrency, formatKg, formatPercent } from '@/utils/format';
import { sum } from '@/utils/math';

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<ProductionRecord[]>([]);
  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [todayPlan, setTodayPlan] = useState<DailyPlan | null>(null);

  const load = useCallback(async () => {
    const [nextRecords, inventory, nextSettings, nextOrders, plans] = await Promise.all([
      getProductionRecords(),
      getInventory(),
      getSettings(),
      getPurchaseOrders(),
      getDailyPlans(),
    ]);
    const sorted = sortByDateAsc(nextRecords);
    setRecords(sorted);
    setSettings(nextSettings);
    setForecast(forecastNextDay(sorted, inventory, nextSettings));
    setOrders(nextOrders);
    setTodayPlan(plans.find((p) => p.date === todayKey()) ?? null);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const todayRecord = records.find((r) => r.date === todayKey()) ?? records.at(-1);
  const last7 = records.slice(-7);
  const weeklyRevenue = sum(last7.map((r) => r.revenue));
  const weeklyWasteLoss = sum(last7.map((r) => r.wasteLoss));
  const pendingOrders = orders.filter((o) => o.status === 'pending' || o.status === 'submitted' || o.status === 'flagged');
  const flaggedOrders = orders.filter((o) => o.status === 'flagged');
  const urgentPurchases = forecast?.purchaseRecommendations.filter((i) => i.urgency === 'urgent') ?? [];

  const handleLogout = async () => {
    await logout();
    router.replace('/login' as any);
  };

  return (
    <AppScreen
      title="Admin"
      subtitle={settings?.restaurantName ?? 'Osh Markazi'}
      loading={loading}
      onRefresh={load}
      right={
        <Pressable style={styles.logoutBtn} onPress={() => void handleLogout()}>
          <Ionicons name="log-out-outline" size={20} color={theme.colors.muted} />
        </Pressable>
      }>

      {todayRecord ? (
        <>
          <View style={styles.metricRow}>
            <MetricCard label="Weekly revenue" value={formatCurrency(weeklyRevenue)} detail="Last 7 days" tone="green" />
            <MetricCard label="Waste loss" value={formatCurrency(weeklyWasteLoss)} detail="Last 7 days" tone="amber" />
          </View>

          <View style={styles.metricRow}>
            <MetricCard
              label="Pending orders"
              value={String(pendingOrders.length)}
              detail={flaggedOrders.length > 0 ? `${flaggedOrders.length} flagged` : 'All clear'}
              tone={flaggedOrders.length > 0 ? 'red' : 'green'}
            />
            <MetricCard
              label="Stock alerts"
              value={String(urgentPurchases.length)}
              detail={urgentPurchases.length > 0 ? 'Needs action' : 'Healthy'}
              tone={urgentPurchases.length > 0 ? 'red' : 'green'}
            />
          </View>

          {forecast ? (
            <InsightCard
              title={forecast.holidayName ? `Forecast · ${forecast.holidayName}` : 'Forecast'}
              body={`Tomorrow: ${formatKg(forecast.recommendedCookKg)} recommended · ${forecast.confidence}% confidence. ${forecast.message}`}
              icon="sparkles-outline"
              tone="blue"
            />
          ) : null}

          {flaggedOrders.length > 0 ? (
            <>
              <SectionHeader title="Flagged purchases" />
              <Card>
                {flaggedOrders.slice(0, 3).map((order) => (
                  <ListItem
                    key={order.id}
                    title={displayDate(order.date)}
                    subtitle={`${order.items.filter((i) => i.flagged).length} items flagged · variance ${order.overallVariancePercent > 0 ? '+' : ''}${order.overallVariancePercent.toFixed(1)}%`}
                    right={<StatusBadge label="Flagged" tone="red" />}
                  />
                ))}
              </Card>
            </>
          ) : null}

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

          {todayPlan ? (
            <>
              <SectionHeader title="Today's plan" />
              <Card>
                <ListItem
                  title="Planned cook"
                  value={formatKg(todayPlan.plannedCookKg)}
                />
                <ListItem
                  title="Forecasted demand"
                  value={formatKg(todayPlan.forecastKg)}
                />
                {todayPlan.holidayName ? (
                  <ListItem
                    title="Holiday"
                    value={todayPlan.holidayName}
                    right={<StatusBadge label={`×${todayPlan.holidayMultiplier}`} tone="blue" />}
                  />
                ) : null}
                <ListItem
                  title="Estimated ingredient cost"
                  value={formatCurrency(todayPlan.shoppingList.reduce((s, i) => s + i.estimatedCost, 0))}
                />
              </Card>
            </>
          ) : null}

          <SectionHeader title="Weekly performance" />
          <Card>
            <MiniChart records={last7} />
          </Card>
        </>
      ) : (
        <EmptyState title="No data" message="Add production records to see analytics." />
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  logoutBtn: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.line,
  },
  metricRow: { flexDirection: 'row', gap: theme.spacing.md },
  prodRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  prodValue: { color: theme.colors.text, fontFamily: theme.font, fontSize: 24, fontWeight: '700' },
  prodLabel: { marginTop: 4, color: theme.colors.muted, fontFamily: theme.font, fontSize: 13, fontWeight: '600' },
});
