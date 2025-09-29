import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const connectionString = process.env.POSTGRES_URL;

if (!connectionString) {
  throw new Error("POSTGRES_URL environment variable is not set.");
}

const createClient = () =>
  postgres(connectionString, {
    ssl: {
      rejectUnauthorized: false
    }
  });

declare global {
  // eslint-disable-next-line no-var
  var __postgresClient: ReturnType<typeof createClient> | undefined;
  // eslint-disable-next-line no-var
  var __drizzleDb: ReturnType<typeof drizzle> | undefined;
}

const client = globalThis.__postgresClient ?? createClient();
if (process.env.NODE_ENV !== "production") {
  globalThis.__postgresClient = client;
}

export const db = globalThis.__drizzleDb ?? drizzle(client);
if (process.env.NODE_ENV !== "production") {
  globalThis.__drizzleDb = db;
}
