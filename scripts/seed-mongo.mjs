// Loads sample documents and creates indexes in MongoDB. Run with: npm run mongo:seed
// WARNING: this first EMPTIES the four collections (event_details, seat_maps, reviews, activity_logs).
// The event_details _id values match events.mongo_doc_id in db/seed.sql.
import { MongoClient, ObjectId } from "mongodb";

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db(process.env.MONGODB_DB ?? "ticketdb");

for (const name of ["event_details", "seat_maps", "reviews", "activity_logs"]) await db.collection(name).deleteMany({});

await db.collection("event_details").insertMany([
  {
    _id: new ObjectId("665f1a2b3c4d5e6f70818293"), eventId: 1,
    description: "A night of live rock with three headline acts, a full light show and food stalls in the foyer.",
    lineup: [{ artist: "The Midnight Riders", slot: "19:30" }, { artist: "Neon Harbour", slot: "20:30" }, { artist: "Kaveri Roots", slot: "21:30" }],
    tags: ["rock", "live", "bengaluru"],
    faqs: [{ q: "Is re-entry allowed?", a: "No, re-entry is not permitted." }, { q: "Are outside snacks allowed?", a: "No, food is available inside." }],
    media: { banner: "/img/rock-nation.jpg" },
  },
  {
    _id: new ObjectId("665f1a2b3c4d5e6f70818294"), eventId: 2,
    description: "An evening of stand-up comedy featuring five of the city's funniest new voices.",
    lineup: [{ artist: "Open mic winners", slot: "20:00" }],
    tags: ["comedy", "stand-up", "evening"],
    faqs: [{ q: "Is there an age limit?", a: "Recommended for 16 years and above." }],
    media: {},
  },
  {
    _id: new ObjectId("665f1a2b3c4d5e6f70818295"), eventId: 3,
    description: "A full-day developer conference with talks on cloud, databases and AI, plus a hands-on workshop track.",
    lineup: [{ artist: "Keynote: Data at scale", slot: "09:30" }, { artist: "Workshop: Query tuning", slot: "13:00" }],
    tags: ["technology", "conference", "databases"],
    faqs: [{ q: "Is lunch included?", a: "Yes, lunch and refreshments are included." }],
    media: {},
  },
]);

await db.collection("seat_maps").insertMany([
  { venueId: 1, stageLabel: "STAGE", rows: [
    { label: "A", category: "VIP", seats: 6, aisleAfter: [3] },
    { label: "B", category: "GOLD", seats: 6, aisleAfter: [3] },
    { label: "C", category: "GOLD", seats: 6, aisleAfter: [3] },
    { label: "D", category: "SILVER", seats: 6, aisleAfter: [3] },
    { label: "E", category: "SILVER", seats: 6, aisleAfter: [3] },
  ] },
  { venueId: 2, stageLabel: "STAGE", rows: [
    { label: "A", category: "PREMIUM", seats: 5, aisleAfter: [] },
    { label: "B", category: "PREMIUM", seats: 5, aisleAfter: [] },
    { label: "C", category: "STANDARD", seats: 5, aisleAfter: [] },
    { label: "D", category: "STANDARD", seats: 5, aisleAfter: [] },
  ] },
]);

const daysAgo = (n) => new Date(Date.now() - n * 24 * 3600 * 1000);
await db.collection("reviews").insertMany([
  { eventId: 1, userId: 4, userName: "Anita Rao", rating: 5, comment: "Great sound and the seat selection was effortless.", createdAt: daysAgo(2) },
  { eventId: 1, userId: 5, userName: "Rohan Shetty", rating: 4, comment: "Loved the line-up. Entry queue was a bit slow.", createdAt: daysAgo(1) },
  { eventId: 2, userId: 4, userName: "Anita Rao", rating: 4, comment: "Very funny, good seats for the price.", createdAt: daysAgo(3) },
  { eventId: 3, userId: 5, userName: "Rohan Shetty", rating: 5, comment: "The query tuning workshop was excellent.", createdAt: daysAgo(1) },
]);

const actions = [1, 1, 1, 2, 3, 1, 2];
await db.collection("activity_logs").insertMany(
  Array.from({ length: 30 }, (_, i) => ({
    userId: 4 + (i % 4), action: "VIEW_EVENT", eventId: actions[i % actions.length], timestamp: daysAgo(i % 6),
  }))
);

await db.collection("event_details").createIndex({ eventId: 1 }, { unique: true });
await db.collection("event_details").createIndex({ description: "text", tags: "text" });
await db.collection("seat_maps").createIndex({ venueId: 1 }, { unique: true });
await db.collection("reviews").createIndex({ eventId: 1, createdAt: -1 });
await db.collection("reviews").createIndex({ eventId: 1, userId: 1 }, { unique: true }); // one review per user per event
await db.collection("activity_logs").createIndex({ userId: 1, timestamp: -1 });
await db.collection("activity_logs").createIndex({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });

console.log("MongoDB seeded:", {
  event_details: await db.collection("event_details").countDocuments(),
  seat_maps: await db.collection("seat_maps").countDocuments(),
  reviews: await db.collection("reviews").countDocuments(),
  activity_logs: await db.collection("activity_logs").countDocuments(),
});
await client.close();
