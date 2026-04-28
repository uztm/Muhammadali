import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';

interface StatusBadgeProps {
  label: string;
  tone?: 'green' | 'amber' | 'red' | 'neutral' | 'blue';
}

const toneMap = {
  green: theme.colors.green,
  amber: theme.colors.amber,
  red: theme.colors.red,
  neutral: theme.colors.muted,
  blue: theme.colors.blue,
};

export function StatusBadge({ label, tone = 'neutral' }: StatusBadgeProps) {
  const color = toneMap[tone];

  return (
    <View style={[styles.badge, { backgroundColor: `${color}14` }]}>
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  text: {
    fontFamily: theme.font,
    fontSize: 12,
    fontWeight: '700',
  },
});
