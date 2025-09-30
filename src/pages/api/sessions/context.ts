import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/db/client";
import { sessionContexts } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const {
    sessionId,
    requester,
    company,
    product,
    feedbackDesired,
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
    const payload = {
      sessionId,
      requester: typeof requester === "string" ? requester : null,
      company: typeof company === "string" ? company : null,
      product: typeof product === "string" ? product : null,
      feedbackDesired: typeof feedbackDesired === "string" ? feedbackDesired : null,
      desiredIcp: typeof desiredIcp === "string" ? desiredIcp : null,
      desiredIcpIndustry: typeof desiredIcpIndustry === "string" ? desiredIcpIndustry : null,
      desiredIcpRegion: typeof desiredIcpRegion === "string" ? desiredIcpRegion : null,
      keyQuestions: typeof keyQuestions === "string" ? keyQuestions : null,
      surveyQuestions: Array.isArray(surveyQuestions)
        ? (surveyQuestions as string[])
        : typeof surveyQuestions === "string" && surveyQuestions.trim()
          ? (() => {
              try {
                const parsed = JSON.parse(surveyQuestions);
                return Array.isArray(parsed) ? parsed : [surveyQuestions];
              } catch (error) {
                return [surveyQuestions];
              }
            })()
          : null,
      updatedAt: new Date()
    };

    await db
      .insert(sessionContexts)
      .values(payload)
      .onConflictDoUpdate({
        target: sessionContexts.sessionId,
        set: {
          requester: payload.requester,
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
