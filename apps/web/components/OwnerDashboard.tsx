"use client";
import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/Auth";
import { Page, Empty } from "@/components/ui";
import { peso } from "@/lib/data";
import { getReport, getLowStock, mergeBestSellers, mergePeakHours } from "@/lib/reports";

type Granularity = "daily" | "weekly" | "monthly";
const GRANULARITIES: Granularity[] = ["daily", "weekly", "monthly"];
const RANK_BARS = ["bg-accent", "bg-leaf", "bg-sand"];
const SEGMENTS = ["bg-accent", "bg-leaf", "bg-sand", "bg-slate"];
const control = "flex h-9 items-center gap-2 rounded-lg border border-line bg-white px-3 text-xs font-medium text-ink";
const link = "text-xs font-semibold text-accent hover:underline";

const utc = (d: string) => new Date(`${d}T00:00:00Z`);
const fmt = (d: string, o: Intl.DateTimeFormatOptions) => utc(d).toLocaleDateString("en-PH", { ...o, timeZone: "UTC" });
const short = (d: string) => fmt(d, { month: "short", day: "numeric" });
const span = (from: string, to: string) => from.slice(0, 7) === to.slice(0, 7) ? `${short(from)}–${utc(to).getUTCDate()}` : `${short(from)} – ${short(to)}`;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const weekStart = (d: string) => iso(new Date(utc(d).getTime() - ((utc(d).getUTCDay() + 6) % 7) * 864e5));
/** Same number of business days last month, as the API's Growth does (clamped to that month's length). */
const prevWindow = (d: string) => {
  const t = utc(d), y = t.getUTCFullYear(), m = t.getUTCMonth();
  return { from: iso(new Date(Date.UTC(y, m - 1, 1))), to: iso(new Date(Date.UTC(y, m - 1, Math.min(t.getUTCDate(), new Date(Date.UTC(y, m, 0)).getUTCDate())))) };
};
const pct = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
const arrow = (n: number) => n < 0 ? "↘" : "↗";
const niceMax = (v: number) => { const p = 10 ** Math.floor(Math.log10(Math.max(v, 1))); return ([1, 2, 4, 6, 8, 10].find(m => m * p >= v) ?? 10) * p; };
const kilo = (v: number) => v >= 1000 ? `₱${v / 1000}k` : `₱${v}`;

const Panel = ({ children, className = "" }: { children: ReactNode; className?: string }) => <section className={`flex flex-col gap-[18px] rounded-xl border border-line bg-white p-[22px] ${className}`}>{children}</section>;
const Heading = ({ title, sub, action }: { title: string; sub: string; action?: ReactNode }) => <div className="flex items-center gap-3"><div className="min-w-0 flex-1"><h2 className="text-base font-semibold text-ink">{title}</h2><p className="text-[11px] text-muted">{sub}</p></div>{action}</div>;
const Kpi = ({ label, value, sub, dark }: { label: string; value: string; sub: string; dark?: boolean }) => (
  <div className={`flex flex-col gap-2.5 rounded-xl border p-5 ${dark ? "border-deep bg-deep" : "border-line bg-white"}`}>
    <div className={`text-xs ${dark ? "text-cream" : "text-muted"}`}>{label}</div>
    <div className={`text-[28px] font-semibold tabular-nums ${dark ? "text-white" : "text-ink"}`}>{value}</div>
    <div className={`text-[11px] ${dark ? "text-cream" : "text-muted"}`}>{sub}</div>
  </div>
);
const Icon = ({ name, size }: { name: string; size: number }) => <img src={`/icons/dashboard/${name}.svg`} alt="" width={size} height={size} className="shrink-0" />;
const Table = ({ head, rows }: { head: string[]; rows: ReactNode[][] }) => (
  <div className="overflow-x-auto"><table className="w-full min-w-[520px]">
    <thead><tr>{head.map(h => <th key={h} className="whitespace-nowrap bg-wash px-2.5 py-3.5 text-[10px] font-medium uppercase text-muted first:rounded-l-md last:rounded-r-md">{h}</th>)}</tr></thead>
    <tbody>{rows.map((cells, i) => <tr key={i}>{cells.map((cell, j) => <td key={j} className="h-[43px] whitespace-nowrap border-b border-t-0 border-grid px-2.5 py-0 text-xs text-muted first:font-medium first:text-ink">{cell}</td>)}</tr>)}</tbody>
  </table></div>
);

function RevenueChart({ series, granularity }: { series: { date: string; sales: string }[]; granularity: Granularity }) {
  const values = series.map(p => Number(p.sales) / 100);
  if (values.length < 2) return <p className="text-sm text-muted">Not enough sales yet to draw a trend.</p>;
  const top = niceMax(Math.max(...values)), W = 720, H = 198, n = Math.min(7, series.length);
  const points = values.map((v, i) => `${(i / (values.length - 1)) * W},${H - 1 - (v / top) * (H - 2)}`).join(" ");
  const ticks = [0, 1, 2, 3, 4].map(i => top - (top / 4) * i);
  const labels = Array.from({ length: n }, (_, i) => series[Math.round(i * (series.length - 1) / (n - 1))].date);
  return <div className="flex flex-col gap-2.5">
    <div className="flex gap-3">
      <div className="flex h-[198px] w-[34px] shrink-0 flex-col justify-between text-[10px] text-muted">{ticks.map(t => <span key={t}>{kilo(t)}</span>)}</div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Revenue trend" className="h-[198px] min-w-0 flex-1">
        {ticks.map((_, i) => <line key={i} x1="0" x2={W} y1={i * (H - 1) / 4 + 0.5} y2={i * (H - 1) / 4 + 0.5} className="stroke-grid" vectorEffect="non-scaling-stroke" />)}
        <polyline fill="none" className="stroke-accent" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" points={points} />
      </svg>
    </div>
    <div className="flex justify-between pl-[46px] text-[9px] text-muted">{labels.map(d => <span key={d}>{granularity === "monthly" ? fmt(d, { month: "short", year: "numeric" }) : short(d)}</span>)}</div>
  </div>;
}

export default function OwnerDashboard() {
  const { branches, scope, setScope, setAiOpen } = useAuth();
  const [summary, setSummary] = useState<any>(null), [comparison, setComparison] = useState<any[]>([]), [trend, setTrend] = useState<any>(null), [best, setBest] = useState<any[]>([]), [peak, setPeak] = useState<any[]>([]);
  const [expenseReport, setExpenseReport] = useState<any>(null), [low, setLow] = useState<any[]>([]), [message, setMessage] = useState(""), [granularity, setGranularity] = useState<Granularity>("daily");
  const branch = scope === "all" ? "all" : branches.find((b: any) => b.code === scope)?.id;

  useEffect(() => {
    if (!branch) return;
    let live = true;
    (async () => {
      try {
        const s = await getReport(`summary?branch=${branch}`);
        const periods = s.branches.length ? s.branches : [{ branchId: branch, date: s.date }];
        const [c, bests, peaks, e, l] = await Promise.all([
          getReport("comparison"),
          Promise.all(periods.map((p: any) => getReport(`best-sellers?branch=${p.branchId}&from=${p.date.slice(0, 7)}-01&to=${p.date}`))),
          Promise.all(periods.map((p: any) => getReport(`peak-hours?branch=${p.branchId}&from=${p.date}&to=${p.date}`))),
          getReport(`expenses?branch=${branch}&month=${s.date.slice(0, 7)}`),
          getLowStock(branch === "all" ? branches : branches.filter((b: any) => b.id === branch)),
        ]);
        if (!live) return;
        setSummary(s); setComparison(c); setBest(mergeBestSellers(bests.flat())); setPeak(mergePeakHours(peaks.flat())); setExpenseReport(e); setLow(l); setMessage("");
      } catch (error: any) { if (live) setMessage(error.message); }
    })();
    return () => { live = false; };
  }, [branch]);

  useEffect(() => {
    if (!branch) return;
    let live = true;
    getReport(`trend?branch=${branch}&granularity=${granularity}`).then(t => live && setTrend(t)).catch(error => live && setMessage(error.message));
    return () => { live = false; };
  }, [branch, granularity]);

  const money = (value: string | number) => peso(Number(value) / 100);
  const date: string | undefined = summary?.date;
  const monthStart = date?.slice(0, 8) + "01";
  const scopeName = scope === "all" ? "All branches" : branches.find((b: any) => b.code === scope)?.name ?? "";
  const ranked = [...comparison].sort((a, b) => Number(b.mtd) - Number(a.mtd));
  const top = ranked[0], topMtd = Number(top?.mtd ?? 0);
  const growing = comparison.filter(r => r.growth !== null && Number(r.growth) > 0).length;
  const previous = comparison.filter(r => scope === "all" || r.code === scope).reduce((n, r) => n + BigInt(r.previous), BigInt(0));
  const growth: number | null = summary?.growth === null || summary?.growth === undefined ? null : Number(summary.growth);
  const prev = date ? prevWindow(date) : null;
  const noSales = !!summary && Number(summary.mtd) === 0 && Number(summary.today) === 0 && !best.length;
  const peakHour = peak.reduce<any>((busiest, hour) => !busiest || Number(hour.sales) > Number(busiest.sales) ? hour : busiest, null);
  const series: { date: string; sales: string }[] = trend?.series ?? [];
  const categories: any[] = expenseReport?.categories ?? [];
  const categoryTotal = categories.reduce((n, c) => n + Number(c.total), 0);
  const year = date ? utc(date).getUTCFullYear() : "";

  return <Page title="Dashboard" sub={`A clear view of your café business. ${branches.length} branch${branches.length === 1 ? "" : "es"}, one connected picture.`} action={<button className="btn-p" onClick={() => setAiOpen(true)}>Ask AI about your data</button>}>
    <div className="space-y-6">
      {message && <p role="alert" className="card text-sm">{message}</p>}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className={control}><Icon name="store" size={14} /><select aria-label="Branch" className="bg-transparent outline-none" value={scope} onChange={e => setScope(e.target.value)}><option value="all">All branches</option>{branches.map((b: any) => <option key={b.id} value={b.code}>{b.name}</option>)}</select></div>
        {date && <div className={control}><Icon name="calendar-days" size={14} />{span(monthStart!, date)}, {year} · MTD</div>}
      </div>
      {!branches.length && <Empty title="No branches yet" hint="This account is not assigned to a branch. Ask the owner to add you to one." />}
      {noSales && <Empty title="No sales yet" hint="Figures, the sales trend and best sellers appear here after the first sale is recorded."><Link href="/products" className="btn">Set up products</Link><Link href="/sales" className="btn-p">Open sales</Link></Empty>}

      {summary && <>
        <div className="flex items-center gap-3 rounded-lg bg-tint px-[18px] py-[13px] text-accent">
          <Icon name="chart-no-axes-combined" size={18} />
          <p className="flex-1 text-xs">{growth === null ? "There were no sales in the same period last month, so growth can't be compared yet." : growth >= 0 ? `Your business is growing. Revenue is up ${growth.toFixed(1)}% vs the prior-month same period.` : `Revenue is down ${Math.abs(growth).toFixed(1)}% vs the prior-month same period.`}</p>
          <p className="whitespace-nowrap text-[11px] font-medium">{growing} of {comparison.length} branches growing ↗</p>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi dark label="Total sales today" value={money(summary.today)} sub={fmt(summary.date, { month: "long", day: "numeric", year: "numeric" })} />
          <Kpi label="Total sales this week" value={money(summary.week)} sub={span(weekStart(summary.date), summary.date)} />
          <Kpi label="Total sales this month" value={money(summary.mtd)} sub={`${span(monthStart!, summary.date)} · MTD`} />
          <Kpi label="Revenue growth · MTD" value={growth === null ? "—" : pct(growth)} sub={growth === null ? "No prior-month sales to compare" : `${arrow(growth)} vs ${span(prev!.from, prev!.to)} · ${money(previous.toString())}`} />
          <Kpi label="Customers · MTD" value={Number(summary.customers).toLocaleString()} sub="Sales made, voided excluded" />
          <Kpi label="Total expenses · MTD" value={money(summary.expenses)} sub={`Across ${scope === "all" ? branches.length : 1} branch${scope === "all" && branches.length !== 1 ? "es" : ""}`} />
          <Kpi label="Total inventory value" value={money(summary.inventoryValue)} sub={`Current stock · ${low.length} low-stock item${low.length === 1 ? "" : "s"}`} />
          <Kpi label="Operating contribution" value={money(summary.operatingContribution)} sub="MTD sales less expenses" />
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_326px]">
          <Panel>
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1"><h2 className="text-base font-semibold text-ink">Revenue overview</h2><p className="text-[11px] text-muted">{granularity[0].toUpperCase() + granularity.slice(1)} sales · {scopeName}</p></div>
              <div role="group" aria-label="Trend period" className="flex gap-0.5 rounded-lg bg-wash p-[3px]">{GRANULARITIES.map(g => <button key={g} aria-pressed={granularity === g} onClick={() => setGranularity(g)} className={`rounded-md border px-2.5 py-1.5 text-[11px] ${granularity === g ? "border-line bg-white font-semibold text-accent" : "border-transparent text-muted"}`}>{g[0].toUpperCase() + g.slice(1)}</button>)}</div>
            </div>
            <div className="flex items-center gap-3"><div className="text-[28px] font-semibold tabular-nums text-ink">{money(summary.mtd)}</div>{growth !== null && <span className="rounded-md bg-tint px-2 py-1 text-[11px] font-medium text-accent">{arrow(growth)} {Math.abs(growth).toFixed(1)}%</span>}</div>
            {series.length > 0 && <div className="flex items-center gap-1.5 text-[11px] text-muted"><span className="h-1.5 w-1.5 rounded-full bg-accent" />{span(series[0].date, series[series.length - 1].date)}, {utc(series[series.length - 1].date).getUTCFullYear()}</div>}
            <RevenueChart series={series} granularity={granularity} />
            {growth !== null && <p className="text-[10px] text-muted">{Number(summary.mtd) >= Number(previous) ? "+" : "−"} {money((BigInt(summary.mtd) - previous < BigInt(0) ? previous - BigInt(summary.mtd) : BigInt(summary.mtd) - previous).toString())} vs prior-month same period ({money(previous.toString())}). {fmt(summary.date, { month: "long" })} is month to date, not a completed month.</p>}
          </Panel>

          <Panel>
            <Heading title="Branch ranking" sub="Sales revenue · Month to date" />
            <div className="flex flex-col gap-6">{ranked.map((r, i) => <div key={r.id} className="flex flex-col gap-[9px]">
              <div className="flex items-center gap-2.5">
                <span className={`grid h-[25px] w-[25px] place-items-center rounded-md text-[11px] font-semibold text-accent ${i === 0 ? "bg-tint" : "bg-wash"}`}>#{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink">{r.name}</span>
                <span className="text-xs font-semibold tabular-nums text-ink">{money(r.mtd)}</span>
              </div>
              <div className="h-[7px] overflow-hidden rounded bg-wash"><div className={`h-full rounded ${RANK_BARS[i % RANK_BARS.length]}`} style={{ width: `${topMtd ? Number(r.mtd) / topMtd * 100 : 0}%` }} /></div>
              <div className="flex justify-between text-[10px]"><span className="text-muted">{Number(r.share).toFixed(1)}% of group sales</span><span className="text-accent">{r.growth === null ? "—" : `${pct(Number(r.growth))} ${arrow(Number(r.growth))}`}</span></div>
            </div>)}</div>
          </Panel>
        </div>

        <Panel>
          <Heading title="Branch performance comparison" sub={`${span(monthStart!, summary.date)}, ${year} · Ranked by MTD sales`} />
          <Table head={["Rank / Branch", "Today", "This week", "Month to date", "Growth¹", "Customers · MTD", "Expenses · MTD", "Details"]} rows={ranked.map((r, i) => [`#${i + 1}   ${r.name}`, money(r.today), money(r.week), money(r.mtd), r.growth === null ? "—" : pct(Number(r.growth)), Number(r.customers).toLocaleString(), money(r.expenses), <button key="open" className={link} onClick={() => setScope(r.code)}>Open ↗</button>])} />
          <p className="text-[10px] text-muted">¹ Revenue growth vs prior-month same period: {span(prev!.from, prev!.to)}, {year}. All amounts in PHP.</p>
        </Panel>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_372px]">
          <Panel>
            <Heading title="Best-selling products" sub={`${scopeName} · ${span(monthStart!, summary.date)}`} action={<Link href="/products" className={link}>All products ↗</Link>} />
            <Table head={["Product", "Units sold", "Revenue", "Margin"]} rows={best.slice(0, 5).map(p => [p.name, Number(p.units).toLocaleString(), money(p.revenue), `${Math.round(Number(p.margin))}%`])} />
            <div className="flex items-center gap-2.5"><span className="rounded-md bg-tint px-2 py-1 text-[11px] font-medium text-accent">Top 5</span><p className="text-[11px] text-muted">Partial list · Ranked by sales revenue, not units.</p></div>
          </Panel>

          <Panel>
            <Heading title="Expense tracking" sub={`${span(monthStart!, summary.date)} · Month to date`} action={<Link href="/expenses" className={link}>View ledger ↗</Link>} />
            <div className="flex items-center justify-between"><div className="text-[26px] font-semibold tabular-nums text-ink">{money(summary.expenses)}</div><div className="text-[11px] text-muted">{categories.length} categories</div></div>
            <div className="flex h-2.5 gap-[3px] overflow-hidden rounded-md bg-wash">{categories.filter(c => Number(c.total) > 0).map((c, i) => <div key={c.categoryId} className={SEGMENTS[i % SEGMENTS.length]} style={{ flex: `${Number(c.total)} 0 0` }} />)}</div>
            <div className="flex flex-col gap-3">{categories.map((c, i) => <div key={c.categoryId} className="flex items-center gap-2 text-xs">
              <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${SEGMENTS[i % SEGMENTS.length]}`} />
              <span className="min-w-0 flex-1 truncate text-muted">{c.categoryName}</span>
              <span className="font-medium tabular-nums text-ink">{money(c.total)}</span>
              <span className="w-7 text-right text-[10px] text-muted">{categoryTotal ? Math.round(Number(c.total) / categoryTotal * 100) : 0}%</span>
            </div>)}</div>
            <div className="h-px bg-line" />
            <p className="text-[11px] text-muted">Includes posted expenses only. Amounts in PHP.</p>
          </Panel>
        </div>

        <div className="flex flex-col gap-4">
          <div><h2 className="text-base font-semibold text-ink">Your attention, where it matters</h2><p className="text-[11px] text-muted">A short list to keep every branch moving.</p></div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex flex-col gap-[18px] rounded-xl border border-line bg-white p-5">
              <div className={`flex items-center gap-2 text-xs font-semibold ${low.length ? "text-amber" : "text-accent"}`}><Icon name="package" size={17} />{low.length ? "ACTION NEEDED" : "ALL CLEAR"}</div>
              <p className="text-[15px] font-semibold text-ink">{low.length ? `${low.length} stock item${low.length === 1 ? " needs" : "s need"} attention` : "Stock levels are fine"}</p>
              <p className="text-xs text-muted">{low[0] ? `${low[0].name} is low at ${low[0].branchName}. Review reorders before tomorrow's service.` : "Nothing is below its par level."}</p>
              <Link href="/inventory" className={link}>Review inventory →</Link>
            </div>
            <div className="flex flex-col gap-[18px] rounded-xl border border-line bg-white p-5">
              <div className="flex items-center gap-2 text-xs font-semibold text-accent"><Icon name="trending-up" size={17} />OWNER INSIGHT</div>
              <p className="text-[15px] font-semibold text-ink">{topMtd ? `${top.name} is setting the pace` : "No sales this month yet"}</p>
              <p className="text-xs text-muted">{topMtd ? `${money(top.mtd)} in MTD sales${top.growth === null ? "" : ` and ${Number(top.growth).toFixed(1)}% growth`}. Your top-performing branch this month.` : "Branch rankings appear after the first sale this month."}</p>
              {topMtd > 0 && <button className={`${link} self-start`} onClick={() => setScope(top.code)}>Open {top.name} →</button>}
            </div>
            <div className="flex flex-col gap-[18px] rounded-xl border border-line bg-white p-5">
              <div className="flex items-center gap-2 text-xs font-semibold text-accent"><Icon name="users" size={17} />OWNER INSIGHT</div>
              <p className="text-[15px] font-semibold text-ink">Plan for the lunch rush</p>
              <p className="text-xs text-muted">{peakHour ? `Busiest hour today is ${String(peakHour.local_hour).padStart(2, "0")}:00. Keep bar and kitchen coverage aligned with demand.` : "No sales today yet."}</p>
              <Link href="/sales" className={link}>Open sales →</Link>
            </div>
          </div>
        </div>

        <p className="py-2 text-[11px] text-muted">PHP · {fmt(summary.date, { month: "long", day: "numeric", year: "numeric" })}  /  Month to date: {span(monthStart!, summary.date)} · Week: {span(weekStart(summary.date), summary.date)}</p>
      </>}
    </div>
  </Page>;
}
