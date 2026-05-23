import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';

import { AppScreen } from '@/components/AppScreen';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { ListItem } from '@/components/ListItem';
import { SectionHeader } from '@/components/SectionHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { theme } from '@/constants/theme';
import { logout } from '@/services/auth.service';
import { getMeals } from '@/services/storage.service';
import { Meal } from '@/types';

const CHEF_COLOR = '#C2410C';

export default function ChefMeals() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [meals, setMeals] = useState<Meal[]>([]);

  const load = useCallback(async () => {
    const m = await getMeals();
    setMeals(m);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const handleLogout = async () => {
    await logout();
    router.replace('/login' as any);
  };

  const active = meals.filter((m) => m.isActive);
  const inactive = meals.filter((m) => !m.isActive);

  return (
    <AppScreen
      title="Chef"
      subtitle="Menu & recipes"
      loading={loading}
      onRefresh={load}
      right={
        <Pressable style={styles.logoutBtn} onPress={() => void handleLogout()}>
          <Ionicons name="log-out-outline" size={20} color={theme.colors.muted} />
        </Pressable>
      }>

      {meals.length === 0 ? (
        <EmptyState
          title="No meals yet"
          message="Manager adds meals to the menu. You set ingredient quantities in the Recipes tab."
          icon="restaurant-outline"
        />
      ) : (
        <>
          {active.length > 0 && (
            <>
              <SectionHeader title="Active meals" />
              <Card>
                {active.map((meal) => (
                  <ListItem
                    key={meal.id}
                    title={meal.name}
                    subtitle={
                      meal.ingredients.length > 0
                        ? `${meal.ingredients.length} ingredient(s) configured`
                        : 'No ingredients set yet'
                    }
                    right={
                      <View style={styles.mealRight}>
                        <StatusBadge
                          label={meal.ingredients.length > 0 ? 'Ready' : 'Pending'}
                          tone={meal.ingredients.length > 0 ? 'green' : 'amber'}
                        />
                      </View>
                    }
                  />
                ))}
              </Card>
            </>
          )}

          {inactive.length > 0 && (
            <>
              <SectionHeader title="Inactive meals" />
              <Card>
                {inactive.map((meal) => (
                  <ListItem
                    key={meal.id}
                    title={meal.name}
                    subtitle={meal.description || 'Inactive'}
                    right={<StatusBadge label="Inactive" tone="amber" />}
                  />
                ))}
              </Card>
            </>
          )}
        </>
      )}

      <Card style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Ionicons name="information-circle-outline" size={18} color={theme.colors.blue} />
          <Text style={styles.infoText}>
            Go to <Text style={{ fontWeight: '700' }}>Recipes</Text> tab to set how many of each ingredient is needed per kg of each meal.
          </Text>
        </View>
      </Card>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  logoutBtn: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.line },
  mealRight: { alignItems: 'flex-end' },
  infoCard: { backgroundColor: theme.colors.blue + '10', borderColor: theme.colors.blue + '30' },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  infoText: { flex: 1, color: theme.colors.text, fontFamily: theme.font, fontSize: 13, lineHeight: 19 },
});
