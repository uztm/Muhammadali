import {
  ForecastResult,
  IngredientRequirement,
  InventoryItem,
  ProductionRecord,
  PurchaseRecommendation,
  RestaurantSettings,
  UrgencyLevel,
  WasteAnalytics,
  WasteReductionAdvice,
} from '@/types';
import { getHolidayForDate, getSeasonalMultiplier } from '@/constants/holidays';
import { addDays, parseDateKey, sortByDateAsc, todayKey } from '@/utils/date';
import { average, clamp, roundTo, roundToHalf, sum } from '@/utils/math';
import { formatCurrency, formatKg } from '@/utils/format';

const dayOfWeekMultiplier = (date: Date) => {
  const multipliers = [1.12, 0.9, 0.93, 0.98, 1, 1.18, 1.16];
  return multipliers[date.getDay()] ?? 1;
};

const buildIngredientRequirements = (
  inventory: InventoryItem[],
  recommendedCookKg: number,
): IngredientRequirement[] => {
  return inventory.map((item) => ({
    itemId: item.id,
    name: item.name,
    unit: item.unit,
    requiredTomorrow: roundTo(item.recipeUsagePerKg * recommendedCookKg, item.unit === 'pcs' ? 0 : 2),
  }));
};

export const calculatePurchaseRecommendations = (
  inventory: InventoryItem[],
  recommendedCookKg: number,
): PurchaseRecommendation[] => {
  const requirements = buildIngredientRequirements(inventory, recommendedCookKg);

  return inventory
    .map((item) => {
      const requirement = requirements.find((r) => r.itemId === item.id);
      const requiredTomorrow = requirement?.requiredTomorrow ?? 0;
      const targetStock = Math.max(item.minimumStock, requiredTomorrow * 2);
      const deficit = targetStock - item.currentStock;
      const recommendedPurchase =
        item.unit === 'pcs'
          ? Math.max(0, Math.ceil(deficit))
          : roundTo(Math.max(0, deficit), 1);
      const urgency: UrgencyLevel =
        item.currentStock < requiredTomorrow
          ? 'urgent'
          : item.currentStock < item.minimumStock
            ? 'watch'
            : 'ok';
      const reason =
        urgency === 'urgent'
          ? 'Stock is below tomorrow production requirement.'
          : urgency === 'watch'
            ? 'Stock is below the operating minimum.'
            : 'Stock covers tomorrow production plan.';

      return {
        itemId: item.id,
        name: item.name,
        unit: item.unit,
        requiredTomorrow,
        currentStock: item.currentStock,
        recommendedPurchase,
        urgency,
        reason,
      };
    })
    .filter((item) => item.urgency !== 'ok' || item.recommendedPurchase > 0)
    .sort((a, b) => {
      const score: Record<UrgencyLevel, number> = { urgent: 0, watch: 1, ok: 2 };
      return score[a.urgency] - score[b.urgency];
    });
};

export const forecastNextDay = (
  records: ProductionRecord[],
  inventory: InventoryItem[],
  settings: RestaurantSettings,
): ForecastResult => {
  const sorted = sortByDateAsc(records);
  const recent = sorted.slice(-7);
  const previous = sorted.slice(-14, -7);
  const averageSold = average(recent.map((r) => r.soldKg)) || settings.defaultCookKg * 0.8;
  const averageWaste = average(recent.map((r) => r.wasteKg));
  const previousAverageSold = average(previous.map((r) => r.soldKg)) || averageSold;
  const trendRatio = previousAverageSold > 0 ? averageSold / previousAverageSold : 1;
  const trendMultiplier = clamp(1 + (trendRatio - 1) * 0.45, 0.92, 1.1);

  const tomorrow = addDays(parseDateKey(todayKey()), 1);
  const dowMultiplier = dayOfWeekMultiplier(tomorrow);
  const seasonal = getSeasonalMultiplier(tomorrow);
  const holiday = getHolidayForDate(tomorrow);
  const holidayMultiplier = holiday?.demandMultiplier ?? 1;

  const expectedSoldKg = roundTo(
    averageSold * dowMultiplier * seasonal * holidayMultiplier * trendMultiplier,
    1,
  );
  const safetyBufferKg = expectedSoldKg * (settings.safetyBufferPercent / 100);
  const recommendedCookKg = roundToHalf(expectedSoldKg + safetyBufferKg);
  const expectedWasteKg = roundTo(Math.max(0, recommendedCookKg - expectedSoldKg, averageWaste * 0.25), 1);
  const planningCookKg = settings.defaultCookKg;
  const reductionKg = roundTo(Math.max(0, planningCookKg - recommendedCookKg), 1);
  const possibleSavings = Math.round(Math.max(0, reductionKg) * settings.pricePerKg);
  const volatility = average(recent.map((r) => Math.abs(r.soldKg - averageSold)));
  const confidence = Math.round(clamp(88 - volatility * 12 - Math.abs(trendRatio - 1) * 30, 62, 93));

  const ingredientsRequired = buildIngredientRequirements(inventory, recommendedCookKg);
  const purchaseRecommendations = calculatePurchaseRecommendations(inventory, recommendedCookKg);

  const holidayNote = holiday ? ` (${holiday.name} — ${Math.round((holidayMultiplier - 1) * 100)}% demand boost)` : '';
  const message =
    reductionKg > 0
      ? `Reduce production by ${formatKg(reductionKg)} to lower waste risk.`
      : `Maintain production near ${formatKg(recommendedCookKg)} for tomorrow.`;

  return {
    expectedSoldKg,
    recommendedCookKg,
    expectedWasteKg,
    confidence,
    possibleSavings,
    reductionKg,
    message: message + holidayNote,
    ingredientsRequired,
    purchaseRecommendations,
    holidayName: holiday?.name,
    holidayMultiplier,
    seasonalMultiplier: seasonal,
  };
};

export const calculateWasteAnalytics = (
  records: ProductionRecord[],
  settings: RestaurantSettings,
  forecast?: ForecastResult,
): WasteAnalytics => {
  const sorted = sortByDateAsc(records);
  const currentWeek = sorted.slice(-7);
  const previousWeek = sorted.slice(-14, -7);
  const weeklyWasteKg = roundTo(sum(currentWeek.map((r) => r.wasteKg)), 1);
  const weeklyCookedKg = sum(currentWeek.map((r) => r.cookedKg));
  const wasteRate = weeklyCookedKg > 0 ? (weeklyWasteKg / weeklyCookedKg) * 100 : 0;
  const wasteLoss = sum(currentWeek.map((r) => r.wasteLoss));
  const previousWasteKg = sum(previousWeek.map((r) => r.wasteKg));
  const trendPercent =
    previousWasteKg > 0 ? ((weeklyWasteKg - previousWasteKg) / previousWasteKg) * 100 : 0;
  const averageDailyWasteKg = roundTo(average(currentWeek.map((r) => r.wasteKg)), 1);
  const bestDay = [...currentWeek].sort((a, b) => a.wasteKg - b.wasteKg)[0];
  const worstDay = [...currentWeek].sort((a, b) => b.wasteKg - a.wasteKg)[0];
  const recommendedCookKg =
    forecast?.recommendedCookKg ??
    roundToHalf(Math.max(0.5, average(currentWeek.map((r) => r.soldKg)) * 1.08));
  const targetReductionKg = roundTo(Math.max(0, settings.defaultCookKg - recommendedCookKg), 1);
  const targetWasteRiskKg = roundTo(
    Math.max(0, settings.defaultCookKg - average(currentWeek.map((r) => r.soldKg))),
    1,
  );
  const targetWeeklySavings = Math.round(targetReductionKg * 7 * settings.pricePerKg);
  const direction = trendPercent >= 0 ? 'increased' : 'decreased';

  return {
    weeklyWasteKg,
    wasteRate,
    wasteLoss,
    averageDailyWasteKg,
    planningTargetKg: settings.defaultCookKg,
    recommendedCookKg,
    targetReductionKg,
    targetWasteRiskKg,
    targetWeeklySavings,
    bestDay,
    worstDay,
    trendPercent,
    insights: [
      `Waste ${direction} by ${Math.abs(Math.round(trendPercent))}% compared to last week.`,
      `Average daily waste is ${formatKg(averageDailyWasteKg)}.`,
      targetReductionKg > 0
        ? `Forecast recommends ${formatKg(recommendedCookKg)}, saving around ${formatCurrency(targetWeeklySavings)} per week.`
        : `Current target is aligned with the forecasted cooking plan.`,
    ],
  };
};

export const calculateWasteReductionAdvice = (
  record: ProductionRecord | undefined,
  inventory: InventoryItem[],
  settings: RestaurantSettings,
): WasteReductionAdvice | null => {
  if (!record) return null;

  const hasWaste = record.wasteKg > 0;
  const soldOut = record.soldKg >= record.cookedKg && record.cookedKg > 0;
  const bufferPercent = soldOut ? 15 : Math.max(10, settings.safetyBufferPercent);
  const bufferedDemandKg = roundTo(record.soldKg * (1 + bufferPercent / 100), 1);
  const bufferedSoldKg = roundToHalf(bufferedDemandKg);
  const recommendedCookKg = soldOut
    ? Math.max(record.cookedKg, bufferedSoldKg)
    : hasWaste
      ? Math.max(record.soldKg, Math.min(record.cookedKg, bufferedSoldKg))
      : record.cookedKg;
  const reductionKg = roundTo(Math.max(0, record.cookedKg - recommendedCookKg), 1);
  const increaseKg = roundTo(Math.max(0, recommendedCookKg - record.cookedKg), 1);
  const possibleSavings = Math.round(reductionKg * settings.pricePerKg);
  const possibleExtraRevenue = Math.round(increaseKg * settings.pricePerKg);
  const ingredientAdvice = inventory.map((item) => {
    const decimals = item.unit === 'pcs' ? 0 : 2;
    const currentProductionUsage = roundTo(record.cookedKg * item.recipeUsagePerKg, decimals);
    const recommendedUsage = roundTo(recommendedCookKg * item.recipeUsagePerKg, decimals);
    const reduceBy = roundTo(Math.max(0, currentProductionUsage - recommendedUsage), decimals);
    const addBy = roundTo(Math.max(0, recommendedUsage - currentProductionUsage), decimals);
    return { itemId: item.id, name: item.name, unit: item.unit, currentProductionUsage, recommendedUsage, reduceBy, addBy };
  });
  const mode = soldOut ? 'increase' : hasWaste ? 'reduce' : 'maintain';

  return {
    mode,
    hasWaste,
    soldOut,
    currentCookKg: record.cookedKg,
    soldKg: record.soldKg,
    wasteKg: record.wasteKg,
    bufferPercent,
    bufferedDemandKg,
    recommendedCookKg,
    reductionKg,
    increaseKg,
    possibleSavings,
    possibleExtraRevenue,
    summary: hasWaste
      ? `Cooked ${formatKg(record.cookedKg)}, sold ${formatKg(record.soldKg)}. Add ${bufferPercent}% buffer → plan ${formatKg(recommendedCookKg)}.`
      : soldOut
        ? `Sold out ${formatKg(record.cookedKg)}. Add ${bufferPercent}% growth buffer → plan ${formatKg(recommendedCookKg)} next time.`
        : `No waste. Keep the plan near ${formatKg(record.cookedKg)}.`,
    ingredientAdvice,
  };
};

export const calculateInventoryDaysRemaining = (item: InventoryItem, forecast: ForecastResult) => {
  const requirement = forecast.ingredientsRequired.find((r) => r.itemId === item.id);
  const dailyUsage = requirement?.requiredTomorrow ?? item.recipeUsagePerKg * forecast.recommendedCookKg;
  if (dailyUsage <= 0) return 0;
  return roundTo(item.currentStock / dailyUsage, 1);
};
