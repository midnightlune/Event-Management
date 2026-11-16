import { MongoClient, Db } from "mongodb";

const globalForMongo = globalThis as unknown as { mongoClient?: MongoClient; mongoIndexes?: Promise<void> };

function client(): MongoClient {
  if (!globalForMongo.mongoClient) {
    globalForMongo.mongoClient = new MongoClient(process.env.MONGODB_URI as string, { serverSelectionTimeoutMS: 3000 });
  }
  return globalForMongo.mongoClient;
}

export async function getDb(): Promise<Db> {
  const c = client();
  await c.connect(); // safe to call repeatedly
  const db = c.db(process.env.MONGODB_DB ?? "ticketdb");
  if (!globalForMongo.mongoIndexes) {
    globalForMongo.mongoIndexes = ensureIndexes(db).catch(() => undefined);
  }
  return db;
}

export async function ensureIndexes(db: Db) {
  await db.collection("event_details").createIndex({ eventId: 1 }, { unique: true });
  await db.collection("event_details").createIndex({ description: "text", tags: "text" });
  await db.collection("seat_maps").createIndex({ venueId: 1 }, { unique: true });
  await db.collection("reviews").createIndex({ eventId: 1, createdAt: -1 });
  await db.collection("reviews").createIndex({ eventId: 1, userId: 1 }, { unique: true }); // one review per user per event, enforced by MongoDB
  await db.collection("activity_logs").createIndex({ userId: 1, timestamp: -1 });
  await db.collection("activity_logs").createIndex({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });
}
