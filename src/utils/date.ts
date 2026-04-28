const pad = (value: number) => String(value).padStart(2, '0');

export const toDateKey = (date: Date) => {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export const parseDateKey = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

export const todayKey = () => toDateKey(new Date());

export const displayDate = (dateKey: string) => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  }).format(parseDateKey(dateKey));
};

export const sortByDateDesc = <T extends { date: string }>(records: T[]) => {
  return [...records].sort((a, b) => b.date.localeCompare(a.date));
};

export const sortByDateAsc = <T extends { date: string }>(records: T[]) => {
  return [...records].sort((a, b) => a.date.localeCompare(b.date));
};
