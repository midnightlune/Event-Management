"use client";
import { useState } from "react";
import { useLoad } from "@/lib/useLoad";
import { api, fmtDate, money } from "@/lib/api";
import { btn, card, ErrorMsg, input, Loading, Notice, PageTitle, StatusBadge } from "@/components/ui";

const CATEGORIES = ["CONCERT", "MOVIE", "SPORTS", "THEATRE", "CONFERENCE", "OTHER"];

export default function OrganizerPage() {
  const dash = useLoad<any>("/api/organizer/dashboard");
  const venues = useLoad<any>("/api/venues");
  const [f, setF] = useState({ title: "", category: "CONCERT", description: "", tags: "", venueId: "", startTime: "", endTime: "" });
  const [s, setS] = useState({ eventId: "", venueId: "", startTime: "", endTime: "" });
  const [msg, setMsg] = useState({ error: "", ok: "" });

  const set = (k: string) => (e: React.ChangeEvent<any>) => setF({ ...f, [k]: e.target.value });
  const setShow = (k: string) => (e: React.ChangeEvent<any>) => setS({ ...s, [k]: e.target.value });

  async function createEvent(e: React.FormEvent) {
    e.preventDefault();
    setMsg({ error: "", ok: "" });
    try {
      await api("/api/organizer/events", {
        body: { ...f, venueId: Number(f.venueId), tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean) },
      });
      setMsg({ error: "", ok: "Event published. Seat inventory was created for the first show." });
      setF({ title: "", category: "CONCERT", description: "", tags: "", venueId: "", startTime: "", endTime: "" });
      dash.reload();
    } catch (err: any) { setMsg({ error: err.message, ok: "" }); }
  }

  async function addShow(e: React.FormEvent) {
    e.preventDefault();
    setMsg({ error: "", ok: "" });
    try {
      await api(`/api/organizer/events/${s.eventId}/shows`, { body: { venueId: Number(s.venueId), startTime: s.startTime, endTime: s.endTime } });
      setMsg({ error: "", ok: "Show added." });
      setS({ eventId: "", venueId: "", startTime: "", endTime: "" });
      dash.reload();
    } catch (err: any) { setMsg({ error: err.message, ok: "" }); }
  }

  const venueOptions = (venues.data?.venues ?? []).map((v: any) => <option key={v.id} value={v.id}>{v.name}, {v.city} ({v.capacity} seats)</option>);

  return (
    <>
      <PageTitle sub="Sales and occupancy come from the v_organizer_revenue and v_show_occupancy views.">Organizer dashboard</PageTitle>
      <ErrorMsg>{dash.error || msg.error}</ErrorMsg><Notice>{msg.ok}</Notice>
      {dash.loading ? <Loading /> : (
        <div className="space-y-6">
          <section className={card}>
            <h2 className="mb-3 text-lg font-semibold">Revenue by event</h2>
            <div className="overflow-x-auto"><table className="w-full text-left text-sm">
              <thead className="text-slate-500"><tr><th className="py-1">Event</th><th>Category</th><th>Status</th><th className="text-right">Confirmed bookings</th><th className="text-right">Gross revenue</th></tr></thead>
              <tbody>{dash.data?.events.map((e: any) => (
                <tr key={e.eventId} className="border-t border-slate-100"><td className="py-1.5 font-medium">{e.title}</td><td>{e.category}</td><td><StatusBadge status={e.status} /></td><td className="text-right">{e.confirmedBookings}</td><td className="text-right">{money(e.grossRevenue)}</td></tr>
              ))}</tbody>
            </table></div>
          </section>

          <section className={card}>
            <h2 className="mb-3 text-lg font-semibold">Show occupancy</h2>
            <div className="space-y-3">
              {dash.data?.shows.map((o: any) => (
                <div key={o.showId} className="text-sm">
                  <div className="flex justify-between"><span><b>{o.title}</b> &middot; {fmtDate(o.startTime)}</span><span>{o.booked} booked, {o.held} held of {o.totalSeats} ({o.occupancyPct}%)</span></div>
                  <div className="mt-1 h-2.5 overflow-hidden rounded bg-slate-200"><div className="h-full bg-indigo-600" style={{ width: `${Math.min(100, o.occupancyPct)}%` }} /></div>
                </div>
              ))}
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <form onSubmit={createEvent} className={`${card} space-y-3`}>
              <h2 className="text-lg font-semibold">Create an event</h2>
              <input className={input} required minLength={3} placeholder="Event title" value={f.title} onChange={set("title")} />
              <select className={input} value={f.category} onChange={set("category")}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
              <textarea className={input} required minLength={10} rows={3} placeholder="Description (stored in MongoDB)" value={f.description} onChange={set("description")} />
              <input className={input} placeholder="Tags, comma separated" value={f.tags} onChange={set("tags")} />
              <select className={input} required value={f.venueId} onChange={set("venueId")}><option value="">Select venue</option>{venueOptions}</select>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs text-slate-500">Starts</label><input className={input} type="datetime-local" required value={f.startTime} onChange={set("startTime")} /></div>
                <div><label className="text-xs text-slate-500">Ends</label><input className={input} type="datetime-local" required value={f.endTime} onChange={set("endTime")} /></div>
              </div>
              <button className={btn}>Publish event</button>
            </form>

            <form onSubmit={addShow} className={`${card} h-fit space-y-3`}>
              <h2 className="text-lg font-semibold">Add another show</h2>
              <select className={input} required value={s.eventId} onChange={setShow("eventId")}><option value="">Select event</option>{dash.data?.events.map((e: any) => <option key={e.eventId} value={e.eventId}>{e.title}</option>)}</select>
              <select className={input} required value={s.venueId} onChange={setShow("venueId")}><option value="">Select venue</option>{venueOptions}</select>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs text-slate-500">Starts</label><input className={input} type="datetime-local" required value={s.startTime} onChange={setShow("startTime")} /></div>
                <div><label className="text-xs text-slate-500">Ends</label><input className={input} type="datetime-local" required value={s.endTime} onChange={setShow("endTime")} /></div>
              </div>
              <button className={btn}>Add show</button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
