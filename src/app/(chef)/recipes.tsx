import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
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
import { theme } from '@/constants/theme';
import { getInventory, getMeals, upsertMeal } from '@/services/storage.service';
import { InventoryItem, Meal, MealIngredient } from '@/types';

const CHEF_COLOR = '#C2410C';

interface IngredientDraft {
  itemId: string;
  name: string;
  unit: InventoryItem['unit'];
  quantityPerKg: string;
}

export default function ChefRecipes() {
  const [loading, setLoading] = useState(true);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null);
  const [draft, setDraft] = useState<IngredientDraft[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [m, inv] = await Promise.all([getMeals(), getInventory()]);
    setMeals(m);
    setInventory(inv);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const startEdit = (meal: Meal) => {
    setEditingMeal(meal);
    setDraft(
      inventory.map((item) => {
        const existing = meal.ingredients.find((ing) => ing.itemId === item.id);
        return {
          itemId: item.id,
          name: item.name,
          unit: item.unit,
          quantityPerKg: existing ? String(existing.quantityPerKg) : '',
        };
      }),
    );
  };

  const handleSave = async () => {
    if (!editingMeal) return;
    setSaving(true);
    const ingredients: MealIngredient[] = draft
      .filter((d) => d.quantityPerKg !== '' && parseFloat(d.quantityPerKg) > 0)
      .map((d) => ({
        itemId: d.itemId,
        name: d.name,
        unit: d.unit,
        quantityPerKg: parseFloat(d.quantityPerKg),
      }));

    const updated: Meal = { ...editingMeal, ingredients };
    await upsertMeal(updated);
    setMeals((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    setEditingMeal(null);
    Alert.alert('Saved', 'Recipe updated successfully.');
    setSaving(false);
  };

  if (editingMeal) {
    return (
      <View style={styles.fullScreen}>
        <View style={styles.editHeader}>
          <Pressable onPress={() => setEditingMeal(null)} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={20} color={theme.colors.muted} />
            <Text style={styles.backText}>Cancel</Text>
          </Pressable>
          <Text style={styles.editTitle}>{editingMeal.name}</Text>
          <Pressable style={styles.saveBtn} onPress={() => void handleSave()} disabled={saving}>
            <Text style={styles.saveBtnText}>{saving ? '…' : 'Save'}</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.editContent}>
          <Text style={styles.editSubtitle}>
            Set how many of each ingredient is needed per 1 kg of this meal.
          </Text>
          {draft.map((d) => (
            <View key={d.itemId} style={styles.ingredientRow}>
              <View style={styles.ingredientInfo}>
                <Text style={styles.ingredientName}>{d.name}</Text>
                <Text style={styles.ingredientUnit}>per kg meal → {d.unit}</Text>
              </View>
              <TextInput
                style={styles.qtyInput}
                value={d.quantityPerKg}
                onChangeText={(v) =>
                  setDraft((prev) =>
                    prev.map((item) =>
                      item.itemId === d.itemId ? { ...item, quantityPerKg: v } : item,
                    ),
                  )
                }
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={theme.colors.subtle}
              />
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }

  return (
    <AppScreen
      title="Recipes"
      subtitle="Set ingredients per meal"
      loading={loading}
      onRefresh={load}>

      {meals.length === 0 ? (
        <EmptyState
          title="No meals yet"
          message="Ask manager to add meals to the menu first."
          icon="list-outline"
        />
      ) : (
        <>
          <SectionHeader title="Select a meal to edit its recipe" />
          {meals.map((meal) => (
            <Pressable key={meal.id} onPress={() => startEdit(meal)}>
              <Card style={styles.mealCard}>
                <View style={styles.mealCardRow}>
                  <View style={styles.mealCardInfo}>
                    <Text style={styles.mealCardName}>{meal.name}</Text>
                    {meal.description ? (
                      <Text style={styles.mealCardDesc}>{meal.description}</Text>
                    ) : null}
                    <Text style={styles.mealCardIngCount}>
                      {meal.ingredients.length > 0
                        ? `${meal.ingredients.length} ingredient(s) set`
                        : 'No ingredients configured yet'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.colors.subtle} />
                </View>
                {meal.ingredients.length > 0 && (
                  <View style={styles.ingredientList}>
                    {meal.ingredients.map((ing) => (
                      <View key={ing.itemId} style={styles.ingredientChip}>
                        <Text style={styles.ingredientChipText}>
                          {ing.name}: {ing.quantityPerKg} {ing.unit}/kg
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </Card>
            </Pressable>
          ))}
        </>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  fullScreen: { flex: 1, backgroundColor: theme.colors.background },
  editHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.spacing.lg, paddingTop: 60, paddingBottom: theme.spacing.md, backgroundColor: theme.colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.line },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backText: { color: theme.colors.muted, fontFamily: theme.font, fontSize: 15 },
  editTitle: { color: theme.colors.text, fontFamily: theme.font, fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' },
  saveBtn: { backgroundColor: CHEF_COLOR, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  saveBtnText: { color: '#fff', fontFamily: theme.font, fontSize: 15, fontWeight: '700' },
  editContent: { padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: 60 },
  editSubtitle: { color: theme.colors.muted, fontFamily: theme.font, fontSize: 13, lineHeight: 18 },
  ingredientRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: theme.radius.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.line, padding: theme.spacing.md, gap: theme.spacing.md },
  ingredientInfo: { flex: 1 },
  ingredientName: { color: theme.colors.text, fontFamily: theme.font, fontSize: 15, fontWeight: '600' },
  ingredientUnit: { color: theme.colors.muted, fontFamily: theme.font, fontSize: 12, marginTop: 2 },
  qtyInput: { width: 72, backgroundColor: theme.colors.surfaceAlt, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.line, padding: theme.spacing.sm, fontFamily: theme.font, fontSize: 16, color: theme.colors.text, textAlign: 'center' },
  mealCard: { gap: theme.spacing.sm },
  mealCardRow: { flexDirection: 'row', alignItems: 'center' },
  mealCardInfo: { flex: 1, gap: 2 },
  mealCardName: { color: theme.colors.text, fontFamily: theme.font, fontSize: 17, fontWeight: '700' },
  mealCardDesc: { color: theme.colors.muted, fontFamily: theme.font, fontSize: 13 },
  mealCardIngCount: { color: theme.colors.subtle, fontFamily: theme.font, fontSize: 12, marginTop: 2 },
  ingredientList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  ingredientChip: { backgroundColor: CHEF_COLOR + '15', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  ingredientChipText: { color: CHEF_COLOR, fontFamily: theme.font, fontSize: 12, fontWeight: '600' },
});
