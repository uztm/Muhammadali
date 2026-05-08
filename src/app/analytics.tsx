import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/AppScreen';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { InsightCard } from '@/components/InsightCard';
import { ListItem } from '@/components/ListItem';
import { MetricCard } from '@/components/MetricCard';
import { MiniChart } from '@/components/MiniChart';
import { SectionHeader } from '@/components/SectionHeader';
import { theme } from '@/constants/theme';
import { calculateWasteAnalytics, forecastNextDay } from '@/services/forecast.service';
import { getInventory, getProductionRecords, getSettings } from '@/services/storage.service';
import { ProductionRecord, WasteAnalytics } from '@/types';
import { displayDate, sortByDateAsc } from '@/utils/date';
import { formatCurrency, formatKg, formatPercent, formatSignedPercent } from '@/utils/format';

export default function AnalyticsScreen() {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<ProductionRecord[]>([]);
  const [analytics, setAnalytics] = useState<WasteAnalytics | null>(null);

  const load = useCallback(async () => {
    const [nextRecords, inventory, settings] = await Promise.all([
      getProductionRecords(),
      getInventory(),
      getSettings(),
    ]);
    const sorted = sortByDateAsc(nextRecords);
    const forecast = forecastNextDay(sorted, inventory, settings);
    setRecords(sorted);
    setAnalytics(calculateWasteAnalytics(sorted, settings, forecast));
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const last7 = records.slice(-7);

  return (
    <AppScreen title="Waste" subtitle="Spoilage, overproduction, and money loss" loading={loading} onRefresh={load}>
      {analytics ? (
        <View>
          <View style={styles.metricRow}>
            <MetricCard label="Weekly waste" value={formatKg(analytics.weeklyWasteKg)} detail="Last 7 days" tone="amber" />
            <MetricCard label="Waste rate" value={formatPercent(analytics.wasteRate)} detail="Cooked vs wasted" tone="red" />
          </View>
          <MetricCard
            label="Money lost"
            value={formatCurrency(analytics.wasteLoss)}
            detail={`${formatSignedPercent(analytics.trendPercent)} vs previous week`}
            tone={analytics.trendPercent > 0 ? 'red' : 'green'}
          />
          <MetricCard
            label="Target gap"
            value={formatKg(analytics.targetReductionKg)}
            detail={`${formatKg(analytics.planningTargetKg)} target · ${formatKg(analytics.recommendedCookKg)} forecast`}
            tone={analytics.targetReductionKg > 0 ? 'amber' : 'green'}
          />

          <SectionHeader title="Waste trend" />
          <Card>
            <MiniChart records={last7} mode="waste" />
          </Card>

          <SectionHeader title="Operational insight" />
          {analytics.insights.map((insight, index) => (
            <InsightCard
              key={insight}
              title={index === 0 ? 'Weekly comparison' : index === 1 ? 'Daily average' : 'Savings opportunity'}
              body={insight}
              icon={index === 2 ? 'cash-outline' : 'analytics-outline'}
              tone={index === 0 && analytics.trendPercent > 0 ? 'amber' : 'green'}
            />
          ))}

          <SectionHeader title="Best and worst day" />
          <Card>
            {analytics.bestDay ? (
              <ListItem
                title="Best day"
                subtitle={displayDate(analytics.bestDay.date)}
                value={`${formatKg(analytics.bestDay.wasteKg)} waste`}
              />
            ) : null}
            {analytics.worstDay ? (
              <ListItem
                title="Worst day"
                subtitle={displayDate(analytics.worstDay.date)}
                value={`${formatKg(analytics.worstDay.wasteKg)} waste`}
              />
            ) : null}
            <View style={styles.note}>
              <Text style={styles.noteText}>
                Planned target above forecast creates about {formatKg(analytics.targetWasteRiskKg)} daily
                overproduction risk before sales variation.
              </Text>
            </View>
          </Card>
        </View>
      ) : (
        <EmptyState title="No analytics yet" message="Production records are required for waste analytics." />
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  metricRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  note: {
    paddingVertical: theme.spacing.md,
  },
  noteText: {
    color: theme.colors.muted,
    fontFamily: theme.font,
    fontSize: 13,
    lineHeight: 19,
  },
});
