import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/db/client";
import { surveyResponses } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const { responseId } = req.query;

  if (typeof responseId !== "string") {
    return res.status(400).json({ error: "invalid_response_id" });
  }

  try {
    // Verify response exists
    const [response] = await db
      .select()
      .from(surveyResponses)
      .where(eq(surveyResponses.id, responseId))
      .limit(1);

    if (!response) {
      return res.status(404).json({ error: "response_not_found" });
    }

    if (response.status === "completed") {
      return res.status(200).json({ response });
    }

    // Mark as completed
    const [updated] = await db
      .update(surveyResponses)
      .set({
        status: "completed",
        completedAt: new Date(),
      })
      .where(eq(surveyResponses.id, responseId))
      .returning();

    return res.status(200).json({ response: updated });
  } catch (error) {
    console.error("Failed to complete response", error);
    return res.status(500).json({ error: "internal_error" });
  }
}
