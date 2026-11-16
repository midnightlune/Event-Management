import { getDb } from "@/lib/mongo";

/** Fire-and-forget activity log in MongoDB. Never blocks or breaks the request. */
export async function logActivity(entry: { userId?: number | null; action: string; eventId?: number; meta?: Record<string, unknown> }) {
  try {
    const db = await getDb();
    await db.collection("activity_logs").insertOne({ ...entry, timestamp: new Date() });
  } catch {
    /* logging must never fail a request */
  }
}
