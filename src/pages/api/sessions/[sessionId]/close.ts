import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/db/client";
import { sessions } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST" && req.method !== "PATCH") {
    res.setHeader("Allow", "POST, PATCH");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const { sessionId } = req.query;
  const id = typeof sessionId === "string" ? sessionId : Array.isArray(sessionId) ? sessionId[0] : null;

  if (!id) {
    return res.status(400).json({ error: "missing_session_id" });
  }

  try {
    const existing = await db
      .select({ sessionId: sessions.sessionId })
      .from(sessions)
      .where(eq(sessions.sessionId, id))
      .limit(1);

    if (existing.length === 0) {
      return res.status(404).json({ error: "session_not_found" });
    }

    await db
      .update(sessions)
      .set({ status: "closed" })
      .where(eq(sessions.sessionId, id));

    return res.status(200).json({ sessionId: id, status: "closed" });
  } catch (error) {
    console.error("Failed to close session", error);
    return res.status(500).json({ error: "internal_error" });
  }
}
