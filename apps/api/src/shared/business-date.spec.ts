import { businessDate, shiftDate } from './business-date';

describe('businessDate (ADR-0002, Manila time)', () => {
  const at = (manila: string) => new Date(`${manila}+08:00`);

  it('uses the calendar day when the cutoff is midnight', () => {
    expect(businessDate(at('2026-11-04T00:00:00'), '00:00')).toBe('2026-11-04');
    expect(businessDate(at('2026-11-04T23:59:00'), '00:00')).toBe('2026-11-04');
  });

  it('keeps early-morning sales on the previous day when the cutoff is after midnight', () => {
    expect(businessDate(at('2026-11-04T03:59:00'), '04:00')).toBe('2026-11-03');
    expect(businessDate(at('2026-11-04T04:00:00'), '04:00')).toBe('2026-11-04');
  });

  it('moves a sale to the new day when the cutoff changes', () => {
    const sale = at('2026-11-04T03:00:00');
    expect(businessDate(sale, '04:00')).toBe('2026-11-03');
    expect(businessDate(sale, '02:00')).toBe('2026-11-04');
  });

  it('accepts HH:MM:SS cutoffs and crosses month boundaries', () => {
    expect(businessDate(at('2026-12-01T01:00:00'), '04:00:00')).toBe('2026-11-30');
  });

  it('shifts dates across month and year ends', () => {
    expect(shiftDate('2026-01-01', -1)).toBe('2025-12-31');
    expect(shiftDate('2026-02-28', 1)).toBe('2026-03-01');
  });
});
