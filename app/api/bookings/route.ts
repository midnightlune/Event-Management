import { dbFor } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { handleError, ok, readJson } from "@/lib/http";
import { bookingSchema } from "@/lib/validation";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

// GET /api/bookings -> the logged-in user's booking history (uses the v_user_booking_history view)
export async function GET() {
  try {
    const session = await requireRole();
    const rows = await dbFor(session.role).query(
      `SELECT h.booking_id AS bookingId, h.title, h.start_time AS startTime, h.venue, h.status,
              h.total_amount AS total, h.seat_count AS seatCount,
              (SELECT GROUP_CONCAT(CONCAT(s.row_label, s.seat_number) ORDER BY s.row_label, s.seat_number SEPARATOR ', ')
                 FROM booking_seats bs
                 JOIN show_seats ss ON ss.show_seat_id = bs.show_seat_id
                 JOIN seats s ON s.seat_id = ss.seat_id
                WHERE bs.booking_id = h.booking_id) AS seats,
              (SELECT GREATEST(TIMESTAMPDIFF(SECOND, NOW(), b.hold_expires_at), 0)
                 FROM bookings b WHERE b.booking_id = h.booking_id AND b.status = 'PENDING') AS secondsLeft
       FROM v_user_booking_history h
       WHERE h.user_id = ?
       ORDER BY h.booking_id DESC`,
      [session.userId]
    );
    return ok({ bookings: rows });
  } catch (err) {
    return handleError(err);
  }
}

// POST /api/bookings { showId, showSeatIds } -> holds the seats for 10 minutes via the book_seats procedure
export async function POST(req: Request) {
  try {
    const session = await requireRole("CUSTOMER");
    const { showId, showSeatIds } = bookingSchema.parse(await readJson(req));

    const bookingId = await dbFor(session.role).withConnection(async (conn) => {
      // OUT parameter is a session variable, so both statements must share one connection
      await conn.query("CALL book_seats(?, ?, ?, @booking_id)", [session.userId, showId, JSON.stringify(showSeatIds)]);
      const [rows]: any = await conn.query("SELECT @booking_id AS bookingId");
      return rows[0].bookingId as number;
    });

    logActivity({ userId: session.userId, action: "BOOKING_HOLD", meta: { bookingId, showId } });
    return ok({ bookingId }, 201);
  } catch (err) {
    return handleError(err);
  }
}
