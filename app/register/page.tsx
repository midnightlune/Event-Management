"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { btn, card, ErrorMsg, input } from "@/components/ui";

export default function RegisterPage() {
  const router = useRouter();
  const [f, setF] = useState({ fullName: "", email: "", password: "", phone: "", role: "CUSTOMER" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await api("/api/auth/register", { body: f });
      router.push("/events");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`mx-auto max-w-md ${card}`}>
      <h1 className="mb-4 text-xl font-bold">Create an account</h1>
      <form onSubmit={submit} className="space-y-3">
        <div><label className="mb-1 block text-sm font-medium">Full name</label><input className={input} required value={f.fullName} onChange={set("fullName")} /></div>
        <div><label className="mb-1 block text-sm font-medium">Email</label><input className={input} type="email" required value={f.email} onChange={set("email")} /></div>
        <div><label className="mb-1 block text-sm font-medium">Password (min 8 characters)</label><input className={input} type="password" required minLength={8} value={f.password} onChange={set("password")} /></div>
        <div><label className="mb-1 block text-sm font-medium">Phone (optional, digits only)</label><input className={input} value={f.phone} onChange={set("phone")} /></div>
        <div><label className="mb-1 block text-sm font-medium">I want to</label>
          <select className={input} value={f.role} onChange={set("role")}>
            <option value="CUSTOMER">Book tickets (Customer)</option>
            <option value="ORGANIZER">Host events (Organizer)</option>
          </select></div>
        <ErrorMsg>{error}</ErrorMsg>
        <button className={`${btn} w-full`} disabled={busy}>{busy ? "Creating..." : "Sign up"}</button>
      </form>
      <p className="mt-4 text-sm text-slate-600">Already have an account? <Link className="text-indigo-700 underline" href="/login">Log in</Link></p>
    </div>
  );
}
