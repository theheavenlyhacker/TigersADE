"use client";
import Link from "next/link";import {usePathname,useRouter} from "next/navigation";import {useEffect,ReactNode} from "react";
import {useAuth} from "./Auth";import AskAI from "./AskAI";import {branches} from "@/lib/data";
const nav=[["dashboard","Executive dashboard"],["sales","Sales & revenue"],["inventory","Inventory"],["products","Products"],["expenses","Expenses"],["staff","Staff & activity"]];
export default function Shell({children}:{children:ReactNode}){
const {user,loaded,logout,scope,setScope}=useAuth();const path=usePathname();const r=useRouter();
useEffect(()=>{if(loaded&&!user)r.replace("/")},[loaded,user,r]);
if(!user)return null;const owner=user.role==="owner";
const label=(k:string,t:string)=>owner||k!=="dashboard"?t:"Branch dashboard";
return <div className="flex min-h-screen">
<aside className="w-64 shrink-0 bg-white border-r border-black/5 p-4 flex flex-col gap-4 sticky top-0 h-screen">
<div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-brand text-white grid place-items-center font-bold">T</div><div><div className="font-semibold">Tigers café</div><div className="text-xs text-black/50">café operations</div></div></div>
<div className="border border-black/10 rounded-lg px-3 py-3">Tigers Café Group</div>
<nav className="space-y-1">{nav.map(([k,t])=><Link key={k} href={"/"+k} className={"block rounded-lg px-3 py-2.5 "+(path==="/"+k?"bg-mint font-medium":"hover:bg-paper")}>{label(k,t)}</Link>)}</nav>
<div className="text-sm text-black/50 mt-2">{owner?"Your branches":"Your branch"}</div>
<div className="space-y-1">{branches.filter(b=>owner||b.id===user.branch).map(b=><button key={b.id} disabled={!owner} onClick={()=>setScope(scope===b.id?"all":b.id)} className={"w-full text-left rounded-lg px-3 py-2 flex items-center gap-2 "+(scope===b.id?"bg-mint":"hover:bg-paper")}><span className="w-1.5 h-1.5 rounded-full bg-sage"/>{b.name}</button>)}</div>
<div className="mt-auto space-y-3"><div className="bg-mint rounded-xl p-3 text-sm"><b>A little clarity. Every day.</b><div className="text-black/50">{owner?"All 3 branches are connected.":"Connected to head office."}</div></div>
<div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-mint grid place-items-center text-sm">{user.initials}</div><div className="flex-1 text-sm"><div>{user.name}</div><div className="text-xs text-black/50">{owner?"Owner · Admin":"Branch manager"}</div></div><button onClick={()=>{logout();r.replace("/")}} className="text-xs underline">Log out</button></div></div>
</aside><main className="flex-1 min-w-0 p-8 max-w-6xl">{children}</main><AskAI/></div>}
