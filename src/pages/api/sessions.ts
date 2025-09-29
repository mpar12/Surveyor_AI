import type { NextApiRequest, NextApiResponse } from "next";
import { randomUUID } from "crypto";
import { db } from "@/db/client";
import { sessions } from "@/db/schema";
import { and, eq } from "drizzle-orm";

const MAX_PIN_ATTEMPTS = 10;

const generatePin = () => String(Math.floor(Math.random() * 10000)).padStart(4, "0");

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  try {
    let pin: string | null = null;

    for (let attempt = 0; attempt < MAX_PIN_ATTEMPTS; attempt += 1) {
      const candidate = generatePin();
      const existing = await db
        .select({ sessionId: sessions.sessionId })
        .from(sessions)
        .where(and(eq(sessions.pinCode, candidate), eq(sessions.status, "active")))
        .limit(1);

      if (existing.length === 0) {
        pin = candidate;
        break;
      }
    }

    if (!pin) {
      return res.status(503).json({ error: "pin_generation_failed" });
    }

    const sessionId = randomUUID();

    await db.insert(sessions).values({
      sessionId,
      pinCode: pin,
      status: "active"
    });

    return res.status(201).json({ sessionId, pin });
  } catch (error) {
    console.error("Failed to create session", error);
    return res.status(500).json({ error: "internal_error" });
  }
}
