import { recipePerKgPlov } from '@/constants/recipe';
import { InventoryItem, ProductionRecord, RestaurantSettings } from '@/types';
import { addDays, toDateKey } from '@/utils/date';
import { roundTo } from '@/utils/math';

export const defaultSettings: RestaurantSettings = {
  restaurantName: 'Osh Markazi',
  restaurantType: 'Uzbek Plov Center',
  location: 'Tashkent',
  defaultCookKg: 10,
  pricePerKg: 85000,
  safetyBufferPercent: 8,
};

const deterministicNoise = (seed: number) => {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
};

const dayMultiplier = (day: number) => {
  const multipliers = [1.12, 0.9, 0.93, 0.98, 1, 1.18, 1.16];
  return multipliers[day] ?? 1;
};

const createRecord = (date: Date, index: number, forceToday = false): ProductionRecord => {
  const dateKey = toDateKey(date);

  if (forceToday) {
    return {
      id: `production-${dateKey}`,
      date: dateKey,
      cookedKg: 10,
      soldKg: 8,
      wasteKg: 2,
      pricePerKg: defaultSettings.pricePerKg,
      revenue: 8 * defaultSettings.pricePerKg,
      wasteLoss: 2 * defaultSettings.pricePerKg,
    };
  }

  const day = date.getDay();
  const weeklyDemand = 8 * dayMultiplier(day);
  const variation = (deterministicNoise(index + 3) - 0.5) * 1.2;
  const specialDemand = index % 19 === 0 ? 1.1 : index % 23 === 0 ? -1.2 : 0;
  const soldKg = roundTo(Math.max(5.8, weeklyDemand + variation + specialDemand), 1);
  const cookedVariation = (deterministicNoise(index + 13) - 0.5) * 0.8;
  const cookedKg = roundTo(Math.max(soldKg + 0.4, 10 + cookedVariation + (day >= 5 ? 0.4 : 0)), 1);
  const wasteKg = roundTo(Math.max(0, cookedKg - soldKg), 1);
  const pricePerKg = defaultSettings.pricePerKg + (index % 11 === 0 ? 5000 : 0);

  return {
    id: `production-${dateKey}`,
    date: dateKey,
    cookedKg,
    soldKg,
    wasteKg,
    pricePerKg,
    revenue: Math.round(soldKg * pricePerKg),
    wasteLoss: Math.round(wasteKg * pricePerKg),
  };
};

export const seedProductionRecords = (today = new Date()): ProductionRecord[] => {
  return Array.from({ length: 60 }, (_, position) => {
    const daysAgo = 59 - position;
    const date = addDays(today, -daysAgo);
    return createRecord(date, position + 1, daysAgo === 0);
  });
};

export const seedInventory = (): InventoryItem[] => {
  return recipePerKgPlov.map((item) => ({ ...item }));
};
