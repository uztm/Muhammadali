import { InventoryItem } from '@/types';

export const formatKg = (value: number) => `${value.toFixed(value % 1 === 0 ? 0 : 1)} kg`;

export const formatUnit = (value: number, unit: InventoryItem['unit']) => {
  if (unit === 'pcs') {
    return `${Math.ceil(value)} pcs`;
  }

  return `${value.toFixed(value >= 10 || value % 1 === 0 ? 0 : 1)} ${unit}`;
};

export const formatPercent = (value: number) => `${Math.round(value)}%`;

export const formatCurrency = (value: number) => {
  return `${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(Math.round(value))} UZS`;
};

export const formatSignedPercent = (value: number) => {
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${Math.round(value)}%`;
};
