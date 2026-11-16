import bcrypt from "bcryptjs";
import { dbFor } from "@/lib/db";
import { setSessionCookie, Role } from "@/lib/auth";
import { handleError, HttpError, ok, readJson } from "@/lib/http";
import { loginSchema } from "@/lib/validation";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";
// compared against when the email is unknown, so response time does not reveal which emails exist
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

export async function POST(req: Request) {
  try {
    const { email, password } = loginSchema.parse(await readJson(req));
    const rows = await dbFor("AUTH").query<{ user_id: number; full_name: string; password_hash: string; is_active: number; role: Role }>(
      `SELECT u.user_id, u.full_name, u.password_hash, u.is_active, r.role_name AS role
       FROM users u JOIN roles r ON r.role_id = u.role_id WHERE u.email = ?`,
      [email]
    );
    const user = rows[0];
    const valid = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
    if (!user || !valid) throw new HttpError(401, "Incorrect email or password.");
    if (!user.is_active) throw new HttpError(403, "This account has been deactivated.");
    await setSessionCookie({ userId: user.user_id, role: user.role, name: user.full_name });
    logActivity({ userId: user.user_id, action: "LOGIN" });
    return ok({ user: { id: user.user_id, name: user.full_name, role: user.role } });
  } catch (err) {
    return handleError(err);
  }
}
