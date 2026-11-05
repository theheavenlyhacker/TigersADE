import { UnprocessableEntityException } from '@nestjs/common';

export type MovementType = 'received' | 'wastage' | 'adjustment' | 'count';

// Quantities have three decimals; work in thousandths so arithmetic is exact.
const milli = (q: string) => { const [i, f = ''] = q.replace('-', '').split('.'); const n = BigInt(i) * 1000n + BigInt(f.padEnd(3, '0')); return q.startsWith('-') ? -n : n; };
const text = (n: bigint) => `${n < 0n ? '-' : ''}${(n < 0n ? -n : n) / 1000n}.${String((n < 0n ? -n : n) % 1000n).padStart(3, '0')}`;

/**
 * The signed change a movement makes to stock on hand. Received and wastage take a positive quantity
 * (wastage subtracts); an adjustment may be either sign; a count stores the difference between what was
 * counted and what the system had (spec §5).
 */
export function movementDelta(type: MovementType, quantity: string, onHand: string): string {
  const qty = milli(quantity);
  if (type !== 'count' && qty === 0n) throw new UnprocessableEntityException('quantity must not be zero');
  if (type !== 'adjustment' && qty < 0n) throw new UnprocessableEntityException('quantity must be positive; adjustments may be negative');
  if (type === 'wastage') return text(-qty);
  if (type === 'count') return text(qty - milli(onHand));
  return text(qty);
}

/** Low stock means on hand is below the branch's par level; an item with no par is never "low". */
export const isLowStock = (onHand: string, par: string | null) => par !== null && milli(onHand) < milli(par);
export const isNegativeStock = (onHand: string) => milli(onHand) < 0n;
