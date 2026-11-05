import { Inject, Injectable } from '@nestjs/common';
import { and, asc, between, desc, eq, inArray, sql } from 'drizzle-orm';
import { DB, Db } from '../../db/db.module';
import { branches, cashCloses, products, saleLines, sales } from '../../db/schema';
import { Executor } from '../../db/unit-of-work';
import { asText } from '../../shared/sql';
import { SaleRecord, SalesRepository } from '../application/sales.repository';
import { PricedLine } from '../domain/sale';

const saleColumns = {
  id: sales.id, branchId: sales.branchId, saleNo: sales.saleNo, businessDate: sql<string>`${sales.businessDate}::text`,
  paymentMethod: sales.paymentMethod, total: asText(sales.total),
};

@Injectable()
export class DrizzleSalesRepository extends SalesRepository {
  constructor(@Inject(DB) private readonly db: Db) { super(); }

  async lockBranch(tx: Executor, branchId: string) {
    const [row] = await tx.select({ dayCutoff: sql<string>`${branches.dayCutoff}::text` }).from(branches).where(eq(branches.id, branchId)).for('update');
    return row ?? null;
  }

  async findSale(tx: Executor, id: string) {
    const [sale] = await tx.select(saleColumns).from(sales).where(eq(sales.id, id));
    if (!sale) return null;
    const lines = await tx.select({ productId: saleLines.productId, productName: saleLines.productName, unitPrice: asText(saleLines.unitPrice), unitCost: asText(saleLines.unitCost), qty: saleLines.qty })
      .from(saleLines).where(eq(saleLines.saleId, id)).orderBy(asc(saleLines.id));
    return { ...sale, lines };
  }

  async isDayClosed(tx: Executor, branchId: string, businessDate: string) {
    const rows = await tx.select({ id: cashCloses.id }).from(cashCloses).where(and(eq(cashCloses.branchId, branchId), eq(cashCloses.businessDate, businessDate)));
    return rows.length > 0;
  }

  findProducts(tx: Executor, ids: string[]) {
    return tx.select({ id: products.id, name: products.name, price: asText(products.price), unitCost: asText(products.unitCost), active: products.active }).from(products).where(inArray(products.id, ids));
  }

  async allocateSaleNo(tx: Executor, branchId: string) {
    const [row] = await tx.update(branches).set({ nextSaleNo: sql`${branches.nextSaleNo} + 1` }).where(eq(branches.id, branchId)).returning({ saleNo: sql<number>`${branches.nextSaleNo} - 1` });
    return row.saleNo;
  }

  async insertSale(tx: Executor, sale: SaleRecord & { cashierId: string }, lines: PricedLine[]) {
    await tx.insert(sales).values({ id: sale.id, branchId: sale.branchId, saleNo: sale.saleNo, businessDate: sale.businessDate, paymentMethod: sale.paymentMethod as 'cash', total: BigInt(sale.total), cashierId: sale.cashierId });
    await tx.insert(saleLines).values(lines.map(l => ({ saleId: sale.id, productId: l.productId, productName: l.productName, unitPrice: BigInt(l.unitPrice), unitCost: BigInt(l.unitCost), qty: l.qty })));
  }

  async lockSale(tx: Executor, saleId: string, branchId: string) {
    const [row] = await tx.select({ id: sales.id, saleNo: sales.saleNo, businessDate: sql<string>`${sales.businessDate}::text`, voided: sql<boolean>`${sales.voidedAt} is not null` })
      .from(sales).where(and(eq(sales.id, saleId), eq(sales.branchId, branchId))).for('update');
    return row ?? null;
  }

  async markVoided(tx: Executor, saleId: string, by: { actorId: string; at: Date; reason: string }) {
    const [row] = await tx.update(sales).set({ voidedAt: by.at, voidedBy: by.actorId, voidReason: by.reason }).where(eq(sales.id, saleId))
      .returning({ id: sales.id, branchId: sales.branchId, saleNo: sales.saleNo, businessDate: sql<string>`${sales.businessDate}::text`, voidedAt: sales.voidedAt, voidedBy: sales.voidedBy, voidReason: sales.voidReason });
    return row;
  }

  list(branchId: string, from: string, to: string) {
    return this.db.select({ ...saleColumns, createdAt: sales.createdAt, voidedAt: sales.voidedAt, voidedBy: sales.voidedBy, voidReason: sales.voidReason })
      .from(sales).where(and(eq(sales.branchId, branchId), between(sales.businessDate, from, to))).orderBy(desc(sales.businessDate), desc(sales.saleNo));
  }
}
