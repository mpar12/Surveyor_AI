import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/db/client";
import { surveys, surveySections, surveyQuestions } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import type { QuestionType, QuestionSettings, SurveySettings } from "@/types/surveyBuilder";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const { id: surveyId } = req.query;

  if (typeof surveyId !== "string") {
    return res.status(400).json({ error: "invalid_survey_id" });
  }

  try {
    // Get survey (must be published or allow draft preview)
    const [survey] = await db
      .select()
      .from(surveys)
      .where(eq(surveys.id, surveyId))
      .limit(1);

    if (!survey) {
      return res.status(404).json({ error: "survey_not_found" });
    }

    // Get sections
    const sections = await db
      .select()
      .from(surveySections)
      .where(eq(surveySections.surveyId, surveyId))
      .orderBy(asc(surveySections.order));

    // Get all questions with their sections
    const allQuestions = [];
    for (const section of sections) {
      const questions = await db
        .select()
        .from(surveyQuestions)
        .where(eq(surveyQuestions.sectionId, section.id))
        .orderBy(asc(surveyQuestions.order));

      for (const question of questions) {
        allQuestions.push({
          id: question.id,
          sectionId: question.sectionId,
          sectionTitle: section.title,
          type: question.type as QuestionType,
          text: question.text,
          description: question.description ?? undefined,
          settings: question.settings as QuestionSettings | undefined,
        });
      }
    }

    return res.status(200).json({
      survey: {
        id: survey.id,
        title: survey.title,
        description: survey.description ?? undefined,
        status: survey.status,
        version: survey.version,
        settings: survey.settings as SurveySettings | undefined,
      },
      questions: allQuestions,
    });
  } catch (error) {
    console.error("Failed to fetch survey for taking", error);
    return res.status(500).json({ error: "internal_error" });
  }
}
