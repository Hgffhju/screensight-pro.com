import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
import * as schema from "./schema.ts";

const { Pool } = pkg;

// Function to create a new connection pool using Object Method
export const createPool = () => {
  const host = process.env.SQL_HOST;
  const user = process.env.SQL_USER;
  const password = process.env.SQL_PASSWORD;
  const database = process.env.SQL_DB_NAME;

  if (!host || !user || !password || !database) {
    console.warn("SQL environment variables are not fully set up yet. DB calls will be skipped or fail gracefully.");
  }

  return new Pool({
    host: host || "localhost",
    user: user || "postgres",
    password: password || "",
    database: database || "postgres",
    connectionTimeoutMillis: 15000,
  });
};

// Create a pool instance
const pool = createPool();

// Prevent unhandled pool-level errors from crashing the application
pool.on("error", (err) => {
  console.error("Unexpected error on idle SQL pool client:", err);
});

// Initialize Drizzle with the pool and schema
export const db = drizzle(pool, { schema });
