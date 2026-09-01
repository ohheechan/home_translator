/** eligibility.ts와 scoring.ts가 공유하는 날짜 계산 유틸. YYYY-MM-DD 문자열 기준. */

export function yearsBetween(fromISO: string, toISO: string): number {
  const from = new Date(fromISO);
  const to = new Date(toISO);
  let years = to.getUTCFullYear() - from.getUTCFullYear();
  const monthDay = (to.getUTCMonth() - from.getUTCMonth()) * 100 + (to.getUTCDate() - from.getUTCDate());
  if (monthDay < 0) years -= 1;
  return years;
}

export function ageInYears(birthISO: string, asOfISO: string): number {
  return yearsBetween(birthISO, asOfISO);
}

export function addYears(iso: string, years: number): string {
  const d = new Date(iso);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
}
