import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { AppScreen } from '@/components/AppScreen';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { SectionHeader } from '@/components/SectionHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { theme } from '@/constants/theme';
import { deleteMeal, getMeals, upsertMeal } from '@/services/storage.service';
import { Meal } from '@/types';

export default function ManagerMenu() {
  const [loading, setLoading] = useState(true);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [mode, setMode] = useState<'list' | 'new'>('list');
  const [mealName, setMealName] = useState('');
  const [mealDesc, setMealDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const m = await getMeals();
    setMeals(m);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const handleAdd = async () => {
    if (!mealName.trim()) {
      Alert.alert('Name required', 'Enter a name for the meal.');
      return;
    }
    setSaving(true);
    const meal: Meal = {
      id: `meal-${Date.now()}`,
      name: mealName.trim(),
      description: mealDesc.trim(),
      isActive: true,
      createdBy: 'manager-1',
      ingredients: [],
    };
    await upsertMeal(meal);
    setMeals((prev) => [...prev, meal]);
    setMealName('');
    setMealDesc('');
    setMode('list');
    Alert.alert('Meal added', `"${meal.name}" added to menu. Chef can now set its recipe.`);
    setSaving(false);
  };

  const handleToggleActive = async (meal: Meal) => {
    const updated = { ...meal, isActive: !meal.isActive };
    await upsertMeal(updated);
    setMeals((prev) => prev.map((m) => (m.id === meal.id ? updated : m)));
  };

  const handleDelete = (meal: Meal) => {
    Alert.alert(
      'Delete meal',
      `Remove "${meal.name}" from the menu?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteMeal(meal.id);
            setMeals((prev) => prev.filter((m) => m.id !== meal.id));
          },
        },
      ],
    );
  };

  if (mode === 'new') {
    return (
      <View style={styles.fullScreen}>
        <View style={styles.newHeader}>
          <Pressable onPress={() => setMode('list')} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={20} color={theme.colors.muted} />
            <Text style={styles.backText}>Cancel</Text>
          </Pressable>
          <Text style={styles.newTitle}>New Meal</Text>
          <Pressable style={styles.saveBtn} onPress={() => void handleAdd()} disabled={saving}>
            <Text style={styles.saveBtnText}>{saving ? 'Adding…' : 'Add'}</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.newContent}>
          <Text style={styles.fieldLabel}>Meal name *</Text>
          <TextInput
            style={styles.textInput}
            value={mealName}
            onChangeText={setMealName}
            placeholder="e.g. Plov, Shashlik, Lagman..."
            placeholderTextColor={theme.colors.subtle}
            autoFocus
          />
          <Text style={[styles.fieldLabel, { marginTop: theme.spacing.md }]}>Description (optional)</Text>
          <TextInput
            style={[styles.textInput, styles.textInputMulti]}
            value={mealDesc}
            onChangeText={setMealDesc}
            placeholder="Short description of the meal..."
            placeholderTextColor={theme.colors.subtle}
            multiline
          />
          <Text style={styles.hint}>
            After adding, the Chef can set ingredient quantities for this meal in the Recipes section.
          </Text>
        </ScrollView>
      </View>
    );
  }

  return (
    <AppScreen title="Menu" subtitle="Manage meals" loading={loading} onRefresh={load}>
      <Pressable style={styles.addBtn} onPress={() => setMode('new')}>
        <Ionicons name="add-circle-outline" size={20} color={theme.colors.surface} />
        <Text style={styles.addBtnText}>Add New Meal</Text>
      </Pressable>

      {meals.length === 0 ? (
        <EmptyState
          title="No meals yet"
          message="Add meals to the menu so chefs can configure their recipes."
          icon="restaurant-outline"
        />
      ) : (
        <>
          <SectionHeader title={`${meals.length} meal(s) on menu`} />
          {meals.map((meal) => (
            <Card key={meal.id} style={styles.mealCard}>
              <View style={styles.mealHeader}>
                <View style={styles.mealInfo}>
                  <Text style={styles.mealName}>{meal.name}</Text>
                  {meal.description ? (
                    <Text style={styles.mealDesc}>{meal.description}</Text>
                  ) : null}
                </View>
                <Pressable onPress={() => handleDelete(meal)} style={styles.deleteBtn}>
                  <Ionicons name="trash-outline" size={18} color={theme.colors.red} />
                </Pressable>
              </View>

              <View style={styles.mealMeta}>
                <StatusBadge
                  label={meal.ingredients.length > 0 ? `${meal.ingredients.length} ingredients` : 'No recipe yet'}
                  tone={meal.ingredients.length > 0 ? 'green' : 'amber'}
                />
              </View>

              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Active on menu</Text>
                <Switch
                  value={meal.isActive}
                  onValueChange={() => void handleToggleActive(meal)}
                  trackColor={{ true: theme.colors.blue, false: theme.colors.line }}
                  thumbColor={theme.colors.surface}
                />
              </View>
            </Card>
          ))}
        </>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  fullScreen: { flex: 1, backgroundColor: theme.colors.background },
  newHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.spacing.lg, paddingTop: 60, paddingBottom: theme.spacing.md, backgroundColor: theme.colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.line },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backText: { color: theme.colors.muted, fontFamily: theme.font, fontSize: 15 },
  newTitle: { color: theme.colors.text, fontFamily: theme.font, fontSize: 17, fontWeight: '700' },
  saveBtn: { backgroundColor: theme.colors.blue, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  saveBtnText: { color: '#fff', fontFamily: theme.font, fontSize: 15, fontWeight: '700' },
  newContent: { padding: theme.spacing.lg, gap: theme.spacing.sm, paddingBottom: 60 },
  fieldLabel: { color: theme.colors.muted, fontFamily: theme.font, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  textInput: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.line, padding: theme.spacing.md, fontFamily: theme.font, fontSize: 16, color: theme.colors.text },
  textInputMulti: { minHeight: 80, textAlignVertical: 'top' },
  hint: { color: theme.colors.subtle, fontFamily: theme.font, fontSize: 13, lineHeight: 18, marginTop: theme.spacing.sm },
  addBtn: { height: 52, borderRadius: 16, backgroundColor: theme.colors.blue, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  addBtnText: { color: '#fff', fontFamily: theme.font, fontSize: 16, fontWeight: '700' },
  mealCard: { gap: theme.spacing.sm },
  mealHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  mealInfo: { flex: 1, gap: 2 },
  mealName: { color: theme.colors.text, fontFamily: theme.font, fontSize: 17, fontWeight: '700' },
  mealDesc: { color: theme.colors.muted, fontFamily: theme.font, fontSize: 13 },
  deleteBtn: { padding: 4 },
  mealMeta: { flexDirection: 'row' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: theme.spacing.xs, borderTopWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.line },
  toggleLabel: { color: theme.colors.text, fontFamily: theme.font, fontSize: 15 },
});
