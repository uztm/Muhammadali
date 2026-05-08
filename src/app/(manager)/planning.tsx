import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, Pressable, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { AppScreen } from '@/components/AppScreen';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { ListItem } from '@/components/ListItem';
import { SectionHeader } from '@/components/SectionHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { theme } from '@/constants/theme';
import { getMonthlyForecast } from '@/services/planning.service';
import { getDailyPlans, getInventory, getProductionRecords, getSettings } from '@/services/storage.service';
import { DailyPlan, MonthlyForecast } from '@/types';
import { displayDate, todayKey } from '@/utils/date';
import { formatCurrency, formatKg } from '@/utils/format';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function ManagerPlanningScreen() {
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<DailyPlan[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [monthForecast, setMonthForecast] = useState<MonthlyForecast | null>(null);

  const load = useCallback(async () => {
    const [nextPlans, records, inventory, settings] = await Promise.all([
      getDailyPlans(),
      getProductionRecords(),
      getInventory(),
      getSettings(),
    ]);
    setPlans(nextPlans);
    const year = new Date().getFullYear();
    setMonthForecast(getMonthlyForecast(year, selectedMonth, records, inventory, settings));
    setLoading(false);
  }, [selectedMonth]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const weekPlans = plans
    .filter((p) => p.date >= todayKey())
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 14);

  const monthPlans = plans
    .filter((p) => {
      const d = new Date(p.date);
      return d.getMonth() + 1 === selectedMonth && d.getFullYear() === new Date().getFullYear();
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <AppScreen
      title="Planning"
      subtitle="Monthly and weekly production plans"
      loading={loading}
      onRefresh={load}>

      <SectionHeader title="Next 14 days" />
      <Card>
        {weekPlans.length === 0 ? (
          <EmptyState title="No plans" message="Contact admin to generate plans." icon="calendar-outline" />
        ) : (
          weekPlans.map((plan) => (
            <ListItem
              key={plan.id}
              title={displayDate(plan.date)}
              subtitle={plan.holidayName ?? `×${plan.seasonalMultiplier.toFixed(2)} seasonal`}
              value={formatKg(plan.plannedCookKg)}
              right={
                plan.holidayName
                  ? <StatusBadge label="Holiday" tone="blue" />
                  : plan.date === todayKey()
                    ? <StatusBadge label="Today" tone="amber" />
                    : null
              }
            />
          ))
        )}
      </Card>

      <SectionHeader title="Monthly forecast" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.monthScroll} contentContainerStyle={styles.monthRow}>
        {MONTH_NAMES.map((name, i) => {
          const isSelected = selectedMonth === i + 1;
          return (
            <Pressable key={name} style={[styles.chip, isSelected && styles.chipActive]} onPress={() => setSelectedMonth(i + 1)}>
              <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>{name}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {monthForecast ? (
        <Card style={styles.forecastCard}>
          <View style={styles.metricRow}>
            <View>
              <Text style={styles.metricValue}>{formatKg(monthForecast.totalForecastKg)}</Text>
              <Text style={styles.metricLabel}>Total</Text>
            </View>
            <View>
              <Text style={styles.metricValue}>{formatKg(monthForecast.avgDailyKg)}</Text>
              <Text style={styles.metricLabel}>Daily avg</Text>
            </View>
            <View>
              <Text style={styles.metricValue}>{formatCurrency(monthForecast.estimatedRevenue)}</Text>
              <Text style={styles.metricLabel}>Revenue</Text>
            </View>
          </View>
          {monthForecast.holidays.length > 0 ? (
            <View style={styles.holidayList}>
              {monthForecast.holidays.map((h) => (
                <View key={h.id} style={styles.holidayTag}>
                  <Text style={styles.holidayTagText}>{h.name}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </Card>
      ) : null}

      {monthPlans.length > 0 ? (
        <>
          <SectionHeader title={`${MONTH_NAMES[selectedMonth - 1]} daily plan`} />
          <Card>
            {monthPlans.map((plan) => (
              <ListItem
                key={plan.id}
                title={displayDate(plan.date)}
                subtitle={plan.holidayName ?? `Budget: ${formatCurrency(plan.shoppingList.reduce((s, i) => s + i.estimatedCost, 0))}`}
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
  monthScroll: { marginHorizontal: -theme.spacing.xl },
  monthRow: { paddingHorizontal: theme.spacing.xl, gap: theme.spacing.sm, paddingVertical: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14, backgroundColor: theme.colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.line },
  chipActive: { backgroundColor: theme.colors.text, borderColor: theme.colors.text },
  chipText: { color: theme.colors.text, fontFamily: theme.font, fontSize: 13, fontWeight: '700' },
  chipTextActive: { color: theme.colors.surface },
  forecastCard: { gap: theme.spacing.sm },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between' },
  metricValue: { color: theme.colors.text, fontFamily: theme.font, fontSize: 16, fontWeight: '700' },
  metricLabel: { marginTop: 4, color: theme.colors.muted, fontFamily: theme.font, fontSize: 12 },
  holidayList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: theme.spacing.sm },
  holidayTag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: theme.colors.blue + '18' },
  holidayTagText: { color: theme.colors.blue, fontFamily: theme.font, fontSize: 12, fontWeight: '600' },
});
