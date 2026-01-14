import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/db/client";
import { surveys, surveyQuestions, surveyAnswers, surveyFollowups } from "@/db/schema";
import { eq } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY || process.env.claude_api_key,
});

const FOLLOWUP_SYSTEM_PROMPT = `You are conducting a research interview. Your role is to ask ONE natural follow-up question based on the participant's response.

Guidelines:
- Be curious and specific to what they said
- Dig deeper into interesting points they mentioned
- Ask "why" or "how" questions to understand their reasoning
- Keep the question conversational, not formal
- Do not repeat or summarize what they said
- Generate only ONE question, no other text
- If they gave a very short or unclear response, gently ask them to elaborate`;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const { id: surveyId } = req.query;
  const { answerId, questionId, responseText } = req.body;

  if (!surveyId || typeof surveyId !== "string") {
    return res.status(400).json({ error: "missing_survey_id" });
  }

  if (!answerId || !questionId || !responseText) {
    return res.status(400).json({ error: "missing_required_fields" });
  }

  try {
    // Get the survey for context
    const [survey] = await db
      .select()
      .from(surveys)
      .where(eq(surveys.id, surveyId))
      .limit(1);

    if (!survey) {
      return res.status(404).json({ error: "survey_not_found" });
    }

    // Get the original question
    const [question] = await db
      .select()
      .from(surveyQuestions)
      .where(eq(surveyQuestions.id, questionId))
      .limit(1);

    if (!question) {
      return res.status(404).json({ error: "question_not_found" });
    }

    // Generate follow-up using Claude
    const message = await anthropic.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 200,
      system: FOLLOWUP_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Survey context: ${survey.description || survey.title}

Original question: ${question.text}

Participant's response: ${responseText}

Generate a natural follow-up question:`,
        },
      ],
    });

    const followupText = message.content[0].type === "text"
      ? message.content[0].text.trim()
      : "";

    if (!followupText) {
      return res.status(200).json({ followup: null });
    }

    // Store the follow-up question in the database
    const [followup] = await db
      .insert(surveyFollowups)
      .values({
        answerId,
        questionText: followupText,
      })
      .returning();

    return res.status(200).json({
      followup: {
        id: followup.id,
        questionText: followupText,
      },
    });
  } catch (error) {
    console.error("Failed to generate follow-up:", error);
    return res.status(500).json({ error: "internal_error" });
  }
}
