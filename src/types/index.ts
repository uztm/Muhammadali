export type InventoryCategory = 'base' | 'protein' | 'vegetable' | 'oil' | 'garnish' | 'seasoning';
export type UrgencyLevel = 'ok' | 'watch' | 'urgent';
export type UserRole = 'admin' | 'manager' | 'bozorchi' | 'warehouseman' | 'chef';
export type PlanStatus = 'pending' | 'active' | 'completed';
export type PurchaseStatus = 'pending' | 'submitted' | 'verified' | 'flagged' | 'received';
export type PriceStatus = 'normal' | 'high' | 'suspicious';

export interface AppUser {
  id: string;
  name: string;
  role: UserRole;
  pin: string;
}

export interface HolidayEvent {
  id: string;
  name: string;
  date: string; // MM-DD recurring or YYYY-MM-DD one-time
  demandMultiplier: number;
  recurring: boolean;
  type: 'national' | 'religious' | 'event';
}

export interface SeasonalPattern {
  month: number; // 1-12
  multiplier: number;
}

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

export interface ShoppingItem {
  itemId: string;
  name: string;
  unit: InventoryItem['unit'];
  quantity: number;
  estimatedUnitPrice: number;
  estimatedCost: number;
  purchased: boolean;
}

export interface DailyPlan {
  id: string;
  date: string;
  forecastKg: number;
  plannedCookKg: number;
  shoppingList: ShoppingItem[];
  status: PlanStatus;
  holidayId?: string;
  holidayName?: string;
  holidayMultiplier: number;
  seasonalMultiplier: number;
  dayOfWeekMultiplier: number;
  notes: string;
  warehouseAccepted: boolean;
  warehouseAcceptedBy?: string;
  warehouseAcceptedAt?: string;
  warehouseNote?: string;
}

export interface PurchaseOrderItem {
  itemId: string;
  name: string;
  unit: InventoryItem['unit'];
  plannedQty: number;
  actualQty: number;
  receivedQty: number;
  plannedUnitPrice: number;
  actualUnitPrice: number;
  priceVariancePercent: number;
  flagged: boolean;
  flagReason: string;
}

export interface PurchaseOrder {
  id: string;
  date: string;
  planId: string;
  status: PurchaseStatus;
  items: PurchaseOrderItem[];
  submittedBy: string;
  verifiedBy?: string;
  totalPlannedCost: number;
  totalActualCost: number;
  overallVariancePercent: number;
  createdAt: string;
  reviewNote?: string;
  warehouseNote?: string;
  warehouseAcceptedBy?: string;
  warehouseAcceptedAt?: string;
}

export interface PriceRecord {
  id: string;
  itemId: string;
  itemName: string;
  unitPrice: number;
  unit: InventoryItem['unit'];
  date: string;
  submittedBy: string;
  status: PriceStatus;
  deviationPercent: number;
  orderId?: string;
}

export interface SupplierPerformance {
  itemId: string;
  itemName: string;
  unit: InventoryItem['unit'];
  avgUnitPrice: number;
  minUnitPrice: number;
  maxUnitPrice: number;
  priceVolatility: number;
  flaggedCount: number;
  totalRecords: number;
  trend: 'up' | 'down' | 'stable';
}

export interface MonthlyForecast {
  year: number;
  month: number;
  avgDailyKg: number;
  totalForecastKg: number;
  estimatedRevenue: number;
  estimatedIngredientCost: number;
  holidays: HolidayEvent[];
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
  holidayName?: string;
  holidayMultiplier: number;
  seasonalMultiplier: number;
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

export interface MealIngredient {
  itemId: string;
  name: string;
  unit: InventoryItem['unit'];
  quantityPerKg: number;
}

export interface Meal {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  createdBy: string;
  ingredients: MealIngredient[];
}

export interface StockDeliveryItem {
  itemId: string;
  name: string;
  unit: InventoryItem['unit'];
  expectedQty: number;
  actualQty: number;
}

export interface StockDelivery {
  id: string;
  date: string;
  registeredBy: string;
  notes: string;
  items: StockDeliveryItem[];
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
