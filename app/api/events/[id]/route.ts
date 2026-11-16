import { dbFor } from "@/lib/db";
import { getDb } from "@/lib/mongo";
import { getSession } from "@/lib/auth";
import { handleError, HttpError, idParam, ok } from "@/lib/http";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const id = idParam(params.id);
    const session = await getSession();
    const sql = dbFor(session?.role);

    const [event] = await sql.query<any>(
      `SELECT e.event_id AS eventId, e.title, e.category, e.status, e.organizer_id AS organizerId, u.full_name AS organizer
       FROM events e JOIN users u ON u.user_id = e.organizer_id WHERE e.event_id = ?`,
      [id]
    );
    const canSeeDraft = session && (session.role === "ADMIN" || session.userId === event?.organizerId);
    if (!event || (event.status !== "PUBLISHED" && !canSeeDraft)) throw new HttpError(404, "Event not found.");

    const shows = await sql.query(
      `SELECT sh.show_id AS showId, sh.start_time AS startTime, sh.end_time AS endTime, sh.status,
              v.name AS venue, v.city, fn_available_seats(sh.show_id) AS seatsLeft,
              (SELECT MIN(price) FROM show_seats WHERE show_id = sh.show_id) AS minPrice
       FROM shows sh JOIN venues v ON v.venue_id = sh.venue_id
       WHERE sh.event_id = ? ORDER BY sh.start_time`,
      [id]
    );

    // Flexible content lives in MongoDB. If MongoDB is down the page still works.
    let details: any = null;
    let reviews: any[] = [];
    let rating = { average: 0, count: 0 };
    let mongoOk = true;
    try {
      const db = await getDb();
      details = await db.collection("event_details").findOne({ eventId: id }, { projection: { _id: 0 } });
      reviews = await db.collection("reviews").find({ eventId: id }, { projection: { _id: 0 } }).sort({ createdAt: -1 }).limit(10).toArray();
      const agg = await db
        .collection("reviews")
        .aggregate([{ $match: { eventId: id } }, { $group: { _id: "$eventId", avg: { $avg: "$rating" }, n: { $sum: 1 } } }])
        .toArray();
      if (agg[0]) rating = { average: Math.round(agg[0].avg * 10) / 10, count: agg[0].n };
    } catch {
      mongoOk = false;
    }

    logActivity({ userId: session?.userId ?? null, action: "VIEW_EVENT", eventId: id });
    return ok({ event, shows, details, reviews, rating, mongoOk });
  } catch (err) {
    return handleError(err);
  }
}
