import { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Tabs } from 'expo-router';

import { theme } from '@/constants/theme';
import { getDailyPlans, getPurchaseOrders } from '@/services/storage.service';

type TabIconName = keyof typeof Ionicons.glyphMap;

const BROWN = '#7C5C3E';

const tabIcon = (name: TabIconName, color: string, focused: boolean, badge?: number) => (
  <View style={focused ? styles.activeIconWrap : styles.iconWrap}>
    <Ionicons name={name} size={22} color={color} />
    {badge != null && badge > 0 ? (
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
      </View>
    ) : null}
  </View>
);

export default function WarehousemanLayout() {
  const [pendingCount, setPendingCount] = useState(0);

  const refreshBadge = useCallback(async () => {
    const [orders, plans] = await Promise.all([getPurchaseOrders(), getDailyPlans()]);
    const orderCount = orders.filter((o) => o.status === 'submitted' || o.status === 'flagged').length;
    const planCount = plans.filter((p) => !p.warehouseAccepted && p.date >= new Date().toISOString().slice(0, 10)).length;
    setPendingCount(orderCount + planCount);
  }, []);

  useEffect(() => { void refreshBadge(); }, [refreshBadge]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: BROWN,
        tabBarInactiveTintColor: theme.colors.subtle,
        tabBarLabelStyle: styles.label,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabItem,
      }}
      screenListeners={{ focus: () => void refreshBadge() }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Stock',
          tabBarIcon: ({ color, focused }) => tabIcon(focused ? 'cube' : 'cube-outline', color, focused),
        }}
      />
      <Tabs.Screen
        name="plans"
        options={{
          title: 'Plans',
          tabBarIcon: ({ color, focused }) =>
            tabIcon(focused ? 'calendar' : 'calendar-outline', color, focused, pendingCount),
        }}
      />
      <Tabs.Screen
        name="deliveries"
        options={{
          title: 'Deliveries',
          tabBarIcon: ({ color, focused }) =>
            tabIcon(focused ? 'arrow-down-circle' : 'arrow-down-circle-outline', color, focused),
        }}
      />
      <Tabs.Screen
        name="report"
        options={{
          title: 'Report',
          tabBarIcon: ({ color, focused }) => tabIcon(focused ? 'document-text' : 'document-text-outline', color, focused),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: Platform.OS === 'ios' ? 22 : 16,
    height: 72,
    paddingTop: 9,
    paddingBottom: Platform.OS === 'ios' ? 14 : 10,
    backgroundColor: theme.colors.tab,
    borderTopWidth: 0,
    borderRadius: 24,
    ...theme.shadow,
  },
  tabItem: { borderRadius: 18 },
  iconWrap: { width: 32, height: 28, alignItems: 'center', justifyContent: 'center' },
  activeIconWrap: { width: 42, height: 30, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfaceAlt },
  label: { fontFamily: theme.font, fontSize: 11, fontWeight: '600' },
  badge: { position: 'absolute', top: -4, right: -6, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: theme.colors.red, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { color: '#fff', fontFamily: theme.font, fontSize: 10, fontWeight: '800' },
});
