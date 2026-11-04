"use client";
import {useAuth} from "@/components/Auth";import {Page,Bar} from "@/components/ui";import {peso,expenseCats} from "@/lib/data";
export default function E(){const {list}=useAuth();if(!list)return null;const t=list.reduce((a:number,b:any)=>a+b.expenses,0);
return <Page title="Expenses" sub="Month to date, by category and branch.">
<div className="card"><div className="text-4xl font-semibold mb-4">{peso(t)}</div>{expenseCats.map(c=><div key={c.n} className="mb-4"><div className="flex justify-between text-sm mb-1"><span>{c.n}</span><span>{peso(t*c.p/100)} · {c.p}%</span></div><Bar pct={c.p}/></div>)}</div>
<div className="card"><table className="w-full"><thead><tr><th>Branch</th><th>Expenses MTD</th><th>% of sales</th></tr></thead><tbody>{list.map((b:any)=><tr key={b.id}><td>{b.name}</td><td>{peso(b.expenses)}</td><td>{(b.expenses/b.mtd*100).toFixed(1)}%</td></tr>)}</tbody></table></div></Page>}
