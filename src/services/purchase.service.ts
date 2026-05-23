import {
  DailyPlan,
  InventoryItem,
  PriceRecord,
  PriceStatus,
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseStatus,
  SupplierPerformance,
} from '@/types';
import { ingredientBasePrices } from '@/constants/holidays';
import { roundTo } from '@/utils/math';

const HIGH_VARIANCE_THRESHOLD = 0.2;
const SUSPICIOUS_VARIANCE_THRESHOLD = 0.35;

export const computePriceVariance = (planned: number, actual: number): number => {
  if (planned <= 0) return 0;
  return roundTo(((actual - planned) / planned) * 100, 1);
};

export const getPriceStatus = (deviationPercent: number): PriceStatus => {
  const abs = Math.abs(deviationPercent);
  if (abs >= SUSPICIOUS_VARIANCE_THRESHOLD * 100) return 'suspicious';
  if (abs >= HIGH_VARIANCE_THRESHOLD * 100) return 'high';
  return 'normal';
};

export const buildPurchaseOrderFromPlan = (
  plan: DailyPlan,
  submittedBy: string,
): PurchaseOrder => {
  const items: PurchaseOrderItem[] = plan.shoppingList.map((item) => ({
    itemId: item.itemId,
    name: item.name,
    unit: item.unit,
    plannedQty: item.quantity,
    actualQty: item.quantity,
    receivedQty: 0,
    plannedUnitPrice: item.estimatedUnitPrice,
    actualUnitPrice: item.estimatedUnitPrice,
    priceVariancePercent: 0,
    flagged: false,
    flagReason: '',
  }));

  const totalPlannedCost = items.reduce(
    (sum, it) => sum + it.plannedQty * it.plannedUnitPrice,
    0,
  );

  return {
    id: `order-${plan.date}-${Date.now()}`,
    date: plan.date,
    planId: plan.id,
    status: 'pending',
    items,
    submittedBy,
    totalPlannedCost: Math.round(totalPlannedCost),
    totalActualCost: Math.round(totalPlannedCost),
    overallVariancePercent: 0,
    createdAt: new Date().toISOString(),
  };
};

export const submitPurchaseOrder = (
  order: PurchaseOrder,
  actualItems: { itemId: string; actualQty: number; actualUnitPrice: number }[],
  submittedBy: string,
): PurchaseOrder => {
  const updatedItems: PurchaseOrderItem[] = order.items.map((item) => {
    const actual = actualItems.find((a) => a.itemId === item.itemId);
    if (!actual) return item;

    const variance = computePriceVariance(item.plannedUnitPrice, actual.actualUnitPrice);
    const absVariance = Math.abs(variance);
    const flagged = absVariance >= HIGH_VARIANCE_THRESHOLD * 100;
    const flagReason = flagged
      ? absVariance >= SUSPICIOUS_VARIANCE_THRESHOLD * 100
        ? `Price ${variance > 0 ? 'exceeds' : 'is below'} expected by ${Math.abs(Math.round(variance))}% — possible fraud`
        : `Price deviation of ${Math.round(variance)}% — review recommended`
      : '';

    return {
      ...item,
      actualQty: actual.actualQty,
      actualUnitPrice: actual.actualUnitPrice,
      priceVariancePercent: variance,
      flagged,
      flagReason,
    };
  });

  const totalActual = updatedItems.reduce(
    (sum, it) => sum + it.actualQty * it.actualUnitPrice,
    0,
  );
  const overallVariance = computePriceVariance(order.totalPlannedCost, totalActual);
  const hasFlagged = updatedItems.some((it) => it.flagged);

  return {
    ...order,
    items: updatedItems,
    submittedBy,
    status: hasFlagged ? 'flagged' : 'submitted',
    totalActualCost: Math.round(totalActual),
    overallVariancePercent: overallVariance,
  };
};

export const verifyPurchaseOrder = (
  order: PurchaseOrder,
  verifiedBy: string,
  approved: boolean,
  note: string,
): PurchaseOrder => ({
  ...order,
  status: approved ? 'verified' : 'flagged',
  verifiedBy,
  reviewNote: note,
});

export const extractPriceRecords = (
  order: PurchaseOrder,
  inventory: InventoryItem[],
): PriceRecord[] => {
  return order.items.map((item) => {
    const inv = inventory.find((i) => i.id === item.itemId);
    const basePrice = ingredientBasePrices[item.itemId] ?? item.plannedUnitPrice;
    const deviation = computePriceVariance(basePrice, item.actualUnitPrice);
    return {
      id: `price-${item.itemId}-${order.date}-${Date.now()}`,
      itemId: item.itemId,
      itemName: item.name,
      unitPrice: item.actualUnitPrice,
      unit: inv?.unit ?? 'kg',
      date: order.date,
      submittedBy: order.submittedBy,
      status: getPriceStatus(deviation),
      deviationPercent: deviation,
      orderId: order.id,
    };
  });
};

export const computeSupplierPerformance = (
  priceRecords: PriceRecord[],
): SupplierPerformance[] => {
  const byItem: Record<string, PriceRecord[]> = {};
  for (const rec of priceRecords) {
    if (!byItem[rec.itemId]) byItem[rec.itemId] = [];
    byItem[rec.itemId].push(rec);
  }

  return Object.entries(byItem).map(([itemId, records]) => {
    const prices = records.map((r) => r.unitPrice);
    const avg = prices.reduce((s, p) => s + p, 0) / prices.length;
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const variance = roundTo(
      Math.sqrt(prices.reduce((s, p) => s + (p - avg) ** 2, 0) / prices.length) / avg * 100,
      1,
    );
    const flaggedCount = records.filter((r) => r.status !== 'normal').length;

    const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
    const firstHalf = sorted.slice(0, Math.floor(sorted.length / 2));
    const secondHalf = sorted.slice(Math.floor(sorted.length / 2));
    const firstAvg = firstHalf.length ? firstHalf.reduce((s, r) => s + r.unitPrice, 0) / firstHalf.length : avg;
    const secondAvg = secondHalf.length ? secondHalf.reduce((s, r) => s + r.unitPrice, 0) / secondHalf.length : avg;
    const trend: 'up' | 'down' | 'stable' =
      secondAvg > firstAvg * 1.03 ? 'up' : secondAvg < firstAvg * 0.97 ? 'down' : 'stable';

    return {
      itemId,
      itemName: records[0]?.itemName ?? itemId,
      unit: records[0]?.unit ?? 'kg',
      avgUnitPrice: Math.round(avg),
      minUnitPrice: min,
      maxUnitPrice: max,
      priceVolatility: variance,
      flaggedCount,
      totalRecords: records.length,
      trend,
    };
  });
};
