import { dbFor } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { handleError, HttpError, idParam, ok, readJson } from "@/lib/http";
import { userUpdateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// PATCH /api/admin/users/:id { role?, isActive? }
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole("ADMIN");
    const id = idParam(params.id);
    const db = dbFor("ADMIN");
    const input = userUpdateSchema.parse(await readJson(req));
    if (id === session.userId) throw new HttpError(400, "You cannot change your own role or status.");
    if (input.role === undefined && input.isActive === undefined) throw new HttpError(400, "Nothing to update.");

    if (input.role !== undefined)
      await db.pool.query("UPDATE users SET role_id = (SELECT role_id FROM roles WHERE role_name = ?) WHERE user_id = ?", [input.role, id]);
    if (input.isActive !== undefined)
      await db.pool.query("UPDATE users SET is_active = ? WHERE user_id = ?", [input.isActive ? 1 : 0, id]);
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
