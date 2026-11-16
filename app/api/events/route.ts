import { dbFor } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { handleError, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

// GET /api/events?q=rock&category=CONCERT  -> published events with next show, price and seats left
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim().slice(0, 60);
    const category = url.searchParams.get("category") ?? "";

    const where: string[] = ["e.status = 'PUBLISHED'"];
    const params: unknown[] = [];

    // FULLTEXT search (prefix match on each word) with a LIKE fallback for very short words
    const words = q.replace(/[+\-<>()~*"@]/g, " ").split(/\s+/).filter(Boolean);
    if (words.length) {
      where.push("(MATCH(e.title) AGAINST(? IN BOOLEAN MODE) OR e.title LIKE ?)");
      params.push(words.map((w) => `+${w}*`).join(" "), `%${words.join("%")}%`);
    }
    if (["CONCERT", "MOVIE", "SPORTS", "THEATRE", "CONFERENCE", "OTHER"].includes(category)) {
      where.push("e.category = ?");
      params.push(category);
    }

    const session = await getSession(); // not logged in -> GUEST database account
    const rows = await dbFor(session?.role).query(
      `SELECT e.event_id AS eventId, e.title, e.category,
              MIN(sh.start_time) AS nextShow,
              MIN(v.name) AS venue, MIN(v.city) AS city,
              COUNT(sh.show_id) AS showCount,
              COALESCE(SUM(fn_available_seats(sh.show_id)), 0) AS seatsLeft,
              (SELECT MIN(ss.price) FROM show_seats ss JOIN shows s2 ON s2.show_id = ss.show_id
                WHERE s2.event_id = e.event_id) AS minPrice
       FROM events e
       LEFT JOIN shows sh ON sh.event_id = e.event_id AND sh.status = 'SCHEDULED'
       LEFT JOIN venues v ON v.venue_id = sh.venue_id
       WHERE ${where.join(" AND ")}
       GROUP BY e.event_id, e.title, e.category
       ORDER BY nextShow IS NULL, nextShow`,
      params
    );
    return ok({ events: rows });
  } catch (err) {
    return handleError(err);
  }
}
