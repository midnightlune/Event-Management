import { dbFor } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { handleError, HttpError, idParam, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole();
    const id = idParam(params.id);
    const db = dbFor(session.role);
    const [booking] = await db.query<any>(
      `SELECT b.booking_id AS bookingId, b.status, b.total_amount AS total, e.title, sh.start_time AS startTime,
              v.name AS venue, v.city,
              CASE WHEN b.status = 'PENDING' THEN GREATEST(TIMESTAMPDIFF(SECOND, NOW(), b.hold_expires_at), 0) END AS secondsLeft
       FROM bookings b
       JOIN shows sh ON sh.show_id = b.show_id
       JOIN events e ON e.event_id = sh.event_id
       JOIN venues v ON v.venue_id = sh.venue_id
       WHERE b.booking_id = ? AND b.user_id = ?`,
      [id, session.userId]
    );
    if (!booking) throw new HttpError(404, "Booking not found.");
    const seats = await db.query(
      `SELECT s.row_label AS rowLabel, s.seat_number AS num, c.name AS category, bs.price_paid AS price
       FROM booking_seats bs
       JOIN show_seats ss ON ss.show_seat_id = bs.show_seat_id
       JOIN seats s ON s.seat_id = ss.seat_id
       JOIN seat_categories c ON c.category_id = s.category_id
       WHERE bs.booking_id = ? ORDER BY s.row_label, s.seat_number`,
      [id]
    );
    const [refund] = await db.query<any>("SELECT refund_amount AS amount FROM cancellations WHERE booking_id = ?", [id]);
    return ok({ booking, seats, refund: refund?.amount ?? null });
  } catch (err) {
    return handleError(err);
  }
}
