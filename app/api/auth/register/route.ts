import bcrypt from "bcryptjs";
import { ResultSetHeader } from "mysql2/promise";
import { dbFor } from "@/lib/db";
import { setSessionCookie } from "@/lib/auth";
import { handleError, HttpError, ok, readJson } from "@/lib/http";
import { registerSchema } from "@/lib/validation";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const input = registerSchema.parse(await readJson(req));
    const hash = await bcrypt.hash(input.password, 10); // only the hash is ever stored
    let result: ResultSetHeader;
    try {
      [result] = await dbFor("AUTH").pool.query<ResultSetHeader>(
        `INSERT INTO users (role_id, full_name, email, password_hash, phone)
         VALUES ((SELECT role_id FROM roles WHERE role_name = ?), ?, ?, ?, ?)`,
        [input.role, input.fullName, input.email, hash, input.phone || null]
      );
    } catch (e: any) {
      if (e?.errno === 1062) throw new HttpError(409, "An account with this email already exists.");
      throw e;
    }
    await setSessionCookie({ userId: result.insertId, role: input.role, name: input.fullName });
    logActivity({ userId: result.insertId, action: "REGISTER" });
    return ok({ user: { id: result.insertId, name: input.fullName, role: input.role } }, 201);
  } catch (err) {
    return handleError(err);
  }
}
