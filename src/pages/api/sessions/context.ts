import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/db/client";
import { sessionContexts, sessions } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const { sessionId, pin } = req.query;

    if (typeof sessionId !== "string" || !sessionId.trim()) {
      return res.status(400).json({ error: "session_id_required" });
    }

    if (typeof pin !== "string" || !pin.trim()) {
      return res.status(400).json({ error: "pin_required" });
    }

    try {
      // Validate pin against session
      const session = await db
        .select()
        .from(sessions)
        .where(eq(sessions.sessionId, sessionId))
        .limit(1);

      if (!session.length || session[0].pinCode !== pin) {
        return res.status(401).json({ error: "invalid_session_or_pin" });
      }

      // Get session context
      const context = await db
        .select()
        .from(sessionContexts)
        .where(eq(sessionContexts.sessionId, sessionId))
        .limit(1);

      if (!context.length) {
        return res.status(404).json({ error: "session_context_not_found" });
      }

      const contextData = context[0];
      return res.status(200).json({
        sessionId: contextData.sessionId,
        requester: contextData.requester,
        prompt: contextData.prompt,
        company: contextData.company,
        product: contextData.product,
        feedbackDesired: contextData.feedbackDesired,
        desiredIcp: contextData.desiredIcp,
        desiredIcpIndustry: contextData.desiredIcpIndustry,
        desiredIcpRegion: contextData.desiredIcpRegion,
        keyQuestions: contextData.keyQuestions,
        surveyQuestions: contextData.surveyQuestions,
        updatedAt: contextData.updatedAt
      });
    } catch (error) {
      console.error("Failed to retrieve session context", error);
      return res.status(500).json({ error: "internal_error" });
    }
  }

  if (req.method === "POST") {
    const {
      sessionId,
      requester,
      company,
      product,
      feedbackDesired,
      prompt,
      desiredIcp,
      desiredIcpIndustry,
      desiredIcpRegion,
      keyQuestions,
      surveyQuestions
    } = req.body ?? {};

  if (typeof sessionId !== "string" || !sessionId.trim()) {
    return res.status(400).json({ error: "session_id_required" });
  }

  try {
    const normalizeSurveyQuestions = (value: unknown): string | string[] | null => {
      if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed ? trimmed : null;
      }

      if (Array.isArray(value)) {
        const sanitized = value
          .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
          .filter((entry): entry is string => Boolean(entry));
        return sanitized.length ? sanitized : null;
      }

      if (value && typeof value === "object") {
        const record = value as Record<string, unknown>;
        if (typeof record.paragraph === "string" && record.paragraph.trim()) {
          return record.paragraph.trim();
        }
      }

      return null;
    };

    const payload = {
      sessionId,
      requester: typeof requester === "string" ? requester : null,
      prompt: typeof prompt === "string" ? prompt : null,
      company: typeof company === "string" ? company : null,
      product: typeof product === "string" ? product : null,
      feedbackDesired: typeof feedbackDesired === "string" ? feedbackDesired : null,
      desiredIcp: typeof desiredIcp === "string" ? desiredIcp : null,
      desiredIcpIndustry: typeof desiredIcpIndustry === "string" ? desiredIcpIndustry : null,
      desiredIcpRegion: typeof desiredIcpRegion === "string" ? desiredIcpRegion : null,
      keyQuestions: typeof keyQuestions === "string" ? keyQuestions : null,
      surveyQuestions: normalizeSurveyQuestions(surveyQuestions),
      updatedAt: new Date()
    };

    await db
      .insert(sessionContexts)
      .values(payload)
      .onConflictDoUpdate({
        target: sessionContexts.sessionId,
        set: {
          requester: payload.requester,
          prompt: payload.prompt,
          company: payload.company,
          product: payload.product,
          feedbackDesired: payload.feedbackDesired,
          desiredIcp: payload.desiredIcp,
          desiredIcpIndustry: payload.desiredIcpIndustry,
          desiredIcpRegion: payload.desiredIcpRegion,
          keyQuestions: payload.keyQuestions,
          surveyQuestions: payload.surveyQuestions,
          updatedAt: payload.updatedAt
        }
      });

    return res.status(200).json({ status: "stored" });
  } catch (error) {
    console.error("Failed to store session context", error);
    return res.status(500).json({ error: "internal_error" });
  }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "method_not_allowed" });
}
