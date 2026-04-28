import AsyncStorage from '@react-native-async-storage/async-storage';

import { seedInventory, seedProductionRecords, defaultSettings } from '@/services/seed.service';
import { InventoryItem, ProductionRecord, RestaurantSettings } from '@/types';

const STORAGE_KEYS = {
  seeded: 'osh-markazi.seeded',
  production: 'osh-markazi.production',
  inventory: 'osh-markazi.inventory',
  settings: 'osh-markazi.settings',
} as const;

const parseJson = <T>(value: string | null, fallback: T): T => {
  if (!value) {
    return fallback;
  }

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
  const seeded = await AsyncStorage.getItem(STORAGE_KEYS.seeded);

  if (seeded === 'true') {
    return;
  }

  await resetDemoData();
};

export const getProductionRecords = async (): Promise<ProductionRecord[]> => {
  const value = await AsyncStorage.getItem(STORAGE_KEYS.production);
  return parseJson<ProductionRecord[]>(value, []).map(hydrateRecord);
};

export const saveProductionRecords = async (records: ProductionRecord[]) => {
  const hydrated = records.map(hydrateRecord).sort((a, b) => a.date.localeCompare(b.date));
  await AsyncStorage.setItem(STORAGE_KEYS.production, JSON.stringify(hydrated));
};

export const addProductionRecord = async (record: ProductionRecord) => {
  const records = await getProductionRecords();
  const nextRecords = records.filter((item) => item.date !== record.date);
  nextRecords.push(hydrateRecord(record));
  await saveProductionRecords(nextRecords);
};

export const updateProductionRecord = async (record: ProductionRecord) => {
  await addProductionRecord(record);
};

export const deleteProductionRecord = async (recordDate: string) => {
  const records = await getProductionRecords();
  await saveProductionRecords(records.filter((record) => record.date !== recordDate));
};

export const getInventory = async (): Promise<InventoryItem[]> => {
  const value = await AsyncStorage.getItem(STORAGE_KEYS.inventory);
  return parseJson<InventoryItem[]>(value, seedInventory());
};

export const updateInventory = async (inventory: InventoryItem[]) => {
  await AsyncStorage.setItem(STORAGE_KEYS.inventory, JSON.stringify(inventory));
};

export const getSettings = async (): Promise<RestaurantSettings> => {
  const value = await AsyncStorage.getItem(STORAGE_KEYS.settings);
  return {
    ...defaultSettings,
    ...parseJson<Partial<RestaurantSettings>>(value, {}),
  };
};

export const updateSettings = async (settings: RestaurantSettings) => {
  await AsyncStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
};

export const resetDemoData = async () => {
  await Promise.all([
    AsyncStorage.setItem(STORAGE_KEYS.production, JSON.stringify(seedProductionRecords())),
    AsyncStorage.setItem(STORAGE_KEYS.inventory, JSON.stringify(seedInventory())),
    AsyncStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(defaultSettings)),
    AsyncStorage.setItem(STORAGE_KEYS.seeded, 'true'),
  ]);
};

export const clearLocalData = async () => {
  await Promise.all([
    AsyncStorage.removeItem(STORAGE_KEYS.seeded),
    AsyncStorage.removeItem(STORAGE_KEYS.production),
    AsyncStorage.removeItem(STORAGE_KEYS.inventory),
    AsyncStorage.removeItem(STORAGE_KEYS.settings),
  ]);
};
