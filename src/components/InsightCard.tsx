import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Card } from '@/components/Card';
import { theme } from '@/constants/theme';

interface InsightCardProps {
  title: string;
  body: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone?: 'neutral' | 'green' | 'amber' | 'red' | 'blue';
}

const toneColors = {
  neutral: theme.colors.text,
  green: theme.colors.green,
  amber: theme.colors.amber,
  red: theme.colors.red,
  blue: theme.colors.blue,
};

export function InsightCard({ title, body, icon, tone = 'neutral' }: InsightCardProps) {
  const color = toneColors[tone];

  return (
    <Card>
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: `${color}14` }]}>
          <Ionicons name={icon} size={20} color={color} />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: theme.colors.text,
    fontFamily: theme.font,
    fontSize: 16,
    fontWeight: '700',
  },
  body: {
    color: theme.colors.muted,
    fontFamily: theme.font,
    fontSize: 14,
    lineHeight: 20,
  },
});
