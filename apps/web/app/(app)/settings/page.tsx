"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/Auth";
import { Page } from "@/components/ui";

const api = process.env.NEXT_PUBLIC_API_URL ?? (typeof window === "undefined" ? "http://localhost:4000" : `http://${window.location.hostname}:4000`);
type Settings = { id: string; code: string; name: string; dailyTarget: string | null; dayCutoff: string };

export default function BranchSettings() {
  const { user, branches } = useAuth();
  const [values, setValues] = useState<Settings[]>([]);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (user?.role !== "owner") return;
    Promise.all(branches.map((branch: Settings) => fetch(`${api}/branches/${branch.id}`, { credentials: "include" }).then(r => r.json())))
      .then(setValues).catch(() => setMessage("Could not load branch settings."));
  }, [user, branches]);
  if (user?.role !== "owner") return null;
  async function save(id: string, key: "dailyTarget" | "dayCutoff", value: string) {
    const response = await fetch(`${api}/branches/${id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [key]: key === "dailyTarget" ? String(Math.round(Number(value) * 100)) : value }) });
    setMessage(response.ok ? "Settings saved." : "Could not save settings.");
  }
  return <Page title="Branch settings" sub="Set each branch's daily sales target and business day cutoff.">
    {message && <div role="status" className="card text-sm">{message}</div>}
    {values.map(branch => <div className="card grid gap-4 md:grid-cols-3 md:items-end" key={branch.id}>
      <h2 className="font-semibold text-lg">{branch.name}</h2>
      <label className="grid gap-1 text-sm">Daily target (₱)<input className="btn w-full" type="number" min="0" step="0.01" defaultValue={branch.dailyTarget === null ? "" : (Number(branch.dailyTarget) / 100).toFixed(2)} onBlur={e => void save(branch.id, "dailyTarget", e.target.value)} /></label>
      <label className="grid gap-1 text-sm">Day cutoff<input className="btn w-full" type="time" defaultValue={branch.dayCutoff.slice(0, 5)} onBlur={e => void save(branch.id, "dayCutoff", e.target.value)} /></label>
    </div>)}
  </Page>;
}
