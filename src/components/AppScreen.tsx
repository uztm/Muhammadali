import { PropsWithChildren, ReactNode } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/constants/theme';

interface AppScreenProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
  loading?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  right?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}

export function AppScreen({
  title,
  subtitle,
  loading,
  refreshing,
  onRefresh,
  right,
  contentStyle,
  children,
}: AppScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, contentStyle]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} /> : undefined
        }>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {right}
        </View>
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : (
          children
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.lg,
    paddingBottom: 116,
    gap: theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xs,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: theme.colors.text,
    fontFamily: theme.font,
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: 0,
  },
  subtitle: {
    color: theme.colors.muted,
    fontFamily: theme.font,
    fontSize: 15,
    lineHeight: 21,
  },
  loading: {
    minHeight: 420,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
