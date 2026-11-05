"use client";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/Auth";
import { Page, Bar } from "@/components/ui";
import { apiUrl } from "@/lib/catalog";

type Row = { itemId: string; branchId: string; branchName: string; name: string; unit: string; unitCost: string; par: string | null; onHand: string; lowStock: boolean; negativeStock: boolean };
type Reorder = { id: string; branchId: string; itemId: string; itemName: string; unit: string; quantity: string; status: string; createdAt: string };
const api = apiUrl;
export default function InventoryPage() {
  const { user, branches } = useAuth();
  const [rows, setRows] = useState<Row[]>([]), [items, setItems] = useState<any[]>([]), [lowOnly, setLowOnly] = useState(false), [error, setError] = useState(""), [saving, setSaving] = useState(false);
  const [newItem, setNewItem] = useState({ name: "", unit: "", unitCost: "" });
  const [reorders, setReorders] = useState<Reorder[]>([]);
  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const results = await Promise.all(branches.map(async (branch: any) => {
        const response = await fetch(`${api()}/branches/${branch.id}/inventory`, { credentials: "include" });
        if (!response.ok) throw new Error("Inventory could not be loaded.");
        const requests = await fetch(`${api()}/branches/${branch.id}/reorder-requests?status=requested`, { credentials: "include" });
        if (!requests.ok) throw new Error("Reorder requests could not be loaded.");
        return { rows: (await response.json()).map((row: any) => ({ ...row, branchId: branch.id, branchName: branch.name })), reorders: await requests.json() };
      }));
      setRows(results.flatMap(result => result.rows));
      setReorders(results.flatMap(result => result.reorders));
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
    <div className="card overflow-x-auto"><table className="w-full"><thead><tr><th>Item</th><th>Branch</th><th>On hand</th><th>Par</th><th>Level</th><th>Movement / count</th><th>Reorder</th></tr></thead><tbody>{visible.map(row => <tr key={`${row.itemId}:${row.branchId}`}><td>{row.name} ({row.unit}){(row.negativeStock || row.lowStock) && <strong className="block text-red-700">{row.negativeStock ? "Negative stock" : "Low stock"}</strong>}</td><td>{row.branchName}</td><td>{row.onHand}</td><td><input aria-label={`Par for ${row.name} at ${row.branchName}`} className="btn w-24" type="number" min="0" step="0.001" defaultValue={row.par ?? ""} onBlur={e => { if (e.target.value !== String(row.par ?? "")) void send(`/branches/${row.branchId}/inventory/${row.itemId}`, "PUT", { par: e.target.value }); }} /></td><td className="w-36"><Bar pct={Number(row.par) ? Number(row.onHand) / Number(row.par) * 100 : 100} c={row.lowStock || row.negativeStock ? "bg-red-600" : "bg-sage"} /></td><td><div className="flex gap-1"><select className="btn" id={`type-${row.itemId}-${row.branchId}`}><option value="received">Received</option><option value="wastage">Wastage</option><option value="adjustment">Adjustment</option><option value="count">Count</option></select><input className="btn w-24" type="number" step="0.001" placeholder="Qty" id={`qty-${row.itemId}-${row.branchId}`} /><button className="btn" disabled={saving} onClick={() => { const type = (document.getElementById(`type-${row.itemId}-${row.branchId}`) as HTMLSelectElement).value; const quantity = (document.getElementById(`qty-${row.itemId}-${row.branchId}`) as HTMLInputElement).value; void send(`/branches/${row.branchId}/stock-movements`, "POST", { itemId: row.itemId, type, quantity }); }}>Record</button></div></td><td><form className="flex gap-1" onSubmit={e => { e.preventDefault(); const quantity = new FormData(e.currentTarget).get("quantity"); void send(`/branches/${row.branchId}/reorder-requests`, "POST", { itemId: row.itemId, quantity }); }}><input name="quantity" aria-label={`Reorder quantity for ${row.name} at ${row.branchName}`} className="btn w-24" type="number" min="0.001" step="0.001" required /><button className="btn" disabled={saving}>Reorder</button></form></td></tr>)}</tbody></table>{!visible.length && <p className="p-4">No inventory items{lowOnly ? " below par" : " configured for these branches"}.</p>}</div>
    <section className="card"><h2 className="font-semibold mb-2">Pending reorder requests</h2>{reorders.length ? <ul className="divide-y">{reorders.map(reorder => <li key={reorder.id} className="flex flex-wrap items-center gap-3 py-2"><span>{reorder.quantity} {reorder.unit} {reorder.itemName} · {branches.find((branch: any) => branch.id === reorder.branchId)?.name}</span><button className="btn" disabled={saving} onClick={() => void send(`/branches/${reorder.branchId}/reorder-requests/${reorder.id}/receive`, "POST", {})}>Received</button><button className="btn" disabled={saving} onClick={() => void send(`/branches/${reorder.branchId}/reorder-requests/${reorder.id}/cancel`, "POST", {})}>Cancel</button></li>)}</ul> : <p>No pending reorder requests.</p>}</section>
  </Page>;
}
