// The sample users in db/seed.sql have placeholder hashes. This gives every sample user a real bcrypt hash
// of the demo password so you can log in. Run with: npm run db:passwords
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";

const DEMO_PASSWORD = "Password@123";
const conn = await mysql.createConnection({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT ?? 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE ?? "ticketdb",
});
try {
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  await conn.query("UPDATE users SET password_hash = ?", [hash]);
  const [rows] = await conn.query(
    "SELECT u.email, r.role_name AS role FROM users u JOIN roles r ON r.role_id = u.role_id ORDER BY u.user_id"
  );
  console.log(`Demo password for every sample user: ${DEMO_PASSWORD}`);
  console.table(rows);
} finally {
  await conn.end();
}
