import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/db/client";
import { surveys, surveyResponses } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id: surveyId } = req.query;

  if (typeof surveyId !== "string") {
    return res.status(400).json({ error: "invalid_survey_id" });
  }

  if (req.method === "POST") {
    return handlePost(surveyId, req, res);
  }

  res.setHeader("Allow", "POST");
  return res.status(405).json({ error: "method_not_allowed" });
}

async function handlePost(surveyId: string, req: NextApiRequest, res: NextApiResponse) {
  try {
    const { respondentId, respondentEmail } = req.body as {
      respondentId?: string;
      respondentEmail?: string;
    };

    // Get survey to verify it exists and get version
    const [survey] = await db
      .select()
      .from(surveys)
      .where(eq(surveys.id, surveyId))
      .limit(1);

    if (!survey) {
      return res.status(404).json({ error: "survey_not_found" });
    }

    // Create response
    const [response] = await db
      .insert(surveyResponses)
      .values({
        surveyId,
        surveyVersion: survey.version,
        respondentId: respondentId || null,
        respondentEmail: respondentEmail || null,
        status: "in_progress",
      })
      .returning();

    return res.status(201).json({ response });
  } catch (error) {
    console.error("Failed to create response", error);
    return res.status(500).json({ error: "internal_error" });
  }
}
