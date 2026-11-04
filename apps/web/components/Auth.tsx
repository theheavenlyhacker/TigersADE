"use client";
import {createContext,useContext,useEffect,useState,ReactNode} from "react";
type U={id:string;email:string;name:string;role:"owner"|"manager"|"cashier"};
type B={id:string;code:string;name:string};
const Ctx=createContext<any>(null);
export function AuthProvider({children}:{children:ReactNode}){
const [user,setUser]=useState<U|null>(null);const [list,setList]=useState<B[]>([]);const [loaded,setLoaded]=useState(false);const [scope,setScope]=useState("all");const [aiOpen,setAiOpen]=useState(false);
const api=process.env.NEXT_PUBLIC_API_URL??(typeof window==="undefined"?"http://localhost:4000":`http://${window.location.hostname}:4000`);
useEffect(()=>{fetch(`${api}/me`,{credentials:"include"}).then(r=>r.ok?r.json():null).then(data=>{if(data){setUser(data.user);setList(data.branches);setScope(data.user.role==="owner"?"all":data.branches[0]?.id??"")}}).catch(()=>{}).finally(()=>setLoaded(true))},[api]);
const login=async(email:string,password:string):Promise<U>=>{const r=await fetch(`${api}/auth/login`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password})});if(!r.ok)throw new Error("Invalid email or password");const u:U=await r.json();const me=await fetch(`${api}/me`,{credentials:"include"});if(!me.ok)throw new Error("Invalid email or password");const data=await me.json();setUser(u);setList(data.branches);setScope(u.role==="owner"?"all":data.branches[0]?.id??"");return u};
const logout=async()=>{await fetch(`${api}/auth/logout`,{method:"POST",credentials:"include"});setUser(null)};
return <Ctx.Provider value={{aiOpen,setAiOpen,user,loaded,login,logout,scope,setScope,list}}>{children}</Ctx.Provider>}
export const useAuth=()=>useContext(Ctx);
