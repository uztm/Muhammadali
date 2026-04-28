import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { AppScreen } from '@/components/AppScreen';
import { Card } from '@/components/Card';
import { FormInput } from '@/components/FormInput';
import { ListItem } from '@/components/ListItem';
import { NumberInput } from '@/components/NumberInput';
import { SectionHeader } from '@/components/SectionHeader';
import { theme } from '@/constants/theme';
import { defaultSettings } from '@/services/seed.service';
import {
  clearLocalData,
  getInventory,
  getSettings,
  resetDemoData,
  updateInventory,
  updateSettings,
} from '@/services/storage.service';
import { InventoryItem, RestaurantSettings } from '@/types';
import { formatKg, formatUnit } from '@/utils/format';

interface SettingsForm {
  restaurantName: string;
  defaultCookKg: string;
  pricePerKg: string;
  safetyBufferPercent: string;
}

export default function SettingsScreen() {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<RestaurantSettings>(defaultSettings);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [recipeForm, setRecipeForm] = useState<Record<string, string>>({});
  const [form, setForm] = useState<SettingsForm>({
    restaurantName: defaultSettings.restaurantName,
    defaultCookKg: String(defaultSettings.defaultCookKg),
    pricePerKg: String(defaultSettings.pricePerKg),
    safetyBufferPercent: String(defaultSettings.safetyBufferPercent),
  });
  const [error, setError] = useState('');
  const [recipeError, setRecipeError] = useState('');

  const load = useCallback(async () => {
    const [nextSettings, nextInventory] = await Promise.all([getSettings(), getInventory()]);
    setSettings(nextSettings);
    setInventory(nextInventory);
    setRecipeForm(
      Object.fromEntries(
        nextInventory.map((item) => [item.id, String(item.recipeUsagePerKg)]),
      ),
    );
    setForm({
      restaurantName: nextSettings.restaurantName,
      defaultCookKg: String(nextSettings.defaultCookKg),
      pricePerKg: String(nextSettings.pricePerKg),
      safetyBufferPercent: String(nextSettings.safetyBufferPercent),
    });
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const save = async () => {
    const defaultCookKg = Number(form.defaultCookKg);
    const pricePerKg = Number(form.pricePerKg);
    const safetyBufferPercent = Number(form.safetyBufferPercent);

    if (!form.restaurantName.trim()) {
      setError('Restaurant name is required.');
      return;
    }
    if (defaultCookKg <= 0 || pricePerKg <= 0 || safetyBufferPercent < 0) {
      setError('Cooking target and price must be positive.');
      return;
    }

    const nextSettings: RestaurantSettings = {
      ...settings,
      restaurantName: form.restaurantName.trim(),
      defaultCookKg,
      pricePerKg,
      safetyBufferPercent,
    };
    await updateSettings(nextSettings);
    setSettings(nextSettings);
    setError('');
    Alert.alert('Settings saved', 'Forecasting parameters were updated.');
  };

  const saveRecipe = async () => {
    const coreIds = ['rice', 'meat', 'carrot'];
    const hasInvalidValue = coreIds.some((itemId) => {
      const value = Number(recipeForm[itemId]);
      return !Number.isFinite(value) || value <= 0;
    });

    if (hasInvalidValue) {
      setRecipeError('Recipe usage values must be positive.');
      return;
    }

    const nextInventory = inventory.map((item) => {
      const value = Number(recipeForm[item.id]);
      return Number.isFinite(value) && value > 0 ? { ...item, recipeUsagePerKg: value } : item;
    });
    await updateInventory(nextInventory);
    setInventory(nextInventory);
    setRecipeError('');
    Alert.alert('Recipe saved', 'Ingredient requirements will recalculate on Inventory and Dashboard.');
  };

  const confirmReset = () => {
    Alert.alert('Reset demo data?', 'This will regenerate 60 days of Osh Markazi records.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => {
          void resetDemoData().then(load);
        },
      },
    ]);
  };

  const confirmClear = () => {
    Alert.alert('Clear local data?', 'Production, inventory, and settings will be removed from this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          void clearLocalData().then(load);
        },
      },
    ]);
  };

  return (
    <AppScreen title="Settings" subtitle="Restaurant profile and planning controls" loading={loading} onRefresh={load}>
      <Card style={styles.formCard}>
        <FormInput
          label="Restaurant name"
          value={form.restaurantName}
          error={error}
          onChangeText={(restaurantName) => setForm((current) => ({ ...current, restaurantName }))}
        />
        <NumberInput
          label="Default daily cooking target"
          suffix="kg"
          value={form.defaultCookKg}
          onChangeText={(defaultCookKg) => setForm((current) => ({ ...current, defaultCookKg }))}
        />
        <NumberInput
          label="Price per kg"
          suffix="UZS"
          value={form.pricePerKg}
          onChangeText={(pricePerKg) => setForm((current) => ({ ...current, pricePerKg }))}
        />
        <NumberInput
          label="Safety buffer"
          suffix="%"
          value={form.safetyBufferPercent}
          onChangeText={(safetyBufferPercent) =>
            setForm((current) => ({ ...current, safetyBufferPercent }))
          }
        />
        <Pressable
          style={styles.primaryButton}
          onPress={() => {
            void save();
          }}>
          <Text style={styles.primaryButtonText}>Save settings</Text>
        </Pressable>
      </Card>

      <SectionHeader title="Core recipe per 1 kg" />
      <Card style={styles.formCard}>
        {inventory
          .filter((item) => ['rice', 'meat', 'carrot'].includes(item.id))
          .map((item) => (
            <NumberInput
              key={item.id}
              label={item.name}
              suffix={item.unit}
              value={recipeForm[item.id] ?? ''}
              onChangeText={(value) =>
                setRecipeForm((current) => ({ ...current, [item.id]: value }))
              }
            />
          ))}
        {recipeError ? <Text style={styles.errorText}>{recipeError}</Text> : null}
        <View style={styles.recipePreview}>
          <Text style={styles.recipePreviewTitle}>For {formatKg(Number(form.defaultCookKg) || settings.defaultCookKg)}</Text>
          {inventory
            .filter((item) => ['rice', 'meat', 'carrot'].includes(item.id))
            .map((item) => {
              const targetCookKg = Number(form.defaultCookKg) || settings.defaultCookKg;
              const usage = Number(recipeForm[item.id]) || 0;
              return (
                <ListItem
                  key={item.id}
                  title={item.name}
                  value={formatUnit(usage * targetCookKg, item.unit)}
                />
              );
            })}
        </View>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => {
            void saveRecipe();
          }}>
          <Text style={styles.secondaryButtonText}>Save recipe</Text>
        </Pressable>
      </Card>

      <SectionHeader title="Restaurant" />
      <Card>
        <ListItem title="Type" value={settings.restaurantType} />
        <ListItem title="Location" value={settings.location} />
        <ListItem title="Local database" subtitle="AsyncStorage on this device" value="Enabled" />
      </Card>

      <SectionHeader title="Data controls" />
      <Card style={styles.actions}>
        <Pressable style={styles.secondaryButton} onPress={confirmReset}>
          <Text style={styles.secondaryButtonText}>Reset demo data</Text>
        </Pressable>
        <Pressable style={styles.dangerButton} onPress={confirmClear}>
          <Text style={styles.dangerButtonText}>Clear local data</Text>
        </Pressable>
      </Card>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  formCard: {
    gap: theme.spacing.md,
  },
  primaryButton: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
  },
  primaryButtonText: {
    color: theme.colors.surface,
    fontFamily: theme.font,
    fontSize: 16,
    fontWeight: '700',
  },
  actions: {
    gap: theme.spacing.sm,
  },
  recipePreview: {
    padding: theme.spacing.md,
    borderRadius: 16,
    backgroundColor: theme.colors.surfaceAlt,
  },
  recipePreviewTitle: {
    marginBottom: theme.spacing.xs,
    color: theme.colors.text,
    fontFamily: theme.font,
    fontSize: 15,
    fontWeight: '700',
  },
  errorText: {
    color: theme.colors.red,
    fontFamily: theme.font,
    fontSize: 12,
  },
  secondaryButton: {
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceAlt,
  },
  secondaryButtonText: {
    color: theme.colors.text,
    fontFamily: theme.font,
    fontSize: 15,
    fontWeight: '700',
  },
  dangerButton: {
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7E9E7',
  },
  dangerButtonText: {
    color: theme.colors.red,
    fontFamily: theme.font,
    fontSize: 15,
    fontWeight: '700',
  },
});
