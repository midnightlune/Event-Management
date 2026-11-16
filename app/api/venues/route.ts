import { dbFor } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { handleError, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireRole("ORGANIZER", "ADMIN");
    const venues = await dbFor(session.role).query(
      `SELECT v.venue_id AS id, v.name, v.city, v.capacity FROM venues v ORDER BY v.city, v.name`
    );
    return ok({ venues });
  } catch (err) {
    return handleError(err);
  }
}
