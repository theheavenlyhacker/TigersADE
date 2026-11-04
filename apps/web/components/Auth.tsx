"use client";
import {createContext,useContext,useEffect,useState,ReactNode} from "react";
import {users,branches} from "@/lib/data";
type U=(typeof users)[number];
const Ctx=createContext<any>(null);
export function AuthProvider({children}:{children:ReactNode}){
const [user,setUser]=useState<U|null>(null);const [loaded,setLoaded]=useState(false);const [scope,setScope]=useState("all");const [aiOpen,setAiOpen]=useState(false);
useEffect(()=>{try{const id=localStorage.getItem("ade-user");const u=users.find(x=>x.id===id);if(u){setUser(u);setScope(u.branch||"all")}}catch{}setLoaded(true)},[]);
const login=(id:string)=>{const u=users.find(x=>x.id===id)!;localStorage.setItem("ade-user",id);setUser(u);setScope(u.branch||"all")};
const logout=()=>{localStorage.removeItem("ade-user");setUser(null)};
const list=scope==="all"?branches:branches.filter(b=>b.id===scope);
return <Ctx.Provider value={{aiOpen,setAiOpen,user,loaded,login,logout,scope,setScope,list}}>{children}</Ctx.Provider>}
export const useAuth=()=>useContext(Ctx);
