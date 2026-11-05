import { DomainError } from '../../shared/domain-error';
import { INT8_MAX } from '../../shared/int8';

export interface SellableProduct { id: string; name: string; price: string; unitCost: string; active: boolean }
export interface SaleLineInput { productId: string; qty: number }
export interface PricedLine { productId: string; productName: string; unitPrice: string; unitCost: string; qty: number }

/**
 * The server sets every price (ADR-0001): copy the product's current name, price and cost onto each line
 * and total them. The client only says which products and how many.
 */
export function priceSale(products: SellableProduct[], lines: SaleLineInput[]): { lines: PricedLine[]; total: bigint } {
  if (new Set(lines.map(l => l.productId)).size !== lines.length) throw new DomainError('invalid', 'Each product may appear on a sale only once');
  const byId = new Map(products.map(p => [p.id, p]));
  const priced = lines.map(line => {
    const product = byId.get(line.productId);
    if (!product) throw new DomainError('notFound', 'Product not found');
    if (!product.active) throw new DomainError('invalid', 'Archived products cannot be sold');
    return { productId: line.productId, productName: product.name, unitPrice: product.price, unitCost: product.unitCost, qty: line.qty };
  });
  const total = priced.reduce((sum, l) => sum + BigInt(l.unitPrice) * BigInt(l.qty), 0n);
  if (total > INT8_MAX) throw new DomainError('invalid', 'Sale total is too large');
  return { lines: priced, total };
}

/** Voiding rules, checked in order: not already voided, business day not closed. Who may void is enforced by the route's roles. */
export function assertCanVoid(sale: { voided: boolean; dayClosed: boolean }) {
  if (sale.voided) throw new DomainError('conflict', 'Sale is already voided');
  if (sale.dayClosed) throw new DomainError('conflict', 'This business day is already closed');
}
