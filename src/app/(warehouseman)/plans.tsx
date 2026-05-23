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
import { StatusBadge } from '@/components/StatusBadge';
import { theme } from '@/constants/theme';
import { getDailyPlans, getInventory, upsertDailyPlan } from '@/services/storage.service';
import { DailyPlan, InventoryItem, ShoppingItem } from '@/types';
import { displayDate, todayKey } from '@/utils/date';
import { formatKg } from '@/utils/format';

const BROWN = '#7C5C3E';

function stockStatus(item: ShoppingItem, inventory: InventoryItem[]): 'ok' | 'low' | 'missing' {
  const inv = inventory.find((i) => i.id === item.itemId);
  if (!inv) return 'missing';
  if (inv.currentStock >= item.quantity) return 'ok';
  if (inv.currentStock >= item.quantity * 0.5) return 'low';
  return 'missing';
}

export default function WarehousePlans() {
  const [loading, setLoading] = useState(true);
  const [pendingPlans, setPendingPlans] = useState<DailyPlan[]>([]);
  const [acceptedPlans, setAcceptedPlans] = useState<DailyPlan[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [reviewing, setReviewing] = useState<DailyPlan | null>(null);
  const [warehouseNote, setWarehouseNote] = useState('');
  const [saving, setSaving] = useState(false);

  const today = todayKey();

  const load = useCallback(async () => {
    const [plans, inv] = await Promise.all([getDailyPlans(), getInventory()]);
    const upcoming = plans.filter((p) => p.date >= today);
    setPendingPlans(upcoming.filter((p) => !p.warehouseAccepted).sort((a, b) => a.date.localeCompare(b.date)));
    setAcceptedPlans(upcoming.filter((p) => p.warehouseAccepted).sort((a, b) => a.date.localeCompare(b.date)));
    setInventory(inv);
    setLoading(false);
  }, [today]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const openReview = (plan: DailyPlan) => {
    setReviewing(plan);
    setWarehouseNote('');
  };

  const handleAccept = async () => {
    if (!reviewing) return;
    setSaving(true);

    const accepted: DailyPlan = {
      ...reviewing,
      warehouseAccepted: true,
      warehouseAcceptedBy: 'warehouseman-1',
      warehouseAcceptedAt: new Date().toISOString(),
      warehouseNote: warehouseNote.trim(),
    };

    await upsertDailyPlan(accepted);
    setReviewing(null);
    await load();

    const missing = reviewing.shoppingList.filter(
      (item) => stockStatus(item, inventory) !== 'ok',
    );
    Alert.alert(
      'Plan accepted',
      missing.length > 0
        ? `Accepted with ${missing.length} item(s) that need purchasing: ${missing.map((i) => i.name).join(', ')}.`
        : 'Plan accepted. Warehouse stock is sufficient.',
    );
    setSaving(false);
  };

  if (reviewing) {
    const missingItems = reviewing.shoppingList.filter((i) => stockStatus(i, inventory) === 'missing');
    const lowItems = reviewing.shoppingList.filter((i) => stockStatus(i, inventory) === 'low');
    const okItems = reviewing.shoppingList.filter((i) => stockStatus(i, inventory) === 'ok');

    return (
      <View style={styles.fullScreen}>
        <View style={styles.reviewHeader}>
          <Pressable onPress={() => setReviewing(null)} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={20} color={theme.colors.muted} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <Text style={styles.reviewTitle}>{displayDate(reviewing.date)}</Text>
          <Pressable
            style={[styles.acceptBtn, saving && { opacity: 0.5 }]}
            onPress={() => void handleAccept()}
            disabled={saving}>
            <Text style={styles.acceptBtnText}>{saving ? '…' : 'Accept'}</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.reviewContent}>
          <Card style={styles.planSummary}>
            <View style={styles.planSummaryRow}>
              <View style={styles.planKpi}>
                <Text style={styles.kpiValue}>{formatKg(reviewing.plannedCookKg)}</Text>
                <Text style={styles.kpiLabel}>To cook</Text>
              </View>
              <View style={styles.planKpi}>
                <Text style={styles.kpiValue}>{formatKg(reviewing.forecastKg)}</Text>
                <Text style={styles.kpiLabel}>Forecast</Text>
              </View>
              <View style={styles.planKpi}>
                <Text style={[styles.kpiValue, missingItems.length > 0 ? { color: theme.colors.red } : lowItems.length > 0 ? { color: theme.colors.amber } : { color: theme.colors.green }]}>
                  {missingItems.length > 0 ? `${missingItems.length} missing` : lowItems.length > 0 ? `${lowItems.length} low` : 'Ready'}
                </Text>
                <Text style={styles.kpiLabel}>Stock status</Text>
              </View>
            </View>
            {reviewing.holidayName ? (
              <View style={styles.holidayRow}>
                <Ionicons name="star-outline" size={14} color={theme.colors.blue} />
                <Text style={styles.holidayText}>{reviewing.holidayName} — higher demand expected</Text>
              </View>
            ) : null}
          </Card>

          {missingItems.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Not enough stock — must purchase</Text>
              {missingItems.map((item) => {
                const inv = inventory.find((i) => i.id === item.itemId);
                return (
                  <View key={item.itemId} style={[styles.itemRow, styles.itemRowMissing]}>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.itemNeeded}>Needed: {item.quantity} {item.unit}</Text>
                    </View>
                    <View style={styles.itemStock}>
                      <Text style={[styles.itemStockQty, { color: theme.colors.red }]}>
                        {inv ? `${inv.currentStock} ${item.unit}` : 'No stock'}
                      </Text>
                      <StatusBadge label="Missing" tone="red" />
                    </View>
                  </View>
                );
              })}
            </>
          )}

          {lowItems.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Partial stock — may need more</Text>
              {lowItems.map((item) => {
                const inv = inventory.find((i) => i.id === item.itemId);
                return (
                  <View key={item.itemId} style={[styles.itemRow, styles.itemRowLow]}>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.itemNeeded}>Needed: {item.quantity} {item.unit}</Text>
                    </View>
                    <View style={styles.itemStock}>
                      <Text style={[styles.itemStockQty, { color: theme.colors.amber }]}>
                        {inv ? `${inv.currentStock} ${item.unit}` : '-'}
                      </Text>
                      <StatusBadge label="Low" tone="amber" />
                    </View>
                  </View>
                );
              })}
            </>
          )}

          {okItems.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Sufficient stock</Text>
              <Card>
                {okItems.map((item) => {
                  const inv = inventory.find((i) => i.id === item.itemId);
                  return (
                    <View key={item.itemId} style={styles.okItemRow}>
                      <Text style={styles.okItemName}>{item.name}</Text>
                      <Text style={styles.okItemQty}>
                        {inv?.currentStock ?? '-'} / {item.quantity} {item.unit}
                      </Text>
                    </View>
                  );
                })}
              </Card>
            </>
          )}

          <Text style={styles.sectionLabel}>Warehouse note (optional)</Text>
          <TextInput
            style={styles.noteInput}
            value={warehouseNote}
            onChangeText={setWarehouseNote}
            placeholder="Any remarks about stock or this plan..."
            placeholderTextColor={theme.colors.subtle}
            multiline
          />

          <Pressable
            style={[styles.acceptBtnLarge, saving && { opacity: 0.5 }]}
            onPress={() => void handleAccept()}
            disabled={saving}>
            <Ionicons name="checkmark-circle-outline" size={22} color="#fff" />
            <Text style={styles.acceptBtnLargeText}>
              {saving ? 'Saving…' : 'Accept Plan'}
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <AppScreen
      title="Plans"
      subtitle="Review & accept daily plans"
      loading={loading}
      onRefresh={load}>

      {pendingPlans.length === 0 && acceptedPlans.length === 0 ? (
        <EmptyState
          title="No upcoming plans"
          message="Ask admin or manager to generate plans. They will appear here for your review."
          icon="calendar-outline"
        />
      ) : null}

      {pendingPlans.length > 0 && (
        <>
          <SectionHeader title={`Needs your acceptance (${pendingPlans.length})`} />
          {pendingPlans.map((plan) => {
            const missing = plan.shoppingList.filter((i) => stockStatus(i, inventory) === 'missing');
            const low = plan.shoppingList.filter((i) => stockStatus(i, inventory) === 'low');
            return (
              <Pressable key={plan.id} onPress={() => openReview(plan)}>
                <Card style={styles.planCard}>
                  <View style={styles.planCardRow}>
                    <View style={styles.planCardInfo}>
                      <Text style={styles.planCardDate}>{displayDate(plan.date)}</Text>
                      <Text style={styles.planCardCook}>{formatKg(plan.plannedCookKg)} to cook</Text>
                      {missing.length > 0 && (
                        <Text style={styles.planCardMissing}>{missing.length} item(s) missing from stock</Text>
                      )}
                      {missing.length === 0 && low.length > 0 && (
                        <Text style={styles.planCardLow}>{low.length} item(s) low in stock</Text>
                      )}
                      {plan.holidayName && (
                        <Text style={styles.planCardHoliday}>{plan.holidayName}</Text>
                      )}
                    </View>
                    <View style={styles.planCardRight}>
                      <StatusBadge
                        label={missing.length > 0 ? 'Needs purchase' : low.length > 0 ? 'Low stock' : 'Stock OK'}
                        tone={missing.length > 0 ? 'red' : low.length > 0 ? 'amber' : 'green'}
                      />
                      <Ionicons name="chevron-forward" size={16} color={theme.colors.subtle} style={{ marginTop: 6 }} />
                    </View>
                  </View>
                </Card>
              </Pressable>
            );
          })}
        </>
      )}

      {acceptedPlans.length > 0 && (
        <>
          <SectionHeader title="Accepted" />
          {acceptedPlans.map((plan) => (
            <Card key={plan.id} style={styles.acceptedCard}>
              <View style={styles.planCardRow}>
                <View style={styles.planCardInfo}>
                  <Text style={styles.planCardDate}>{displayDate(plan.date)}</Text>
                  <Text style={styles.planCardCook}>{formatKg(plan.plannedCookKg)} to cook</Text>
                  {plan.warehouseNote ? (
                    <Text style={styles.warehouseNote}>Note: {plan.warehouseNote}</Text>
                  ) : null}
                </View>
                <StatusBadge label="Accepted" tone="green" />
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
  reviewHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg, paddingTop: 60, paddingBottom: theme.spacing.md,
    backgroundColor: theme.colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.line,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, minWidth: 60 },
  backText: { color: theme.colors.muted, fontFamily: theme.font, fontSize: 15 },
  reviewTitle: { color: theme.colors.text, fontFamily: theme.font, fontSize: 17, fontWeight: '700' },
  acceptBtn: { backgroundColor: BROWN, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7, minWidth: 70, alignItems: 'center' },
  acceptBtnText: { color: '#fff', fontFamily: theme.font, fontSize: 15, fontWeight: '700' },
  reviewContent: { padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: 60 },
  planSummary: { gap: theme.spacing.sm },
  planSummaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  planKpi: { alignItems: 'center', flex: 1 },
  kpiValue: { color: theme.colors.text, fontFamily: theme.font, fontSize: 17, fontWeight: '700' },
  kpiLabel: { marginTop: 3, color: theme.colors.muted, fontFamily: theme.font, fontSize: 12 },
  holidayRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  holidayText: { color: theme.colors.blue, fontFamily: theme.font, fontSize: 13 },
  sectionLabel: { color: theme.colors.muted, fontFamily: theme.font, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: theme.radius.sm, borderWidth: StyleSheet.hairlineWidth, padding: theme.spacing.md },
  itemRowMissing: { backgroundColor: theme.colors.red + '08', borderColor: theme.colors.red + '40' },
  itemRowLow: { backgroundColor: theme.colors.amber + '08', borderColor: theme.colors.amber + '40' },
  itemInfo: { flex: 1, gap: 2 },
  itemName: { color: theme.colors.text, fontFamily: theme.font, fontSize: 15, fontWeight: '600' },
  itemNeeded: { color: theme.colors.muted, fontFamily: theme.font, fontSize: 13 },
  itemStock: { alignItems: 'flex-end', gap: 4 },
  itemStockQty: { fontFamily: theme.font, fontSize: 14, fontWeight: '700' },
  okItemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.line },
  okItemName: { color: theme.colors.text, fontFamily: theme.font, fontSize: 14 },
  okItemQty: { color: theme.colors.green, fontFamily: theme.font, fontSize: 14, fontWeight: '600' },
  noteInput: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.line, padding: theme.spacing.md, fontFamily: theme.font, fontSize: 15, color: theme.colors.text, minHeight: 72, textAlignVertical: 'top' },
  acceptBtnLarge: { height: 56, borderRadius: 17, backgroundColor: BROWN, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  acceptBtnLargeText: { color: '#fff', fontFamily: theme.font, fontSize: 17, fontWeight: '700' },
  planCard: { gap: theme.spacing.xs },
  planCardRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  planCardInfo: { flex: 1, gap: 3 },
  planCardDate: { color: theme.colors.text, fontFamily: theme.font, fontSize: 16, fontWeight: '700' },
  planCardCook: { color: theme.colors.muted, fontFamily: theme.font, fontSize: 13 },
  planCardMissing: { color: theme.colors.red, fontFamily: theme.font, fontSize: 12, fontWeight: '600' },
  planCardLow: { color: theme.colors.amber, fontFamily: theme.font, fontSize: 12, fontWeight: '600' },
  planCardHoliday: { color: theme.colors.blue, fontFamily: theme.font, fontSize: 12 },
  planCardRight: { alignItems: 'flex-end' },
  acceptedCard: { gap: 4 },
  warehouseNote: { color: theme.colors.muted, fontFamily: theme.font, fontSize: 12, fontStyle: 'italic' },
});
