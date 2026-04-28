import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';

interface ListItemProps {
  title: string;
  subtitle?: string;
  value?: string;
  right?: ReactNode;
}

export function ListItem({ title, subtitle, value, right }: ListItemProps) {
  return (
    <View style={styles.row}>
      <View style={styles.textWrap}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right ?? (value ? <Text style={styles.value}>{value}</Text> : null)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.line,
  },
  textWrap: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
  },
  title: {
    color: theme.colors.text,
    fontFamily: theme.font,
    fontSize: 15,
    fontWeight: '600',
  },
  subtitle: {
    marginTop: 3,
    color: theme.colors.muted,
    fontFamily: theme.font,
    fontSize: 13,
    lineHeight: 18,
  },
  value: {
    color: theme.colors.text,
    fontFamily: theme.font,
    fontSize: 15,
    fontWeight: '700',
  },
});
