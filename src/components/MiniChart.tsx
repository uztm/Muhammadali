import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';
import { ProductionRecord } from '@/types';
import { displayDate } from '@/utils/date';

interface MiniChartProps {
  records: ProductionRecord[];
  mode?: 'sold' | 'waste';
}

export function MiniChart({ records, mode = 'sold' }: MiniChartProps) {
  const values = records.map((record) => (mode === 'sold' ? record.soldKg : record.wasteKg));
  const max = Math.max(...values, 1);

  return (
    <View style={styles.wrap}>
      <View style={styles.chart}>
        {records.map((record) => {
          const value = mode === 'sold' ? record.soldKg : record.wasteKg;
          const height = Math.max(12, (value / max) * 94);
          return (
            <View style={styles.barWrap} key={record.id}>
              <View style={[styles.bar, mode === 'waste' && styles.wasteBar, { height }]} />
            </View>
          );
        })}
      </View>
      <View style={styles.labels}>
        {records.map((record) => (
          <Text style={styles.label} key={record.id}>
            {displayDate(record.date).split(' ')[0]}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: theme.spacing.sm,
  },
  chart: {
    height: 112,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 7,
  },
  barWrap: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  bar: {
    borderRadius: 8,
    backgroundColor: theme.colors.accent,
  },
  wasteBar: {
    backgroundColor: theme.colors.amber,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 7,
  },
  label: {
    flex: 1,
    textAlign: 'center',
    color: theme.colors.subtle,
    fontFamily: theme.font,
    fontSize: 11,
    fontWeight: '600',
  },
});
