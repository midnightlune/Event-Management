import { dbFor } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { handleError, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

// Organizers see their own events; admins see everything. Numbers come from the MySQL views.
export async function GET() {
  try {
    const session = await requireRole("ORGANIZER", "ADMIN");
    const db = dbFor(session.role);
    const all = session.role === "ADMIN" ? 1 : 0;

    const events = await db.query(
      `SELECT e.event_id AS eventId, e.title, e.category, e.status,
              COALESCE(r.confirmed_bookings, 0) AS confirmedBookings, COALESCE(r.gross_revenue, 0) AS grossRevenue
       FROM events e LEFT JOIN v_organizer_revenue r ON r.event_id = e.event_id
       WHERE (? = 1 OR e.organizer_id = ?)
       ORDER BY e.event_id DESC`,
      [all, session.userId]
    );
    const shows = await db.query(
      `SELECT o.show_id AS showId, e.event_id AS eventId, o.title, o.start_time AS startTime,
              o.total_seats AS totalSeats, o.booked, o.held, o.occupancy_pct AS occupancyPct
       FROM v_show_occupancy o
       JOIN shows sh ON sh.show_id = o.show_id
       JOIN events e ON e.event_id = sh.event_id
       WHERE (? = 1 OR e.organizer_id = ?)
       ORDER BY o.start_time`,
      [all, session.userId]
    );
    return ok({ events, shows });
  } catch (err) {
    return handleError(err);
  }
}
