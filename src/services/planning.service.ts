import {
  DailyPlan,
  HolidayEvent,
  InventoryItem,
  MonthlyForecast,
  ProductionRecord,
  RestaurantSettings,
  ShoppingItem,
} from '@/types';
import {
  getHolidayForDate,
  getSeasonalMultiplier,
  ingredientBasePrices,
  uzbekHolidays,
} from '@/constants/holidays';
import { addDays, toDateKey } from '@/utils/date';
import { average, roundTo, roundToHalf } from '@/utils/math';

const DAY_MULTIPLIERS = [1.12, 0.9, 0.93, 0.98, 1.0, 1.18, 1.16];

const deterministicNoise = (seed: number) => {
  const v = Math.sin(seed * 9.7534) * 43758.5453;
  return v - Math.floor(v);
};

export const generateDailyPlan = (
  date: Date,
  records: ProductionRecord[],
  inventory: InventoryItem[],
  settings: RestaurantSettings,
  seedOffset = 0,
): DailyPlan => {
  const recent = records.slice(-14);
  const baseDemand =
    recent.length > 0
      ? average(recent.map((r) => r.soldKg))
      : settings.defaultCookKg * 0.8;

  const dayMultiplier = DAY_MULTIPLIERS[date.getDay()] ?? 1;
  const seasonal = getSeasonalMultiplier(date);
  const holiday = getHolidayForDate(date);
  const holidayMultiplier = holiday?.demandMultiplier ?? 1;

  const noise = (deterministicNoise(date.getTime() / 86400000 + seedOffset) - 0.5) * 0.04;
  const forecastKg = roundTo(
    baseDemand * dayMultiplier * seasonal * holidayMultiplier * (1 + noise),
    1,
  );
  const safetyBuffer = 1 + settings.safetyBufferPercent / 100;
  const plannedCookKg = roundToHalf(forecastKg * safetyBuffer);

  const shoppingList: ShoppingItem[] = inventory.map((item) => {
    const quantity =
      item.unit === 'pcs'
        ? Math.ceil(item.recipeUsagePerKg * plannedCookKg)
        : roundTo(item.recipeUsagePerKg * plannedCookKg, 2);
    const basePrice = ingredientBasePrices[item.id] ?? 10000;
    const estimatedUnitPrice = Math.round(basePrice * (1 + (deterministicNoise(date.getTime() / 86400000 + seedOffset + 7) - 0.5) * 0.06));
    return {
      itemId: item.id,
      name: item.name,
      unit: item.unit,
      quantity,
      estimatedUnitPrice,
      estimatedCost: Math.round(quantity * estimatedUnitPrice),
      purchased: false,
    };
  });

  const dateKey = toDateKey(date);
  return {
    id: `plan-${dateKey}`,
    date: dateKey,
    forecastKg,
    plannedCookKg,
    shoppingList,
    status: 'pending',
    holidayId: holiday?.id,
    holidayName: holiday?.name,
    holidayMultiplier,
    seasonalMultiplier: seasonal,
    dayOfWeekMultiplier: dayMultiplier,
    notes: holiday ? `${holiday.name} — expect ${Math.round((holidayMultiplier - 1) * 100)}% higher demand.` : '',
  };
};

export const generatePlansForRange = (
  startDate: Date,
  days: number,
  records: ProductionRecord[],
  inventory: InventoryItem[],
  settings: RestaurantSettings,
): DailyPlan[] => {
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(startDate, i);
    return generateDailyPlan(date, records, inventory, settings, i);
  });
};

export const getMonthlyForecast = (
  year: number,
  month: number,
  records: ProductionRecord[],
  inventory: InventoryItem[],
  settings: RestaurantSettings,
): MonthlyForecast => {
  const daysInMonth = new Date(year, month, 0).getDate();
  const plans = Array.from({ length: daysInMonth }, (_, i) => {
    const date = new Date(year, month - 1, i + 1);
    return generateDailyPlan(date, records, inventory, settings, i + month * 31);
  });

  const totalForecastKg = roundTo(
    plans.reduce((sum, p) => sum + p.forecastKg, 0),
    1,
  );
  const avgDailyKg = roundTo(totalForecastKg / daysInMonth, 1);
  const estimatedRevenue = Math.round(totalForecastKg * settings.pricePerKg);

  const totalIngredientCost = plans.reduce((sum, plan) => {
    return sum + plan.shoppingList.reduce((s, item) => s + item.estimatedCost, 0);
  }, 0);

  const mmStr = String(month).padStart(2, '0');
  const monthHolidays = uzbekHolidays.filter((h) => {
    if (h.recurring) return h.date.startsWith(mmStr);
    return h.date.startsWith(`${year}-${mmStr}`);
  });

  return {
    year,
    month,
    avgDailyKg,
    totalForecastKg,
    estimatedRevenue,
    estimatedIngredientCost: totalIngredientCost,
    holidays: monthHolidays,
  };
};

export const getYearlyForecasts = (
  year: number,
  records: ProductionRecord[],
  inventory: InventoryItem[],
  settings: RestaurantSettings,
): MonthlyForecast[] => {
  return Array.from({ length: 12 }, (_, i) =>
    getMonthlyForecast(year, i + 1, records, inventory, settings),
  );
};

export const getHolidaysForMonth = (year: number, month: number): HolidayEvent[] => {
  const mmStr = String(month).padStart(2, '0');
  return uzbekHolidays.filter((h) => {
    if (h.recurring) return h.date.startsWith(mmStr);
    return h.date.startsWith(`${year}-${mmStr}`);
  });
};
