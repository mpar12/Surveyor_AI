import { afterEach, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  sessionContexts,
  sessions,
  surveyQuestions,
  surveySections,
  surveys,
} from "@/db/schema";
import sessionsHandler from "@/pages/api/sessions";
import contextHandler from "@/pages/api/sessions/context";
import surveysHandler from "@/pages/api/surveys/index";
import { callApi } from "./helpers/api";

type SessionResponse = { sessionId: string; pin: string };

type SurveyResponse = {
  survey?: {
    id: string;
    title: string;
  };
};

type ErrorResponse = { error?: string };

type ContextResponse = {
  sessionId?: string;
  prompt?: string | null;
};

const createdSessionIds = new Set<string>();
const createdSurveyIds = new Set<string>();

const cleanupSessions = async () => {
  const sessionIds = Array.from(createdSessionIds);
  if (sessionIds.length === 0) return;

  await db.delete(sessionContexts).where(inArray(sessionContexts.sessionId, sessionIds));
  await db.delete(sessions).where(inArray(sessions.sessionId, sessionIds));
  createdSessionIds.clear();
};

const cleanupSurveys = async () => {
  const surveyIds = Array.from(createdSurveyIds);
  if (surveyIds.length === 0) return;

  const sections = await db
    .select({ id: surveySections.id })
    .from(surveySections)
    .where(inArray(surveySections.surveyId, surveyIds));
  const sectionIds = sections.map((section) => section.id);

  if (sectionIds.length > 0) {
    await db
      .delete(surveyQuestions)
      .where(inArray(surveyQuestions.sectionId, sectionIds));
  }

  await db.delete(surveySections).where(inArray(surveySections.surveyId, surveyIds));
  await db.delete(surveys).where(inArray(surveys.id, surveyIds));
  createdSurveyIds.clear();
};

afterEach(async () => {
  await cleanupSurveys();
  await cleanupSessions();
});

describe("Invariant: session context access", () => {
  it("rejects session context lookups with the wrong pin", async () => {
    const sessionResult = await callApi<SessionResponse>(sessionsHandler, { method: "POST" });
    expect(sessionResult.status).toBe(201);
    expect(sessionResult.json?.sessionId).toBeTruthy();
    expect(sessionResult.json?.pin).toBeTruthy();

    const sessionId = sessionResult.json!.sessionId;
    const pin = sessionResult.json!.pin;
    createdSessionIds.add(sessionId);

    const contextPayload = {
      sessionId,
      requester: "Invariant Test",
      prompt: "Testing session context",
    };

    const contextResult = await callApi<ErrorResponse>(contextHandler, {
      method: "POST",
      body: contextPayload,
    });
    expect(contextResult.status).toBe(200);

    const wrongPin = pin === "0000" ? "9999" : "0000";
    const invalidResult = await callApi<ErrorResponse>(contextHandler, {
      method: "GET",
      query: { sessionId, pin: wrongPin },
    });
    expect(invalidResult.status).toBe(401);

    const validResult = await callApi<ContextResponse>(contextHandler, {
      method: "GET",
      query: { sessionId, pin },
    });
    expect(validResult.status).toBe(200);
    expect(validResult.json?.sessionId).toBe(sessionId);
    expect(validResult.json?.prompt).toBe(contextPayload.prompt);
  });

  it("upserts session context without creating duplicates", async () => {
    const sessionResult = await callApi<SessionResponse>(sessionsHandler, { method: "POST" });
    expect(sessionResult.status).toBe(201);

    const sessionId = sessionResult.json!.sessionId;
    createdSessionIds.add(sessionId);

    const firstPayload = {
      sessionId,
      requester: "Invariant Test",
      prompt: "First prompt",
    };

    const secondPayload = {
      sessionId,
      requester: "Invariant Test",
      prompt: "Second prompt",
    };

    const firstResult = await callApi<ErrorResponse>(contextHandler, {
      method: "POST",
      body: firstPayload,
    });
    expect(firstResult.status).toBe(200);

    const secondResult = await callApi<ErrorResponse>(contextHandler, {
      method: "POST",
      body: secondPayload,
    });
    expect(secondResult.status).toBe(200);

    const rows = await db
      .select({ sessionId: sessionContexts.sessionId, prompt: sessionContexts.prompt })
      .from(sessionContexts)
      .where(eq(sessionContexts.sessionId, sessionId));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.prompt).toBe(secondPayload.prompt);
  });
});

describe("Invariant: survey creation", () => {
  it("rejects survey creation without a title", async () => {
    const before = await db.select({ id: surveys.id }).from(surveys);

    const result = await callApi<ErrorResponse>(surveysHandler, {
      method: "POST",
      body: { description: "Missing title" },
    });

    expect(result.status).toBe(400);
    expect(result.json?.error).toBe("title_required");

    const after = await db.select({ id: surveys.id }).from(surveys);
    expect(after.length).toBe(before.length);
  });

  it("creates default sections alongside a new survey", async () => {
    const result = await callApi<SurveyResponse>(surveysHandler, {
      method: "POST",
      body: { title: "Invariant survey" },
    });

    expect(result.status).toBe(201);
    expect(result.json?.survey?.id).toBeTruthy();

    const surveyId = result.json!.survey!.id;
    createdSurveyIds.add(surveyId);

    const sections = await db
      .select({ id: surveySections.id, title: surveySections.title, order: surveySections.order })
      .from(surveySections)
      .where(eq(surveySections.surveyId, surveyId));

    expect(sections).toHaveLength(2);
    const sectionTitles = sections.map((section) => section.title);
    expect(sectionTitles).toContain("Welcome");
    expect(sectionTitles).toContain("Section 1");
  });
});
