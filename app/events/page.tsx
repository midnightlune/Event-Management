"use client";
import Link from "next/link";
import { useState } from "react";
import { useLoad } from "@/lib/useLoad";
import { fmtDate, money } from "@/lib/api";
import { btn, CATEGORY_STYLE, ErrorMsg, input, Loading, PageTitle } from "@/components/ui";

const CATEGORIES = ["", "CONCERT", "MOVIE", "SPORTS", "THEATRE", "CONFERENCE", "OTHER"];

export default function EventsPage() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [applied, setApplied] = useState({ q: "", category: "" });
  const { data, error, loading } = useLoad<{ events: any[] }>(
    `/api/events?q=${encodeURIComponent(applied.q)}&category=${applied.category}`
  );

  return (
    <>
      <PageTitle sub="Search by title and filter by category. Seat counts are live from the database.">Upcoming events</PageTitle>
      <form className="mb-6 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); setApplied({ q, category }); }}>
        <input className={`${input} max-w-xs`} placeholder="Search events (e.g. rock)" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={`${input} max-w-[10rem]`} value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c || "All categories"}</option>)}
        </select>
        <button className={btn}>Search</button>
      </form>
      <ErrorMsg>{error}</ErrorMsg>
      {loading ? <Loading /> : data?.events.length === 0 ? <p className="text-slate-500">No events found.</p> : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {data?.events.map((e) => (
            <Link key={e.eventId} href={`/events/${e.eventId}`} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
              <div className={`bg-gradient-to-br ${CATEGORY_STYLE[e.category] ?? CATEGORY_STYLE.OTHER} px-5 py-8 text-white`}>
                <span className="rounded bg-white/25 px-2 py-0.5 text-xs font-semibold">{e.category}</span>
                <h2 className="mt-3 text-xl font-bold">{e.title}</h2>
              </div>
              <div className="space-y-1 p-4 text-sm text-slate-600">
                <p>{e.venue ? `${e.venue}, ${e.city}` : "Venue to be announced"}</p>
                <p>Next show: {fmtDate(e.nextShow)}</p>
                <p className="flex justify-between pt-1">
                  <span className="font-semibold text-slate-900">{e.minPrice != null ? `From ${money(e.minPrice)}` : "No seats yet"}</span>
                  <span>{e.seatsLeft} seats left</span>
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
