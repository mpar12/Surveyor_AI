import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";
import { db } from "@/db/client";
import { convaiTranscripts, sessionContexts, sessions } from "@/db/schema";
import { desc, eq, or } from "drizzle-orm";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type TakeawaysResponse = {
  analysis: string;
  recurringThemes: string[];
  interestingHighlights: Array<{ quote: string; participant: string }>;
};

type ErrorResponse = { error: string };

type TranscriptTurn = {
  speaker: "agent" | "participant";
  text: string;
};

const detectSpeaker = (entry: Record<string, unknown>): "agent" | "participant" | null => {
  const candidateKeys = ["speaker", "role", "from", "actor", "entity"];

  for (const key of candidateKeys) {
    const raw = entry[key];
    if (typeof raw !== "string") {
      continue;
    }

    const normalized = raw.trim().toLowerCase();

    if (
      normalized.includes("agent") ||
      normalized.includes("assistant") ||
      normalized.includes("ai") ||
      normalized.includes("survagent") ||
      normalized.includes("system")
    ) {
      return "agent";
    }

    if (
      normalized.includes("user") ||
      normalized.includes("participant") ||
      normalized.includes("customer") ||
      normalized.includes("caller") ||
      normalized.includes("prospect") ||
      normalized.includes("client") ||
      normalized.includes("human")
    ) {
      return "participant";
    }
  }

  if (typeof entry.agent === "boolean") {
    return entry.agent ? "agent" : "participant";
  }

  if (typeof entry.is_user === "boolean") {
    return entry.is_user ? "participant" : "agent";
  }

  return null;
};

const valueToText = (value: unknown): string => {
  if (typeof value === "string") {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => valueToText(item))
      .filter(Boolean)
      .join(" ");
  }

  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = ["text", "content", "value", "utterance", "message", "transcript"];

    for (const key of keys) {
      if (key in obj) {
        const nested = valueToText(obj[key]);
        if (nested) {
          return nested;
        }
      }
    }

    if (Array.isArray(obj.segments)) {
      const joined = obj.segments
        .map((segment) => valueToText(segment))
        .filter(Boolean)
        .join(" ");
      if (joined) {
        return joined;
      }
    }
  }

  return "";
};

const normalizeTranscript = (raw: unknown): TranscriptTurn[] => {
  if (!Array.isArray(raw)) {
    return [];
  }

  const turns: TranscriptTurn[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const speaker = detectSpeaker(entry as Record<string, unknown>);
    if (!speaker) {
      continue;
    }

    const text = valueToText(entry);
    if (!text) {
      continue;
    }

    turns.push({
      speaker,
      text: text.replace(/\s+/g, " ").trim()
    });
  }

  return turns;
};

const buildTranscriptSummary = (turns: TranscriptTurn[]): string => {
  if (!turns.length) {
    return "";
  }

  return turns
    .map((turn) => `${turn.speaker === "agent" ? "Agent" : "Participant"}: ${turn.text}`)
    .join("\n");
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TakeawaysResponse | ErrorResponse>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "OPENAI_API_KEY environment variable is not set." });
  }

  const { sessionId, pin } = req.body ?? {};

  if (typeof sessionId !== "string" || !sessionId.trim()) {
    return res.status(400).json({ error: "session_id_required" });
  }

  if (typeof pin !== "string" || !pin.trim()) {
    return res.status(400).json({ error: "pin_required" });
  }

  const normalizedPin = pin.trim();

  try {
    const sessionRows = await db
      .select({
        sessionId: sessions.sessionId,
        pinCode: sessions.pinCode
      })
      .from(sessions)
      .where(eq(sessions.sessionId, sessionId))
      .limit(1);

    if (!sessionRows.length || sessionRows[0].pinCode !== normalizedPin) {
      return res.status(401).json({ error: "invalid_session_or_pin" });
    }

    const contextRows = await db
      .select({
        prompt: sessionContexts.prompt,
        requester: sessionContexts.requester
      })
      .from(sessionContexts)
      .where(eq(sessionContexts.sessionId, sessionId))
      .limit(1);

    const prompt = contextRows[0]?.prompt ?? "";
    const requester = contextRows[0]?.requester ?? "";

    const transcriptCondition = normalizedPin
      ? or(eq(convaiTranscripts.sessionId, sessionId), eq(convaiTranscripts.pinCode, normalizedPin))
      : eq(convaiTranscripts.sessionId, sessionId);

    const transcriptRows = await db
      .select({
        conversationId: convaiTranscripts.conversationId,
        dynamicVariables: convaiTranscripts.dynamicVariables,
        transcript: convaiTranscripts.transcript
      })
      .from(convaiTranscripts)
      .where(transcriptCondition)
      .orderBy(desc(convaiTranscripts.receivedAt));

    if (!transcriptRows.length) {
      return res.status(200).json({
        analysis: "No completed conversations yet.",
        recurringThemes: [],
        interestingHighlights: []
      });
    }

    const formattedTranscripts = transcriptRows.map((row, index) => {
      const dynamicVars =
        row.dynamicVariables && typeof row.dynamicVariables === "object"
          ? (row.dynamicVariables as Record<string, unknown>)
          : {};
      const email =
        typeof dynamicVars.email_address === "string" && dynamicVars.email_address.trim()
          ? dynamicVars.email_address.trim()
          : `Participant ${index + 1}`;
      const turns = normalizeTranscript(row.transcript);
      const summary = buildTranscriptSummary(turns);

      return {
        label: email,
        summary
      };
    });

    const transcriptPayload = formattedTranscripts
      .map(
        (entry, index) =>
          `Participant ${index + 1} (${entry.label}):\n${entry.summary || "No transcript text."}`
      )
      .join("\n\n");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are an insights analyst summarizing AI-led customer interviews. Respond only with valid JSON."
        },
        {
          role: "user",
          content: `Research goal (provided by requester): ${prompt || "Not specified."}\nRequester: ${
            requester || "Unknown"
          }\n\nTranscript excerpts:\n${transcriptPayload}\n\nTasks:\n1. Provide a short paragraph labelled "AI Analysis" that synthesizes what we learned about the research goal.\n2. Provide 3-5 recurring themes as bullet-ready strings; each should name the theme and explain the supporting evidence across participants.\n3. Provide 2-3 interesting highlights as direct quotes along with the participant label in parentheses.\n\nReturn JSON with the following shape:\n{\n  "analysis": string,\n  "recurringThemes": string[],\n  "interestingHighlights": [\n    { "quote": string, "participant": string }\n  ]\n}`
        }
      ]
    });

    const content = completion.choices[0]?.message?.content;

    if (!content) {
      throw new Error("No content returned from OpenAI");
    }

    const parsed = JSON.parse(content) as Partial<TakeawaysResponse>;

    if (!parsed.analysis || !Array.isArray(parsed.recurringThemes) || !Array.isArray(parsed.interestingHighlights)) {
      throw new Error("Response missing required fields");
    }

    return res.status(200).json({
      analysis: parsed.analysis,
      recurringThemes: parsed.recurringThemes,
      interestingHighlights: parsed.interestingHighlights.slice(0, 3)
    });
  } catch (error) {
    console.error("Failed to build key takeaways", error);
    return res.status(500).json({ error: "failed_to_generate_takeaways" });
  }
}
