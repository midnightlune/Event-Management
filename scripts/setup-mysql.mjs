// Creates (or re-creates) the MySQL database: tables, indexes, views, procedures, functions, trigger, event, sample data.
// WARNING: drops the existing database first. Run with: npm run db:setup
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

const root = path.resolve(import.meta.dirname, "..");

/** Splits a .sql file into statements and understands the client-only DELIMITER command. */
function splitSql(text) {
  let delim = ";";
  let buf = [];
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (/^DELIMITER\s+/i.test(t)) { delim = t.split(/\s+/)[1]; continue; }
    if (t === "" || t.startsWith("--")) { if (buf.length) buf.push(line); continue; }
    buf.push(line);
    if (t.endsWith(delim)) {
      const stmt = buf.join("\n").trimEnd().slice(0, -delim.length).trim();
      if (stmt) out.push(stmt);
      buf = [];
    }
  }
  return out;
}

const conn = await mysql.createConnection({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT ?? 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
});

try {
  await conn.query("DROP DATABASE IF EXISTS ticketdb");
  for (const file of ["db/schema.sql", "db/seed.sql"]) {
    const statements = splitSql(fs.readFileSync(path.join(root, file), "utf8"));
    for (const s of statements) await conn.query(s);
    console.log(`Ran ${file} (${statements.length} statements)`);
  }
  const [[counts]] = await conn.query(
    "SELECT (SELECT COUNT(*) FROM ticketdb.users) AS users, (SELECT COUNT(*) FROM ticketdb.events) AS events, (SELECT COUNT(*) FROM ticketdb.show_seats) AS show_seats, (SELECT COUNT(*) FROM ticketdb.bookings) AS bookings"
  );
  console.log("Database ready:", counts);
  if ((process.env.MYSQL_DATABASE ?? "ticketdb") !== "ticketdb")
    console.warn("NOTE: db/schema.sql creates a database named 'ticketdb'. Set MYSQL_DATABASE=ticketdb in .env.local.");
  const [[ev]] = await conn.query("SELECT @@event_scheduler AS scheduler");
  if (ev.scheduler !== "ON") console.warn("NOTE: the event scheduler is OFF. Run  SET GLOBAL event_scheduler = ON;  so unpaid holds expire automatically.");
} finally {
  await conn.end();
}
