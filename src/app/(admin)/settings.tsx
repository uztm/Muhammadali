import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';

import { AppScreen } from '@/components/AppScreen';
import { Card } from '@/components/Card';
import { FormInput } from '@/components/FormInput';
import { ListItem } from '@/components/ListItem';
import { NumberInput } from '@/components/NumberInput';
import { SectionHeader } from '@/components/SectionHeader';
import { theme } from '@/constants/theme';
import {
  addUser,
  defaultUsers,
  deleteUser,
  getUsers,
  logout,
  roleLabel,
  updateUser,
} from '@/services/auth.service';
import { defaultSettings } from '@/services/seed.service';
import {
  clearLocalData,
  getSettings,
  resetDemoData,
  updateSettings,
} from '@/services/storage.service';
import { AppUser, RestaurantSettings } from '@/types';

interface SettingsForm {
  restaurantName: string;
  defaultCookKg: string;
  pricePerKg: string;
  safetyBufferPercent: string;
}

export default function AdminSettingsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<RestaurantSettings>(defaultSettings);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [form, setForm] = useState<SettingsForm>({
    restaurantName: defaultSettings.restaurantName,
    defaultCookKg: String(defaultSettings.defaultCookKg),
    pricePerKg: String(defaultSettings.pricePerKg),
    safetyBufferPercent: String(defaultSettings.safetyBufferPercent),
  });
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [s, u] = await Promise.all([getSettings(), getUsers()]);
    setSettings(s);
    setUsers(u);
    setForm({
      restaurantName: s.restaurantName,
      defaultCookKg: String(s.defaultCookKg),
      pricePerKg: String(s.pricePerKg),
      safetyBufferPercent: String(s.safetyBufferPercent),
    });
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const save = async () => {
    if (!form.restaurantName.trim()) { setError('Name required.'); return; }
    const c = Number(form.defaultCookKg), p = Number(form.pricePerKg), b = Number(form.safetyBufferPercent);
    if (c <= 0 || p <= 0 || b < 0) { setError('Values must be positive.'); return; }
    const next: RestaurantSettings = { ...settings, restaurantName: form.restaurantName.trim(), defaultCookKg: c, pricePerKg: p, safetyBufferPercent: b };
    await updateSettings(next);
    setSettings(next);
    setError('');
    Alert.alert('Saved', 'Settings updated.');
  };

  const handleResetPin = (user: AppUser) => {
    Alert.prompt('Reset PIN', `New PIN for ${user.name}:`, async (pin) => {
      if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
        Alert.alert('Invalid PIN', 'PIN must be exactly 4 digits.');
        return;
      }
      await updateUser({ ...user, pin });
      await load();
      Alert.alert('PIN updated', `${user.name}'s PIN has been changed.`);
    }, 'plain-text', '', 'numeric');
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/login' as any);
  };

  return (
    <AppScreen title="Settings" subtitle="System configuration and user management" loading={loading} onRefresh={load}>

      <SectionHeader title="Restaurant profile" />
      <Card style={styles.formCard}>
        <FormInput label="Restaurant name" value={form.restaurantName} error={error} onChangeText={(v) => setForm((c) => ({ ...c, restaurantName: v }))} />
        <NumberInput label="Daily cooking target" suffix="kg" value={form.defaultCookKg} onChangeText={(v) => setForm((c) => ({ ...c, defaultCookKg: v }))} />
        <NumberInput label="Price per kg" suffix="UZS" value={form.pricePerKg} onChangeText={(v) => setForm((c) => ({ ...c, pricePerKg: v }))} />
        <NumberInput label="Safety buffer" suffix="%" value={form.safetyBufferPercent} onChangeText={(v) => setForm((c) => ({ ...c, safetyBufferPercent: v }))} />
        <Pressable style={styles.primaryBtn} onPress={() => void save()}>
          <Text style={styles.primaryBtnText}>Save settings</Text>
        </Pressable>
      </Card>

      <SectionHeader title="User management" />
      <Card>
        {users.map((user) => (
          <ListItem
            key={user.id}
            title={user.name}
            subtitle={roleLabel(user.role)}
            right={
              <Pressable style={styles.pinResetBtn} onPress={() => handleResetPin(user)}>
                <Text style={styles.pinResetText}>Reset PIN</Text>
              </Pressable>
            }
          />
        ))}
      </Card>

      <SectionHeader title="System" />
      <Card>
        <ListItem title="Type" value={settings.restaurantType} />
        <ListItem title="Location" value={settings.location} />
        <ListItem title="Storage" subtitle="AsyncStorage on this device" value="Local" />
      </Card>

      <SectionHeader title="Data" />
      <Card style={styles.actionsCard}>
        <Pressable style={styles.secondaryBtn} onPress={() => Alert.alert('Reset demo data?', '60 days of records + plans will be regenerated.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Reset', style: 'destructive', onPress: () => void resetDemoData().then(load) },
        ])}>
          <Text style={styles.secondaryBtnText}>Reset demo data</Text>
        </Pressable>
        <Pressable style={styles.dangerBtn} onPress={() => Alert.alert('Clear data?', 'All local data will be deleted.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Clear', style: 'destructive', onPress: () => void clearLocalData().then(load) },
        ])}>
          <Text style={styles.dangerBtnText}>Clear all data</Text>
        </Pressable>
        <Pressable style={styles.dangerBtn} onPress={() => void handleLogout()}>
          <Text style={styles.dangerBtnText}>Sign out</Text>
        </Pressable>
      </Card>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  formCard: { gap: theme.spacing.md },
  primaryBtn: { height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primary },
  primaryBtnText: { color: theme.colors.surface, fontFamily: theme.font, fontSize: 16, fontWeight: '700' },
  pinResetBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: theme.colors.surfaceAlt },
  pinResetText: { color: theme.colors.text, fontFamily: theme.font, fontSize: 13, fontWeight: '600' },
  actionsCard: { gap: theme.spacing.sm },
  secondaryBtn: { height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfaceAlt },
  secondaryBtnText: { color: theme.colors.text, fontFamily: theme.font, fontSize: 15, fontWeight: '700' },
  dangerBtn: { height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7E9E7' },
  dangerBtnText: { color: theme.colors.red, fontFamily: theme.font, fontSize: 15, fontWeight: '700' },
});
