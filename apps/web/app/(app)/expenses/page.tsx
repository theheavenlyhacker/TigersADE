"use client";
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/components/Auth";
import { Page, Bar } from "@/components/ui";
import { peso } from "@/lib/data";
import { apiUrl, loadCatalog } from "@/lib/catalog";

type Expense = { id: string; categoryId: string; categoryName: string; businessDate: string; amount: string; note: string | null };
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export default function ExpensesPage() {
  const { user, branches } = useAuth();
  const [branchId, setBranchId] = useState("");
  const [month] = useState(today().slice(0, 7));
  const [rows, setRows] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [report, setReport] = useState<any>(null);
  const [edit, setEdit] = useState<Expense | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [businessDate, setBusinessDate] = useState(today);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => { if (!branchId && branches.length) setBranchId(branches[0].id); }, [branches, branchId]);
  useEffect(() => { loadCatalog().then(c => setCategories(c.expenseCategories)).catch(() => setError("Could not load expense categories.")); }, []);
  useEffect(() => {
    if (!branchId) return;
    const start = `${month}-01`, end = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).toISOString().slice(0, 10);
    Promise.all([
      fetch(`${apiUrl()}/branches/${branchId}/expenses?from=${start}&to=${end}`, { credentials: "include" }).then(r => r.ok ? r.json() : Promise.reject()),
      fetch(`${apiUrl()}/reports/expenses?branch=${user?.role === "owner" ? "all" : branchId}&month=${month}`, { credentials: "include" }).then(r => r.ok ? r.json() : Promise.reject()),
    ]).then(([expenses, summary]) => { setRows(expenses); setReport(summary); setError(""); }).catch(() => setError("Expenses could not be loaded."));
  }, [branchId, month, refresh, user?.role]);
  if (!user) return null;
  const save = async (event: FormEvent) => {
    event.preventDefault(); setError("");
    const path = `/branches/${branchId}/expenses${edit ? `/${edit.id}` : ""}`;
    try {
      const response = await fetch(`${apiUrl()}${path}`, { method: edit ? "PATCH" : "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ categoryId, businessDate, amount: String(Math.round(Number(amount) * 100)), note: note || null }) });
      if (!response.ok) throw new Error("Expense could not be saved.");
      setEdit(null); setCategoryId(""); setAmount(""); setNote(""); setBusinessDate(today()); setRefresh(n => n + 1);
    } catch (e) { setError(e instanceof Error ? e.message : "Expense could not be saved."); }
  };
  const startEdit = (row: Expense) => { setEdit(row); setCategoryId(row.categoryId); setBusinessDate(row.businessDate); setAmount((Number(row.amount) / 100).toFixed(2)); setNote(row.note ?? ""); };
  const remove = async (row: Expense) => {
    if (!window.confirm("Delete this expense?")) return;
    const response = await fetch(`${apiUrl()}/branches/${branchId}/expenses/${row.id}`, { method: "DELETE", credentials: "include" });
    if (response.ok) setRefresh(n => n + 1); else setError("Expense could not be deleted.");
  };
  return <Page title="Expenses" sub="Branch spending for the current month.">
    <div className="card flex flex-wrap items-end gap-3"><label className="text-sm">Branch<select className="block mt-1 border rounded-lg p-2" value={branchId} onChange={e => setBranchId(e.target.value)}>{branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label><span className="text-sm">{month} · Month to date</span></div>
    {report && <div className="card"><div className="text-4xl font-semibold mb-4">{peso(Number(report.expenses) / 100)}</div>{report.categories.map((c: any) => { const pct = Number(report.expenses) ? Number(c.total) / Number(report.expenses) * 100 : 0; return <div key={c.categoryId} className="mb-4"><div className="flex justify-between text-sm mb-1"><span>{c.categoryName}</span><span>{peso(Number(c.total) / 100)} · {pct.toFixed(1)}%</span></div><Bar pct={pct}/></div>; })}<p className="text-sm">Expenses are {report.shareOfSales === null ? "—" : `${report.shareOfSales}%`} of sales.</p></div>}
    <form className="card grid gap-3 md:grid-cols-5" onSubmit={save}><select className="btn" aria-label="Expense category" required value={categoryId} onChange={e => setCategoryId(e.target.value)}><option value="">Expense category</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><input className="btn" aria-label="Business date" type="date" required value={businessDate} onChange={e => setBusinessDate(e.target.value)}/><input className="btn" aria-label="Amount in pesos" type="number" min="0.01" step="0.01" required placeholder="Amount (₱)" value={amount} onChange={e => setAmount(e.target.value)}/><input className="btn" aria-label="Note" maxLength={1000} placeholder="Note" value={note} onChange={e => setNote(e.target.value)}/><div className="flex gap-2"><button className="btn-p">{edit ? "Save expense" : "Add expense"}</button>{edit && <button type="button" className="btn" onClick={() => setEdit(null)}>Cancel</button>}</div></form>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    <div className="card overflow-x-auto"><table className="w-full"><thead><tr><th>Business date</th><th>Category</th><th>Amount</th><th>Note</th><th>Actions</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td>{row.businessDate}</td><td>{row.categoryName}</td><td>{peso(Number(row.amount) / 100)}</td><td>{row.note}</td><td className="flex gap-2"><button className="btn" onClick={() => startEdit(row)}>Edit</button><button className="btn" onClick={() => remove(row)}>Delete</button></td></tr>)}</tbody></table>{!rows.length && !error && <p className="text-sm text-black/50 mt-3">No expenses this month.</p>}</div>
  </Page>;
}
