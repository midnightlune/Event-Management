import { dbFor } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/mongo";
import { handleError, HttpError, idParam, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const showId = idParam(params.id);
    const session = await getSession();
    const sql = dbFor(session?.role);
    const [show] = await sql.query<any>(
      `SELECT sh.show_id AS showId, sh.start_time AS startTime, sh.status, e.event_id AS eventId, e.title,
              v.venue_id AS venueId, v.name AS venue, v.city
       FROM shows sh JOIN events e ON e.event_id = sh.event_id JOIN venues v ON v.venue_id = sh.venue_id
       WHERE sh.show_id = ? AND e.status = 'PUBLISHED'`,
      [showId]
    );
    if (!show) throw new HttpError(404, "Show not found.");

    // Seat availability is the source of truth in MySQL
    const seats = await sql.query(
      `SELECT ss.show_seat_id AS id, s.row_label AS rowLabel, s.seat_number AS num, c.name AS category, ss.price, ss.status
       FROM show_seats ss
       JOIN seats s ON s.seat_id = ss.seat_id
       JOIN seat_categories c ON c.category_id = s.category_id
       WHERE ss.show_id = ? ORDER BY s.row_label, s.seat_number`,
      [showId]
    );

    // The drawing hints (stage label, aisles) come from the seat map document in MongoDB
    let layout: any = null;
    try {
      const db = await getDb();
      layout = await db.collection("seat_maps").findOne({ venueId: show.venueId }, { projection: { _id: 0 } });
    } catch {
      /* fall back to a plain grid */
    }
    return ok({ show, seats, layout });
  } catch (err) {
    return handleError(err);
  }
}
