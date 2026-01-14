import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/db/client";
import { surveys } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const { id } = req.query;

  if (typeof id !== "string") {
    return res.status(400).json({ error: "invalid_survey_id" });
  }

  try {
    // Get current survey
    const [survey] = await db
      .select()
      .from(surveys)
      .where(eq(surveys.id, id))
      .limit(1);

    if (!survey) {
      return res.status(404).json({ error: "survey_not_found" });
    }

    // Determine new version
    const newVersion = survey.status === "published" ? survey.version + 1 : survey.version;

    // Update survey to published
    const [updated] = await db
      .update(surveys)
      .set({
        status: "published",
        version: newVersion,
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(surveys.id, id))
      .returning();

    return res.status(200).json({ survey: updated });
  } catch (error) {
    console.error("Failed to publish survey", error);
    return res.status(500).json({ error: "internal_error" });
  }
}
