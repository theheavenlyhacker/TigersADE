import { assertDayHasStarted, reconcile } from './cash-close';

describe('reconcile', () => {
  it('computes expected cash and variance', () => {
    expect(reconcile(100000n, 250000n, 349000n)).toEqual({ expectedCash: 350000n, variance: -1000n });
    expect(reconcile(0n, 0n, 500n)).toEqual({ expectedCash: 0n, variance: 500n });
  });
  it('rejects an expected amount beyond bigint', () => {
    expect(() => reconcile(9223372036854775807n, 1n, 0n)).toThrow('too large');
  });
});

describe('assertDayHasStarted', () => {
  it('rejects future business days only', () => {
    expect(() => assertDayHasStarted('2026-11-05', '2026-11-04')).toThrow('not started');
    expect(() => assertDayHasStarted('2026-11-04', '2026-11-04')).not.toThrow();
  });
});
