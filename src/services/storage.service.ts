import AsyncStorage from '@react-native-async-storage/async-storage';

import { seedInventory, seedProductionRecords, defaultSettings, seedDailyPlans, seedPurchaseOrders, seedPriceRecords } from '@/services/seed.service';
import { DailyPlan, InventoryItem, PriceRecord, ProductionRecord, PurchaseOrder, RestaurantSettings } from '@/types';

const KEYS = {
  seeded: 'osh-markazi.seeded',
  production: 'osh-markazi.production',
  inventory: 'osh-markazi.inventory',
  settings: 'osh-markazi.settings',
  dailyPlans: 'osh-markazi.daily-plans',
  purchaseOrders: 'osh-markazi.purchase-orders',
  priceRecords: 'osh-markazi.price-records',
} as const;

const parseJson = <T>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const hydrateRecord = (record: ProductionRecord): ProductionRecord => {
  const wasteKg = Math.max(0, record.cookedKg - record.soldKg);
  return {
    ...record,
    id: record.id || `production-${record.date}`,
    wasteKg,
    revenue: Math.round(record.soldKg * record.pricePerKg),
    wasteLoss: Math.round(wasteKg * record.pricePerKg),
  };
};

export const initializeStorage = async () => {
  const seeded = await AsyncStorage.getItem(KEYS.seeded);
  if (seeded === 'true') return;
  await resetDemoData();
};

// Production Records
export const getProductionRecords = async (): Promise<ProductionRecord[]> => {
  const value = await AsyncStorage.getItem(KEYS.production);
  return parseJson<ProductionRecord[]>(value, []).map(hydrateRecord);
};

export const saveProductionRecords = async (records: ProductionRecord[]) => {
  const hydrated = records.map(hydrateRecord).sort((a, b) => a.date.localeCompare(b.date));
  await AsyncStorage.setItem(KEYS.production, JSON.stringify(hydrated));
};

export const addProductionRecord = async (record: ProductionRecord) => {
  const records = await getProductionRecords();
  const next = records.filter((r) => r.date !== record.date);
  next.push(hydrateRecord(record));
  await saveProductionRecords(next);
};

export const updateProductionRecord = async (record: ProductionRecord) => {
  await addProductionRecord(record);
};

export const deleteProductionRecord = async (recordDate: string) => {
  const records = await getProductionRecords();
  await saveProductionRecords(records.filter((r) => r.date !== recordDate));
};

// Inventory
export const getInventory = async (): Promise<InventoryItem[]> => {
  const value = await AsyncStorage.getItem(KEYS.inventory);
  return parseJson<InventoryItem[]>(value, seedInventory());
};

export const updateInventory = async (inventory: InventoryItem[]) => {
  await AsyncStorage.setItem(KEYS.inventory, JSON.stringify(inventory));
};

// Settings
export const getSettings = async (): Promise<RestaurantSettings> => {
  const value = await AsyncStorage.getItem(KEYS.settings);
  return { ...defaultSettings, ...parseJson<Partial<RestaurantSettings>>(value, {}) };
};

export const updateSettings = async (settings: RestaurantSettings) => {
  await AsyncStorage.setItem(KEYS.settings, JSON.stringify(settings));
};

// Daily Plans
export const getDailyPlans = async (): Promise<DailyPlan[]> => {
  const value = await AsyncStorage.getItem(KEYS.dailyPlans);
  return parseJson<DailyPlan[]>(value, []);
};

export const saveDailyPlans = async (plans: DailyPlan[]) => {
  const sorted = [...plans].sort((a, b) => a.date.localeCompare(b.date));
  await AsyncStorage.setItem(KEYS.dailyPlans, JSON.stringify(sorted));
};

export const upsertDailyPlan = async (plan: DailyPlan) => {
  const plans = await getDailyPlans();
  const next = plans.filter((p) => p.id !== plan.id);
  next.push(plan);
  await saveDailyPlans(next);
};

export const getDailyPlan = async (date: string): Promise<DailyPlan | null> => {
  const plans = await getDailyPlans();
  return plans.find((p) => p.date === date) ?? null;
};

// Purchase Orders
export const getPurchaseOrders = async (): Promise<PurchaseOrder[]> => {
  const value = await AsyncStorage.getItem(KEYS.purchaseOrders);
  return parseJson<PurchaseOrder[]>(value, []);
};

export const savePurchaseOrders = async (orders: PurchaseOrder[]) => {
  const sorted = [...orders].sort((a, b) => b.date.localeCompare(a.date));
  await AsyncStorage.setItem(KEYS.purchaseOrders, JSON.stringify(sorted));
};

export const upsertPurchaseOrder = async (order: PurchaseOrder) => {
  const orders = await getPurchaseOrders();
  const next = orders.filter((o) => o.id !== order.id);
  next.push(order);
  await savePurchaseOrders(next);
};

export const getPurchaseOrder = async (id: string): Promise<PurchaseOrder | null> => {
  const orders = await getPurchaseOrders();
  return orders.find((o) => o.id === id) ?? null;
};

// Price Records
export const getPriceRecords = async (): Promise<PriceRecord[]> => {
  const value = await AsyncStorage.getItem(KEYS.priceRecords);
  return parseJson<PriceRecord[]>(value, []);
};

export const savePriceRecords = async (records: PriceRecord[]) => {
  await AsyncStorage.setItem(KEYS.priceRecords, JSON.stringify(records));
};

export const addPriceRecords = async (newRecords: PriceRecord[]) => {
  const existing = await getPriceRecords();
  await savePriceRecords([...existing, ...newRecords]);
};

// Reset / Clear
export const resetDemoData = async () => {
  const [records, inventory, settings] = [
    seedProductionRecords(),
    seedInventory(),
    defaultSettings,
  ];
  const plans = seedDailyPlans(records, inventory, settings);
  const orders = seedPurchaseOrders(plans, records);
  const prices = seedPriceRecords(orders, inventory);

  await Promise.all([
    AsyncStorage.setItem(KEYS.production, JSON.stringify(records)),
    AsyncStorage.setItem(KEYS.inventory, JSON.stringify(inventory)),
    AsyncStorage.setItem(KEYS.settings, JSON.stringify(settings)),
    AsyncStorage.setItem(KEYS.dailyPlans, JSON.stringify(plans)),
    AsyncStorage.setItem(KEYS.purchaseOrders, JSON.stringify(orders)),
    AsyncStorage.setItem(KEYS.priceRecords, JSON.stringify(prices)),
    AsyncStorage.setItem(KEYS.seeded, 'true'),
  ]);
};

export const clearLocalData = async () => {
  await Promise.all(Object.values(KEYS).map((k) => AsyncStorage.removeItem(k)));
};
