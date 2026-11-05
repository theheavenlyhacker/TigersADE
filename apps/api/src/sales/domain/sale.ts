import { ConflictException, ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { INT8_MAX } from '../../shared/sql';

export interface SellableProduct { id: string; name: string; price: string; unitCost: string; active: boolean }
export interface SaleLineInput { productId: string; qty: number }
export interface PricedLine { productId: string; productName: string; unitPrice: string; unitCost: string; qty: number }

/**
 * The server sets every price (ADR-0001): copy the product's current name, price and cost onto each line
 * and total them. The client only says which products and how many.
 */
export function priceSale(products: SellableProduct[], lines: SaleLineInput[]): { lines: PricedLine[]; total: bigint } {
  if (new Set(lines.map(l => l.productId)).size !== lines.length) throw new UnprocessableEntityException('Each product may appear on a sale only once');
  const byId = new Map(products.map(p => [p.id, p]));
  const priced = lines.map(line => {
    const product = byId.get(line.productId);
    if (!product) throw new NotFoundException('Product not found');
    if (!product.active) throw new UnprocessableEntityException('Archived products cannot be sold');
    return { productId: line.productId, productName: product.name, unitPrice: product.price, unitCost: product.unitCost, qty: line.qty };
  });
  const total = priced.reduce((sum, l) => sum + BigInt(l.unitPrice) * BigInt(l.qty), 0n);
  if (total > INT8_MAX) throw new UnprocessableEntityException('Sale total is too large');
  return { lines: priced, total };
}

/** Voiding rules, checked in order: not already voided, day not closed, cashiers only on the current business day. */
export function assertCanVoid(sale: { voided: boolean; businessDate: string; dayClosed: boolean }, actor: { role: string }, today: string) {
  if (sale.voided) throw new ConflictException('Sale is already voided');
  if (sale.dayClosed) throw new ConflictException('This business day is already closed');
  if (actor.role === 'cashier' && sale.businessDate !== today) throw new ForbiddenException('Cashiers can only void sales from the current business day');
}
