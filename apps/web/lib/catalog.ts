export type Catalog = {
  version: string;
  productCategories: { id: string; name: string }[];
  products: { id: string; categoryId: string; categoryName: string; name: string; price: string; unitCost: string }[];
};

export const apiUrl = () => process.env.NEXT_PUBLIC_API_URL ?? (typeof window === 'undefined' ? 'http://localhost:4000' : `http://${window.location.hostname}:4000`);

export async function loadCatalog(): Promise<Catalog> {
  const cached = localStorage.getItem('catalog');
  const old = cached ? JSON.parse(cached) as Catalog : null;
  let response = await fetch(`${apiUrl()}/catalog`, { credentials: 'include', headers: old ? { 'If-None-Match': old.version } : {} });
  if (response.status === 304 && old && response.headers.get('X-Catalog-Version') === old.version) return old;
  if (response.status === 304) response = await fetch(`${apiUrl()}/catalog`, { credentials: 'include' });
  if (!response.ok) throw new Error('Could not load the catalog');
  let data = await response.json() as Catalog;
  if (response.headers.get('X-Catalog-Version') !== data.version) {
    response = await fetch(`${apiUrl()}/catalog`, { credentials: 'include' });
    if (!response.ok) throw new Error('Could not refresh the catalog');
    data = await response.json() as Catalog;
    if (response.headers.get('X-Catalog-Version') !== data.version) throw new Error('Catalog changed while it was loading');
  }
  localStorage.setItem('catalog', JSON.stringify(data));
  return data;
}
