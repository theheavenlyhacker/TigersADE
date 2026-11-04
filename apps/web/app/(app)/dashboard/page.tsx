"use client";
import Link from "next/link";import {useState} from "react";import {useAuth} from "@/components/Auth";
import {Page,Stat,Bar,Line} from "@/components/ui";import {peso,series,branches as sampleBranches,inventory,products,bname,expenseCats} from "@/lib/data";
export default function D(){
const {user,list,branches:apiBranches,scope,setScope,setAiOpen}=useAuth();const [msg,setMsg]=useState("");
if(!user)return null;const owner=user.role==="owner";
const sum=(k:"today"|"week"|"mtd"|"customers"|"expenses"|"stock")=>list.reduce((a:number,b:any)=>a+b[k],0);
const mtd=sum("mtd");const g=list.reduce((a:number,b:any)=>a+b.growth*b.mtd,0)/mtd;
const low=inventory.filter(i=>i.qty<i.par&&(scope==="all"||i.branch===scope));
const ranked=[...sampleBranches].sort((a,b)=>b.mtd-a.mtd);const tot=sampleBranches.reduce((a,b)=>a+b.mtd,0);
const b0=list[0];
return <Page title={owner?"Executive dashboard":list[0]?.name??"Branch dashboard"} sub={owner?"A clear view of your café business. Three branches, one connected picture.":"Your branch today: sales, targets and what needs doing."}
action={owner&&<div className="flex gap-2"><button className="btn-p" onClick={()=>setAiOpen(true)}>Ask AI about your data</button><button className="btn" onClick={()=>setMsg("Report export is a placeholder.")}>Export report</button></div>}>
{msg&&<div className="card text-sm bg-mint">{msg}</div>}
{owner&&<select className="btn" value={scope} onChange={e=>setScope(e.target.value)}><option value="all">All branches</option>{apiBranches.map((b:any)=><option key={b.code} value={b.code}>{b.name}</option>)}</select>}
<div className="bg-mint rounded-xl px-5 py-3 flex justify-between"><span>{owner?`Your business is growing. Revenue is up ${g.toFixed(1)}% vs the prior month's same period.`:`Your branch is up ${g.toFixed(1)}% vs the prior month's same period.`}</span>{owner&&<span>3 of 3 branches growing</span>}</div>
<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
<Stat dark l="Total sales today" v={peso(sum("today"))} s="Oct 18, 2026"/><Stat l="Sales this week" v={peso(sum("week"))} s="Oct 12–18"/><Stat l="Sales this month" v={peso(mtd)} s="Oct 1–18 · MTD"/><Stat l="Revenue growth · MTD" v={"+"+g.toFixed(1)+"%"} s="vs prior period"/>
<Stat l="Customer count" v={sum("customers").toLocaleString()} s="MTD transactions"/><Stat l="Expenses · MTD" v={peso(sum("expenses"))} s={`Across ${list.length} branch${list.length>1?"es":""}`}/><Stat l="Inventory value" v={peso(sum("stock"))} s="Current stock at cost"/><Stat l="Operating contribution" v={peso(mtd-sum("expenses"))} s="MTD sales less expenses"/></div>
{!owner&&b0&&<div className="grid md:grid-cols-2 gap-5"><div className="card"><h3 className="font-semibold text-lg">Today's target</h3><p className="text-sm text-black/50 mb-3">{peso(b0.today)} of {peso(b0.target)}</p><Bar pct={b0.today/b0.target*100}/><p className="text-sm mt-2">{Math.round(b0.today/b0.target*100)}% reached</p></div>
<div className="card"><h3 className="font-semibold text-lg">End-of-day cash check</h3><p className="text-sm text-black/50">Expected cash {peso(b0.today*0.4)}. Count the drawer and enter the amount.</p><button className="btn-p mt-3" onClick={()=>setMsg("Cash reconciliation saved (prototype).")}>Submit end-of-day close</button></div></div>}
<div className="card"><h3 className="font-semibold text-lg">Revenue overview</h3><p className="text-sm text-black/50 mb-2">Cumulative, month to date · solid is October, dashed is September</p><Line a={series(mtd)} b={series(mtd/(1+g/100))}/></div>
{owner&&<div className="card"><h3 className="font-semibold text-lg mb-2">Branch performance comparison</h3><table className="w-full"><thead><tr><th>Branch</th><th>Today</th><th>This week</th><th>MTD</th><th>Growth</th><th>Share</th></tr></thead><tbody>{ranked.map((b,i)=><tr key={b.id}><td>#{i+1} {b.name}</td><td>{peso(b.today)}</td><td>{peso(b.week)}</td><td>{peso(b.mtd)}</td><td className="text-sage">+{b.growth}%</td><td className="w-32"><Bar pct={b.mtd/tot*100} c="bg-sage"/></td></tr>)}</tbody></table></div>}
<div className="grid md:grid-cols-2 gap-5"><div className="card"><h3 className="font-semibold text-lg mb-2">Best-selling products</h3><table className="w-full"><thead><tr><th>Product</th><th>Units</th><th>Price</th><th>Margin</th></tr></thead><tbody>{products.slice(0,5).map(p=><tr key={p.name}><td>{p.name}</td><td>{p.units.toLocaleString()}</td><td>{peso(p.price)}</td><td>{p.margin}%</td></tr>)}</tbody></table></div>
<div className="card"><h3 className="font-semibold text-lg">Expense tracking</h3><div className="text-3xl font-semibold my-2">{peso(sum("expenses"))}</div>{expenseCats.map(c=><div key={c.n} className="flex justify-between py-1.5 text-sm"><span>{c.n}</span><span>{peso(sum("expenses")*c.p/100)} <span className="text-black/40">{c.p}%</span></span></div>)}</div></div>
<h2 className="text-xl font-semibold pt-2">Your attention, where it matters</h2>
<div className="grid md:grid-cols-3 gap-4"><div className="card"><b>{low.length} stock items need attention</b><p className="text-sm text-black/55 my-2">{low[0]?`${low[0].item} is low at ${bname(low[0].branch)}.`:"All stock levels are fine."}</p><Link href="/inventory" className="text-brand underline">Review inventory</Link></div>
<div className="card"><b>{owner?`${ranked[0].name} is setting the pace`:"Plan for the lunch rush"}</b><p className="text-sm text-black/55 my-2">{owner?`${peso(ranked[0].mtd)} in MTD sales and ${ranked[0].growth}% growth.`:"Peak hours are 12–2pm. Keep bar and kitchen coverage aligned."}</p><Link href="/sales" className="text-brand underline">Open sales</Link></div>
<div className="card"><b>Review recent activity</b><p className="text-sm text-black/55 my-2">Voids, price changes and stock adjustments are logged.</p><Link href="/staff" className="text-brand underline">View activity</Link></div></div>
</Page>}
