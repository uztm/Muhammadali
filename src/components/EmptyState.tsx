import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '@/constants/theme';

interface EmptyStateProps {
  title: string;
  message: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

export function EmptyState({ title, message, icon = 'file-tray-outline' }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={28} color={theme.colors.subtle} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  title: {
    color: theme.colors.text,
    fontFamily: theme.font,
    fontSize: 17,
    fontWeight: '700',
  },
  message: {
    color: theme.colors.muted,
    fontFamily: theme.font,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
