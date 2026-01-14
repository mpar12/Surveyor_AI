import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/db/client";
import { surveys, surveySections, surveyQuestions } from "@/db/schema";
import { eq, asc, max } from "drizzle-orm";
import type { CreateSectionRequest, UpdateSectionRequest } from "@/types/surveyBuilder";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id: surveyId, sectionId } = req.query;

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
    return handlePost(surveyId, req, res);
  }

  if (req.method === "PUT") {
    if (typeof sectionId !== "string") {
      return res.status(400).json({ error: "section_id_required" });
    }
    return handlePut(sectionId, req, res);
  }

  if (req.method === "DELETE") {
    if (typeof sectionId !== "string") {
      return res.status(400).json({ error: "section_id_required" });
    }
    return handleDelete(sectionId, res);
  }

  res.setHeader("Allow", "GET, POST, PUT, DELETE");
  return res.status(405).json({ error: "method_not_allowed" });
}

async function handleGet(surveyId: string, res: NextApiResponse) {
  try {
    const sections = await db
      .select()
      .from(surveySections)
      .where(eq(surveySections.surveyId, surveyId))
      .orderBy(asc(surveySections.order));

    return res.status(200).json({ sections });
  } catch (error) {
    console.error("Failed to fetch sections", error);
    return res.status(500).json({ error: "internal_error" });
  }
}

async function handlePost(surveyId: string, req: NextApiRequest, res: NextApiResponse) {
  try {
    const body = req.body as CreateSectionRequest;

    if (!body.title || typeof body.title !== "string") {
      return res.status(400).json({ error: "title_required" });
    }

    // Get max order for this survey
    const [maxOrderResult] = await db
      .select({ maxOrder: max(surveySections.order) })
      .from(surveySections)
      .where(eq(surveySections.surveyId, surveyId));

    const nextOrder = (maxOrderResult?.maxOrder ?? -1) + 1;

    const [newSection] = await db
      .insert(surveySections)
      .values({
        surveyId,
        title: body.title.trim(),
        description: body.description?.trim() || null,
        order: body.order ?? nextOrder,
      })
      .returning();

    return res.status(201).json({ section: newSection });
  } catch (error) {
    console.error("Failed to create section", error);
    return res.status(500).json({ error: "internal_error" });
  }
}

async function handlePut(sectionId: string, req: NextApiRequest, res: NextApiResponse) {
  try {
    const body = req.body as UpdateSectionRequest;

    // Check section exists
    const [existing] = await db
      .select()
      .from(surveySections)
      .where(eq(surveySections.id, sectionId))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: "section_not_found" });
    }

    // Build update object
    const updateData: Record<string, unknown> = {};

    if (body.title !== undefined) {
      updateData.title = body.title.trim();
    }
    if (body.description !== undefined) {
      updateData.description = body.description?.trim() || null;
    }
    if (body.order !== undefined) {
      updateData.order = body.order;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(200).json({ section: existing });
    }

    const [updated] = await db
      .update(surveySections)
      .set(updateData)
      .where(eq(surveySections.id, sectionId))
      .returning();

    return res.status(200).json({ section: updated });
  } catch (error) {
    console.error("Failed to update section", error);
    return res.status(500).json({ error: "internal_error" });
  }
}

async function handleDelete(sectionId: string, res: NextApiResponse) {
  try {
    // Check section exists
    const [existing] = await db
      .select()
      .from(surveySections)
      .where(eq(surveySections.id, sectionId))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: "section_not_found" });
    }

    // Delete all questions in this section
    await db
      .delete(surveyQuestions)
      .where(eq(surveyQuestions.sectionId, sectionId));

    // Delete section
    await db
      .delete(surveySections)
      .where(eq(surveySections.id, sectionId));

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Failed to delete section", error);
    return res.status(500).json({ error: "internal_error" });
  }
}
