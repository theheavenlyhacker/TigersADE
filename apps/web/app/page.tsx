"use client";
import {useRouter} from "next/navigation";import {useState,useEffect} from "react";import {useAuth} from "@/components/Auth";
export default function Login(){
const {login,user,loaded}=useAuth();const r=useRouter();const [em,setEm]=useState("");
const [pw,setPw]=useState("");const [error,setError]=useState("");const [busy,setBusy]=useState(false);
useEffect(()=>{if(loaded&&user)r.replace("/dashboard")},[loaded,user,r]);
return <div className="min-h-screen grid place-items-center p-6"><div className="card w-full max-w-md space-y-5">
<div className="flex items-center gap-3"><div className="w-11 h-11 rounded-xl bg-brand text-white grid place-items-center font-bold">T</div><div><div className="font-semibold text-lg">Tigers café</div><div className="text-sm text-black/50">Access Data Environment</div></div></div>
<form className="space-y-3" onSubmit={async e=>{e.preventDefault();setBusy(true);setError("");try{const u=await login(em,pw);r.push(u.role==="cashier"?"/sales":"/dashboard")}catch{setError("Invalid email or password")}finally{setBusy(false)}}}>
<input required autoComplete="username" type="email" className="w-full border border-black/10 rounded-lg px-3 py-2" placeholder="Email" value={em} onChange={e=>setEm(e.target.value)}/>
<input required autoComplete="current-password" className="w-full border border-black/10 rounded-lg px-3 py-2" type="password" placeholder="Password" value={pw} onChange={e=>setPw(e.target.value)}/>
<button disabled={busy} className="btn-p w-full">Log in</button></form>
{error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
</div></div>}
