"use client";
import {useAuth} from "@/components/Auth";import {Page} from "@/components/ui";import {staff,activity,bname} from "@/lib/data";
export default function S(){const {list}=useAuth();if(!list)return null;const ids=list.map((b:any)=>b.id);
return <Page title="Staff & activity" sub="Who is working, and what changed.">
<div className="card"><h3 className="font-semibold mb-2">Staff on roster</h3><table className="w-full"><thead><tr><th>Name</th><th>Role</th><th>Branch</th><th>Shift</th></tr></thead><tbody>{staff.filter(s=>ids.includes(s.branch)).map(s=><tr key={s.name}><td>{s.name}</td><td>{s.role}</td><td>{bname(s.branch)}</td><td>{s.shift}</td></tr>)}</tbody></table></div>
<div className="card"><h3 className="font-semibold mb-2">Activity log</h3>{activity.filter(a=>ids.includes(a.branch)).map((a,i)=><div key={i} className="flex gap-4 py-2 border-t border-black/5 text-sm"><span className="text-black/40 w-12">{a.t}</span><span className="flex-1">{a.a}</span><span className="text-black/50">{a.by} · {bname(a.branch)}</span></div>)}</div></Page>}
