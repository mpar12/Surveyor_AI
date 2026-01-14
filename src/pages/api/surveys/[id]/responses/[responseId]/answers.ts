import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/db/client";
import { surveyResponses, surveyAnswers } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { SubmitAnswerRequest, AnswerType } from "@/types/surveyBuilder";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { responseId } = req.query;

  if (typeof responseId !== "string") {
    return res.status(400).json({ error: "invalid_response_id" });
  }

  if (req.method === "POST") {
    return handlePost(responseId, req, res);
  }

  res.setHeader("Allow", "POST");
  return res.status(405).json({ error: "method_not_allowed" });
}

async function handlePost(responseId: string, req: NextApiRequest, res: NextApiResponse) {
  try {
    const body = req.body as SubmitAnswerRequest;

    if (!body.questionId) {
      return res.status(400).json({ error: "question_id_required" });
    }

    if (!body.answerType) {
      return res.status(400).json({ error: "answer_type_required" });
    }

    // Verify response exists and is in progress
    const [response] = await db
      .select()
      .from(surveyResponses)
      .where(eq(surveyResponses.id, responseId))
      .limit(1);

    if (!response) {
      return res.status(404).json({ error: "response_not_found" });
    }

    if (response.status !== "in_progress") {
      return res.status(400).json({ error: "response_already_completed" });
    }

    // Check if answer already exists for this question
    const [existingAnswer] = await db
      .select()
      .from(surveyAnswers)
      .where(eq(surveyAnswers.responseId, responseId))
      .limit(1);

    // Create or update answer
    const answerData = {
      responseId,
      questionId: body.questionId,
      answerType: body.answerType as AnswerType,
      choiceIds: body.choiceIds || null,
      textValue: body.textValue || null,
      voiceUrl: body.voiceUrl || null,
      transcript: body.transcript || null,
    };

    const [answer] = await db
      .insert(surveyAnswers)
      .values(answerData)
      .returning();

    return res.status(201).json({ answer });
  } catch (error) {
    console.error("Failed to submit answer", error);
    return res.status(500).json({ error: "internal_error" });
  }
}
