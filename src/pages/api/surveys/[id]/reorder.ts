import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/db/client";
import { surveys, surveySections, surveyQuestions } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { ReorderRequest } from "@/types/surveyBuilder";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PUT") {
    res.setHeader("Allow", "PUT");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const { id: surveyId } = req.query;

  if (typeof surveyId !== "string") {
    return res.status(400).json({ error: "invalid_survey_id" });
  }

  try {
    // Verify survey exists
    const [survey] = await db
      .select()
      .from(surveys)
      .where(eq(surveys.id, surveyId))
      .limit(1);

    if (!survey) {
      return res.status(404).json({ error: "survey_not_found" });
    }

    const body = req.body as ReorderRequest;

    // Reorder sections
    if (body.sections && Array.isArray(body.sections)) {
      for (const item of body.sections) {
        await db
          .update(surveySections)
          .set({ order: item.order })
          .where(eq(surveySections.id, item.id));
      }
    }

    // Reorder questions
    if (body.questions && Array.isArray(body.questions)) {
      for (const item of body.questions) {
        await db
          .update(surveyQuestions)
          .set({ order: item.order })
          .where(eq(surveyQuestions.id, item.id));
      }
    }

    // Update survey updatedAt
    await db
      .update(surveys)
      .set({ updatedAt: new Date() })
      .where(eq(surveys.id, surveyId));

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Failed to reorder items", error);
    return res.status(500).json({ error: "internal_error" });
  }
}
