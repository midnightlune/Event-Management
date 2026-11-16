"use client";
import { useState } from "react";
import { useLoad } from "@/lib/useLoad";
import { api, money } from "@/lib/api";
import { btn, card, ErrorMsg, input, Loading, Notice, PageTitle } from "@/components/ui";

export default function AdminPage() {
  const summary = useLoad<any>("/api/admin/summary");
  const users = useLoad<any>("/api/admin/users");
  const [v, setV] = useState({ name: "", city: "", address: "", rows: "5", seatsPerRow: "8", vipPrice: "2500", goldPrice: "1500", silverPrice: "800" });
  const [msg, setMsg] = useState({ error: "", ok: "" });
  const setVal = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });

  async function patchUser(id: number, body: object) {
    setMsg({ error: "", ok: "" });
    try { await api(`/api/admin/users/${id}`, { method: "PATCH", body }); users.reload(); }
    catch (e: any) { setMsg({ error: e.message, ok: "" }); }
  }

  async function createVenue(e: React.FormEvent) {
    e.preventDefault();
    setMsg({ error: "", ok: "" });
    try {
      await api("/api/admin/venues", { body: {
        name: v.name, city: v.city, address: v.address, rows: Number(v.rows), seatsPerRow: Number(v.seatsPerRow),
        vipPrice: Number(v.vipPrice), goldPrice: Number(v.goldPrice), silverPrice: Number(v.silverPrice) } });
      setMsg({ error: "", ok: `Venue "${v.name}" created with ${Number(v.rows) * Number(v.seatsPerRow)} seats.` });
      setV({ ...v, name: "", city: "", address: "" });
    } catch (err: any) { setMsg({ error: err.message, ok: "" }); }
  }

  const t = summary.data?.totals;
  return (
    <>
      <PageTitle sub="Platform-wide figures (MySQL) and usage analytics (MongoDB aggregation).">Admin</PageTitle>
      <ErrorMsg>{summary.error || users.error || msg.error}</ErrorMsg><Notice>{msg.ok}</Notice>
      {summary.loading ? <Loading /> : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[["Users", t?.users], ["Events", t?.events], ["Confirmed bookings", t?.confirmedBookings], ["Revenue", money(t?.revenue ?? 0)], ["Refunds", money(t?.refunds ?? 0)]].map(([label, val]) => (
              <div key={label as string} className={card}><p className="text-xs uppercase text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold">{val}</p></div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <section className={card}>
              <h2 className="mb-2 font-semibold">Top events by revenue</h2>
              {summary.data?.topEvents.length === 0 && <p className="text-sm text-slate-500">No confirmed bookings yet.</p>}
              <ul className="space-y-1 text-sm">{summary.data?.topEvents.map((e: any) => <li key={e.eventId} className="flex justify-between"><span>{e.title}</span><span>{money(e.revenue)}</span></li>)}</ul>
            </section>
            <section className={card}>
              <h2 className="mb-2 font-semibold">Most viewed (last 7 days)</h2>
              {!summary.data?.mongoOk && <p className="text-sm text-red-600">MongoDB is not reachable.</p>}
              <ul className="space-y-1 text-sm">{summary.data?.mostViewed.map((e: any) => <li key={e.eventId} className="flex justify-between"><span>{e.title}</span><span>{e.views} views</span></li>)}</ul>
            </section>
            <section className={card}>
              <h2 className="mb-2 font-semibold">Average rating</h2>
              <ul className="space-y-1 text-sm">{summary.data?.ratings.map((e: any) => <li key={e.eventId} className="flex justify-between"><span>{e.title}</span><span>{e.avgRating} / 5 ({e.reviews})</span></li>)}</ul>
            </section>
          </div>

          <section className={card}>
            <h2 className="mb-3 text-lg font-semibold">Users</h2>
            <div className="overflow-x-auto"><table className="w-full text-left text-sm">
              <thead className="text-slate-500"><tr><th className="py-1">Name</th><th>Email</th><th>Role</th><th>Active</th></tr></thead>
              <tbody>{users.data?.users.map((u: any) => (
                <tr key={u.id} className="border-t border-slate-100">
                  <td className="py-1.5 font-medium">{u.name}</td><td>{u.email}</td>
                  <td><select className="rounded border border-slate-300 px-2 py-1 text-sm" value={u.role} onChange={(e) => patchUser(u.id, { role: e.target.value })}>
                    <option>CUSTOMER</option><option>ORGANIZER</option><option>ADMIN</option></select></td>
                  <td><input type="checkbox" checked={!!u.isActive} onChange={(e) => patchUser(u.id, { isActive: e.target.checked })} /></td>
                </tr>
              ))}</tbody>
            </table></div>
          </section>

          <form onSubmit={createVenue} className={`${card} max-w-2xl space-y-3`}>
            <h2 className="text-lg font-semibold">Add a venue</h2>
            <div className="grid gap-2 sm:grid-cols-3">
              <input className={input} required placeholder="Venue name" value={v.name} onChange={setVal("name")} />
              <input className={input} required placeholder="City" value={v.city} onChange={setVal("city")} />
              <input className={input} placeholder="Address" value={v.address} onChange={setVal("address")} />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {([["rows", "Rows (1-26)"], ["seatsPerRow", "Seats per row"], ["vipPrice", "VIP price"], ["goldPrice", "Gold price"], ["silverPrice", "Silver price"]] as const).map(([k, label]) => (
                <div key={k}><label className="text-xs text-slate-500">{label}</label><input className={input} type="number" min={0} required value={(v as any)[k]} onChange={setVal(k)} /></div>
              ))}
            </div>
            <p className="text-xs text-slate-500">The first 20% of rows are VIP, the next 40% Gold and the rest Silver. A seat map document is also stored in MongoDB.</p>
            <button className={btn}>Create venue</button>
          </form>
        </div>
      )}
    </>
  );
}
