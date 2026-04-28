export const roundTo = (value: number, decimals = 1) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

export const roundToHalf = (value: number) => Math.round(value * 2) / 2;

export const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
};

export const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

export const average = (values: number[]) => {
  if (values.length === 0) {
    return 0;
  }

  return sum(values) / values.length;
};
