import {ReactNode} from "react";
export const Page=({title,sub,children,action}:{title:string;sub:string;children:ReactNode;action?:ReactNode})=>(
<div><div className="flex justify-between items-start gap-4 mb-6"><div><h1 className="text-4xl font-semibold tracking-tight">{title}</h1><p className="text-black/55 mt-1">{sub}</p></div>{action}</div><div className="space-y-5">{children}</div></div>);
export const Stat=({l,v,s,dark}:{l:string;v:string;s:string;dark?:boolean})=>(
<div className={"rounded-2xl p-5 border border-black/5 "+(dark?"bg-brand text-white":"bg-white")}><div className={"text-sm "+(dark?"text-white/80":"text-black/55")}>{l}</div><div className="text-3xl font-semibold my-2">{v}</div><div className={"text-sm "+(dark?"text-white/70":"text-black/45")}>{s}</div></div>);
export const Bar=({pct,c="bg-brand"}:{pct:number;c?:string})=>(<div className="h-1.5 rounded-full bg-black/10 overflow-hidden"><div className={"h-full "+c} style={{width:Math.min(100,pct)+"%"}}/></div>);
export function Line({a,b}:{a:number[];b?:number[]}){
const W=700,H=180,max=Math.max(...a,...(b||[0]))*1.05;
const pts=(d:number[])=>d.map((v,i)=>`${(i/(d.length-1))*W},${H-(v/max)*H}`).join(" ");
return <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-48"><polyline fill="none" stroke="#1c4a3a" strokeWidth="2.5" points={pts(a)}/>{b&&<polyline fill="none" stroke="#999" strokeDasharray="4 4" points={pts(b)}/>}</svg>}
/** Shown instead of an empty table or chart: says what is missing and what to do next. */
export const Empty=({title,hint,children}:{title:string;hint:string;children?:ReactNode})=>(
<div role="status" className="card flex flex-col items-center text-center py-12 px-6 border border-dashed border-black/15">
<svg aria-hidden viewBox="0 0 48 48" className="w-12 h-12 text-brand/60 mb-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="12" width="32" height="26" rx="4"/><path d="M8 20h32M18 28h12"/></svg>
<h2 className="text-lg font-semibold">{title}</h2><p className="text-sm text-black/55 mt-1 max-w-sm">{hint}</p>{children&&<div className="mt-4 flex gap-2">{children}</div>}</div>);
