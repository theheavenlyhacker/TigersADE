"use client";
import {useRouter} from "next/navigation";import {useState,useEffect} from "react";import {useAuth} from "@/components/Auth";import {users,bname} from "@/lib/data";
const tag=(u:(typeof users)[number])=>u.role==="owner"?"Owner":"Manager · "+bname(u.branch as string);
export default function Login(){
const {login,user,loaded}=useAuth();const r=useRouter();const [em,setEm]=useState("");const [as,setAs]=useState("owner");
useEffect(()=>{if(loaded&&user)r.replace("/dashboard")},[loaded,user,r]);
const go=(id:string)=>{login(id);r.push("/dashboard")};
return <div className="min-h-screen grid place-items-center p-6"><div className="card w-full max-w-md space-y-5">
<div className="flex items-center gap-3"><div className="w-11 h-11 rounded-xl bg-brand text-white grid place-items-center font-bold">T</div><div><div className="font-semibold text-lg">Tigers café</div><div className="text-sm text-black/50">Access Data Environment</div></div></div>
<form className="space-y-3" onSubmit={e=>{e.preventDefault();const m=users.find(x=>x.email===em.trim().toLowerCase());go(m?m.id:as)}}>
<input className="w-full border border-black/10 rounded-lg px-3 py-2" placeholder="Email (any, demo)" value={em} onChange={e=>setEm(e.target.value)}/>
<input className="w-full border border-black/10 rounded-lg px-3 py-2" type="password" placeholder="Password (any, demo)"/>
<label className="block text-sm text-black/50">Log in as
<select className="mt-1 w-full border border-black/10 rounded-lg px-3 py-2 text-ink bg-white" value={as} onChange={e=>setAs(e.target.value)}>{users.map(u=><option key={u.id} value={u.id}>{u.name} · {tag(u)}</option>)}</select></label>
<button className="btn-p w-full">Log in</button></form>
<div className="text-sm text-black/50">Or jump straight in</div>
<div className="space-y-2">{users.map(u=><button key={u.id} onClick={()=>go(u.id)} className="btn w-full text-left flex justify-between"><span>{u.name}</span><span className="text-black/50">{tag(u)}</span></button>)}</div>
</div></div>}
