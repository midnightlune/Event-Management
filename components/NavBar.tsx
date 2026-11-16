import Link from "next/link";
import { getSession } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";

export default async function NavBar() {
  const session = await getSession();
  const link = "rounded px-2 py-1 text-sm hover:bg-white/10";
  return (
    <header className="bg-indigo-700 text-white">
      <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3">
        <Link href="/events" className="mr-4 text-lg font-bold">TicketHub</Link>
        <Link href="/events" className={link}>Events</Link>
        {session && <Link href="/my-bookings" className={link}>My bookings</Link>}
        {(session?.role === "ORGANIZER" || session?.role === "ADMIN") && <Link href="/organizer" className={link}>Organizer</Link>}
        {session?.role === "ADMIN" && <Link href="/admin" className={link}>Admin</Link>}
        <div className="ml-auto flex items-center gap-3">
          {session ? (
            <>
              <span className="text-sm">{session.name} <span className="rounded bg-white/20 px-1.5 py-0.5 text-xs">{session.role}</span></span>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/login" className={link}>Log in</Link>
              <Link href="/register" className="rounded-md bg-white px-3 py-1 text-sm font-medium text-indigo-700">Sign up</Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
