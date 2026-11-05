import { DomainError } from '../../shared/domain-error';
import { assertCanVoid, priceSale } from './sale';

const latte = { id: 'a', name: 'Latte', price: '15000', unitCost: '5000', active: true };

describe('priceSale', () => {
  it('copies price and cost onto lines and totals them', () => {
    const { lines, total } = priceSale([latte], [{ productId: 'a', qty: 3 }]);
    expect(total).toBe(45000n);
    expect(lines[0]).toMatchObject({ productName: 'Latte', unitPrice: '15000', unitCost: '5000', qty: 3 });
  });
  it('rejects archived, unknown and repeated products', () => {
    expect(() => priceSale([{ ...latte, active: false }], [{ productId: 'a', qty: 1 }])).toThrow('Archived');
    expect(() => priceSale([], [{ productId: 'a', qty: 1 }])).toThrow('not found');
    expect(() => priceSale([latte], [{ productId: 'a', qty: 1 }, { productId: 'a', qty: 1 }])).toThrow('only once');
  });
});

describe('assertCanVoid', () => {
  const sale = { voided: false, dayClosed: false };
  it('allows an open, unvoided sale', () => { expect(() => assertCanVoid(sale)).not.toThrow(); });
  it('throws domain errors, not HTTP ones', () => { expect(() => assertCanVoid({ ...sale, voided: true })).toThrow(DomainError); });
  it('rejects voided sales and closed days', () => {
    expect(() => assertCanVoid({ ...sale, voided: true })).toThrow('already voided');
    expect(() => assertCanVoid({ ...sale, dayClosed: true })).toThrow('closed');
  });
});
