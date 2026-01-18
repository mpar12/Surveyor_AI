import { config } from "dotenv";
import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env.test");
if (fs.existsSync(envPath)) {
  config({ path: envPath });
}

process.env.NODE_ENV = "test";

const postgresUrl = process.env.POSTGRES_URL;
if (!postgresUrl) {
  throw new Error(
    "POSTGRES_URL is required for invariant tests. Add it to .env.test pointing at a local database."
  );
}

const blockedHosts = [/supabase\.co/i, /vercel-storage\.com/i, /neon\.tech/i, /render\.com/i];
if (blockedHosts.some((pattern) => pattern.test(postgresUrl))) {
  throw new Error(
    "POSTGRES_URL must point to a local database for invariant tests (hosted databases are blocked)."
  );
}
