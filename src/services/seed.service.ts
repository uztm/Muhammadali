import { recipePerKgPlov } from '@/constants/recipe';
import { ingredientBasePrices, getHolidayForDate, getSeasonalMultiplier } from '@/constants/holidays';
import {
  DailyPlan,
  InventoryItem,
  PriceRecord,
  ProductionRecord,
  PurchaseOrder,
  PurchaseOrderItem,
  RestaurantSettings,
  ShoppingItem,
} from '@/types';
import { addDays, toDateKey } from '@/utils/date';
import { roundTo, roundToHalf } from '@/utils/math';

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

const DAY_MULTIPLIERS = [1.12, 0.9, 0.93, 0.98, 1.0, 1.18, 1.16];

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
  const seasonal = getSeasonalMultiplier(date);
  const holiday = getHolidayForDate(date);
  const holidayMult = holiday?.demandMultiplier ?? 1;
  const weeklyDemand = 8 * (DAY_MULTIPLIERS[day] ?? 1) * seasonal * holidayMult;
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

export const seedDailyPlans = (
  records: ProductionRecord[],
  inventory: InventoryItem[],
  settings: RestaurantSettings,
  today = new Date(),
): DailyPlan[] => {
  const recent = records.slice(-14);
  const baseAvg = recent.reduce((s, r) => s + r.soldKg, 0) / Math.max(recent.length, 1);

  return Array.from({ length: 30 }, (_, i) => {
    const daysFromToday = i - 7;
    const date = addDays(today, daysFromToday);
    const dateKey = toDateKey(date);
    const day = date.getDay();
    const seasonal = getSeasonalMultiplier(date);
    const holiday = getHolidayForDate(date);
    const holidayMult = holiday?.demandMultiplier ?? 1;
    const noise = (deterministicNoise(date.getTime() / 86400000 + 5) - 0.5) * 0.04;
    const forecastKg = roundTo(
      baseAvg * (DAY_MULTIPLIERS[day] ?? 1) * seasonal * holidayMult * (1 + noise),
      1,
    );
    const plannedCookKg = roundToHalf(forecastKg * (1 + settings.safetyBufferPercent / 100));

    const shoppingList: ShoppingItem[] = inventory.map((item) => {
      const quantity =
        item.unit === 'pcs'
          ? Math.ceil(item.recipeUsagePerKg * plannedCookKg)
          : roundTo(item.recipeUsagePerKg * plannedCookKg, 2);
      const basePrice = ingredientBasePrices[item.id] ?? 10000;
      const priceSeed = deterministicNoise(date.getTime() / 86400000 + i + 10);
      const estimatedUnitPrice = Math.round(basePrice * (1 + (priceSeed - 0.5) * 0.06));
      return {
        itemId: item.id,
        name: item.name,
        unit: item.unit,
        quantity,
        estimatedUnitPrice,
        estimatedCost: Math.round(quantity * estimatedUnitPrice),
        purchased: daysFromToday < 0,
      };
    });

    const isPast = daysFromToday < 0;
    return {
      id: `plan-${dateKey}`,
      date: dateKey,
      forecastKg,
      plannedCookKg,
      shoppingList,
      status: isPast ? 'completed' : daysFromToday === 0 ? 'active' : 'pending',
      holidayId: holiday?.id,
      holidayName: holiday?.name,
      holidayMultiplier: holidayMult,
      seasonalMultiplier: seasonal,
      dayOfWeekMultiplier: DAY_MULTIPLIERS[day] ?? 1,
      notes: holiday ? `${holiday.name} — expect ${Math.round((holidayMult - 1) * 100)}% higher demand.` : '',
    };
  });
};

export const seedPurchaseOrders = (
  plans: DailyPlan[],
  records: ProductionRecord[],
  today = new Date(),
): PurchaseOrder[] => {
  const pastPlans = plans.filter((p) => p.status === 'completed').slice(-14);

  return pastPlans.map((plan, idx) => {
    const items: PurchaseOrderItem[] = plan.shoppingList.map((item) => {
      const priceSeed = deterministicNoise(idx * 17 + item.itemId.length * 3);
      const variance = (priceSeed - 0.5) * 0.3; // -15% to +15%
      const actualPrice = Math.round(item.estimatedUnitPrice * (1 + variance));
      const priceVariance = roundTo(((actualPrice - item.estimatedUnitPrice) / item.estimatedUnitPrice) * 100, 1);
      const absVar = Math.abs(priceVariance);
      const flagged = absVar >= 20;
      return {
        itemId: item.itemId,
        name: item.name,
        unit: item.unit,
        plannedQty: item.quantity,
        actualQty: item.quantity,
        plannedUnitPrice: item.estimatedUnitPrice,
        actualUnitPrice: actualPrice,
        priceVariancePercent: priceVariance,
        flagged,
        flagReason: flagged
          ? absVar >= 35
            ? `Price ${priceVariance > 0 ? 'exceeds' : 'below'} expected by ${Math.abs(Math.round(priceVariance))}% — possible fraud`
            : `Price deviation of ${Math.round(priceVariance)}% — review recommended`
          : '',
      };
    });

    const totalPlanned = items.reduce((s, it) => s + it.plannedQty * it.plannedUnitPrice, 0);
    const totalActual = items.reduce((s, it) => s + it.actualQty * it.actualUnitPrice, 0);
    const overallVariance = roundTo(((totalActual - totalPlanned) / totalPlanned) * 100, 1);
    const hasFlagged = items.some((it) => it.flagged);
    const isOldEnough = idx < pastPlans.length - 3;

    return {
      id: `order-${plan.date}`,
      date: plan.date,
      planId: plan.id,
      status: hasFlagged && !isOldEnough ? 'flagged' : isOldEnough ? 'verified' : 'submitted',
      items,
      submittedBy: 'bozorchi-1',
      verifiedBy: isOldEnough ? 'manager-1' : undefined,
      totalPlannedCost: Math.round(totalPlanned),
      totalActualCost: Math.round(totalActual),
      overallVariancePercent: overallVariance,
      createdAt: new Date(addDays(today, -(pastPlans.length - idx))).toISOString(),
      reviewNote: isOldEnough ? 'Prices verified against market rates.' : undefined,
    };
  });
};

export const seedPriceRecords = (
  orders: PurchaseOrder[],
  inventory: InventoryItem[],
): PriceRecord[] => {
  const records: PriceRecord[] = [];
  for (const order of orders) {
    for (const item of order.items) {
      const basePrice = ingredientBasePrices[item.itemId] ?? item.plannedUnitPrice;
      const deviation = roundTo(((item.actualUnitPrice - basePrice) / basePrice) * 100, 1);
      const absDeviation = Math.abs(deviation);
      const inv = inventory.find((i) => i.id === item.itemId);
      records.push({
        id: `price-${item.itemId}-${order.date}`,
        itemId: item.itemId,
        itemName: item.name,
        unitPrice: item.actualUnitPrice,
        unit: inv?.unit ?? 'kg',
        date: order.date,
        submittedBy: order.submittedBy,
        status: absDeviation >= 35 ? 'suspicious' : absDeviation >= 20 ? 'high' : 'normal',
        deviationPercent: deviation,
        orderId: order.id,
      });
    }
  }
  return records;
};
