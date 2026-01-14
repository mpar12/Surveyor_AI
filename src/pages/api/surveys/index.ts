import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/db/client";
import { surveys, surveySections, surveyQuestions } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import type { CreateSurveyRequest, SurveyWithSections } from "@/types/surveyBuilder";
import { defaultSurveySettings } from "@/types/surveyBuilder";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    return handleGet(req, res);
  }

  if (req.method === "POST") {
    return handlePost(req, res);
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "method_not_allowed" });
}

async function handleGet(_req: NextApiRequest, res: NextApiResponse) {
  try {
    const allSurveys = await db
      .select()
      .from(surveys)
      .orderBy(desc(surveys.createdAt));

    return res.status(200).json({ surveys: allSurveys });
  } catch (error) {
    console.error("Failed to fetch surveys", error);
    return res.status(500).json({ error: "internal_error" });
  }
}

async function handlePost(req: NextApiRequest, res: NextApiResponse) {
  try {
    const body = req.body as CreateSurveyRequest;

    if (!body.title || typeof body.title !== "string") {
      return res.status(400).json({ error: "title_required" });
    }

    // Create survey
    const [newSurvey] = await db
      .insert(surveys)
      .values({
        title: body.title.trim(),
        description: body.description?.trim() || null,
        sessionId: body.sessionId || null,
        status: "draft",
        version: 1,
        accessType: "anonymous",
        settings: defaultSurveySettings,
      })
      .returning();

    // Create default welcome section
    const [welcomeSection] = await db
      .insert(surveySections)
      .values({
        surveyId: newSurvey.id,
        title: "Welcome",
        description: "Introduction and welcome message",
        order: 0,
      })
      .returning();

    // Create default first section
    const [firstSection] = await db
      .insert(surveySections)
      .values({
        surveyId: newSurvey.id,
        title: "Section 1",
        description: "",
        order: 1,
      })
      .returning();

    // Return full survey with sections
    const result: SurveyWithSections = {
      id: newSurvey.id,
      sessionId: newSurvey.sessionId ?? undefined,
      title: newSurvey.title,
      description: newSurvey.description ?? undefined,
      status: newSurvey.status as "draft" | "published",
      version: newSurvey.version,
      accessType: newSurvey.accessType as "anonymous" | "unique_links" | "verified",
      settings: newSurvey.settings as SurveyWithSections["settings"],
      createdAt: newSurvey.createdAt ?? new Date(),
      updatedAt: newSurvey.updatedAt ?? new Date(),
      publishedAt: newSurvey.publishedAt ?? undefined,
      sections: [
        {
          id: welcomeSection.id,
          surveyId: welcomeSection.surveyId,
          title: welcomeSection.title,
          description: welcomeSection.description ?? undefined,
          order: welcomeSection.order,
          createdAt: welcomeSection.createdAt ?? new Date(),
          questions: [],
        },
        {
          id: firstSection.id,
          surveyId: firstSection.surveyId,
          title: firstSection.title,
          description: firstSection.description ?? undefined,
          order: firstSection.order,
          createdAt: firstSection.createdAt ?? new Date(),
          questions: [],
        },
      ],
    };

    return res.status(201).json({ survey: result });
  } catch (error) {
    console.error("Failed to create survey", error);
    return res.status(500).json({ error: "internal_error" });
  }
}
