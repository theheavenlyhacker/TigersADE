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
  const sale = { voided: false, businessDate: '2026-11-04', dayClosed: false };
  it('lets a cashier void only on the current business day', () => {
    expect(() => assertCanVoid(sale, { role: 'cashier' }, '2026-11-04')).not.toThrow();
    expect(() => assertCanVoid(sale, { role: 'cashier' }, '2026-11-05')).toThrow('current business day');
    expect(() => assertCanVoid(sale, { role: 'manager' }, '2026-11-05')).not.toThrow();
  });
  it('rejects voided sales and closed days', () => {
    expect(() => assertCanVoid({ ...sale, voided: true }, { role: 'owner' }, '2026-11-04')).toThrow('already voided');
    expect(() => assertCanVoid({ ...sale, dayClosed: true }, { role: 'owner' }, '2026-11-04')).toThrow('closed');
  });
});
