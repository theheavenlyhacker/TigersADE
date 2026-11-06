import { Executor } from '../../db/unit-of-work';

export interface ProductView { id: string; categoryId: string; name: string; price: string; unitCost: string }
export interface ProductRecord extends ProductView { active: boolean }

export abstract class CatalogRepository {
  /** Latest `updated_at` across catalog tables, as an ISO string. */
  abstract version(): Promise<string>;
  abstract branches(): Promise<Array<{ id: string; code: string; name: string }>>;
  abstract productCategories(): Promise<Array<{ id: string; name: string }>>;
  abstract products(): Promise<Array<ProductView & { categoryName: string }>>;
  abstract expenseCategories(): Promise<Array<{ id: string; name: string }>>;

  abstract createProductCategory(name: string): Promise<{ id: string; name: string }>;
  abstract updateProductCategory(id: string, change: { name?: string; archive: boolean }): Promise<{ id: string; name: string; active: boolean } | null>;
  abstract hasActiveProductCategory(tx: Executor, id: string): Promise<boolean>;
  /** Inserts only if the category exists and is active; otherwise returns null. */
  abstract insertProduct(tx: Executor, product: { categoryId: string; name: string; price: string; unitCost: string }): Promise<ProductView | null>;
  abstract lockProduct(tx: Executor, id: string): Promise<ProductRecord | null>;
  abstract saveProduct(tx: Executor, id: string, next: ProductRecord): Promise<ProductRecord>;
  abstract createExpenseCategory(name: string): Promise<{ id: string; name: string }>;
  abstract renameExpenseCategory(id: string, name: string): Promise<{ id: string; name: string } | null>;
}
