"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { btn, card, ErrorMsg, input } from "@/components/ui";

function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next") || "/events";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await api("/api/auth/login", { body: { email, password } });
      router.push(next.startsWith("/") ? next : "/events");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`mx-auto max-w-md ${card}`}>
      <h1 className="mb-4 text-xl font-bold">Log in</h1>
      <form onSubmit={submit} className="space-y-3">
        <div><label className="mb-1 block text-sm font-medium">Email</label>
          <input className={input} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div><label className="mb-1 block text-sm font-medium">Password</label>
          <input className={input} type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <ErrorMsg>{error}</ErrorMsg>
        <button className={`${btn} w-full`} disabled={busy}>{busy ? "Logging in..." : "Log in"}</button>
      </form>
      <p className="mt-4 text-sm text-slate-600">New here? <Link className="text-indigo-700 underline" href="/register">Create an account</Link></p>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense fallback={null}><LoginForm /></Suspense>;
}
