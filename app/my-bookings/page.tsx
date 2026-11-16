"use client";
import Link from "next/link";
import { useState } from "react";
import { useLoad } from "@/lib/useLoad";
import { api, fmtDate, money } from "@/lib/api";
import { btn, btnDanger, card, ErrorMsg, Loading, Notice, PageTitle, StatusBadge } from "@/components/ui";

export default function MyBookingsPage() {
  const { data, error, loading, reload } = useLoad<{ bookings: any[] }>("/api/bookings");
  const [msg, setMsg] = useState({ error: "", ok: "" });

  async function cancel(b: any) {
    const warn = b.status === "CONFIRMED" ? "Cancel this booking? Refund is 100% if the show is more than 24 hours away, otherwise 50%." : "Release these held seats?";
    if (!window.confirm(warn)) return;
    setMsg({ error: "", ok: "" });
    try {
      const r = await api<{ refund: number }>(`/api/bookings/${b.bookingId}/cancel`, { body: {} });
      setMsg({ error: "", ok: r.refund > 0 ? `Booking #${b.bookingId} cancelled. Refund of ${money(r.refund)} recorded.` : `Booking #${b.bookingId} cancelled.` });
    } catch (e: any) {
      setMsg({ error: e.message, ok: "" });
    }
    reload();
  }

  return (
    <>
      <PageTitle sub="Your tickets, holds and past bookings.">My bookings</PageTitle>
      <ErrorMsg>{error || msg.error}</ErrorMsg><Notice>{msg.ok}</Notice>
      {loading ? <Loading /> : data?.bookings.length === 0 ? (
        <p className="text-slate-500">No bookings yet. <Link className="text-indigo-700 underline" href="/events">Browse events</Link>.</p>
      ) : (
        <div className="space-y-4">
          {data?.bookings.map((b) => (
            <div key={b.bookingId} className={`${card} flex flex-wrap items-center justify-between gap-4`}>
              <div>
                <p className="font-semibold">{b.title} <span className="ml-2 align-middle"><StatusBadge status={b.status} /></span></p>
                <p className="text-sm text-slate-600">{fmtDate(b.startTime)} &middot; {b.venue}</p>
                <p className="text-sm text-slate-600">Booking #{b.bookingId} &middot; {b.seatCount} seat{b.seatCount > 1 ? "s" : ""}: {b.seats} &middot; {money(b.total)}</p>
              </div>
              <div className="flex gap-2">
                {b.status === "PENDING" && b.secondsLeft > 0 && <Link href={`/checkout/${b.bookingId}`} className={btn}>Pay now</Link>}
                {(b.status === "CONFIRMED" || (b.status === "PENDING" && b.secondsLeft > 0)) && <button className={btnDanger} onClick={() => cancel(b)}>Cancel</button>}
                {b.status !== "PENDING" && <Link href={`/checkout/${b.bookingId}`} className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100">Details</Link>}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
