import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/db/client";
import { surveys, surveySections, surveyQuestions } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import type { UpdateSurveyRequest, SurveyWithSections, SurveySectionWithQuestions, QuestionType, QuestionSettings, SkipLogic } from "@/types/surveyBuilder";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (typeof id !== "string") {
    return res.status(400).json({ error: "invalid_survey_id" });
  }

  if (req.method === "GET") {
    return handleGet(id, res);
  }

  if (req.method === "PUT") {
    return handlePut(id, req, res);
  }

  if (req.method === "DELETE") {
    return handleDelete(id, res);
  }

  res.setHeader("Allow", "GET, PUT, DELETE");
  return res.status(405).json({ error: "method_not_allowed" });
}

async function handleGet(surveyId: string, res: NextApiResponse) {
  try {
    // Get survey
    const [survey] = await db
      .select()
      .from(surveys)
      .where(eq(surveys.id, surveyId))
      .limit(1);

    if (!survey) {
      return res.status(404).json({ error: "survey_not_found" });
    }

    // Get sections ordered by order
    const sections = await db
      .select()
      .from(surveySections)
      .where(eq(surveySections.surveyId, surveyId))
      .orderBy(asc(surveySections.order));

    // Get questions for each section
    const sectionsWithQuestions: SurveySectionWithQuestions[] = await Promise.all(
      sections.map(async (section) => {
        const questions = await db
          .select()
          .from(surveyQuestions)
          .where(eq(surveyQuestions.sectionId, section.id))
          .orderBy(asc(surveyQuestions.order));

        return {
          id: section.id,
          surveyId: section.surveyId,
          title: section.title,
          description: section.description ?? undefined,
          order: section.order,
          createdAt: section.createdAt ?? new Date(),
          questions: questions.map((q) => ({
            id: q.id,
            sectionId: q.sectionId,
            type: q.type as QuestionType,
            text: q.text,
            description: q.description ?? undefined,
            order: q.order,
            settings: q.settings as QuestionSettings | undefined,
            skipLogic: q.skipLogic as SkipLogic | undefined,
            createdAt: q.createdAt ?? new Date(),
          })),
        };
      })
    );

    const result: SurveyWithSections = {
      id: survey.id,
      sessionId: survey.sessionId ?? undefined,
      title: survey.title,
      description: survey.description ?? undefined,
      status: survey.status as "draft" | "published",
      version: survey.version,
      accessType: survey.accessType as "anonymous" | "unique_links" | "verified",
      settings: survey.settings as SurveyWithSections["settings"],
      createdAt: survey.createdAt ?? new Date(),
      updatedAt: survey.updatedAt ?? new Date(),
      publishedAt: survey.publishedAt ?? undefined,
      sections: sectionsWithQuestions,
    };

    return res.status(200).json({ survey: result });
  } catch (error) {
    console.error("Failed to fetch survey", error);
    return res.status(500).json({ error: "internal_error" });
  }
}

async function handlePut(surveyId: string, req: NextApiRequest, res: NextApiResponse) {
  try {
    const body = req.body as UpdateSurveyRequest;

    // Check survey exists
    const [existing] = await db
      .select()
      .from(surveys)
      .where(eq(surveys.id, surveyId))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: "survey_not_found" });
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (body.title !== undefined) {
      updateData.title = body.title.trim();
    }
    if (body.description !== undefined) {
      updateData.description = body.description?.trim() || null;
    }
    if (body.accessType !== undefined) {
      updateData.accessType = body.accessType;
    }
    if (body.settings !== undefined) {
      updateData.settings = body.settings;
    }

    const [updated] = await db
      .update(surveys)
      .set(updateData)
      .where(eq(surveys.id, surveyId))
      .returning();

    return res.status(200).json({ survey: updated });
  } catch (error) {
    console.error("Failed to update survey", error);
    return res.status(500).json({ error: "internal_error" });
  }
}

async function handleDelete(surveyId: string, res: NextApiResponse) {
  try {
    // Check survey exists
    const [existing] = await db
      .select()
      .from(surveys)
      .where(eq(surveys.id, surveyId))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: "survey_not_found" });
    }

    // Get all sections to delete questions
    const sections = await db
      .select({ id: surveySections.id })
      .from(surveySections)
      .where(eq(surveySections.surveyId, surveyId));

    // Delete questions for all sections
    for (const section of sections) {
      await db
        .delete(surveyQuestions)
        .where(eq(surveyQuestions.sectionId, section.id));
    }

    // Delete sections
    await db
      .delete(surveySections)
      .where(eq(surveySections.surveyId, surveyId));

    // Delete survey
    await db
      .delete(surveys)
      .where(eq(surveys.id, surveyId));

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Failed to delete survey", error);
    return res.status(500).json({ error: "internal_error" });
  }
}
