import { dbFor } from "@/lib/db";
import { getDb } from "@/lib/mongo";
import { requireRole } from "@/lib/auth";
import { handleError, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireRole("ADMIN");
    const sql = dbFor("ADMIN");

    const [totals] = await sql.query<any>(
      `SELECT (SELECT COUNT(*) FROM users) AS users,
              (SELECT COUNT(*) FROM events) AS events,
              (SELECT COUNT(*) FROM bookings WHERE status = 'CONFIRMED') AS confirmedBookings,
              (SELECT COALESCE(SUM(total_amount), 0) FROM bookings WHERE status = 'CONFIRMED') AS revenue,
              (SELECT COALESCE(SUM(refund_amount), 0) FROM cancellations) AS refunds`
    );
    const topEvents = await sql.query(
      `SELECT event_id AS eventId, title, confirmed_bookings AS bookings, gross_revenue AS revenue
       FROM v_organizer_revenue ORDER BY gross_revenue DESC LIMIT 5`
    );
    const titles = new Map((await sql.query<any>("SELECT event_id, title FROM events")).map((r) => [r.event_id as number, r.title as string]));

    // Analytics come from MongoDB aggregation pipelines
    let mostViewed: any[] = [];
    let ratings: any[] = [];
    let mongoOk = true;
    try {
      const db = await getDb();
      const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
      const views = await db.collection("activity_logs").aggregate([
        { $match: { action: "VIEW_EVENT", timestamp: { $gte: since } } },
        { $group: { _id: "$eventId", views: { $sum: 1 } } },
        { $sort: { views: -1 } },
        { $limit: 5 },
      ]).toArray();
      mostViewed = views.map((v) => ({ eventId: v._id, title: titles.get(v._id) ?? `Event ${v._id}`, views: v.views }));
      const avg = await db.collection("reviews").aggregate([
        { $group: { _id: "$eventId", avgRating: { $avg: "$rating" }, reviews: { $sum: 1 } } },
        { $sort: { avgRating: -1 } },
      ]).toArray();
      ratings = avg.map((a) => ({ eventId: a._id, title: titles.get(a._id) ?? `Event ${a._id}`, avgRating: Math.round(a.avgRating * 10) / 10, reviews: a.reviews }));
    } catch {
      mongoOk = false;
    }
    return ok({ totals, topEvents, mostViewed, ratings, mongoOk });
  } catch (err) {
    return handleError(err);
  }
}
