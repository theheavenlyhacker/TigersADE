"use client";
import {useState,useRef,useEffect} from "react";import {useAuth} from "./Auth";import {peso,products,expenseCats} from "@/lib/data";
type M={r:"u"|"a";t:string;how?:string};
const chips=["Which branch is best?","Forecast this month","Best-selling product?","Where are expenses going?"];
export default function AskAI(){
const {aiOpen,setAiOpen,list}=useAuth();const [msgs,setMsgs]=useState<M[]>([]);const [q,setQ]=useState("");const end=useRef<HTMLDivElement>(null);
useEffect(()=>{end.current?.scrollIntoView({behavior:"smooth"})},[msgs]);
if(!aiOpen)return null;
const answer=(s:string):M=>{const x=s.toLowerCase();const mtd=list.reduce((a:number,b:any)=>a+b.mtd,0);const exp=list.reduce((a:number,b:any)=>a+b.expenses,0);
if(x.includes("best")&&x.includes("branch")||x.includes("which branch")){const t=[...list].sort((a:any,b:any)=>b.mtd-a.mtd)[0];return{r:"a",t:`${t.name} leads with ${peso(t.mtd)} in month-to-date sales, up ${t.growth}%.`,how:"Ranked branches by SUM(sales) for Oct 1–18, limited to the branches you can access."}}
if(x.includes("forecast")){const e=mtd/18*31;return{r:"a",t:`Expected October sales: ${peso(e)}. Worst case ${peso(e*0.92)}, best case ${peso(e*1.08)}.`,how:"Daily average (MTD ÷ 18 days) × 31 days, with a ±8% range. A simple method, not a seasonal model."}}
if(x.includes("sell")||x.includes("product")){const p=[...products].sort((a,b)=>b.units-a.units)[0];return{r:"a",t:`${p.name} sells the most: ${p.units.toLocaleString()} units and ${peso(p.units*p.price)} in revenue, at a ${p.margin}% margin.`,how:"Ordered products by SUM(units sold) for Oct 1–18."}}
if(x.includes("expense")){const c=expenseCats[0];return{r:"a",t:`Total expenses are ${peso(exp)} month to date. The biggest share is ${c.n} at ${c.p}% (${peso(exp*c.p/100)}).`,how:"SUM(expenses) grouped by category, Oct 1–18."}}
return{r:"a",t:"I can answer questions about branches, sales, products and expenses. Try one of the suggestions."}};
const send=(s:string)=>{if(!s.trim())return;setMsgs(m=>[...m,{r:"u",t:s},answer(s)]);setQ("")};
return <aside className="fixed inset-y-0 right-0 z-50 w-full lg:sticky lg:top-0 lg:h-screen lg:w-[400px] lg:shrink-0 lg:ml-auto bg-white border-l border-black/10 flex flex-col">
<div className="flex justify-between items-center p-5 border-b border-black/5"><h2 className="text-xl font-semibold">Ask AI</h2><button aria-label="Close" onClick={()=>setAiOpen(false)} className="text-2xl leading-none px-2">×</button></div>
<div className="flex-1 overflow-y-auto p-5 space-y-3">
<div className="bg-mint rounded-2xl p-4 max-w-[85%]">Ask me anything about your branches, sales, products or expenses.</div>
{!msgs.length&&<div className="flex flex-wrap gap-2">{chips.map(c=><button key={c} onClick={()=>send(c)} className="btn rounded-full">{c}</button>)}</div>}
{msgs.map((m,i)=><div key={i} className={m.r==="u"?"flex justify-end":""}><div className={"rounded-2xl p-4 max-w-[85%] "+(m.r==="u"?"bg-brand text-white":"bg-mint")}>{m.t}{m.how&&<details className="text-sm mt-2 opacity-80"><summary className="cursor-pointer">How this was calculated</summary>{m.how}</details>}</div></div>)}
<div ref={end}/></div>
<form className="p-4 border-t border-black/5 flex gap-2" onSubmit={e=>{e.preventDefault();send(q)}}>
<input className="flex-1 border border-black/10 rounded-lg px-3 py-2" placeholder="Ask about your data" value={q} onChange={e=>setQ(e.target.value)}/><button className="btn-p px-5">Send</button></form></aside>}
