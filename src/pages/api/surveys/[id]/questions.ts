import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/db/client";
import { surveys, surveySections, surveyQuestions } from "@/db/schema";
import { eq, asc, max } from "drizzle-orm";
import type { CreateQuestionRequest, UpdateQuestionRequest } from "@/types/surveyBuilder";
import { getDefaultSettingsForType } from "@/types/surveyBuilder";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id: surveyId, questionId } = req.query;

  if (typeof surveyId !== "string") {
    return res.status(400).json({ error: "invalid_survey_id" });
  }

  // Verify survey exists
  const [survey] = await db
    .select()
    .from(surveys)
    .where(eq(surveys.id, surveyId))
    .limit(1);

  if (!survey) {
    return res.status(404).json({ error: "survey_not_found" });
  }

  if (req.method === "GET") {
    return handleGet(surveyId, res);
  }

  if (req.method === "POST") {
    return handlePost(req, res);
  }

  if (req.method === "PUT") {
    if (typeof questionId !== "string") {
      return res.status(400).json({ error: "question_id_required" });
    }
    return handlePut(questionId, req, res);
  }

  if (req.method === "DELETE") {
    if (typeof questionId !== "string") {
      return res.status(400).json({ error: "question_id_required" });
    }
    return handleDelete(questionId, res);
  }

  res.setHeader("Allow", "GET, POST, PUT, DELETE");
  return res.status(405).json({ error: "method_not_allowed" });
}

async function handleGet(surveyId: string, res: NextApiResponse) {
  try {
    // Get all sections for this survey
    const sections = await db
      .select({ id: surveySections.id })
      .from(surveySections)
      .where(eq(surveySections.surveyId, surveyId));

    const sectionIds = sections.map((s) => s.id);

    if (sectionIds.length === 0) {
      return res.status(200).json({ questions: [] });
    }

    // Get all questions for these sections
    const questions = await db
      .select()
      .from(surveyQuestions)
      .orderBy(asc(surveyQuestions.order));

    // Filter to only questions in this survey's sections
    const filteredQuestions = questions.filter((q) => sectionIds.includes(q.sectionId));

    return res.status(200).json({ questions: filteredQuestions });
  } catch (error) {
    console.error("Failed to fetch questions", error);
    return res.status(500).json({ error: "internal_error" });
  }
}

async function handlePost(req: NextApiRequest, res: NextApiResponse) {
  try {
    const body = req.body as CreateQuestionRequest;

    if (!body.sectionId || typeof body.sectionId !== "string") {
      return res.status(400).json({ error: "section_id_required" });
    }

    if (!body.type || typeof body.type !== "string") {
      return res.status(400).json({ error: "type_required" });
    }

    if (!body.text || typeof body.text !== "string") {
      return res.status(400).json({ error: "text_required" });
    }

    // Verify section exists
    const [section] = await db
      .select()
      .from(surveySections)
      .where(eq(surveySections.id, body.sectionId))
      .limit(1);

    if (!section) {
      return res.status(404).json({ error: "section_not_found" });
    }

    // Get max order for this section
    const [maxOrderResult] = await db
      .select({ maxOrder: max(surveyQuestions.order) })
      .from(surveyQuestions)
      .where(eq(surveyQuestions.sectionId, body.sectionId));

    const nextOrder = (maxOrderResult?.maxOrder ?? -1) + 1;

    // Get default settings for this question type
    const defaultSettings = getDefaultSettingsForType(body.type as "multiple_choice" | "open_ended" | "statement");

    const [newQuestion] = await db
      .insert(surveyQuestions)
      .values({
        sectionId: body.sectionId,
        type: body.type,
        text: body.text.trim(),
        description: body.description?.trim() || null,
        order: body.order ?? nextOrder,
        settings: body.settings ?? defaultSettings,
      })
      .returning();

    return res.status(201).json({ question: newQuestion });
  } catch (error) {
    console.error("Failed to create question", error);
    return res.status(500).json({ error: "internal_error" });
  }
}

async function handlePut(questionId: string, req: NextApiRequest, res: NextApiResponse) {
  try {
    const body = req.body as UpdateQuestionRequest;

    // Check question exists
    const [existing] = await db
      .select()
      .from(surveyQuestions)
      .where(eq(surveyQuestions.id, questionId))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: "question_not_found" });
    }

    // Build update object
    const updateData: Record<string, unknown> = {};

    if (body.type !== undefined) {
      updateData.type = body.type;
    }
    if (body.text !== undefined) {
      updateData.text = body.text.trim();
    }
    if (body.description !== undefined) {
      updateData.description = body.description?.trim() || null;
    }
    if (body.order !== undefined) {
      updateData.order = body.order;
    }
    if (body.settings !== undefined) {
      updateData.settings = body.settings;
    }
    if (body.skipLogic !== undefined) {
      updateData.skipLogic = body.skipLogic;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(200).json({ question: existing });
    }

    const [updated] = await db
      .update(surveyQuestions)
      .set(updateData)
      .where(eq(surveyQuestions.id, questionId))
      .returning();

    return res.status(200).json({ question: updated });
  } catch (error) {
    console.error("Failed to update question", error);
    return res.status(500).json({ error: "internal_error" });
  }
}

async function handleDelete(questionId: string, res: NextApiResponse) {
  try {
    // Check question exists
    const [existing] = await db
      .select()
      .from(surveyQuestions)
      .where(eq(surveyQuestions.id, questionId))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: "question_not_found" });
    }

    // Delete question
    await db
      .delete(surveyQuestions)
      .where(eq(surveyQuestions.id, questionId));

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Failed to delete question", error);
    return res.status(500).json({ error: "internal_error" });
  }
}
