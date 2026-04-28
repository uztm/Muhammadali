import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

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
import { forecastNextDay } from '@/services/forecast.service';
import { getInventory, getProductionRecords, getSettings } from '@/services/storage.service';
import { ForecastResult, ProductionRecord, RestaurantSettings } from '@/types';
import { displayDate, sortByDateAsc, todayKey } from '@/utils/date';
import { formatCurrency, formatKg, formatPercent } from '@/utils/format';
import { sum } from '@/utils/math';

export default function DashboardScreen() {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<ProductionRecord[]>([]);
  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);

  const load = useCallback(async () => {
    const [nextRecords, inventory, nextSettings] = await Promise.all([
      getProductionRecords(),
      getInventory(),
      getSettings(),
    ]);
    setRecords(sortByDateAsc(nextRecords));
    setSettings(nextSettings);
    setForecast(forecastNextDay(nextRecords, inventory, nextSettings));
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const todayRecord = records.find((record) => record.date === todayKey()) ?? records.at(-1);
  const last7 = records.slice(-7);
  const weeklyRevenue = sum(last7.map((record) => record.revenue));
  const wasteRate = todayRecord ? (todayRecord.wasteKg / todayRecord.cookedKg) * 100 : 0;
  const urgentPurchases = forecast?.purchaseRecommendations.filter((item) => item.urgency === 'urgent') ?? [];
  const watchPurchases = forecast?.purchaseRecommendations.filter((item) => item.urgency === 'watch') ?? [];
  const stockStatus = urgentPurchases.length > 0 ? 'Needs action' : watchPurchases.length > 0 ? 'Watch' : 'Healthy';
  const stockTone = urgentPurchases.length > 0 ? 'red' : watchPurchases.length > 0 ? 'amber' : 'green';

  return (
    <AppScreen
      title="Osh Markazi"
      subtitle={settings ? `${settings.restaurantType} · ${settings.location}` : undefined}
      loading={loading}
      onRefresh={load}>
      {!todayRecord || !forecast ? (
        <EmptyState title="No production data" message="Add a production record to start forecasting." />
      ) : (
        <>
          <Card>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.cardTitle}>Today production</Text>
                <Text style={styles.cardSub}>{displayDate(todayRecord.date)}</Text>
              </View>
              <StatusBadge label={stockStatus} tone={stockTone} />
            </View>
            <View style={styles.productionGrid}>
              <View>
                <Text style={styles.productionValue}>{formatKg(todayRecord.cookedKg)}</Text>
                <Text style={styles.productionLabel}>Cooked</Text>
              </View>
              <View>
                <Text style={styles.productionValue}>{formatKg(todayRecord.soldKg)}</Text>
                <Text style={styles.productionLabel}>Sold</Text>
              </View>
              <View>
                <Text style={[styles.productionValue, styles.wasteValue]}>
                  {formatKg(todayRecord.wasteKg)}
                </Text>
                <Text style={styles.productionLabel}>Waste</Text>
              </View>
            </View>
          </Card>

          <View style={styles.metricRow}>
            <MetricCard label="Waste rate" value={formatPercent(wasteRate)} detail="Today" tone="amber" />
            <MetricCard
              label="Revenue"
              value={formatCurrency(todayRecord.revenue)}
              detail={`Week ${formatCurrency(weeklyRevenue)}`}
              tone="green"
            />
          </View>

          <InsightCard
            title="Forecast"
            body={`${forecast.message} Tomorrow plan: ${formatKg(forecast.recommendedCookKg)} with ${forecast.confidence}% confidence.`}
            icon="sparkles-outline"
            tone="blue"
          />

          <InsightCard
            title="Waste loss"
            body={`${formatCurrency(todayRecord.wasteLoss)} estimated loss today. Potential saving: ${formatCurrency(forecast.possibleSavings)} next day.`}
            icon="trending-down-outline"
            tone="amber"
          />

          <SectionHeader title="Low-stock alerts" />
          <Card>
            {forecast.purchaseRecommendations.length === 0 ? (
              <EmptyState
                title="Inventory is covered"
                message="All key ingredients can support tomorrow production."
                icon="checkmark-circle-outline"
              />
            ) : (
              forecast.purchaseRecommendations.slice(0, 4).map((item) => (
                <ListItem
                  key={item.itemId}
                  title={item.name}
                  subtitle={item.reason}
                  right={
                    <StatusBadge
                      label={item.urgency === 'urgent' ? 'Urgent' : 'Watch'}
                      tone={item.urgency === 'urgent' ? 'red' : 'amber'}
                    />
                  }
                />
              ))
            )}
          </Card>

          <SectionHeader title="Weekly performance" />
          <Card>
            <MiniChart records={last7} />
          </Card>
        </>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  cardHeader: {
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
  productionGrid: {
    marginTop: theme.spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  productionValue: {
    color: theme.colors.text,
    fontFamily: theme.font,
    fontSize: 25,
    fontWeight: '700',
    letterSpacing: 0,
  },
  wasteValue: {
    color: theme.colors.amber,
  },
  productionLabel: {
    marginTop: 4,
    color: theme.colors.muted,
    fontFamily: theme.font,
    fontSize: 13,
    fontWeight: '600',
  },
  metricRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
});
