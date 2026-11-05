import { Executor } from '../../db/unit-of-work';
import { PricedLine, SellableProduct } from '../domain/sale';

export interface SaleRecord { id: string; branchId: string; saleNo: number; businessDate: string; paymentMethod: string; total: string }
export type SaleView = SaleRecord & { lines: PricedLine[] };
export interface SaleListItem extends SaleRecord { createdAt: Date; voidedAt: Date | null; voidedBy: string | null; voidReason: string | null }
export interface VoidedSale { id: string; branchId: string; saleNo: number; businessDate: string; voidedAt: Date | null; voidedBy: string | null; voidReason: string | null }

export abstract class SalesRepository {
  /** Locks the branch row; this is what keeps sale numbers gapless. Returns its "HH:MM:SS" cutoff. */
  abstract lockBranch(tx: Executor, branchId: string): Promise<{ dayCutoff: string } | null>;
  abstract findSale(tx: Executor, id: string): Promise<SaleView | null>;
  abstract isDayClosed(tx: Executor, branchId: string, businessDate: string): Promise<boolean>;
  abstract findProducts(tx: Executor, ids: string[]): Promise<SellableProduct[]>;
  abstract allocateSaleNo(tx: Executor, branchId: string): Promise<number>;
  abstract insertSale(tx: Executor, sale: SaleRecord & { cashierId: string }, lines: PricedLine[]): Promise<void>;
  abstract lockSale(tx: Executor, saleId: string, branchId: string): Promise<{ id: string; saleNo: number; businessDate: string; voided: boolean } | null>;
  abstract markVoided(tx: Executor, saleId: string, by: { actorId: string; at: Date; reason: string }): Promise<VoidedSale>;
  abstract list(branchId: string, from: string, to: string): Promise<SaleListItem[]>;
}
