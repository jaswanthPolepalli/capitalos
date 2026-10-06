export function businessToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function isISODate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10);
}
export function financialYearRange(startYear: number) { return { from: `${startYear}-04-01`, to: `${startYear + 1}-03-31` }; }
export function financialYearStart(today = businessToday()): number { return Number(today.slice(0, 4)) - (Number(today.slice(5, 7)) < 4 ? 1 : 0); }
export function monthlyAnniversary(anchor: string, monthOffset: number): string {
  const [year, month, day] = anchor.split('-').map(Number) as [number, number, number];
  const first = new Date(Date.UTC(year, month - 1 + monthOffset, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(day, lastDay)); return first.toISOString().slice(0, 10);
}
