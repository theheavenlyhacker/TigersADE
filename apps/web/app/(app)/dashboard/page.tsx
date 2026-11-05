"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/Auth";
import { Page, Stat, Bar, Line, Empty } from "@/components/ui";
import { peso } from "@/lib/data";
import { apiUrl } from "@/lib/catalog";

const centavos = (value: string) => { const parts = /^(\d{1,16})(?:\.(\d{1,2}))?$/.exec(value); if (!parts) throw new Error("Enter a non-negative amount with up to two decimal places."); return (BigInt(parts[1]) * BigInt(100) + BigInt((parts[2] ?? "").padEnd(2, "0"))).toString(); };
const centavoPeso = (value: string) => { const amount = BigInt(value), hundred = BigInt(100), absolute = amount < BigInt(0) ? -amount : amount; return `${amount < BigInt(0) ? "-" : ""}₱${(absolute / hundred).toLocaleString("en-PH")}.${(absolute % hundred).toString().padStart(2, "0")}`; };

export default function D() {
  const { user, branches, scope, setScope, setAiOpen } = useAuth();
  const [summary, setSummary] = useState<any>(null), [trend, setTrend] = useState<any>(null), [best, setBest] = useState<any[]>([]), [peak, setPeak] = useState<any[]>([]), [comparison, setComparison] = useState<any[]>([]), [message, setMessage] = useState("");
  const [expenseReport, setExpenseReport] = useState<any>(null), [low, setLow] = useState<any[]>([]);
  const [cashClose, setCashClose] = useState<any>(null), [openingFloat, setOpeningFloat] = useState(""), [countedCash, setCountedCash] = useState(""), [closeNote, setCloseNote] = useState(""), [closeError, setCloseError] = useState(""), [savingClose, setSavingClose] = useState(false);
  const cashCloseBranch = branches[0]?.id;
  const branch = user?.role === "owner" ? scope === "all" ? "all" : branches.find((b: any) => b.code === scope)?.id : branches[0]?.id;
  const selected = user?.role === "owner" && scope === "all" ? branches : branches.filter((b: any) => b.code === scope);
  const expenses = Number(summary?.expenses ?? 0) / 100;
  const noSales = !!summary && Number(summary.mtd) === 0 && Number(summary.today) === 0 && !best.length;
  const peakHour = peak.reduce<any>((busiest, hour) => !busiest || Number(hour.sales) > Number(busiest.sales) ? hour : busiest, null);

  useEffect(() => {
    if (!branch) return;
    const get = async (path: string) => { const response = await fetch(`${apiUrl()}/reports/${path}`, { credentials: "include" }); if (!response.ok) throw new Error("Dashboard reports could not be loaded."); return response.json(); };
    get(`summary?branch=${branch}`).then(async s => {
      const periods = s.branches.length ? s.branches : [{ branchId: branch, date: s.date }];
      const [t, bestByBranch, peakByBranch, c, expenses, lowByBranch] = await Promise.all([get(`trend?branch=${branch}`), Promise.all(periods.map((b: any) => get(`best-sellers?branch=${b.branchId}&from=${b.date.slice(0, 7)}-01&to=${b.date}`))), Promise.all(periods.map((b: any) => get(`peak-hours?branch=${b.branchId}&from=${b.date}&to=${b.date}`))), user?.role === "owner" ? get("comparison") : Promise.resolve([]), get(`expenses?branch=${branch}&month=${s.date.slice(0, 7)}`), Promise.all((branch === "all" ? branches : branches.filter((b: any) => b.id === branch)).map(async (b: any) => ({ branch: b, items: await (await fetch(`${apiUrl()}/branches/${b.id}/inventory?low=true`, { credentials: "include" })).json() })))]);
      const bestProducts = new Map<string, any>();
      for (const product of bestByBranch.flat()) {
        const current = bestProducts.get(product.productId) ?? { ...product, units: 0, revenue: BigInt(0), marginValue: 0 };
        current.units += Number(product.units); current.revenue += BigInt(product.revenue); current.marginValue += Number(product.revenue) * Number(product.margin) / 100;
        bestProducts.set(product.productId, current);
      }
      const peakHours = new Map<number, any>();
      for (const hour of peakByBranch.flat()) {
        const current = peakHours.get(hour.local_hour) ?? { ...hour, customers: 0, sales: BigInt(0) };
        current.customers += Number(hour.customers); current.sales += BigInt(hour.sales); peakHours.set(hour.local_hour, current);
      }
      setSummary(s); setTrend(t); setBest([...bestProducts.values()].map(p => ({ ...p, revenue: p.revenue.toString(), margin: p.revenue ? (p.marginValue / Number(p.revenue) * 100).toFixed(2) : "0" }))); setPeak([...peakHours.values()].map(p => ({ ...p, sales: p.sales.toString() }))); setComparison(c); setExpenseReport(expenses); setLow(lowByBranch.flatMap((x: any) => x.items.map((i: any) => ({ ...i, branchName: x.branch.name })))); setMessage("");
    }).catch(e => setMessage(e.message));
  }, [branch, user?.role]);

  useEffect(() => {
    if (user?.role !== "manager" || !cashCloseBranch) return;
    fetch(`${apiUrl()}/branches/${cashCloseBranch}/cash-closes/preview`, { credentials: "include" }).then(r => r.ok ? r.json() : Promise.reject()).then(setCashClose).catch(() => setCloseError("Could not load cash close preview."));
  }, [cashCloseBranch, user?.role]);

  if (!user) return null;
  const money = (value: string | number) => peso(Number(value) / 100);
  const values = trend?.series?.map((value: any) => Number(value.sales) / 100) ?? [];
  const lowLabel = low[0] ? `${low[0].name} is low at ${low[0].branchName}.` : "All stock levels are fine.";
  const submitClose = async () => {
    if (!cashCloseBranch || !cashClose) return;
    setSavingClose(true); setCloseError("");
    try {
      const response = await fetch(`${apiUrl()}/branches/${cashCloseBranch}/cash-closes`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessDate: cashClose.businessDate, openingFloat: centavos(openingFloat), countedCash: centavos(countedCash), note: closeNote || undefined }) });
      const data = await response.json();
      if (response.status === 409) { const preview = await fetch(`${apiUrl()}/branches/${cashCloseBranch}/cash-closes/preview`, { credentials: "include" }); if (preview.ok) setCashClose(await preview.json()); }
      if (!response.ok) throw new Error(data.message || "Could not submit cash close.");
      setCashClose({ ...cashClose, close: data });
    } catch (error: any) { setCloseError(error.message); } finally { setSavingClose(false); }
  };
  return <Page title={user.role === "owner" ? "Executive dashboard" : branches[0]?.name ?? "Branch dashboard"} sub="Sales figures from recorded sales." action={<div className="flex gap-2"><button className="btn-p" onClick={() => setAiOpen(true)}>Ask AI about your data</button>{user.role === "owner" && <button className="btn" onClick={() => setMessage("Report export is a placeholder.")}>Export report</button>}</div>}>
    {message && <p role="alert" className="card text-sm">{message}</p>}
    {user.role === "owner" && <select aria-label="Branch" className="btn" value={scope} onChange={e => setScope(e.target.value)}><option value="all">All branches</option>{branches.map((b: any) => <option key={b.id} value={b.code}>{b.name}</option>)}</select>}
    {user && !branches.length && <Empty title="No branches yet" hint="This account is not assigned to a branch. Ask the owner to add you to one." />}
    {noSales && <Empty title="No sales yet" hint="Figures, the sales trend and best sellers appear here after the first sale is recorded."><Link href="/products" className="btn">Set up products</Link><Link href="/sales" className="btn-p">Open sales</Link></Empty>}
    {summary && <div className="grid grid-cols-2 lg:grid-cols-4 gap-4"><Stat dark l="Sales today" v={money(summary.today)} s="Business day"/><Stat l="Sales this week" v={money(summary.week)} s="Monday to today"/><Stat l="Sales this month" v={money(summary.mtd)} s="Month to date"/><Stat l="Growth · MTD" v={summary.growth === null ? "—" : `${Number(summary.growth).toFixed(1)}%`} s="vs same business days last month"/><Stat l="Customers" v={Number(summary.customers).toLocaleString()} s="Non-voided sales MTD"/><Stat l="Expenses · MTD" v={peso(expenses)} s={`Across ${selected.length} branch${selected.length > 1 ? "es" : ""}`}/><Stat l="Inventory value" v={peso(Number(summary.inventoryValue) / 100)} s="Current stock at cost"/><Stat l="Operating contribution" v={peso(Number(summary.operatingContribution) / 100)} s="MTD sales less expenses"/></div>}
    {user.role !== "owner" && <div className="grid md:grid-cols-2 gap-5"><div className="card"><h2 className="font-semibold text-lg">Today&apos;s target</h2><p className="text-sm text-black/50 mb-3">{summary && money(summary.today)} of {summary && money(summary.dailyTarget)}</p><Bar pct={summary?.targetProgress ?? 0}/><p className="text-sm mt-2">{summary?.targetProgress == null ? "Not set" : `${Math.round(summary.targetProgress)}% reached`}</p></div>{user.role === "manager" && <div className="card"><h2 className="font-semibold text-lg">End-of-day cash close</h2>{cashClose?.close ? <><p className="text-sm text-black/50">Closed for {cashClose.businessDate}. Expected cash {centavoPeso(cashClose.close.expectedCash)}; counted {centavoPeso(cashClose.close.countedCash)}.</p><p className="text-sm mt-2">Cash variance {centavoPeso(cashClose.close.variance)}</p></> : <><p className="text-sm text-black/50">{cashClose ? `Business day ${cashClose.businessDate} · cash sales ${centavoPeso(cashClose.cashSales)}` : "Loading cash sales preview…"}</p><label className="block text-sm mt-3">Opening float<input className="btn mt-1 w-full" inputMode="decimal" value={openingFloat} onChange={e => setOpeningFloat(e.target.value)}/></label><label className="block text-sm mt-2">Counted cash<input className="btn mt-1 w-full" inputMode="decimal" value={countedCash} onChange={e => setCountedCash(e.target.value)}/></label><label className="block text-sm mt-2">Note (optional)<input className="btn mt-1 w-full" value={closeNote} onChange={e => setCloseNote(e.target.value)}/></label><button className="btn-p mt-3" disabled={!cashClose || !openingFloat || !countedCash || savingClose} onClick={submitClose}>{savingClose ? "Submitting…" : "Submit cash close"}</button></>}{closeError && <p role="alert" className="text-sm text-red-700 mt-2">{closeError}</p>}</div>}</div>}
    {user.role === "owner" && <div className="card"><h2 className="font-semibold mb-2">Branch comparison</h2><table className="w-full"><thead><tr><th>Branch</th><th>Today</th><th>This week</th><th>MTD</th><th>Growth</th><th>Share</th></tr></thead><tbody>{comparison.map(b => <tr key={b.id}><td>{b.name}</td><td>{money(b.today)}</td><td>{money(b.week)}</td><td>{money(b.mtd)}</td><td>{b.growth === null ? "—" : `${Number(b.growth).toFixed(1)}%`}</td><td><Bar pct={Number(b.share)} c="bg-sage"/></td></tr>)}</tbody></table></div>}
    <div className="card"><h2 className="font-semibold">Sales trend</h2><p className="text-sm text-black/50">Daily sales; forecast average {trend ? money(trend.forecast.dailyAverage) : "—"} ± 8%</p>{values.length > 1 && <Line a={values}/>}</div>
    <div className="grid md:grid-cols-2 gap-5"><div className="card"><h2 className="font-semibold mb-2">Best sellers · this month</h2><table className="w-full"><thead><tr><th>Product</th><th>Units</th><th>Revenue</th><th>Margin</th></tr></thead><tbody>{best.slice(0, 5).map(p => <tr key={p.productId}><td>{p.name}</td><td>{p.units}</td><td>{money(p.revenue)}</td><td>{p.margin}%</td></tr>)}</tbody></table></div><div className="card"><h2 className="font-semibold">Peak hours</h2>{peak.length ? peak.map(p => <p key={p.local_hour} className="flex justify-between py-1"><span>{String(p.local_hour).padStart(2, "0")}:00</span><span>{p.customers} sales · {money(p.sales)}</span></p>) : <p className="text-sm text-black/50">No sales today yet.</p>}<Link href="/sales" className="text-brand underline">Open sales</Link></div></div>
    <div className="card"><h2 className="font-semibold">Expense tracking</h2><div className="text-3xl font-semibold my-2">{peso(expenses)}</div>{(expenseReport?.categories ?? []).map((c: any) => <div key={c.categoryId} className="flex justify-between py-1.5 text-sm"><span>{c.categoryName}</span><span>{peso(Number(c.total) / 100)} <span className="text-black/40">{expenses ? `${(Number(c.total) / (expenses * 100) * 100).toFixed(1)}%` : "0%"}</span></span></div>)}</div>
    <h2 className="text-xl font-semibold pt-2">Your attention, where it matters</h2><div className="grid md:grid-cols-3 gap-4"><div className="card"><b>{low.length} stock items need attention</b><p className="text-sm text-black/55 my-2">{lowLabel}</p><Link href="/inventory" className="text-brand underline">Review inventory</Link></div><div className="card"><b>{user.role === "owner" ? "Branch sales performance" : "Plan for the lunch rush"}</b><p className="text-sm text-black/55 my-2">{user.role === "owner" ? "Review current branch figures and growth." : peakHour ? `Busiest hour is ${String(peakHour.local_hour).padStart(2, "0")}:00. Keep bar and kitchen coverage aligned.` : "No sales today yet."}</p><Link href="/sales" className="text-brand underline">Open sales</Link></div><div className="card"><b>Review recent activity</b><p className="text-sm text-black/55 my-2">Voids, price changes and stock adjustments are logged.</p><Link href="/staff" className="text-brand underline">View activity</Link></div></div>
  </Page>;
}
