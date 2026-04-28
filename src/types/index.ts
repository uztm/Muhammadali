export type InventoryCategory = 'base' | 'protein' | 'vegetable' | 'oil' | 'garnish' | 'seasoning';

export type UrgencyLevel = 'ok' | 'watch' | 'urgent';

export interface ProductionRecord {
  id: string;
  date: string;
  cookedKg: number;
  soldKg: number;
  wasteKg: number;
  pricePerKg: number;
  revenue: number;
  wasteLoss: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  unit: 'kg' | 'L' | 'pcs';
  currentStock: number;
  minimumStock: number;
  recipeUsagePerKg: number;
  category: InventoryCategory;
}

export interface IngredientRequirement {
  itemId: string;
  name: string;
  unit: InventoryItem['unit'];
  requiredTomorrow: number;
}

export interface PurchaseRecommendation {
  itemId: string;
  name: string;
  unit: InventoryItem['unit'];
  requiredTomorrow: number;
  currentStock: number;
  recommendedPurchase: number;
  urgency: UrgencyLevel;
  reason: string;
}

export interface ForecastResult {
  expectedSoldKg: number;
  recommendedCookKg: number;
  expectedWasteKg: number;
  confidence: number;
  possibleSavings: number;
  reductionKg: number;
  message: string;
  ingredientsRequired: IngredientRequirement[];
  purchaseRecommendations: PurchaseRecommendation[];
}

export interface WasteReductionIngredientAdvice {
  itemId: string;
  name: string;
  unit: InventoryItem['unit'];
  currentProductionUsage: number;
  recommendedUsage: number;
  reduceBy: number;
  addBy: number;
}

export interface WasteReductionAdvice {
  mode: 'reduce' | 'increase' | 'maintain';
  hasWaste: boolean;
  soldOut: boolean;
  currentCookKg: number;
  soldKg: number;
  wasteKg: number;
  bufferPercent: number;
  bufferedDemandKg: number;
  recommendedCookKg: number;
  reductionKg: number;
  increaseKg: number;
  possibleSavings: number;
  possibleExtraRevenue: number;
  summary: string;
  ingredientAdvice: WasteReductionIngredientAdvice[];
}

export interface RestaurantSettings {
  restaurantName: string;
  restaurantType: string;
  location: string;
  defaultCookKg: number;
  pricePerKg: number;
  safetyBufferPercent: number;
}

export interface WasteAnalytics {
  weeklyWasteKg: number;
  wasteRate: number;
  wasteLoss: number;
  averageDailyWasteKg: number;
  planningTargetKg: number;
  recommendedCookKg: number;
  targetReductionKg: number;
  targetWasteRiskKg: number;
  targetWeeklySavings: number;
  bestDay?: ProductionRecord;
  worstDay?: ProductionRecord;
  trendPercent: number;
  insights: string[];
}
