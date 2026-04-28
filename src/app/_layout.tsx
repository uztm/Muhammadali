import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { theme } from '@/constants/theme';
import { initializeStorage } from '@/services/storage.service';

type TabIconName = keyof typeof Ionicons.glyphMap;

const tabIcon = (name: TabIconName, color: string, focused: boolean) => (
  <View style={focused ? styles.activeIconWrap : styles.iconWrap}>
    <Ionicons name={name} size={22} color={color} />
  </View>
);

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initializeStorage().finally(() => setReady(true));
  }, []);

  if (!ready) {
    return <View style={styles.boot} />;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: theme.colors.primary,
          tabBarInactiveTintColor: theme.colors.subtle,
          tabBarLabelStyle: styles.label,
          tabBarStyle: styles.tabBar,
          tabBarItemStyle: styles.tabItem,
        }}>
        <Tabs.Screen name="index" options={{ href: null }} />
        <Tabs.Screen
          name="dashboard"
          options={{
            title: 'Today',
            tabBarIcon: ({ color, focused }) => tabIcon(focused ? 'grid' : 'grid-outline', color, focused),
          }}
        />
        <Tabs.Screen
          name="production"
          options={{
            title: 'Production',
            tabBarIcon: ({ color, focused }) =>
              tabIcon(focused ? 'restaurant' : 'restaurant-outline', color, focused),
          }}
        />
        <Tabs.Screen
          name="inventory"
          options={{
            title: 'Inventory',
            tabBarIcon: ({ color, focused }) =>
              tabIcon(focused ? 'cube' : 'cube-outline', color, focused),
          }}
        />
        <Tabs.Screen
          name="analytics"
          options={{
            title: 'Waste',
            tabBarIcon: ({ color, focused }) =>
              tabIcon(focused ? 'bar-chart' : 'bar-chart-outline', color, focused),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color, focused }) =>
              tabIcon(focused ? 'settings' : 'settings-outline', color, focused),
          }}
        />
      </Tabs>
      <StatusBar style="dark" />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  boot: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
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
  tabItem: {
    borderRadius: 18,
  },
  iconWrap: {
    width: 32,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIconWrap: {
    width: 42,
    height: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceAlt,
  },
  label: {
    fontFamily: theme.font,
    fontSize: 11,
    fontWeight: '600',
  },
});
