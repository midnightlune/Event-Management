"use client";
import Link from "next/link";
import { useState } from "react";
import { useLoad } from "@/lib/useLoad";
import { api, fmtDate, money } from "@/lib/api";
import { btn, card, CATEGORY_STYLE, ErrorMsg, input, Loading, Notice } from "@/components/ui";

export default function EventDetailPage({ params }: { params: { id: string } }) {
  const { data, error, loading, reload } = useLoad<any>(`/api/events/${params.id}`);
  const me = useLoad<{ user: { role: string } | null }>("/api/auth/me");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [msg, setMsg] = useState({ error: "", ok: "" });

  async function submitReview(e: React.FormEvent) {
    e.preventDefault();
    setMsg({ error: "", ok: "" });
    try {
      await api("/api/reviews", { body: { eventId: Number(params.id), rating, comment } });
      setComment("");
      setMsg({ error: "", ok: "Thanks! Your review has been saved." });
      reload();
    } catch (err: any) {
      setMsg({ error: err.message, ok: "" });
    }
  }

  if (loading) return <Loading />;
  if (error || !data) return <ErrorMsg>{error ?? "Event not found."}</ErrorMsg>;
  const { event, shows, details, reviews, rating: stats } = data;
  const isCustomer = me.data?.user?.role === "CUSTOMER";

  return (
    <>
      <div className={`rounded-xl bg-gradient-to-br ${CATEGORY_STYLE[event.category] ?? CATEGORY_STYLE.OTHER} p-8 text-white`}>
        <span className="rounded bg-white/25 px-2 py-0.5 text-xs font-semibold">{event.category}</span>
        <h1 className="mt-3 text-3xl font-bold">{event.title}</h1>
        <p className="mt-1 text-sm text-white/90">
          Organized by {event.organizer}
          {stats.count > 0 && <> &middot; {stats.average} / 5 from {stats.count} review{stats.count > 1 ? "s" : ""}</>}
        </p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className={card}>
            <h2 className="mb-2 text-lg font-semibold">About this event</h2>
            {details ? (
              <>
                <p className="text-sm text-slate-700">{details.description}</p>
                {details.lineup?.length > 0 && (
                  <>
                    <h3 className="mt-4 text-sm font-semibold">Line-up</h3>
                    <ul className="mt-1 text-sm text-slate-700">{details.lineup.map((l: any, i: number) => <li key={i}>{l.slot} &ndash; {l.artist}</li>)}</ul>
                  </>
                )}
                {details.faqs?.length > 0 && (
                  <>
                    <h3 className="mt-4 text-sm font-semibold">FAQs</h3>
                    {details.faqs.map((f: any, i: number) => <p key={i} className="text-sm text-slate-700"><b>{f.q}</b> {f.a}</p>)}
                  </>
                )}
                {details.tags?.length > 0 && <div className="mt-4 flex flex-wrap gap-1">{details.tags.map((t: string) => <span key={t} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">#{t}</span>)}</div>}
              </>
            ) : <p className="text-sm text-slate-500">{data.mongoOk ? "No description has been added yet." : "Event description is temporarily unavailable."}</p>}
          </section>

          <section className={card}>
            <h2 className="mb-3 text-lg font-semibold">Reviews</h2>
            {reviews.length === 0 && <p className="text-sm text-slate-500">No reviews yet.</p>}
            <div className="space-y-3">
              {reviews.map((r: any, i: number) => (
                <div key={i} className="border-b border-slate-100 pb-2 text-sm last:border-0">
                  <p className="font-medium">{r.userName} <span className="text-amber-600">{"\u2605".repeat(r.rating)}{"\u2606".repeat(5 - r.rating)}</span></p>
                  <p className="text-slate-700">{r.comment}</p>
                </div>
              ))}
            </div>
            {isCustomer && (
              <form onSubmit={submitReview} className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                <h3 className="text-sm font-semibold">Write a review</h3>
                <p className="text-xs text-slate-500">Only customers with a confirmed booking for this event can review it.</p>
                <select className={`${input} max-w-[8rem]`} value={rating} onChange={(e) => setRating(Number(e.target.value))}>
                  {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} star{n > 1 ? "s" : ""}</option>)}
                </select>
                <textarea className={input} rows={3} required minLength={3} maxLength={500} placeholder="How was it?" value={comment} onChange={(e) => setComment(e.target.value)} />
                <ErrorMsg>{msg.error}</ErrorMsg><Notice>{msg.ok}</Notice>
                <button className={btn}>Submit review</button>
              </form>
            )}
          </section>
        </div>

        <aside className="space-y-3">
          <h2 className="text-lg font-semibold">Shows</h2>
          {shows.length === 0 && <p className="text-sm text-slate-500">No shows scheduled.</p>}
          {shows.map((s: any) => (
            <div key={s.showId} className={card}>
              <p className="font-semibold">{fmtDate(s.startTime)}</p>
              <p className="text-sm text-slate-600">{s.venue}, {s.city}</p>
              <p className="mt-1 text-sm text-slate-600">{s.seatsLeft} seats left{s.minPrice != null && <> &middot; from {money(s.minPrice)}</>}</p>
              {s.status === "SCHEDULED" && s.seatsLeft > 0
                ? <Link href={`/shows/${s.showId}/seats`} className={`${btn} mt-3 inline-block`}>Select seats</Link>
                : <p className="mt-3 text-sm font-medium text-red-600">{s.status !== "SCHEDULED" ? s.status : "Sold out"}</p>}
            </div>
          ))}
        </aside>
      </div>
    </>
  );
}
