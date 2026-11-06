// Pure business-day rules (ADR-0002). No framework or database imports.
export const MANILA_TZ = 'Asia/Manila';

/** The business date `now` belongs to, given a branch's day cutoff ("HH:MM" or "HH:MM:SS"). */
export function businessDate(now: Date, cutoff: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: MANILA_TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const day = `${values.year}-${values.month}-${values.day}`;
  return `${values.hour}:${values.minute}:00` < cutoff.slice(0, 5) + ':00' ? shiftDate(day, -1) : day;
}

export const shiftDate = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
