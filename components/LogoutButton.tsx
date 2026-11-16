"use client";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function LogoutButton() {
  const router = useRouter();
  return (
    <button
      className="rounded-md border border-white/40 px-3 py-1 text-sm hover:bg-white/10"
      onClick={async () => {
        await api("/api/auth/logout", { method: "POST", body: {} });
        router.push("/login");
        router.refresh();
      }}
    >
      Log out
    </button>
  );
}
