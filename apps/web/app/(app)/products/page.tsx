"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Page } from "@/components/ui";
import { useAuth } from "@/components/Auth";
import { peso } from "@/lib/data";
import { Catalog, apiUrl, loadCatalog } from "@/lib/catalog";
const displayMoney = (centavos: string) => peso(Number(centavos) / 100);

export default function P() {
  const { user } = useAuth();
  const owner = user?.role === "owner";
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("All");
  const [error, setError] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newCost, setNewCost] = useState("");
  const [newCategoryId, setNewCategoryId] = useState("");
  const [prices, setPrices] = useState<Record<string, string>>({});

  const refresh = async () => {
    setCatalog(await loadCatalog());
  };

  useEffect(() => { refresh().catch(() => setError("Could not load the catalog.")); }, []);
  const rows = useMemo(() => catalog?.products.filter(p => (category === "All" || p.categoryId === category) && p.name.toLowerCase().includes(q.toLowerCase())) ?? [], [catalog, category, q]);

  const mutate = async (path: string, method: string, data: object) => {
    const response = await fetch(`${apiUrl()}${path}`, { method, credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    if (!response.ok) throw new Error("Could not save catalog changes");
    await refresh();
  };
  const submitCategory = async (event: FormEvent) => {
    event.preventDefault(); setError("");
    try { await mutate("/product-categories", "POST", { name: newCategory }); setNewCategory(""); }
    catch { setError("Could not add category."); }
  };
  const submitProduct = async (event: FormEvent) => {
    event.preventDefault(); setError("");
    try {
      await mutate("/products", "POST", { name: newName, categoryId: newCategoryId, price: String(Math.round(Number(newPrice) * 100)), unitCost: String(Math.round(Number(newCost) * 100)) });
      setNewName(""); setNewPrice(""); setNewCost("");
    } catch { setError("Could not add product."); }
  };

  return <Page title="Products" sub="Products, prices and margins.">
    <div className="flex gap-2 flex-wrap"><input className="btn" placeholder="Search products" value={q} onChange={e => setQ(e.target.value)} />
      <button onClick={() => setCategory("All")} className={category === "All" ? "btn-p" : "btn"}>All</button>
      {catalog?.productCategories.map(c => <span key={c.id} className="flex gap-1"><button onClick={() => setCategory(c.id)} className={category === c.id ? "btn-p" : "btn"}>{c.name}</button>{owner && <><button className="btn" aria-label={`Rename ${c.name}`} onClick={() => { const value = window.prompt("Category name", c.name); if (value) mutate(`/product-categories/${c.id}`, "PATCH", { name: value }).catch(() => setError("Could not rename category.")); }}>Rename</button><button className="btn" aria-label={`Archive ${c.name}`} onClick={() => mutate(`/product-categories/${c.id}`, "PATCH", { active: false }).catch(() => setError("Could not archive category."))}>Archive</button></>}</span>)}
    </div>
    {owner && <div className="card grid gap-3 md:grid-cols-2">
      <form onSubmit={submitCategory} className="flex gap-2"><input className="btn" aria-label="New category" placeholder="New category" value={newCategory} onChange={e => setNewCategory(e.target.value)} required /><button className="btn-p">Add category</button></form>
      <form onSubmit={submitProduct} className="grid gap-2">
        <input className="btn" aria-label="Product name" placeholder="Product name" value={newName} onChange={e => setNewName(e.target.value)} required />
        <select className="btn" aria-label="Product category" value={newCategoryId} onChange={e => setNewCategoryId(e.target.value)} required><option value="">Choose category</option>{catalog?.productCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <input className="btn" aria-label="Price in pesos" placeholder="Price (₱)" type="number" min="0" step="0.01" value={newPrice} onChange={e => setNewPrice(e.target.value)} required />
        <input className="btn" aria-label="Unit cost in pesos" placeholder="Unit cost (₱)" type="number" min="0" step="0.01" value={newCost} onChange={e => setNewCost(e.target.value)} required />
        <button className="btn-p">Add product</button>
      </form>
    </div>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
    <div className="card"><table className="w-full"><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Unit cost</th><th>Margin</th>{owner && <th>Manage</th>}</tr></thead><tbody>{rows.map(p => {
      const margin = Number(p.price) ? Math.round((Number(p.price) - Number(p.unitCost)) / Number(p.price) * 100) : 0;
      return <tr key={p.id}><td>{p.name}</td><td>{p.categoryName}</td><td>{displayMoney(p.price)}</td><td>{displayMoney(p.unitCost)}</td><td>{margin}%</td>{owner && <td className="flex gap-2"><input className="btn w-28" aria-label={`Price for ${p.name}`} value={prices[p.id] ?? (Number(p.price) / 100).toFixed(2)} onChange={e => setPrices({ ...prices, [p.id]: e.target.value })} /><button className="btn" onClick={() => mutate(`/products/${p.id}`, "PATCH", { price: String(Math.round(Number(prices[p.id] ?? Number(p.price) / 100) * 100)) }).catch(() => setError("Could not update price."))}>Save price</button><button className="btn" onClick={() => mutate(`/products/${p.id}`, "PATCH", { active: false }).catch(() => setError("Could not archive product."))}>Archive</button></td>}</tr>;
    })}</tbody></table>{!rows.length && <p className="text-black/50 pt-3">No products match. Try a different search.</p>}</div>
  </Page>;
}
