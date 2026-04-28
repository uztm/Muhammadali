import { StyleSheet, Text } from 'react-native';

import { Card } from '@/components/Card';
import { theme } from '@/constants/theme';

interface MetricCardProps {
  label: string;
  value: string;
  detail?: string;
  tone?: 'neutral' | 'green' | 'amber' | 'red' | 'blue';
}

const toneColors = {
  neutral: theme.colors.text,
  green: theme.colors.green,
  amber: theme.colors.amber,
  red: theme.colors.red,
  blue: theme.colors.blue,
};

export function MetricCard({ label, value, detail, tone = 'neutral' }: MetricCardProps) {
  return (
    <Card style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: toneColors[tone] }]}>{value}</Text>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 112,
    justifyContent: 'space-between',
  },
  label: {
    color: theme.colors.muted,
    fontFamily: theme.font,
    fontSize: 13,
    fontWeight: '600',
  },
  value: {
    marginTop: theme.spacing.sm,
    color: theme.colors.text,
    fontFamily: theme.font,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 0,
  },
  detail: {
    marginTop: 5,
    color: theme.colors.muted,
    fontFamily: theme.font,
    fontSize: 12,
    lineHeight: 16,
  },
});
