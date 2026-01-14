import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/db/client";
import { surveyFollowups } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PUT") {
    res.setHeader("Allow", "PUT");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const { followupId, answerType, textValue, voiceUrl } = req.body;

  if (!followupId) {
    return res.status(400).json({ error: "missing_followup_id" });
  }

  try {
    // Update the follow-up with the answer
    const [updated] = await db
      .update(surveyFollowups)
      .set({
        answerType: answerType || "text",
        textValue: textValue || null,
        voiceUrl: voiceUrl || null,
        transcript: textValue || null, // For voice, transcript would be passed as textValue
      })
      .where(eq(surveyFollowups.id, followupId))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "followup_not_found" });
    }

    return res.status(200).json({ followup: updated });
  } catch (error) {
    console.error("Failed to update follow-up:", error);
    return res.status(500).json({ error: "internal_error" });
  }
}
