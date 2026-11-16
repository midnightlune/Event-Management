import { ResultSetHeader } from "mysql2/promise";
import { dbFor } from "@/lib/db";
import { getDb } from "@/lib/mongo";
import { requireRole } from "@/lib/auth";
import { handleError, HttpError, ok, readJson } from "@/lib/http";
import { eventSchema, toMysqlDateTime } from "@/lib/validation";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

// POST /api/organizer/events -> creates the event + first show + the show's seat inventory (one MySQL transaction),
// then stores the rich description in MongoDB and links it through events.mongo_doc_id.
export async function POST(req: Request) {
  try {
    const session = await requireRole("ORGANIZER", "ADMIN");
    const sql = dbFor(session.role);
    const input = eventSchema.parse(await readJson(req));
    const start = toMysqlDateTime(input.startTime);
    const end = toMysqlDateTime(input.endTime);
    if (end <= start) throw new HttpError(400, "The show must end after it starts.");

    const [venue] = await sql.query("SELECT venue_id FROM venues WHERE venue_id = ?", [input.venueId]);
    if (!venue) throw new HttpError(400, "Unknown venue.");

    let ids: { eventId: number; showId: number };
    try {
      ids = await sql.withTransaction(async (conn) => {
        const [e] = await conn.query<ResultSetHeader>(
          "INSERT INTO events (organizer_id, title, category, status) VALUES (?, ?, ?, 'PUBLISHED')",
          [session.userId, input.title, input.category]
        );
        const [s] = await conn.query<ResultSetHeader>(
          "INSERT INTO shows (event_id, venue_id, start_time, end_time) VALUES (?, ?, ?, ?)",
          [e.insertId, input.venueId, start, end]
        );
        await conn.query("CALL generate_show_seats(?)", [s.insertId]);
        return { eventId: e.insertId, showId: s.insertId };
      });
    } catch (err: any) {
      if (err?.errno === 1062) throw new HttpError(409, "That venue already has a show at this start time.");
      throw err;
    }

    try {
      const db = await getDb();
      const r = await db.collection("event_details").insertOne({
        eventId: ids.eventId, description: input.description, tags: input.tags, lineup: [], faqs: [], media: {},
      });
      await sql.pool.query("UPDATE events SET mongo_doc_id = ? WHERE event_id = ?", [r.insertedId.toHexString(), ids.eventId]);
    } catch {
      /* the event exists even if the optional description could not be stored */
    }
    logActivity({ userId: session.userId, action: "EVENT_CREATED", eventId: ids.eventId });
    return ok(ids, 201);
  } catch (err) {
    return handleError(err);
  }
}
