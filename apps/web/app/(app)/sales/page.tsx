"use client";
import {useState} from "react";import {useAuth} from "@/components/Auth";import {Page,Line} from "@/components/ui";import {peso,series} from "@/lib/data";
export default function S(){const {list}=useAuth();const [p,setP]=useState("Monthly");if(!list)return null;
const n=p==="Daily"?7:p==="Weekly"?4:18;const mtd=list.reduce((a:number,b:any)=>a+b.mtd,0);
return <Page title="Sales & revenue" sub="Sales by branch and period." action={<div className="flex gap-1 bg-black/5 rounded-lg p-1">{["Daily","Weekly","Monthly"].map(x=><button key={x} onClick={()=>setP(x)} className={"px-3 py-1 rounded-md text-sm "+(p===x?"bg-white":"")}>{x}</button>)}</div>}>
<div className="card"><h3 className="font-semibold mb-2">{p} trend</h3><Line a={series(mtd,n)}/></div>
<div className="card"><table className="w-full"><thead><tr><th>Branch</th><th>Today</th><th>This week</th><th>MTD</th><th>Customers</th><th>Avg sale</th></tr></thead><tbody>{list.map((b:any)=><tr key={b.id}><td>{b.name}</td><td>{peso(b.today)}</td><td>{peso(b.week)}</td><td>{peso(b.mtd)}</td><td>{b.customers.toLocaleString()}</td><td>{peso(b.mtd/b.customers)}</td></tr>)}</tbody></table></div></Page>}
