import { dbFor } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { handleError, HttpError, idParam, ok } from "@/lib/http";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

// POST /api/bookings/:id/cancel
// Customers have no UPDATE right on bookings. They can only call the cancel_booking procedure, which checks
// ownership; the triggers then enforce the allowed status changes, free the seats and log the refund.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole("CUSTOMER");
    const id = idParam(params.id);
    const db = dbFor(session.role);

    // Friendly early answer. The database does not rely on this check: the status-guard trigger decides.
    const [own] = await db.query<{ status: string }>("SELECT status FROM bookings WHERE booking_id = ? AND user_id = ?", [id, session.userId]);
    if (!own) throw new HttpError(404, "Booking not found.");
    if (own.status !== "PENDING" && own.status !== "CONFIRMED")
      throw new HttpError(409, `A ${own.status.toLowerCase()} booking cannot be cancelled.`);

    // OUT parameter is a session variable, so both statements must share one connection
    const refund = await db.withConnection(async (conn) => {
      await conn.query("CALL cancel_booking(?, ?, @refund)", [id, session.userId]);
      const [rows]: any = await conn.query("SELECT @refund AS refund");
      return Number(rows[0].refund ?? 0);
    });

    logActivity({ userId: session.userId, action: "BOOKING_CANCELLED", meta: { bookingId: id, refund } });
    return ok({ bookingId: id, refund });
  } catch (err) {
    return handleError(err);
  }
}
