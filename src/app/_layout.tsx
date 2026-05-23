import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { theme } from '@/constants/theme';
import { getCurrentUser } from '@/services/auth.service';
import { initializeStorage } from '@/services/storage.service';
import { AppUser } from '@/types';

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const init = async () => {
      await initializeStorage();
      setReady(true);
    };
    void init();
  }, []);

  if (!ready) {
    return <View style={styles.boot} />;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="(admin)" />
        <Stack.Screen name="(manager)" />
        <Stack.Screen name="(bozorchi)" />
        <Stack.Screen name="(warehouseman)" />
        <Stack.Screen name="(chef)" />
        <Stack.Screen name="dashboard" options={{ href: null } as any} />
        <Stack.Screen name="production" options={{ href: null } as any} />
        <Stack.Screen name="inventory" options={{ href: null } as any} />
        <Stack.Screen name="analytics" options={{ href: null } as any} />
        <Stack.Screen name="settings" options={{ href: null } as any} />
      </Stack>
      <StatusBar style="dark" />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  boot: { flex: 1, backgroundColor: theme.colors.background },
});
