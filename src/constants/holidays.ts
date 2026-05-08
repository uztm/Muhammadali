import { HolidayEvent, SeasonalPattern } from '@/types';

export const uzbekHolidays: HolidayEvent[] = [
  {
    id: 'new-year',
    name: "New Year's Day",
    date: '01-01',
    demandMultiplier: 1.7,
    recurring: true,
    type: 'national',
  },
  {
    id: 'defender',
    name: "Defender's Day",
    date: '01-14',
    demandMultiplier: 1.3,
    recurring: true,
    type: 'national',
  },
  {
    id: 'womens-day',
    name: "Women's Day",
    date: '03-08',
    demandMultiplier: 1.5,
    recurring: true,
    type: 'national',
  },
  {
    id: 'navruz',
    name: 'Navruz (Nowruz)',
    date: '03-21',
    demandMultiplier: 2.2,
    recurring: true,
    type: 'national',
  },
  {
    id: 'memory-honor',
    name: 'Memory and Honor Day',
    date: '05-09',
    demandMultiplier: 1.4,
    recurring: true,
    type: 'national',
  },
  {
    id: 'independence',
    name: 'Independence Day',
    date: '09-01',
    demandMultiplier: 1.8,
    recurring: true,
    type: 'national',
  },
  {
    id: 'teachers-day',
    name: "Teacher's Day",
    date: '10-01',
    demandMultiplier: 1.3,
    recurring: true,
    type: 'national',
  },
  {
    id: 'constitution',
    name: 'Constitution Day',
    date: '12-08',
    demandMultiplier: 1.3,
    recurring: true,
    type: 'national',
  },
  {
    id: 'eid-al-fitr',
    name: 'Eid al-Fitr (Ramazon Hayit)',
    date: '03-31',
    demandMultiplier: 2.0,
    recurring: false,
    type: 'religious',
  },
  {
    id: 'eid-al-adha',
    name: 'Eid al-Adha (Qurbon Hayit)',
    date: '06-07',
    demandMultiplier: 2.0,
    recurring: false,
    type: 'religious',
  },
];

export const seasonalMultipliers: SeasonalPattern[] = [
  { month: 1, multiplier: 0.82 },
  { month: 2, multiplier: 0.85 },
  { month: 3, multiplier: 1.15 }, // Navruz season
  { month: 4, multiplier: 1.05 },
  { month: 5, multiplier: 1.08 },
  { month: 6, multiplier: 0.92 },
  { month: 7, multiplier: 0.88 },
  { month: 8, multiplier: 0.90 },
  { month: 9, multiplier: 1.20 }, // Independence Day, wedding season
  { month: 10, multiplier: 1.10 },
  { month: 11, multiplier: 0.95 },
  { month: 12, multiplier: 0.87 },
];

export const ingredientBasePrices: Record<string, number> = {
  rice: 15000,
  meat: 75000,
  carrot: 4500,
  oil: 18000,
  onion: 3500,
  chickpeas: 12000,
  raisins: 28000,
  'quail-eggs': 800,
  salt: 2000,
  spices: 45000,
};

export const getHolidayForDate = (date: Date): HolidayEvent | undefined => {
  const mmdd = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const yyyymmdd = `${date.getFullYear()}-${mmdd}`;
  return uzbekHolidays.find((h) =>
    h.recurring ? h.date === mmdd : h.date === yyyymmdd,
  );
};

export const getSeasonalMultiplier = (date: Date): number => {
  const month = date.getMonth() + 1;
  return seasonalMultipliers.find((s) => s.month === month)?.multiplier ?? 1;
};
