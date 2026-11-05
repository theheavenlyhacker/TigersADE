"use client";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/Auth";
import { Page, Bar } from "@/components/ui";
import { apiUrl } from "@/lib/catalog";

type Row = { itemId: string; branchId: string; branchName: string; name: string; unit: string; unitCost: string; par: string | null; onHand: string; lowStock: boolean; negativeStock: boolean };
const api = apiUrl;
export default function InventoryPage() {
  const { user, branches } = useAuth();
  const [rows, setRows] = useState<Row[]>([]), [items, setItems] = useState<any[]>([]), [lowOnly, setLowOnly] = useState(false), [error, setError] = useState(""), [saving, setSaving] = useState(false);
  const [newItem, setNewItem] = useState({ name: "", unit: "", unitCost: "" });
  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const results = await Promise.all(branches.map(async (branch: any) => {
        const response = await fetch(`${api()}/branches/${branch.id}/inventory`, { credentials: "include" });
        if (!response.ok) throw new Error("Inventory could not be loaded.");
        return (await response.json()).map((row: any) => ({ ...row, branchId: branch.id, branchName: branch.name }));
      }));
      setRows(results.flat());
      if (user.role === "owner") {
        const response = await fetch(`${api()}/inventory-items`, { credentials: "include" });
        if (!response.ok) throw new Error("Inventory items could not be loaded.");
        setItems(await response.json());
      }
      setError("");
    } catch (e: any) { setError(e.message); }
  }, [user, branches]);
  useEffect(() => { void refresh(); }, [refresh]);
  const send = async (path: string, method: string, body: unknown) => {
    setSaving(true);
    try {
      const response = await fetch(`${api()}${path}`, { method, credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not save inventory.");
      await refresh();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };
  const visible = rows.filter(row => !lowOnly || row.lowStock || row.negativeStock);
  return <Page title="Inventory" sub="Stock levels, counts and movements." action={<button className="btn" onClick={() => setLowOnly(!lowOnly)}>{lowOnly ? "Show all items" : "Show low stock only"}</button>}>
    {error && <p role="alert" className="card text-red-700">{error}</p>}
    {user?.role === "owner" && <form className="card flex flex-wrap gap-2 items-end" onSubmit={e => { e.preventDefault(); void send("/inventory-items", "POST", newItem); setNewItem({ name: "", unit: "", unitCost: "" }); }}>
      <label>Item<input className="btn block" value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} required /></label><label>Unit<input className="btn block" value={newItem.unit} onChange={e => setNewItem({ ...newItem, unit: e.target.value })} required /></label><label>Current cost (centavos)<input className="btn block" inputMode="numeric" value={newItem.unitCost} onChange={e => setNewItem({ ...newItem, unitCost: e.target.value })} required /></label><button className="btn-p" disabled={saving}>Add item</button>
    </form>}
    {user?.role === "owner" && <div className="card"><h2 className="font-semibold mb-2">Inventory items</h2>{items.map(item => <form key={item.id} className="flex flex-wrap gap-2 items-end py-2 border-b" onSubmit={e => { e.preventDefault(); const form = new FormData(e.currentTarget); void send(`/inventory-items/${item.id}`, "PATCH", { name: form.get("name"), unit: form.get("unit"), unitCost: form.get("unitCost") }); }}><label>Item<input name="name" className="btn block" defaultValue={item.name} disabled={!item.active} /></label><label>Unit<input name="unit" className="btn block" defaultValue={item.unit} disabled={!item.active} /></label><label>Cost (centavos)<input name="unitCost" className="btn block" defaultValue={item.unitCost} disabled={!item.active} /></label>{item.active ? <><button className="btn" disabled={saving}>Save</button><button type="button" className="btn" disabled={saving} onClick={() => void send(`/inventory-items/${item.id}`, "PATCH", { active: false })}>Archive</button></> : <span>Archived</span>}</form>)}</div>}
    <div className="card overflow-x-auto"><table className="w-full"><thead><tr><th>Item</th><th>Branch</th><th>On hand</th><th>Par</th><th>Level</th><th>Movement / count</th></tr></thead><tbody>{visible.map(row => <tr key={`${row.itemId}:${row.branchId}`}><td>{row.name} ({row.unit}){(row.negativeStock || row.lowStock) && <strong className="block text-red-700">{row.negativeStock ? "Negative stock" : "Low stock"}</strong>}</td><td>{row.branchName}</td><td>{row.onHand}</td><td><input aria-label={`Par for ${row.name} at ${row.branchName}`} className="btn w-24" type="number" min="0" step="0.001" defaultValue={row.par ?? ""} onBlur={e => { if (e.target.value !== String(row.par ?? "")) void send(`/branches/${row.branchId}/inventory/${row.itemId}`, "PUT", { par: e.target.value }); }} /></td><td className="w-36"><Bar pct={Number(row.par) ? Number(row.onHand) / Number(row.par) * 100 : 100} c={row.lowStock || row.negativeStock ? "bg-red-600" : "bg-sage"} /></td><td><div className="flex gap-1"><select className="btn" id={`type-${row.itemId}-${row.branchId}`}><option value="received">Received</option><option value="wastage">Wastage</option><option value="adjustment">Adjustment</option><option value="count">Count</option></select><input className="btn w-24" type="number" step="0.001" placeholder="Qty" id={`qty-${row.itemId}-${row.branchId}`} /><button className="btn" disabled={saving} onClick={() => { const type = (document.getElementById(`type-${row.itemId}-${row.branchId}`) as HTMLSelectElement).value; const quantity = (document.getElementById(`qty-${row.itemId}-${row.branchId}`) as HTMLInputElement).value; void send(`/branches/${row.branchId}/stock-movements`, "POST", { itemId: row.itemId, type, quantity }); }}>Record</button></div></td></tr>)}</tbody></table>{!visible.length && <p className="p-4">No inventory items{lowOnly ? " below par" : " configured for these branches"}.</p>}</div>
  </Page>;
}
