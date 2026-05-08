import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { AppScreen } from '@/components/AppScreen';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { InsightCard } from '@/components/InsightCard';
import { ListItem } from '@/components/ListItem';
import { MetricCard } from '@/components/MetricCard';
import { SectionHeader } from '@/components/SectionHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { theme } from '@/constants/theme';
import { generatePlansForRange, getMonthlyForecast } from '@/services/planning.service';
import {
  getDailyPlans,
  getInventory,
  getProductionRecords,
  getSettings,
  saveDailyPlans,
} from '@/services/storage.service';
import { DailyPlan, MonthlyForecast, RestaurantSettings } from '@/types';
import { addDays, displayDate, todayKey, toDateKey } from '@/utils/date';
import { formatCurrency, formatKg } from '@/utils/format';

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export default function PlanningScreen() {
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<DailyPlan[]>([]);
  const [monthlyForecasts, setMonthlyForecasts] = useState<MonthlyForecast[]>([]);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear] = useState(new Date().getFullYear());

  const load = useCallback(async () => {
    const [nextPlans, records, inventory, nextSettings] = await Promise.all([
      getDailyPlans(),
      getProductionRecords(),
      getInventory(),
      getSettings(),
    ]);
    setPlans(nextPlans);
    setSettings(nextSettings);

    const forecasts = Array.from({ length: 12 }, (_, i) =>
      getMonthlyForecast(selectedYear, i + 1, records, inventory, nextSettings),
    );
    setMonthlyForecasts(forecasts);
    setLoading(false);
  }, [selectedYear]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const handleRegenerate = async () => {
    const [records, inventory, nextSettings] = await Promise.all([
      getProductionRecords(),
      getInventory(),
      getSettings(),
    ]);
    const today = new Date();
    const newPlans = generatePlansForRange(today, 30, records, inventory, nextSettings);
    await saveDailyPlans(newPlans);
    await load();
    Alert.alert('Plans regenerated', 'Next 30 days of plans were rebuilt from latest data.');
  };

  const monthForecast = monthlyForecasts[selectedMonth - 1];
  const monthPlans = plans
    .filter((p) => {
      const d = new Date(p.date);
      return d.getMonth() + 1 === selectedMonth && d.getFullYear() === selectedYear;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const upcomingPlans = plans
    .filter((p) => p.date >= todayKey())
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 7);

  const todayPlan = plans.find((p) => p.date === todayKey());
  const totalIngredientCost = todayPlan
    ? todayPlan.shoppingList.reduce((s, i) => s + i.estimatedCost, 0)
    : 0;

  return (
    <AppScreen
      title="Planning"
      subtitle="Yearly, monthly, and daily food preparation plans"
      loading={loading}
      onRefresh={load}
      right={
        <Pressable style={styles.iconButton} onPress={() => void handleRegenerate()}>
          <Ionicons name="refresh-outline" size={22} color={theme.colors.text} />
        </Pressable>
      }>

      {todayPlan ? (
        <>
          <SectionHeader title="Today's plan" />
          <Card>
            <View style={styles.todayRow}>
              <View style={styles.todayKpi}>
                <Text style={styles.kpiValue}>{formatKg(todayPlan.plannedCookKg)}</Text>
                <Text style={styles.kpiLabel}>Planned cook</Text>
              </View>
              <View style={styles.todayKpi}>
                <Text style={styles.kpiValue}>{formatKg(todayPlan.forecastKg)}</Text>
                <Text style={styles.kpiLabel}>Forecasted</Text>
              </View>
              <View style={styles.todayKpi}>
                <Text style={styles.kpiValue}>{formatCurrency(totalIngredientCost)}</Text>
                <Text style={styles.kpiLabel}>Est. cost</Text>
              </View>
            </View>
            {todayPlan.holidayName ? (
              <InsightCard
                title={todayPlan.holidayName}
                body={todayPlan.notes}
                icon="star-outline"
                tone="blue"
              />
            ) : null}
            <SectionHeader title="Today's shopping list" />
            {todayPlan.shoppingList.map((item) => (
              <ListItem
                key={item.itemId}
                title={item.name}
                subtitle={`Est. ${formatCurrency(item.estimatedUnitPrice)}/${item.unit}`}
                value={`${item.quantity} ${item.unit}`}
              />
            ))}
          </Card>
        </>
      ) : (
        <EmptyState
          title="No plan today"
          message="Tap the refresh icon above to generate plans."
          icon="calendar-outline"
        />
      )}

      <SectionHeader title="Upcoming 7 days" />
      <Card>
        {upcomingPlans.length === 0 ? (
          <EmptyState title="No upcoming plans" message="Regenerate plans to populate." icon="calendar-outline" />
        ) : (
          upcomingPlans.map((plan) => (
            <ListItem
              key={plan.id}
              title={displayDate(plan.date)}
              subtitle={plan.holidayName ? plan.holidayName : `×${plan.dayOfWeekMultiplier.toFixed(2)} day · ×${plan.seasonalMultiplier.toFixed(2)} seasonal`}
              value={formatKg(plan.plannedCookKg)}
              right={
                plan.holidayName ? (
                  <StatusBadge label="Holiday" tone="blue" />
                ) : plan.plannedCookKg > 12 ? (
                  <StatusBadge label="Peak" tone="green" />
                ) : null
              }
            />
          ))
        )}
      </Card>

      <SectionHeader title="Monthly overview" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.monthScroll} contentContainerStyle={styles.monthRow}>
        {MONTH_NAMES.map((name, i) => {
          const mf = monthlyForecasts[i];
          const isSelected = selectedMonth === i + 1;
          return (
            <Pressable
              key={name}
              style={[styles.monthChip, isSelected && styles.monthChipActive]}
              onPress={() => setSelectedMonth(i + 1)}>
              <Text style={[styles.monthName, isSelected && styles.monthNameActive]}>{name}</Text>
              {mf && (
                <Text style={[styles.monthKg, isSelected && styles.monthNameActive]}>
                  {Math.round(mf.totalForecastKg)}kg
                </Text>
              )}
              {mf && mf.holidays.length > 0 && (
                <View style={styles.holidayDot} />
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {monthForecast ? (
        <Card style={styles.monthCard}>
          <View style={styles.metricRow}>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{formatKg(monthForecast.totalForecastKg)}</Text>
              <Text style={styles.metricLabel}>Total forecast</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{formatKg(monthForecast.avgDailyKg)}</Text>
              <Text style={styles.metricLabel}>Daily avg</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{formatCurrency(monthForecast.estimatedRevenue)}</Text>
              <Text style={styles.metricLabel}>Est. revenue</Text>
            </View>
          </View>
          {monthForecast.holidays.length > 0 ? (
            <View style={styles.holidayList}>
              {monthForecast.holidays.map((h) => (
                <View key={h.id} style={styles.holidayTag}>
                  <Text style={styles.holidayTagText}>{h.name} ×{h.demandMultiplier}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </Card>
      ) : null}

      {monthPlans.length > 0 ? (
        <>
          <SectionHeader title={`${MONTH_NAMES[selectedMonth - 1]} daily breakdown`} />
          <Card>
            {monthPlans.map((plan) => (
              <ListItem
                key={plan.id}
                title={displayDate(plan.date)}
                subtitle={plan.holidayName ?? `×${plan.seasonalMultiplier.toFixed(2)} season`}
                value={formatKg(plan.plannedCookKg)}
                right={
                  plan.holidayName ? <StatusBadge label="Holiday" tone="blue" /> :
                  plan.status === 'completed' ? <StatusBadge label="Done" tone="green" /> :
                  plan.status === 'active' ? <StatusBadge label="Today" tone="amber" /> : null
                }
              />
            ))}
          </Card>
        </>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.line,
  },
  todayRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  todayKpi: { alignItems: 'center' },
  kpiValue: { color: theme.colors.text, fontFamily: theme.font, fontSize: 18, fontWeight: '700' },
  kpiLabel: { marginTop: 4, color: theme.colors.muted, fontFamily: theme.font, fontSize: 12 },
  monthScroll: { marginHorizontal: -theme.spacing.xl },
  monthRow: { paddingHorizontal: theme.spacing.xl, gap: theme.spacing.sm, paddingVertical: 4 },
  monthChip: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14,
    backgroundColor: theme.colors.surface, alignItems: 'center', minWidth: 60,
    borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.line,
  },
  monthChipActive: { backgroundColor: theme.colors.text, borderColor: theme.colors.text },
  monthName: { color: theme.colors.text, fontFamily: theme.font, fontSize: 13, fontWeight: '700' },
  monthNameActive: { color: theme.colors.surface },
  monthKg: { marginTop: 2, color: theme.colors.muted, fontFamily: theme.font, fontSize: 11 },
  holidayDot: { marginTop: 4, width: 5, height: 5, borderRadius: 3, backgroundColor: theme.colors.blue },
  monthCard: { gap: theme.spacing.sm },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between' },
  metricItem: { alignItems: 'center' },
  metricValue: { color: theme.colors.text, fontFamily: theme.font, fontSize: 16, fontWeight: '700' },
  metricLabel: { marginTop: 4, color: theme.colors.muted, fontFamily: theme.font, fontSize: 12 },
  holidayList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: theme.spacing.sm },
  holidayTag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: theme.colors.blue + '18' },
  holidayTagText: { color: theme.colors.blue, fontFamily: theme.font, fontSize: 12, fontWeight: '600' },
});
