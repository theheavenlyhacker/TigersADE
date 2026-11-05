"use client";
import {createContext,useContext,useEffect,useState,ReactNode} from "react";
import { apiUrl } from "@/lib/catalog";
type U={id:string;email:string;name:string;role:"owner"|"manager"|"cashier"};
type B={id:string;code:string;name:string};
const Ctx=createContext<any>(null);
export function AuthProvider({children}:{children:ReactNode}){
const [user,setUser]=useState<U|null>(null);const [branches,setBranches]=useState<B[]>([]);const [loaded,setLoaded]=useState(false);const [scope,setScope]=useState("all");const [aiOpen,setAiOpen]=useState(false);
const api = apiUrl();
const loadBranches=(data:any)=>{setBranches(data.branches);setScope(data.user.role==="owner"?"all":data.branches[0]?.code??"")};
useEffect(()=>{fetch(`${api}/me`,{credentials:"include"}).then(r=>r.ok?r.json():null).then(data=>{if(data){setUser(data.user);loadBranches(data)}}).catch(()=>{}).finally(()=>setLoaded(true))},[api]);
const login=async(email:string,password:string):Promise<U>=>{const r=await fetch(`${api}/auth/login`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password})});if(!r.ok)throw new Error("Invalid email or password");const u:U=await r.json();const me=await fetch(`${api}/me`,{credentials:"include"});if(!me.ok)throw new Error("Invalid email or password");const data=await me.json();setUser(u);loadBranches(data);return u};
const logout=async()=>{await fetch(`${api}/auth/logout`,{method:"POST",credentials:"include"});setUser(null);setBranches([]);setScope("all")};
return <Ctx.Provider value={{aiOpen,setAiOpen,user,loaded,login,logout,scope,setScope,branches}}>{children}</Ctx.Provider>}
export const useAuth=()=>useContext(Ctx);
