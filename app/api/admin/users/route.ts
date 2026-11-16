import { dbFor } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { handleError, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireRole("ADMIN");
    const users = await dbFor("ADMIN").query(
      `SELECT u.user_id AS id, u.full_name AS name, u.email, r.role_name AS role, u.is_active AS isActive, u.created_at AS createdAt
       FROM users u JOIN roles r ON r.role_id = u.role_id ORDER BY u.user_id`
    );
    return ok({ users });
  } catch (err) {
    return handleError(err);
  }
}
