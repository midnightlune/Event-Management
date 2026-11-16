import { dbFor } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { handleError, HttpError, idParam, ok, readJson } from "@/lib/http";
import { paySchema } from "@/lib/validation";
import { logActivity } from "@/lib/activity";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

// POST /api/bookings/:id/pay { method } -> calls confirm_payment (simulated payment gateway)
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole("CUSTOMER");
    const id = idParam(params.id);
    const db = dbFor(session.role);
    const { method } = paySchema.parse(await readJson(req));

    const [own] = await db.query("SELECT booking_id FROM bookings WHERE booking_id = ? AND user_id = ?", [id, session.userId]);
    if (!own) throw new HttpError(404, "Booking not found.");

    const txnRef = `TXN-${Date.now()}-${randomBytes(3).toString("hex").toUpperCase()}`;
    await db.withConnection((conn) => conn.query("CALL confirm_payment(?, ?, ?)", [id, method, txnRef]));

    logActivity({ userId: session.userId, action: "BOOKING_PAID", meta: { bookingId: id, method } });
    return ok({ bookingId: id, txnRef });
  } catch (err) {
    return handleError(err);
  }
}
