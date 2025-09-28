import type { NextApiRequest, NextApiResponse } from "next";
import postgres from "postgres";

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    const sql = postgres(process.env.POSTGRES_URL!, { prepare: false });
    const rows = await sql`select now() as now`;
    await sql.end({ timeout: 1 });
    res.status(200).json({ ok: true, now: rows[0].now });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
