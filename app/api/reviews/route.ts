import { dbFor } from "@/lib/db";
import { getDb } from "@/lib/mongo";
import { requireRole } from "@/lib/auth";
import { handleError, HttpError, ok, readJson } from "@/lib/http";
import { reviewSchema } from "@/lib/validation";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

// POST /api/reviews { eventId, rating, comment } - stored in MongoDB, one review per user per event.
// The "has this customer really booked?" rule is checked against MySQL.
export async function POST(req: Request) {
  try {
    const session = await requireRole("CUSTOMER");
    const input = reviewSchema.parse(await readJson(req));

    const [booked] = await dbFor(session.role).query(
      `SELECT 1 AS x FROM bookings b JOIN shows sh ON sh.show_id = b.show_id
       WHERE b.user_id = ? AND sh.event_id = ? AND b.status = 'CONFIRMED' LIMIT 1`,
      [session.userId, input.eventId]
    );
    if (!booked) throw new HttpError(403, "Only customers with a confirmed booking for this event can review it.");

    const db = await getDb();
    await db.collection("reviews").updateOne(
      { eventId: input.eventId, userId: session.userId },
      { $set: { rating: input.rating, comment: input.comment, userName: session.name, createdAt: new Date() } },
      { upsert: true }
    );
    logActivity({ userId: session.userId, action: "REVIEW", eventId: input.eventId });
    return ok({ ok: true }, 201);
  } catch (err) {
    return handleError(err);
  }
}
