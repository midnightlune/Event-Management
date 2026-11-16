import { ResultSetHeader } from "mysql2/promise";
import { dbFor } from "@/lib/db";
import { getDb } from "@/lib/mongo";
import { requireRole } from "@/lib/auth";
import { handleError, HttpError, ok, readJson } from "@/lib/http";
import { venueSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// POST /api/admin/venues -> creates a venue with three price tiers and a full seat grid.
// Row A.. get VIP (first 20% of rows), then GOLD (next 40%), then SILVER (the rest).
export async function POST(req: Request) {
  try {
    await requireRole("ADMIN");
    const v = venueSchema.parse(await readJson(req));
    const vipRows = Math.max(1, Math.ceil(v.rows * 0.2));
    const goldRows = Math.ceil(v.rows * 0.4);
    const tier = (i: number) => (i < vipRows ? 0 : i < vipRows + goldRows ? 1 : 2);
    const names = ["VIP", "GOLD", "SILVER"];

    let venueId: number;
    try {
      venueId = await dbFor("ADMIN").withTransaction(async (conn) => {
        const [venue] = await conn.query<ResultSetHeader>(
          "INSERT INTO venues (name, city, address, capacity) VALUES (?, ?, ?, ?)",
          [v.name, v.city, v.address || null, v.rows * v.seatsPerRow]
        );
        const prices = [v.vipPrice, v.goldPrice, v.silverPrice];
        const catIds: number[] = [];
        for (let i = 0; i < 3; i++) {
          const [c] = await conn.query<ResultSetHeader>(
            "INSERT INTO seat_categories (venue_id, name, base_price) VALUES (?, ?, ?)",
            [venue.insertId, names[i], prices[i]]
          );
          catIds.push(c.insertId);
        }
        const seatRows: (string | number)[][] = [];
        for (let r = 0; r < v.rows; r++)
          for (let n = 1; n <= v.seatsPerRow; n++)
            seatRows.push([venue.insertId, catIds[tier(r)], String.fromCharCode(65 + r), n]);
        await conn.query("INSERT INTO seats (venue_id, category_id, row_label, seat_number) VALUES ?", [seatRows]);
        return venue.insertId;
      });
    } catch (err: any) {
      if (err?.errno === 1062) throw new HttpError(409, "A venue with this name already exists in that city.");
      throw err;
    }

    try {
      const db = await getDb();
      await db.collection("seat_maps").insertOne({
        venueId,
        stageLabel: "STAGE",
        rows: Array.from({ length: v.rows }, (_, r) => ({
          label: String.fromCharCode(65 + r),
          category: names[tier(r)],
          seats: v.seatsPerRow,
          aisleAfter: v.seatsPerRow >= 6 ? [Math.floor(v.seatsPerRow / 2)] : [],
        })),
      });
    } catch {
      /* the grid still renders without the optional layout document */
    }
    return ok({ venueId }, 201);
  } catch (err) {
    return handleError(err);
  }
}
