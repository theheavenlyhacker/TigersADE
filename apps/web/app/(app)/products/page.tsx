"use client";
import {useState} from "react";import {Page} from "@/components/ui";import {products,peso} from "@/lib/data";
export default function P(){const [q,setQ]=useState("");const [c,setC]=useState("All");
const cats=["All",...Array.from(new Set(products.map(p=>p.cat)))];const rows=products.filter(p=>(c==="All"||p.cat===c)&&p.name.toLowerCase().includes(q.toLowerCase()));
return <Page title="Products" sub="Menu items, prices and margins.">
<div className="flex gap-2 flex-wrap"><input className="btn" placeholder="Search products" value={q} onChange={e=>setQ(e.target.value)}/>{cats.map(x=><button key={x} onClick={()=>setC(x)} className={c===x?"btn-p":"btn"}>{x}</button>)}</div>
<div className="card"><table className="w-full"><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Units MTD</th><th>Revenue</th><th>Margin</th></tr></thead><tbody>{rows.map(p=><tr key={p.name}><td>{p.name}</td><td>{p.cat}</td><td>{peso(p.price)}</td><td>{p.units.toLocaleString()}</td><td>{peso(p.units*p.price)}</td><td>{p.margin}%</td></tr>)}</tbody></table>{!rows.length&&<p className="text-black/50 pt-3">No products match. Try a different search.</p>}</div></Page>}
