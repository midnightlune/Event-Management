import mysql, { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";

/**
 * One MySQL connection pool per database role.
 *
 * Each pool logs in with a different MySQL account (app_guest, app_customer, ...), and each account holds
 * exactly one MySQL role from db/roles.sql. The Route Handler picks the pool from the logged-in user's role
 * with dbFor(session.role), so the database itself refuses anything that role should not do, even if the
 * application code has a bug.
 *
 *   GUEST      not logged in            role_guest
 *   AUTH       login / register only    role_auth
 *   CUSTOMER                            role_customer
 *   ORGANIZER                           role_organizer
 *   ADMIN                               role_admin
 *
 * Credentials come only from environment variables (.env.local) - never hard-coded.
 * Development shortcut: DB_ROLE_ACCOUNTS=off makes every role use the single MYSQL_USER account.
 */
export type DbRole = "GUEST" | "AUTH" | "CUSTOMER" | "ORGANIZER" | "ADMIN";

const DEFAULT_ACCOUNT: Record<DbRole, string> = {
  GUEST: "app_guest",
  AUTH: "app_auth",
  CUSTOMER: "app_customer",
  ORGANIZER: "app_organizer",
  ADMIN: "app_admin",
};

const globalForDb = globalThis as unknown as { mysqlPools?: Partial<Record<DbRole, Pool>> };
const pools = (globalForDb.mysqlPools ??= {});

function credentials(role: DbRole) {
  if (process.env.DB_ROLE_ACCOUNTS === "off") {
    return { user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD };
  }
  const user = process.env[`DB_${role}_USER`] ?? DEFAULT_ACCOUNT[role];
  const password = process.env[`DB_${role}_PASSWORD`];
  if (!password) throw new Error(`DB_${role}_PASSWORD is not set (see .env.example and run npm run db:roles).`);
  return { user, password };
}

function poolFor(role: DbRole): Pool {
  let pool = pools[role];
  if (!pool) {
    const { user, password } = credentials(role);
    pool = pools[role] = mysql.createPool({
      host: process.env.MYSQL_HOST,
      port: Number(process.env.MYSQL_PORT ?? 3306),
      user,
      password,
      database: process.env.MYSQL_DATABASE,
      waitForConnections: true,
      connectionLimit: 5,
      decimalNumbers: true, // DECIMAL columns come back as numbers, not strings
      dateStrings: true, // DATETIME/TIMESTAMP come back as 'YYYY-MM-DD HH:mm:ss' strings (no timezone shifts)
    });
  }
  return pool;
}

export type Db = {
  pool: Pool;
  /** Parameterized statement. Values are always passed separately from the SQL text. */
  query<T = any>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Run several statements on one connection (needed for session variables and OUT parameters). */
  withConnection<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T>;
  withTransaction<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T>;
};

/** Database handle for an application role. No role (not logged in) means GUEST. */
export function dbFor(role?: DbRole | null): Db {
  const pool = poolFor(role ?? "GUEST");

  async function query<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
    const [rows] = await pool.query<RowDataPacket[]>(sql, params as any[]);
    return rows as unknown as T[];
  }

  async function withConnection<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
    const conn = await pool.getConnection();
    try {
      return await fn(conn);
    } finally {
      conn.release();
    }
  }

  async function withTransaction<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
    return withConnection(async (conn) => {
      await conn.beginTransaction();
      try {
        const result = await fn(conn);
        await conn.commit();
        return result;
      } catch (err) {
        await conn.rollback();
        throw err;
      }
    });
  }

  return { pool, query, withConnection, withTransaction };
}
