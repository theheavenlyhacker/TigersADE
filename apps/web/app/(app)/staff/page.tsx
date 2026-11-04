"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/Auth";
import { Page } from "@/components/ui";
import { staff, bname } from "@/lib/data";

const api = process.env.NEXT_PUBLIC_API_URL ?? (typeof window === "undefined" ? "http://localhost:4000" : `http://${window.location.hostname}:4000`);
type Entry = { id: string; branchId: string; branchName: string; actorName: string; action: string; payload: Record<string, unknown>; createdAt: string };

export default function S() {
  const { user, list, branches } = useAuth();
  const ids = list?.map((b: { id: string }) => b.id) ?? [];
  const [branch, setBranch] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function load(before?: string) {
    setLoading(true); setError("");
    const params = new URLSearchParams({ limit: "20" });
    if (branch) params.set("branch", branch);
    if (before) params.set("before", before);
    try {
      const response = await fetch(`${api}/activity?${params}`, { credentials: "include" });
      if (!response.ok) throw new Error();
      const page = await response.json();
      setEntries(old => before ? [...old, ...page.items] : page.items);
      setCursor(page.nextBefore);
    } catch { setError("Could not load activity."); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (user) void load(); }, [user, branch]);
  if (!list || !user) return null;
  return <Page title="Staff & activity" sub="Who is working, and what changed.">
    <div className="card"><h3 className="font-semibold mb-2">Staff on roster</h3><table className="w-full"><thead><tr><th>Name</th><th>Role</th><th>Branch</th><th>Shift</th></tr></thead><tbody>{staff.filter(s => ids.includes(s.branch)).map(s => <tr key={s.name}><td>{s.name}</td><td>{s.role}</td><td>{bname(s.branch)}</td><td>{s.shift}</td></tr>)}</tbody></table></div>
    <section className="card" aria-labelledby="activity-title"><div className="flex justify-between items-center gap-4 mb-2"><h3 id="activity-title" className="font-semibold">Activity log</h3><label className="text-sm">Branch <select className="btn ml-2" value={branch} onChange={e => setBranch(e.target.value)}><option value="">All branches</option>{branches.map((b: { id: string; name: string }) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label></div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {entries.map(entry => <div key={entry.id} className="flex flex-wrap gap-x-4 py-2 border-t border-black/5 text-sm"><time className="text-black/40">{new Date(entry.createdAt).toLocaleString()}</time><span className="flex-1">{entry.action.replaceAll(".", " ")} {JSON.stringify(entry.payload)}</span><span className="text-black/50">{entry.actorName} · {entry.branchName}</span></div>)}
      {!entries.length && !loading && <p className="text-sm text-black/50 py-3">No activity yet.</p>}
      {cursor && <button className="btn mt-3" disabled={loading} onClick={() => void load(cursor)}>{loading ? "Loading…" : "Load older activity"}</button>}
    </section>
  </Page>;
}
