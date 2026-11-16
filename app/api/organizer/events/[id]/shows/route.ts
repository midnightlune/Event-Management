import { ResultSetHeader } from "mysql2/promise";
import { dbFor } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { handleError, HttpError, idParam, ok, readJson } from "@/lib/http";
import { showSchema, toMysqlDateTime } from "@/lib/validation";

export const dynamic = "force-dynamic";

// POST /api/organizer/events/:id/shows -> adds another show (date/venue) to an event the organizer owns
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole("ORGANIZER", "ADMIN");
    const eventId = idParam(params.id);
    const db = dbFor(session.role);
    const input = showSchema.parse(await readJson(req));
    const start = toMysqlDateTime(input.startTime);
    const end = toMysqlDateTime(input.endTime);
    if (end <= start) throw new HttpError(400, "The show must end after it starts.");

    const [event] = await db.query<any>("SELECT organizer_id AS organizerId FROM events WHERE event_id = ?", [eventId]);
    if (!event) throw new HttpError(404, "Event not found.");
    if (session.role !== "ADMIN" && event.organizerId !== session.userId) throw new HttpError(403, "You can only add shows to your own events.");

    try {
      const showId = await db.withTransaction(async (conn) => {
        const [s] = await conn.query<ResultSetHeader>(
          "INSERT INTO shows (event_id, venue_id, start_time, end_time) VALUES (?, ?, ?, ?)",
          [eventId, input.venueId, start, end]
        );
        await conn.query("CALL generate_show_seats(?)", [s.insertId]);
        return s.insertId;
      });
      return ok({ showId }, 201);
    } catch (err: any) {
      if (err?.errno === 1062) throw new HttpError(409, "That venue already has a show at this start time.");
      throw err;
    }
  } catch (err) {
    return handleError(err);
  }
}
