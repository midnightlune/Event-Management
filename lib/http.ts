import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const ok = (data: unknown, status = 200) => NextResponse.json(data, { status });

/** Convert any thrown error into a safe JSON response. */
export function handleError(err: unknown) {
  if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
  if (err instanceof ZodError) {
    const msg = err.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ");
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  const e = err as { errno?: number; sqlState?: string; sqlMessage?: string };
  if (e?.sqlState === "45000") return NextResponse.json({ error: e.sqlMessage }, { status: 409 }); // raised by our procedures
  // The database account of this role was refused (ER_TABLEACCESS_DENIED, ER_COLUMNACCESS_DENIED, ER_DBACCESS_DENIED, ER_PROCACCESS_DENIED)
  if (e?.errno === 1142 || e?.errno === 1143 || e?.errno === 1044 || e?.errno === 1370)
    return NextResponse.json({ error: "The database refused this action for your role." }, { status: 403 });
  if (e?.errno === 1062) return NextResponse.json({ error: "That record already exists." }, { status: 409 });
  if (e?.errno === 3819) return NextResponse.json({ error: "A value violates a database rule." }, { status: 400 });
  if (e?.errno === 1452) return NextResponse.json({ error: "A referenced record does not exist." }, { status: 400 });
  console.error(err);
  return NextResponse.json({ error: "Something went wrong on the server." }, { status: 500 });
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }
}

export function idParam(value: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, "Invalid id.");
  return n;
}
