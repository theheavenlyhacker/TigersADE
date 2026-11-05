"use client";
import {useState,useRef,useEffect} from "react";import {useAuth} from "./Auth";import {peso} from "@/lib/data";import {apiUrl} from "@/lib/catalog";
type M={r:"u"|"a";t:string;how?:string};
type Figures={comparison:any[];summary:any;best:any[];expenseCategories:any[];expenseTotal:number;trend:any};
const chips=["Which branch is best?","Forecast this month","Best-selling product?","Where are expenses going?"];
export default function AskAI(){
const {aiOpen,setAiOpen,branches,scope,user}=useAuth();const [msgs,setMsgs]=useState<M[]>([]);const [q,setQ]=useState("");const [figures,setFigures]=useState<Figures|null>(null);const [loading,setLoading]=useState(false);const [error,setError]=useState("");const end=useRef<HTMLDivElement>(null);
useEffect(()=>{end.current?.scrollIntoView({behavior:"smooth"})},[msgs]);
useEffect(()=>{if(!aiOpen||!branches?.length)return;const branch=user?.role==="owner" ? (scope==="all" ? "all" : branches.find((b:any)=>b.code===scope)?.id) : branches[0]?.id;if(!branch){setError("Could not resolve your branch.");return}setFigures(null);setError("");setLoading(true);
  const get=(path:string)=>fetch(`${apiUrl()}/reports/${path}`,{credentials:"include"}).then(r=>r.ok?r.json():null);
  Promise.all([user?.role==="owner"?get("comparison"):Promise.resolve(null),get(`summary?branch=${branch}`),get(`trend?branch=${branch}`)]).then(async([comparison,summary,trend])=>{
    if(!summary)throw new Error("Could not load summary");
    const date=(summary.date??today()).slice(0,10);const monthStart=`${date.slice(0,7)}-01`;
    const branchIds=branch==="all" ? (summary.branches??[]).map((b:any)=>b.branchId).filter(Boolean) : [branch];
    if(!branchIds.length)throw new Error("No branches available");
    setFigures({comparison:user?.role==="owner" ? (comparison??summary.branches?.map((b:any)=>({name:branches.find((x:any)=>x.id===b.branchId)?.name??b.branchId,mtd:b.mtd,growth:summary?.growth??null}))??[]) : [{name:branches[0].name,mtd:summary?.mtd??"0",growth:null}],summary,best:[],expenseCategories:[],expenseTotal:0,trend});
    const [bestByBranch,expenseByBranch]=await Promise.all([Promise.all(branchIds.map((id:string)=>get(`best-sellers?branch=${id}&from=${monthStart}&to=${date}`))),Promise.all(branchIds.map((id:string)=>fetch(`${apiUrl()}/branches/${id}/expenses?from=${monthStart}&to=${date}`,{credentials:"include"}).then(r=>r.ok?r.json():[])))]);
    const bestMap=new Map<string,any>();for(const rows of bestByBranch){for(const p of (rows??[])){const cur=bestMap.get(p.productId)??{...p,units:0,revenue:0,marginValue:0};cur.units+=Number(p.units);cur.revenue+=Number(p.revenue);cur.marginValue+=Number(p.revenue)*Number(p.margin)/100;bestMap.set(p.productId,cur)}}
    const best=[...bestMap.values()].map(p=>({...p,revenue:p.revenue.toString(),margin:p.revenue?(p.marginValue/Number(p.revenue)*100).toFixed(2):"0"}));
    const catMap=new Map<string,any>();let expenseTotal=0;for(const rows of expenseByBranch){for(const e of (rows??[])){expenseTotal+=Number(e.amount);const cur=catMap.get(e.categoryId)??{categoryId:e.categoryId,categoryName:e.categoryName,total:0};cur.total+=Number(e.amount);catMap.set(e.categoryId,cur)}}
    const comparisonRows=user?.role==="owner" ? (comparison??summary?.branches?.map((b:any)=>({name:branches.find((x:any)=>x.id===b.branchId)?.name??b.branchId,mtd:b.mtd,growth:summary?.growth??null}))??[]) : [{name:branches[0].name,mtd:summary?.mtd??"0",growth:null}];
    setFigures({comparison:comparisonRows,summary,best,expenseCategories:[...catMap.values()],expenseTotal,trend});
  }).catch(()=>{setFigures(null);setError("Could not load API figures.")}).finally(()=>setLoading(false));
},[aiOpen,branches,scope,user?.role]);
if(!aiOpen)return null;
const answer=(s:string):M=>{const x=s.toLowerCase();
if(error)return{r:"a",t:"Could not load API figures. Please reopen the panel and try again."};
if(!figures)return{r:"a",t:"Could not load API figures. Please reopen the panel and try again."};
if(loading&&!figures.comparison?.length&&!figures.summary&&!figures.best?.length)return{r:"a",t:"Loading API figures…" };
const money=(v:any)=>peso(Number(v)/100);
const summary=figures.summary;
if(x.includes("best")&&x.includes("branch")||x.includes("which branch")){if(!figures.comparison?.length)return{r:"a",t:"No branch figures yet for the month."};
  if(user?.role!=="owner"){const t=figures.comparison[0];return{r:"a",t:`You have access to one branch: ${t.name}, with ${money(t.mtd)} in month-to-date sales.`,how:"MTD sales from /reports/summary for your branch."}}
  const t=[...figures.comparison].sort((a:any,b:any)=>Number(b.mtd)-Number(a.mtd))[0];
  return{r:"a",t:`${t.name} leads with ${money(t.mtd)} in month-to-date sales${t.growth!==null&&t.growth!==undefined?`, up ${Number(t.growth).toFixed(1)}%`:""}.`,how:"Ranked branches by MTD sales from /reports/comparison."}}
if(x.includes("forecast")){if(!figures.trend?.forecast)return{r:"a",t:"No forecast available yet."};
  const date=(summary?.date??today()).slice(0,10);const [y,m]=date.split("-").map(Number);const daysInMonth=new Date(Date.UTC(y,m,0)).getUTCDate();
  const avg=Number(figures.trend.forecast.dailyAverage)/100;const e=avg*daysInMonth;const lower=Number(figures.trend.forecast.lower)/100;const upper=Number(figures.trend.forecast.upper)/100;
  return{r:"a",t:`Expected month sales: ${peso(e)}. Worst case ${peso(lower)}, best case ${peso(upper)}.`,how:`Daily average from /reports/trend × ${daysInMonth} days, with API lower/upper (±8%).`}}
if(x.includes("sell")||x.includes("product")){if(!figures.best?.length)return{r:"a",t:"No product sales yet this month."};
  const p=[...figures.best].sort((a:any,b:any)=>Number(b.units)-Number(a.units))[0];
  const branchLabel=user?.role==="owner" ? (scope==="all"?" across all branches":" at "+(branches.find((b:any)=>b.code===scope)?.name??"selected branch")) : "";
  return{r:"a",t:`${p.name} sells the most${branchLabel}: ${Number(p.units).toLocaleString()} units and ${money(p.revenue)} in revenue, at a ${Number(p.margin).toFixed(2)}% margin.`,how:"Merged /reports/best-sellers across accessible branches for the current month, ordered by units."}}
if(x.includes("expense")){const categories=figures.expenseCategories;if(!categories.length)return{r:"a",t:`Total expenses are ${peso(figures.expenseTotal/100)} month to date.`};
  const exp=figures.expenseTotal/100;const c=[...categories].sort((a:any,b:any)=>Number(b.total)-Number(a.total))[0];
  return{r:"a",t:`Total expenses are ${peso(exp)} month to date. The biggest share is ${c.categoryName} at ${exp?(Number(c.total)/(exp*100)*100).toFixed(1):"0"}% (${money(c.total)}).`,how:"GET /branches/:id/expenses grouped by category for the current month, merged across accessible branches."}}
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
function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
