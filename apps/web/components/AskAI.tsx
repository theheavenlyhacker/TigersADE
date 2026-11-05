"use client";
import {useState,useRef,useEffect} from "react";import {useAuth} from "./Auth";import {peso} from "@/lib/data";import {apiUrl} from "@/lib/catalog";
type M={r:"u"|"a";t:string;how?:string};
type Figures={comparison:any[];summary:any;best:any[];expenses:any;trend:any};
const chips=["Which branch is best?","Forecast this month","Best-selling product?","Where are expenses going?"];
export default function AskAI(){
const {aiOpen,setAiOpen,branches,scope,user}=useAuth();const [msgs,setMsgs]=useState<M[]>([]);const [q,setQ]=useState("");const [figures,setFigures]=useState<Figures|null>(null);const [loading,setLoading]=useState(false);const end=useRef<HTMLDivElement>(null);
useEffect(()=>{end.current?.scrollIntoView({behavior:"smooth"})},[msgs]);
useEffect(()=>{if(!aiOpen||!branches?.length)return;const branch=user?.role==="owner" ? scope : branches[0]?.id;if(!branch)return;setFigures(null);setLoading(true);
  const get=(path:string)=>fetch(`${apiUrl()}/reports/${path}`,{credentials:"include"}).then(r=>r.ok?r.json():null);
  Promise.all([get("comparison"),get(`summary?branch=${branch}`),get(`trend?branch=${branch}`)]).then(async([comparison,summary,trend])=>{
    const date=(summary?.date??today()).slice(0,10);const month=`${date.slice(0,7)}-01`;
    const branchId=branch==="all" ? (summary?.branches?.[0]?.branchId??branches[0]?.id) : branch;
    const [best,expenses]=await Promise.all([get(`best-sellers?branch=${branchId}&from=${month}&to=${date}`),get(`expenses?branch=${branch}&month=${date.slice(0,7)}`)]);
    setFigures({comparison:summary?.branches? (comparison??summary.branches) : (comparison??[]),summary,best:best??[],expenses,trend});
  }).catch(()=>setFigures(null)).finally(()=>setLoading(false));
},[aiOpen,branches,scope,user?.role]);
if(!aiOpen)return null;
const answer=(s:string):M=>{const x=s.toLowerCase();
if(!figures||loading)return{r:"a",t:"Loading API figures…" };
const money=(v:string)=>peso(Number(v)/100);
const summary=figures.summary;
if(x.includes("best")&&x.includes("branch")||x.includes("which branch")){if(!figures.comparison?.length)return{r:"a",t:"No branch figures yet for the month."};
  const t=[...figures.comparison].sort((a:any,b:any)=>Number(b.mtd)-Number(a.mtd))[0];
  return{r:"a",t:`${t.name} leads with ${money(t.mtd)} in month-to-date sales${t.growth!==null?`, up ${Number(t.growth).toFixed(1)}%`:""}.`,how:"Ranked branches by MTD sales from /reports/comparison, limited to the branches you can access."}}
if(x.includes("forecast")){if(!figures.trend?.forecast)return{r:"a",t:"No forecast available yet."};
  const avg=Number(figures.trend.forecast.dailyAverage)/100;const e=avg*31;
  return{r:"a",t:`Expected month sales: ${peso(e)}. Worst case ${peso(e*0.92)}, best case ${peso(e*1.08)}.`,how:"Daily average from /reports/trend × 31 days, with a ±8% range."}}
if(x.includes("sell")||x.includes("product")){if(!figures.best?.length)return{r:"a",t:"No product sales yet this month."};
  const p=[...figures.best].sort((a:any,b:any)=>Number(b.units)-Number(a.units))[0];
  return{r:"a",t:`${p.name} sells the most: ${Number(p.units).toLocaleString()} units and ${money(p.revenue)} in revenue, at a ${Number(p.margin).toFixed(2)}% margin.`,how:"Ordered products by units sold from /reports/best-sellers for the current month."}}
if(x.includes("expense")){const categories=figures.expenses?.categories??[];if(!categories.length)return{r:"a",t:`Total expenses are ${summary?money(summary.expenses):"₱0"} month to date.`};
  const exp=Number(summary?.expenses??categories.reduce((n:number,c:any)=>n+Number(c.total),0))/100;
  const c=[...categories].sort((a:any,b:any)=>Number(b.total)-Number(a.total))[0];
  return{r:"a",t:`Total expenses are ${peso(exp)} month to date. The biggest share is ${c.categoryName} at ${exp? (Number(c.total)/(exp*100)*100).toFixed(1):"0"}% (${money(c.total)}).`,how:"SUM(expenses) grouped by category from /reports/expenses for the current month."}}
return{r:"a",t:"I can answer questions about branches, sales, products and expenses. Try one of the suggestions."}};
const send=(s:string)=>{if(!s.trim())return;setMsgs(m=>[...m,{r:"u",t:s},answer(s)]);setQ("");};
return <aside className="fixed inset-y-0 right-0 z-50 w-full lg:sticky lg:top-0 lg:h-screen lg:w-[400px] lg:shrink-0 lg:ml-auto bg-white border-l border-black/10 flex flex-col">
<div className="flex justify-between items-center p-5 border-b border-black/5"><h2 className="text-xl font-semibold">Ask AI</h2><button aria-label="Close" onClick={()=>setAiOpen(false)} className="text-2xl leading-none px-2">×</button></div>
<div className="flex-1 overflow-y-auto p-5 space-y-3">
<div className="bg-mint rounded-2xl p-4 max-w-[85%]">Ask me anything about your branches, sales, products or expenses.</div>
{!msgs.length&&<div className="flex flex-wrap gap-2">{chips.map(c=><button key={c} onClick={()=>send(c)} className="btn rounded-full">{c}</button>)}</div>}
{msgs.map((m,i)=><div key={i} className={m.r==="u"?"flex justify-end":""}><div className={"rounded-2xl p-4 max-w-[85%] "+(m.r==="u"?"bg-brand text-white":"bg-mint")}>{m.t}{m.how&&<details className="text-sm mt-2 opacity-80"><summary className="cursor-pointer">How this was calculated</summary>{m.how}</details>}</div></div>)}
<div ref={end}/></div>
<form className="p-4 border-t border-black/5 flex gap-2" onSubmit={e=>{e.preventDefault();send(q)}}>
<input className="flex-1 border border-black/10 rounded-lg px-3 py-2" placeholder="Ask about your data" value={q} onChange={e=>setQ(e.target.value)}/><button className="btn-p px-5">Send</button></form></aside>}
function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
