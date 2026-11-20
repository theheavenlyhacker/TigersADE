import { apiUrl } from "@/lib/catalog";

export const getReport = async (path: string) => {
  const response = await fetch(`${apiUrl()}/reports/${path}`, { credentials: "include" });
  if (!response.ok) throw new Error("Dashboard reports could not be loaded.");
  return response.json();
};

/** Low-stock items across the given branches, each tagged with its branch name. */
export const getLowStock = async (branches: any[]) => (await Promise.all(branches.map(async b => {
  const items = await (await fetch(`${apiUrl()}/branches/${b.id}/inventory?low=true`, { credentials: "include" })).json();
  return items.map((i: any) => ({ ...i, branchName: b.name }));
}))).flat();

/** Best sellers from several branches, merged per product; revenue stays centavos, margin is revenue-weighted. */
export function mergeBestSellers(rows: any[]) {
  const products = new Map<string, any>();
  for (const product of rows) {
    const current = products.get(product.productId) ?? { ...product, units: 0, revenue: BigInt(0), marginValue: 0 };
    current.units += Number(product.units); current.revenue += BigInt(product.revenue); current.marginValue += Number(product.revenue) * Number(product.margin) / 100;
    products.set(product.productId, current);
  }
  return [...products.values()].map(p => ({ ...p, revenue: p.revenue.toString(), margin: p.revenue ? (p.marginValue / Number(p.revenue) * 100).toFixed(2) : "0" }));
}

export function mergePeakHours(rows: any[]) {
  const hours = new Map<number, any>();
  for (const hour of rows) {
    const current = hours.get(hour.local_hour) ?? { ...hour, customers: 0, sales: BigInt(0) };
    current.customers += Number(hour.customers); current.sales += BigInt(hour.sales); hours.set(hour.local_hour, current);
  }
  return [...hours.values()].map(p => ({ ...p, sales: p.sales.toString() }));
}
