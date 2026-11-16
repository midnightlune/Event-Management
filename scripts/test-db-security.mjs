// Checks, against the real database, that
//   (1) every application role can do what it should and is refused everything else, and
//   (2) the booking status trigger allows only the legal transitions.
// Run with: npm run db:test      (needs npm run db:setup and npm run db:roles first)
// It books and cancels a few seats, so run  npm run db:setup && npm run db:passwords && npm run db:roles  afterwards to reset the sample data.
import mysql from "mysql2/promise";

const host = process.env.MYSQL_HOST;
const port = Number(process.env.MYSQL_PORT ?? 3306);
const database = process.env.MYSQL_DATABASE ?? "ticketdb";
const acct = (k, d) => ({ user: process.env[`DB_${k}_USER`] ?? d, password: process.env[`DB_${k}_PASSWORD`] });
const connect = (c) => mysql.createConnection({ host, port, database, ...c });

const results = [];
const ERR = { 1142: "table access denied", 1143: "column access denied", 1370: "routine access denied", 1644: "raised by our code" };

/** expect "ok" or an error: a numeric errno, optionally with a text the message must contain. */
async function check(label, conn, sql, params, expected, messagePart) {
  let outcome;
  try {
    await conn.query(sql, params);
    outcome = "ok";
  } catch (e) {
    outcome = e.errno;
    if (messagePart && !String(e.sqlMessage).includes(messagePart)) outcome = `${e.errno} but message was: ${e.sqlMessage}`;
  }
  const pass = outcome === expected;
  results.push({ test: label, expected: expected === "ok" ? "allowed" : `denied (${expected} ${ERR[expected] ?? ""})`.trim(), result: pass ? "PASS" : `FAIL (${outcome})` });
}

const root = await connect({ user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD });
const guest = await connect(acct("GUEST", "app_guest"));
const auth = await connect(acct("AUTH", "app_auth"));
const customer = await connect(acct("CUSTOMER", "app_customer"));
const organizer = await connect(acct("ORGANIZER", "app_organizer"));
const admin = await connect(acct("ADMIN", "app_admin"));

try {
  // ---------------- Part 1: privileges per role ----------------
  await check("guest   SELECT events", guest, "SELECT COUNT(*) FROM events", [], "ok");
  await check("guest   SELECT user_id, full_name FROM users", guest, "SELECT user_id, full_name FROM users", [], "ok");
  await check("guest   SELECT email FROM users", guest, "SELECT email FROM users", [], 1143);
  await check("guest   SELECT * FROM bookings", guest, "SELECT * FROM bookings", [], 1142);
  await check("guest   CALL book_seats", guest, "CALL book_seats(4, 3, '[1]', @b)", [], 1370);

  await check("auth    SELECT password_hash FROM users", auth, "SELECT password_hash FROM users LIMIT 1", [], "ok");
  await check("auth    UPDATE users", auth, "UPDATE users SET is_active = 1", [], 1142);
  await check("auth    SELECT events", auth, "SELECT * FROM events", [], 1142);

  await check("customer SELECT bookings", customer, "SELECT COUNT(*) FROM bookings", [], "ok");
  await check("customer SELECT email FROM users", customer, "SELECT email FROM users", [], 1143);
  await check("customer SELECT password_hash FROM users", customer, "SELECT password_hash FROM users", [], 1143);
  await check("customer UPDATE bookings SET status = 'CONFIRMED'", customer, "UPDATE bookings SET status = 'CONFIRMED' WHERE booking_id = 5", [], 1142);
  await check("customer UPDATE bookings SET total_amount = 1", customer, "UPDATE bookings SET total_amount = 1 WHERE booking_id = 5", [], 1142);
  await check("customer UPDATE show_seats", customer, "UPDATE show_seats SET status = 'AVAILABLE'", [], 1142);
  await check("customer DELETE FROM bookings", customer, "DELETE FROM bookings", [], 1142);
  await check("customer INSERT INTO events", customer, "INSERT INTO events (organizer_id, title, category) VALUES (2, 'x', 'OTHER')", [], 1142);
  await check("customer SELECT payments", customer, "SELECT * FROM payments", [], 1142);

  await check("organizer INSERT/ROLLBACK events", organizer, "START TRANSACTION", [], "ok");
  await check("organizer INSERT INTO events", organizer, "INSERT INTO events (organizer_id, title, category) VALUES (2, 'Role test', 'OTHER')", [], "ok");
  await organizer.query("ROLLBACK");
  await check("organizer SELECT v_organizer_revenue", organizer, "SELECT * FROM v_organizer_revenue", [], "ok");
  await check("organizer SELECT payments", organizer, "SELECT * FROM payments", [], "ok");
  await check("organizer DELETE FROM payments", organizer, "DELETE FROM payments", [], 1142);
  await check("organizer UPDATE bookings", organizer, "UPDATE bookings SET status = 'CONFIRMED' WHERE booking_id = 5", [], 1142);
  await check("organizer SELECT email FROM users", organizer, "SELECT email FROM users", [], 1143);

  await check("admin   SELECT email FROM users", admin, "SELECT email FROM users", [], "ok");
  await check("admin   SELECT payments", admin, "SELECT COUNT(*) FROM payments", [], "ok");

  // ---------------- Part 2: booking procedures as a customer ----------------
  const [[s1]] = await root.query("SELECT show_seat_id AS id FROM show_seats WHERE show_id = 3 AND status = 'AVAILABLE' ORDER BY show_seat_id LIMIT 1");
  await check("customer CALL book_seats", customer, "CALL book_seats(4, 3, ?, @b)", [JSON.stringify([s1.id])], "ok");
  const [[{ b }]] = await customer.query("SELECT @b AS b");
  await check("customer cancel someone else's booking", customer, "CALL cancel_booking(?, 5, @r)", [b], 1644, "Booking not found");
  await check("customer CALL cancel_booking (own, PENDING)", customer, "CALL cancel_booking(?, 4, @r)", [b], "ok");
  await check("customer cancel it again", customer, "CALL cancel_booking(?, 4, @r)", [b], 1644, "cannot be cancelled");

  // ---------------- Part 3: status transitions (run as the most powerful account, ADMIN) ----------------
  const [avail] = await root.query("SELECT show_seat_id AS id FROM show_seats WHERE show_id = 3 AND status = 'AVAILABLE' ORDER BY show_seat_id LIMIT 8");
  let next = 0;
  const holdBooking = async () => {
    const id = avail[next++].id;
    await root.query("CALL book_seats(4, 3, ?, @nb)", [JSON.stringify([id])]);
    const [[row]] = await root.query("SELECT @nb AS id");
    return row.id;
  };
  const setStatus = (id, st) => admin.query("UPDATE bookings SET status = ? WHERE booking_id = ?", [st, id]);
  const trigTest = async (label, id, to, expected) => {
    let outcome = "ok";
    try { await setStatus(id, to); } catch (e) { outcome = e.errno === 1644 ? 1644 : `${e.errno} ${e.sqlMessage}`; }
    results.push({ test: label, expected: expected === "ok" ? "allowed" : "rejected by trigger", result: outcome === expected ? "PASS" : `FAIL (${outcome})` });
  };

  const p1 = await holdBooking();
  await trigTest("PENDING -> CONFIRMED with no payment", p1, "CONFIRMED", 1644);
  await trigTest("PENDING -> CANCELLED", p1, "CANCELLED", "ok");
  await trigTest("CANCELLED -> CONFIRMED", p1, "CONFIRMED", 1644);
  await trigTest("CANCELLED -> PENDING", p1, "PENDING", 1644);
  await trigTest("CANCELLED -> EXPIRED", p1, "EXPIRED", 1644);

  const p2 = await holdBooking();
  await trigTest("PENDING -> EXPIRED", p2, "EXPIRED", "ok");
  await trigTest("EXPIRED -> PENDING", p2, "PENDING", 1644);
  await trigTest("EXPIRED -> CONFIRMED", p2, "CONFIRMED", 1644);

  const p3 = await holdBooking();
  await root.query("CALL confirm_payment(?, 'UPI', ?)", [p3, `TEST-${Date.now()}`]); // legal path: payment row first, then CONFIRMED
  const [[st3]] = await root.query("SELECT status FROM bookings WHERE booking_id = ?", [p3]);
  results.push({ test: "confirm_payment: PENDING -> CONFIRMED with payment", expected: "allowed", result: st3.status === "CONFIRMED" ? "PASS" : `FAIL (${st3.status})` });
  await trigTest("CONFIRMED -> PENDING", p3, "PENDING", 1644);
  await trigTest("CONFIRMED -> EXPIRED", p3, "EXPIRED", 1644);
  await check("same status, other column (hold_expires_at)", admin, "UPDATE bookings SET hold_expires_at = NULL WHERE booking_id = ?", [p3], "ok");
  await trigTest("CONFIRMED -> CANCELLED", p3, "CANCELLED", "ok");
  const [[ref]] = await root.query("SELECT refund_amount AS r FROM cancellations WHERE booking_id = ?", [p3]);
  results.push({ test: "refund row created by the other trigger", expected: "1 row", result: ref ? "PASS" : "FAIL" });
  await trigTest("CANCELLED -> CONFIRMED (after refund)", p3, "CONFIRMED", 1644);
} finally {
  for (const c of [root, guest, auth, customer, organizer, admin]) await c.end().catch(() => {});
}

console.table(results);
const failed = results.filter((r) => !r.result.startsWith("PASS")).length;
console.log(failed ? `${failed} FAILED of ${results.length}` : `All ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
