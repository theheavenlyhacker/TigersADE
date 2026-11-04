import { growthWindow } from './reports.controller';

describe('growthWindow', () => {
  it('uses the matching calendar dates from the previous month', () => {
    expect(growthWindow('2026-03-15')).toEqual({ from: '2026-02-01', to: '2026-02-15' });
  });

  it('clamps the window when the previous month is shorter', () => {
    expect(growthWindow('2026-03-31')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
  });
});
