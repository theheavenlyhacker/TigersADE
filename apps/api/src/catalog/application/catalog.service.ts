import { Injectable, NotFoundException } from '@nestjs/common';
import { ActivityLog } from '../../db/activity-log';
import { UnitOfWork } from '../../db/unit-of-work';
import { productChangeActions } from '../domain/product-changes';
import { CatalogRepository } from './catalog.repository';

export interface ProductChange { name?: string; categoryId?: string; price?: string; unitCost?: string; active?: false }

@Injectable()
export class CatalogService {
  constructor(private readonly repo: CatalogRepository, private readonly uow: UnitOfWork, private readonly activity: ActivityLog) {}

  version() { return this.repo.version(); }

  async read(version: string) {
    const [branches, productCategories, products, expenseCategories] = await Promise.all([
      this.repo.branches(), this.repo.productCategories(), this.repo.products(), this.repo.expenseCategories(),
    ]);
    return { version, branches, productCategories, products, expenseCategories };
  }

  createProductCategory(name: string) { return this.repo.createProductCategory(name); }

  async updateProductCategory(id: string, change: { name?: string; active?: false }) {
    const updated = await this.repo.updateProductCategory(id, { name: change.name, archive: change.active === false });
    if (!updated) throw new NotFoundException();
    return updated;
  }

  createExpenseCategory(name: string) { return this.repo.createExpenseCategory(name); }

  async renameExpenseCategory(id: string, name: string) {
    const updated = await this.repo.renameExpenseCategory(id, name);
    if (!updated) throw new NotFoundException();
    return updated;
  }

  createProduct(actorId: string, input: { name: string; categoryId: string; price: string; unitCost: string }) {
    return this.uow.run(async tx => {
      const product = await this.repo.insertProduct(tx, input);
      if (!product) throw new NotFoundException('Product category not found');
      await this.activity.record(tx, { branchId: null, actorId, action: 'product.created', payload: { productId: product.id, after: product } });
      return product;
    });
  }

  changeProduct(actorId: string, id: string, change: ProductChange) {
    return this.uow.run(async tx => {
      const before = await this.repo.lockProduct(tx, id);
      if (!before || !before.active) throw new NotFoundException();
      if (change.categoryId && !(await this.repo.hasActiveProductCategory(tx, change.categoryId))) throw new NotFoundException('Product category not found');
      const after = await this.repo.saveProduct(tx, id, {
        ...before, categoryId: change.categoryId ?? before.categoryId, name: change.name ?? before.name,
        price: change.price ?? before.price, unitCost: change.unitCost ?? before.unitCost, active: change.active === false ? false : before.active,
      });
      for (const { action } of productChangeActions(before, after)) {
        const payload = action === 'price.changed'
          ? { productId: id, price: { before: before.price, after: after.price } }
          : { productId: id, before: { active: true }, after: { active: false } };
        await this.activity.record(tx, { branchId: null, actorId, action, payload });
      }
      return after;
    });
  }
}
