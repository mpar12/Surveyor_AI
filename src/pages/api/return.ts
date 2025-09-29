import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/db/client";
import { sessions } from "@/db/schema";
import { and, eq } from "drizzle-orm";

const redirect = (res: NextApiResponse, location: string) => {
  res.writeHead(302, { Location: location });
  res.end();
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const pinRaw = typeof req.body?.pin === "string" ? req.body.pin.trim() : "";

  if (!/^\d{4}$/.test(pinRaw)) {
    redirect(res, "/return?e=1");
    return;
  }

  try {
    const match = await db
      .select({ sessionId: sessions.sessionId })
      .from(sessions)
      .where(and(eq(sessions.pinCode, pinRaw), eq(sessions.status, "active")))
      .limit(1);

    if (match.length === 0) {
      redirect(res, "/return?e=1");
      return;
    }

    redirect(res, `/scorecard?sid=${match[0].sessionId}`);
  } catch (error) {
    console.error("Failed to resolve PIN", error);
    redirect(res, "/return?e=1");
  }
}
