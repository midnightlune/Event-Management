import { ReactNode } from "react";

export const btn = "rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50";
export const btnGhost = "rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50";
export const btnDanger = "rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50";
export const input = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";
export const card = "rounded-xl border border-slate-200 bg-white p-5 shadow-sm";

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-5">
      <h1 className="text-2xl font-bold text-slate-900">{children}</h1>
      {sub && <p className="mt-1 text-sm text-slate-500">{sub}</p>}
    </div>
  );
}

export function ErrorMsg({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <div className="my-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{children}</div>;
}

export function Notice({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <div className="my-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{children}</div>;
}

export function Loading() {
  return <p className="py-10 text-center text-sm text-slate-500">Loading...</p>;
}

const BADGE: Record<string, string> = {
  CONFIRMED: "bg-green-100 text-green-800",
  PENDING: "bg-amber-100 text-amber-800",
  CANCELLED: "bg-red-100 text-red-800",
  EXPIRED: "bg-slate-200 text-slate-700",
  PUBLISHED: "bg-green-100 text-green-800",
  DRAFT: "bg-slate-200 text-slate-700",
};
export function StatusBadge({ status }: { status: string }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${BADGE[status] ?? "bg-slate-100 text-slate-700"}`}>{status}</span>;
}

export const CATEGORY_STYLE: Record<string, string> = {
  CONCERT: "from-fuchsia-500 to-indigo-600",
  MOVIE: "from-rose-500 to-orange-500",
  SPORTS: "from-emerald-500 to-teal-600",
  THEATRE: "from-amber-500 to-red-500",
  CONFERENCE: "from-sky-500 to-blue-700",
  OTHER: "from-slate-500 to-slate-700",
};
