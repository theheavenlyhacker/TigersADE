import { isLowStock, isNegativeStock, movementDelta } from './stock';

describe('movementDelta', () => {
  it('adds received, subtracts wastage, and takes adjustments as signed', () => {
    expect(movementDelta('received', '2.5', '0')).toBe('2.500');
    expect(movementDelta('wastage', '1', '4')).toBe('-1.000');
    expect(movementDelta('adjustment', '-0.25', '4')).toBe('-0.250');
  });
  it('stores a count as counted minus on hand, even when negative stock is corrected', () => {
    expect(movementDelta('count', '10', '7.5')).toBe('2.500');
    expect(movementDelta('count', '0', '3')).toBe('-3.000');
    expect(movementDelta('count', '5', '-2')).toBe('7.000');
  });
  it('rejects zero (except counts) and negative received, wastage or count quantities', () => {
    expect(() => movementDelta('received', '0', '0')).toThrow();
    expect(() => movementDelta('wastage', '-1', '0')).toThrow();
    expect(() => movementDelta('count', '-1', '0')).toThrow();
    expect(() => movementDelta('count', '0', '0')).not.toThrow();
  });
});

describe('stock flags', () => {
  it('is low below par only, and negative below zero', () => {
    expect(isLowStock('1.999', '2.000')).toBe(true);
    expect(isLowStock('2.000', '2.000')).toBe(false);
    expect(isLowStock('0', null)).toBe(false);
    expect(isNegativeStock('-0.001')).toBe(true);
  });
});
