"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/Auth";
import { Page, Stat, Bar, Line } from "@/components/ui";
import { peso, branches as sampleBranches, inventory, products, bname, expenseCats } from "@/lib/data";
import { apiUrl } from "@/lib/catalog";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export default function D() {
  const { user, branches, scope, setScope, setAiOpen } = useAuth();
  const [summary, setSummary] = useState<any>(null), [trend, setTrend] = useState<any>(null), [best, setBest] = useState<any[]>([]), [peak, setPeak] = useState<any[]>([]), [comparison, setComparison] = useState<any[]>([]), [message, setMessage] = useState("");
  const branch = user?.role === "owner" ? scope === "all" ? "all" : branches.find((b: any) => b.code === scope)?.id : branches[0]?.id;
  const selected = user?.role === "owner" && scope === "all" ? sampleBranches : sampleBranches.filter(b => b.id === scope);
  const expenses = selected.reduce((sum, b) => sum + b.expenses, 0), stock = selected.reduce((sum, b) => sum + b.stock, 0);
  const low = inventory.filter(i => i.qty < i.par && (scope === "all" || i.branch === scope));

  useEffect(() => {
    if (!branch) return;
    const get = async (path: string) => { const response = await fetch(`${apiUrl()}/reports/${path}`, { credentials: "include" }); if (!response.ok) throw new Error("Dashboard reports could not be loaded."); return response.json(); };
    const date = today();
    Promise.all([get(`summary?branch=${branch}&date=${date}`), get(`trend?branch=${branch}&date=${date}`), get(`best-sellers?branch=${branch}&from=${date.slice(0, 7)}-01&to=${date}`), get(`peak-hours?branch=${branch}&from=${date}&to=${date}`), ...(user?.role === "owner" ? [get("comparison")] : [])])
      .then(([s, t, b, p, c]) => { setSummary(s); setTrend(t); setBest(b); setPeak(p); setComparison(c ?? []); setMessage(""); }).catch(e => setMessage(e.message));
  }, [branch, user?.role]);

  if (!user) return null;
  const money = (value: string | number) => peso(Number(value) / 100);
  const values = trend?.series?.map((value: any) => Number(value.sales) / 100) ?? [];
  const totalMtd = comparison.reduce((sum, value) => sum + Number(value.mtd), 0);
  const lowLabel = low[0] ? `${low[0].item} is low at ${bname(low[0].branch)}.` : "All stock levels are fine.";
  return <Page title={user.role === "owner" ? "Executive dashboard" : branches[0]?.name ?? "Branch dashboard"} sub="Sales figures from recorded sales." action={user.role === "owner" && <div className="flex gap-2"><button className="btn-p" onClick={() => setAiOpen(true)}>Ask AI about your data</button><button className="btn" onClick={() => setMessage("Report export is a placeholder.")}>Export report</button></div>}>
    {message && <p role="alert" className="card text-sm">{message}</p>}
    {user.role === "owner" && <select aria-label="Branch" className="btn" value={scope} onChange={e => setScope(e.target.value)}><option value="all">All branches</option>{branches.map((b: any) => <option key={b.id} value={b.code}>{b.name}</option>)}</select>}
    {summary && <div className="grid grid-cols-2 lg:grid-cols-4 gap-4"><Stat dark l="Sales today" v={money(summary.today)} s="Business day"/><Stat l="Sales this week" v={money(summary.week)} s="Monday to today"/><Stat l="Sales this month" v={money(summary.mtd)} s="Month to date"/><Stat l="Growth · MTD" v={summary.growth === null ? "—" : `${Number(summary.growth).toFixed(1)}%`} s="vs same business days last month"/><Stat l="Customers" v={Number(summary.customers).toLocaleString()} s="Non-voided sales MTD"/><Stat l="Expenses · MTD" v={peso(expenses)} s={`Across ${selected.length} branch${selected.length > 1 ? "es" : ""}`}/><Stat l="Inventory value" v={peso(stock)} s="Current stock at cost"/><Stat l="Operating contribution" v={peso(Number(summary.mtd) / 100 - expenses)} s="MTD sales less expenses"/></div>}
    {user.role !== "owner" && <div className="grid md:grid-cols-2 gap-5"><div className="card"><h2 className="font-semibold text-lg">Today&apos;s target</h2><p className="text-sm text-black/50 mb-3">{summary && money(summary.today)} of {summary && money(summary.dailyTarget)}</p><Bar pct={summary?.targetProgress ?? 0}/><p className="text-sm mt-2">{summary?.targetProgress == null ? "Not set" : `${Math.round(summary.targetProgress)}% reached`}</p></div><div className="card"><h2 className="font-semibold text-lg">End-of-day cash check</h2><p className="text-sm text-black/50">Review the expected cash and count the drawer before closing.</p><Link className="btn-p inline-block mt-3" href="/expenses">Review branch close</Link></div></div>}
    {user.role === "owner" && <div className="card"><h2 className="font-semibold mb-2">Branch comparison</h2><table className="w-full"><thead><tr><th>Branch</th><th>Today</th><th>This week</th><th>MTD</th><th>Growth</th><th>Share</th></tr></thead><tbody>{comparison.map(b => <tr key={b.id}><td>{b.name}</td><td>{money(b.today)}</td><td>{money(b.week)}</td><td>{money(b.mtd)}</td><td>{b.growth === null ? "—" : `${Number(b.growth).toFixed(1)}%`}</td><td><Bar pct={totalMtd ? Number(b.mtd) / totalMtd * 100 : 0} c="bg-sage"/></td></tr>)}</tbody></table></div>}
    <div className="card"><h2 className="font-semibold">Sales trend</h2><p className="text-sm text-black/50">Daily sales; forecast average {trend ? money(trend.forecast.dailyAverage) : "—"} ± 8%</p>{values.length > 1 && <Line a={values}/>}</div>
    <div className="grid md:grid-cols-2 gap-5"><div className="card"><h2 className="font-semibold mb-2">Best sellers · this month</h2><table className="w-full"><thead><tr><th>Product</th><th>Units</th><th>Revenue</th><th>Margin</th></tr></thead><tbody>{best.slice(0, 5).map(p => <tr key={p.productId}><td>{p.name}</td><td>{p.units}</td><td>{money(p.revenue)}</td><td>{p.margin}%</td></tr>)}</tbody></table></div><div className="card"><h2 className="font-semibold">Peak hours</h2>{peak.length ? peak.map(p => <p key={p.local_hour} className="flex justify-between py-1"><span>{String(p.local_hour).padStart(2, "0")}:00</span><span>{p.customers} sales · {money(p.sales)}</span></p>) : <p className="text-sm text-black/50">No sales today yet.</p>}<Link href="/sales" className="text-brand underline">Open sales</Link></div></div>
    <div className="card"><h2 className="font-semibold">Expense tracking</h2><div className="text-3xl font-semibold my-2">{peso(expenses)}</div>{expenseCats.map(c => <div key={c.n} className="flex justify-between py-1.5 text-sm"><span>{c.n}</span><span>{peso(expenses * c.p / 100)} <span className="text-black/40">{c.p}%</span></span></div>)}</div>
    <h2 className="text-xl font-semibold pt-2">Your attention, where it matters</h2><div className="grid md:grid-cols-3 gap-4"><div className="card"><b>{low.length} stock items need attention</b><p className="text-sm text-black/55 my-2">{lowLabel}</p><Link href="/inventory" className="text-brand underline">Review inventory</Link></div><div className="card"><b>{user.role === "owner" ? "Branch sales performance" : "Plan for the lunch rush"}</b><p className="text-sm text-black/55 my-2">{user.role === "owner" ? "Review current branch figures and growth." : "Peak hours are 12–2pm. Keep bar and kitchen coverage aligned."}</p><Link href="/sales" className="text-brand underline">Open sales</Link></div><div className="card"><b>Review recent activity</b><p className="text-sm text-black/55 my-2">Voids, price changes and stock adjustments are logged.</p><Link href="/staff" className="text-brand underline">View activity</Link></div></div>
  </Page>;
}
