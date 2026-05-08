import { Platform, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { theme } from '@/constants/theme';

type TabIconName = keyof typeof Ionicons.glyphMap;

const tabIcon = (name: TabIconName, color: string, focused: boolean) => (
  <View style={focused ? styles.activeIconWrap : styles.iconWrap}>
    <Ionicons name={name} size={22} color={color} />
  </View>
);

export default function BozorchiLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.amber,
        tabBarInactiveTintColor: theme.colors.subtle,
        tabBarLabelStyle: styles.label,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabItem,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Shopping List',
          tabBarIcon: ({ color, focused }) => tabIcon(focused ? 'cart' : 'cart-outline', color, focused),
        }}
      />
      <Tabs.Screen
        name="submit"
        options={{
          title: 'Submit',
          tabBarIcon: ({ color, focused }) => tabIcon(focused ? 'receipt' : 'receipt-outline', color, focused),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, focused }) => tabIcon(focused ? 'time' : 'time-outline', color, focused),
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
});
