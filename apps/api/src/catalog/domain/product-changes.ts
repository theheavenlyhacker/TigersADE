export interface ProductSnapshot { price: string; active: boolean }

/** Which audited actions a product edit amounts to (spec §5, activity log). */
export function productChangeActions(before: ProductSnapshot, after: ProductSnapshot) {
  const actions: Array<{ action: 'price.changed' | 'product.archived' }> = [];
  if (before.price !== after.price) actions.push({ action: 'price.changed' });
  if (before.active && !after.active) actions.push({ action: 'product.archived' });
  return actions;
}
