"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLoad } from "@/lib/useLoad";
import { api, fmtDate, money } from "@/lib/api";
import { btn, ErrorMsg, Loading, PageTitle } from "@/components/ui";

const TIER: Record<string, string> = {
  VIP: "bg-amber-400 hover:bg-amber-500 border-amber-500",
  GOLD: "bg-yellow-200 hover:bg-yellow-300 border-yellow-400",
  SILVER: "bg-slate-200 hover:bg-slate-300 border-slate-400",
  PREMIUM: "bg-purple-300 hover:bg-purple-400 border-purple-400",
  STANDARD: "bg-teal-200 hover:bg-teal-300 border-teal-400",
};
const MAX_SEATS = 8;

export default function SeatPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { data, error, loading, reload } = useLoad<any>(`/api/shows/${params.id}/seats`);
  const [picked, setPicked] = useState<number[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => {
    const map = new Map<string, any[]>();
    (data?.seats ?? []).forEach((s: any) => map.set(s.rowLabel, [...(map.get(s.rowLabel) ?? []), s]));
    return Array.from(map.entries());
  }, [data]);
  const aisles = useMemo(() => {
    const m = new Map<string, number[]>();
    (data?.layout?.rows ?? []).forEach((r: any) => m.set(r.label, r.aisleAfter ?? []));
    return m;
  }, [data]);

  if (loading) return <Loading />;
  if (error || !data) return <ErrorMsg>{error ?? "Show not found."}</ErrorMsg>;

  const byId = new Map<number, any>(data.seats.map((s: any) => [s.id, s]));
  const chosen = picked.map((id) => byId.get(id)).filter(Boolean);
  const total = chosen.reduce((sum: number, s: any) => sum + s.price, 0);
  const tiers = Array.from(new Map<string, number>(data.seats.map((s: any) => [s.category, s.price])).entries());

  function toggle(seat: any) {
    if (seat.status !== "AVAILABLE") return;
    setMsg("");
    setPicked((p) => p.includes(seat.id) ? p.filter((x) => x !== seat.id) : p.length >= MAX_SEATS ? (setMsg(`You can pick at most ${MAX_SEATS} seats.`), p) : [...p, seat.id]);
  }

  async function hold() {
    setBusy(true); setMsg("");
    try {
      const res = await api<{ bookingId: number }>("/api/bookings", { body: { showId: Number(params.id), showSeatIds: picked } });
      router.push(`/checkout/${res.bookingId}`);
    } catch (e: any) {
      setMsg(e.message);
      setPicked([]);
      reload(); // someone may have taken a seat: show the fresh availability
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageTitle sub={`${fmtDate(data.show.startTime)} \u00b7 ${data.show.venue}, ${data.show.city}`}>{data.show.title}</PageTitle>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2">
          <div className="mx-auto mb-6 w-2/3 rounded-b-3xl bg-slate-800 py-2 text-center text-xs font-semibold tracking-widest text-white">{data.layout?.stageLabel ?? "STAGE"}</div>
          <div className="space-y-2">
            {rows.map(([label, seats]) => (
              <div key={label} className="flex items-center justify-center gap-1.5">
                <span className="w-5 text-center text-xs font-semibold text-slate-500">{label}</span>
                {seats.map((s: any) => {
                  const mine = picked.includes(s.id);
                  const free = s.status === "AVAILABLE";
                  return (
                    <span key={s.id} className="flex">
                      <button
                        onClick={() => toggle(s)}
                        disabled={!free}
                        title={`${label}${s.num} \u00b7 ${s.category} \u00b7 ${money(s.price)}${free ? "" : " \u00b7 " + s.status.toLowerCase()}`}
                        className={`h-8 w-8 rounded-t-lg border text-[10px] font-semibold transition ${
                          mine ? "border-green-700 bg-green-600 text-white"
                          : free ? `${TIER[s.category] ?? "bg-slate-200 border-slate-400"} text-slate-800`
                          : "cursor-not-allowed border-slate-300 bg-slate-300 text-slate-400 line-through"}`}
                      >{s.num}</button>
                      {(aisles.get(label) ?? []).includes(s.num) && <span className="w-4" />}
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-3 text-xs text-slate-600">
            {tiers.map(([name, price]) => (
              <span key={name} className="flex items-center gap-1"><i className={`inline-block h-3 w-3 rounded border ${TIER[name] ?? "bg-slate-200"}`} />{name} {money(price)}</span>
            ))}
            <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded border border-green-700 bg-green-600" />Your selection</span>
            <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded border border-slate-300 bg-slate-300" />Taken / on hold</span>
          </div>
        </div>

        <aside className="h-fit rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Your selection</h2>
          {chosen.length === 0 ? <p className="mt-2 text-sm text-slate-500">Click seats to select them (up to {MAX_SEATS}).</p> : (
            <ul className="mt-2 space-y-1 text-sm">
              {chosen.map((s: any) => <li key={s.id} className="flex justify-between"><span>{s.rowLabel}{s.num} <span className="text-slate-500">({s.category})</span></span><span>{money(s.price)}</span></li>)}
              <li className="flex justify-between border-t border-slate-200 pt-2 font-semibold"><span>Total</span><span>{money(total)}</span></li>
            </ul>
          )}
          <ErrorMsg>{msg}</ErrorMsg>
          <button className={`${btn} mt-4 w-full`} disabled={busy || picked.length === 0} onClick={hold}>{busy ? "Holding seats..." : "Hold seats for 10 minutes"}</button>
          <p className="mt-2 text-xs text-slate-500">Seats are held while you pay. Unpaid holds are released automatically.</p>
        </aside>
      </div>
    </>
  );
}
