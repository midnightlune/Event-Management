// Creates the MySQL roles (db/roles.sql) and one login account per role.
// Passwords come from .env.local - nothing secret is stored in the repository.
// Run with: npm run db:roles      (after npm run db:setup)
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

const root = path.resolve(import.meta.dirname, "..");
const host = process.env.DB_ACCOUNT_HOST ?? "localhost";

// env prefix -> [default account name, MySQL role it receives]
const ACCOUNTS = {
  GUEST: ["app_guest", "role_guest"],
  AUTH: ["app_auth", "role_auth"],
  CUSTOMER: ["app_customer", "role_customer"],
  ORGANIZER: ["app_organizer", "role_organizer"],
  ADMIN: ["app_admin", "role_admin"],
};

function splitSql(text) {
  const out = [];
  let buf = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s--.*$/, ""); // drop end-of-line comments (roles.sql has no '--' inside strings)
    const t = line.trim();
    if (t === "" || t.startsWith("--")) continue;
    buf.push(line);
    if (t.endsWith(";")) {
      out.push(buf.join("\n").trim().slice(0, -1));
      buf = [];
    }
  }
  return out;
}

// Fail early and clearly if a password is missing or still the placeholder.
const plan = Object.entries(ACCOUNTS).map(([key, [defUser, role]]) => {
  const user = process.env[`DB_${key}_USER`] ?? defUser;
  const password = process.env[`DB_${key}_PASSWORD`];
  if (!password || password.length < 8 || /change[-_ ]?me/i.test(password))
    throw new Error(`Set DB_${key}_PASSWORD in .env.local (at least 8 characters, not the placeholder).`);
  return { key, user, password, role };
});

const conn = await mysql.createConnection({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT ?? 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
});
try {
  for (const s of splitSql(fs.readFileSync(path.join(root, "db/roles.sql"), "utf8"))) await conn.query(s);
  console.log("Roles and privileges created (db/roles.sql)");

  for (const { user, password, role } of plan) {
    // client-side escaping: the values become properly quoted string literals
    await conn.query("CREATE USER IF NOT EXISTS ?@? IDENTIFIED BY ?", [user, host, password]);
    await conn.query("ALTER USER ?@? IDENTIFIED BY ?", [user, host, password]); // re-running resets the password
    await conn.query("GRANT ? TO ?@?", [role, user, host]);
    await conn.query("SET DEFAULT ROLE ALL TO ?@?", [user, host]);
  }
  console.table(plan.map(({ key, user, role }) => ({ app_role: key, mysql_account: `${user}@${host}`, mysql_role: role })));
} finally {
  await conn.end();
}
