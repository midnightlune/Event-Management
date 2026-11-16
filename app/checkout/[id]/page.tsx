"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLoad } from "@/lib/useLoad";
import { api, fmtDate, money } from "@/lib/api";
import { btn, btnDanger, card, ErrorMsg, input, Loading, Notice, PageTitle, StatusBadge } from "@/components/ui";

export default function CheckoutPage({ params }: { params: { id: string } }) {
  const { data, error, loading, reload } = useLoad<any>(`/api/bookings/${params.id}`);
  const [left, setLeft] = useState<number | null>(null);
  const [method, setMethod] = useState("UPI");
  const [msg, setMsg] = useState({ error: "", ok: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => { setLeft(data?.booking.status === "PENDING" ? data.booking.secondsLeft : null); }, [data]);
  useEffect(() => {
    if (left === null || left <= 0) return;
    const t = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  if (loading) return <Loading />;
  if (error || !data) return <ErrorMsg>{error ?? "Booking not found."}</ErrorMsg>;
  const { booking, seats, refund } = data;
  const expired = booking.status === "PENDING" && left !== null && left <= 0;
  const mm = left !== null ? String(Math.floor(left / 60)).padStart(2, "0") : "";
  const ss = left !== null ? String(left % 60).padStart(2, "0") : "";

  async function act(path: string, body: unknown, okText: string) {
    setBusy(true); setMsg({ error: "", ok: "" });
    try {
      await api(`/api/bookings/${params.id}/${path}`, { body });
      setMsg({ error: "", ok: okText });
    } catch (e: any) {
      setMsg({ error: e.message, ok: "" });
    } finally {
      setBusy(false);
      reload();
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle sub={`Booking #${booking.bookingId}`}>Checkout</PageTitle>
      <div className={card}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">{booking.title}</h2>
            <p className="text-sm text-slate-600">{fmtDate(booking.startTime)} &middot; {booking.venue}, {booking.city}</p>
          </div>
          <StatusBadge status={booking.status} />
        </div>
        <ul className="mt-4 divide-y divide-slate-100 text-sm">
          {seats.map((s: any) => (
            <li key={`${s.rowLabel}${s.num}`} className="flex justify-between py-1.5"><span>Seat {s.rowLabel}{s.num} <span className="text-slate-500">({s.category})</span></span><span>{money(s.price)}</span></li>
          ))}
          <li className="flex justify-between py-2 font-semibold"><span>Total</span><span>{money(booking.total)}</span></li>
        </ul>

        {booking.status === "PENDING" && !expired && (
          <>
            <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">Your seats are held for <b>{mm}:{ss}</b>. Pay before the timer ends or they will be released.</p>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <div><label className="mb-1 block text-sm font-medium">Payment method</label>
                <select className={input} value={method} onChange={(e) => setMethod(e.target.value)}>
                  <option value="UPI">UPI</option><option value="CARD">Credit / debit card</option>
                  <option value="NETBANKING">Net banking</option><option value="WALLET">Wallet</option>
                </select></div>
              <button className={btn} disabled={busy} onClick={() => act("pay", { method }, "Payment successful. Your booking is confirmed!")}>Pay {money(booking.total)}</button>
              <button className={btnDanger} disabled={busy} onClick={() => act("cancel", {}, "Hold released.")}>Release seats</button>
            </div>
            <p className="mt-2 text-xs text-slate-500">Payments are simulated in this project; no real money is charged.</p>
          </>
        )}
        {expired && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">Your hold has expired and the seats are being released. <Link className="underline" href="/events">Choose seats again</Link>.</p>}
        {booking.status === "CONFIRMED" && <Notice>Booking confirmed. Show this booking number at the venue entrance.</Notice>}
        {booking.status === "CANCELLED" && refund != null && <Notice>Booking cancelled. Refund of {money(refund)} recorded.</Notice>}
        {booking.status === "EXPIRED" && <p className="mt-3 text-sm text-slate-600">This hold expired. <Link className="text-indigo-700 underline" href="/events">Browse events</Link> to book again.</p>}
        <ErrorMsg>{msg.error}</ErrorMsg>
        {msg.ok && booking.status !== "CONFIRMED" && <Notice>{msg.ok}</Notice>}
      </div>
      <p className="mt-4 text-sm"><Link className="text-indigo-700 underline" href="/my-bookings">Go to my bookings</Link></p>
    </div>
  );
}
