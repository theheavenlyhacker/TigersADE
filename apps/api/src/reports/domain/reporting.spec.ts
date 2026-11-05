import { forecast, growthWindow, monthRange, rollUp, shareOfSales, trendStart, weekStart } from './reporting';

describe('growthWindow', () => {
  it('uses the matching calendar dates from the previous month', () => {
    expect(growthWindow('2026-03-15')).toEqual({ from: '2026-02-01', to: '2026-02-15' });
  });
  it('clamps the window when the previous month is shorter', () => {
    expect(growthWindow('2026-03-31')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
  });
});

describe('windows', () => {
  it('starts weeks on Monday and snaps the trend lookback to its bucket', () => {
    expect(weekStart('2026-11-05')).toBe('2026-11-02');
    expect(trendStart('day', '2026-11-05')).toBe('2026-08-14');
    expect(trendStart('month', '2026-11-05')).toBe('2026-08-01');
  });
  it('reports a past month in full and the current month up to today', () => {
    expect(monthRange('2026-10', '2026-11-05')).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(monthRange('2026-11', '2026-11-05')).toEqual({ from: '2026-11-01', to: '2026-11-05' });
  });
});

describe('figures', () => {
  it('forecasts the daily average ± 8%', () => {
    expect(forecast(1000, [{ start: '2026-11-01', end: '2026-11-10' }])).toEqual({ dailyAverage: '100', lower: '92', upper: '108' });
  });
  it('computes expense share and rolls branches up with operating contribution', () => {
    expect(shareOfSales('250', '1000')).toBe(25);
    expect(shareOfSales('1', '0')).toBeNull();
    const branch = { branchId: 'a', date: '2026-11-05', today: '100', week: '300', mtd: '1000', sales: '1000', customers: 4, previous: '800', expenses: '250', dailyTarget: '200', inventoryValue: '50' };
    const total = rollUp([branch, { ...branch, branchId: 'b' }]);
    expect(total).toMatchObject({ mtd: '2000', operatingContribution: '1500', customers: 8, growth: 25, targetProgress: 50 });
  });
});
