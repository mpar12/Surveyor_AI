import type { NextApiRequest, NextApiResponse } from "next";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/db/client";
import { convaiTranscripts, sessionContexts, sessions } from "@/db/schema";
import { desc, eq, or } from "drizzle-orm";
import { TAKEAWAYS_SYSTEM_PROMPT } from "@/lib/prompts";
import { sanitizeJsonLikeString } from "@/lib/jsonUtils";
import { isInterviewAnalysisReport } from "@/types/interviewAnalysis";

const CLAUDE_API_KEY = process.env.claude_api_key ?? process.env.CLAUDE_API_KEY;

const anthropic = new Anthropic({
  apiKey: CLAUDE_API_KEY
});

type TakeawaysResponse = {
  text: string;
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

  if (!CLAUDE_API_KEY) {
    return res.status(500).json({ error: "CLAUDE_API_KEY environment variable is not set." });
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
        transcript: convaiTranscripts.transcript,
        receivedAt: convaiTranscripts.receivedAt
      })
      .from(convaiTranscripts)
      .where(transcriptCondition)
      .orderBy(desc(convaiTranscripts.receivedAt));

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    (req.socket as any).setTimeout?.(0);
    req.socket.setNoDelay?.(true);
    req.socket.setKeepAlive?.(true);
    // @ts-expect-error flushHeaders may not exist in all runtimes
    res.flushHeaders?.();

    const sendEvent = (event: string, data: Record<string, unknown>) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
      // @ts-expect-error flush might not exist
      if (typeof res.flush === "function") {
        res.flush();
      }
    };

    if (!transcriptRows.length) {
      sendEvent("done", {
        text: "No completed conversations yet.",
        report: null,
        generatedAt: new Date().toISOString(),
        error: "No completed conversations yet."
      });
      res.end();
      return;
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

    sendEvent("start", {
      message: "analysis_started",
      requester,
      prompt
    });

    const completion = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 20000,
      temperature: 0.2,
      system: TAKEAWAYS_SYSTEM_PROMPT,
      stream: true,
      messages: [
        {
          role: "user",
          content: `Research goal: ${prompt || "Not specified."}\n\nTranscript excerpts:\n${transcriptPayload}`
        }
      ]
    });

    let aggregatedContent = "";

    try {
      for await (const event of completion) {
        if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
          const text = event.delta.text;
          aggregatedContent += text;
          sendEvent("delta", { text });
        } else if (event.type === "message_stop") {
          break;
        } else if (event.type === "error") {
          const message = event.error?.message || "Anthropic streaming error.";
          sendEvent("error", { message });
          res.end();
          return;
        }
      }
    } catch (streamError) {
      console.error("Anthropic streaming failed", streamError);
      sendEvent("error", {
        message: streamError instanceof Error ? streamError.message : "Unable to stream analysis."
      });
      res.end();
      return;
    }

    const trimmedContent = aggregatedContent.trim();
    const latestTranscript = transcriptRows[0];
    const generatedAt = new Date().toISOString();
    let parsedReport: unknown = null;

    if (trimmedContent) {
      const sanitized = sanitizeJsonLikeString(trimmedContent);
      if (sanitized) {
        try {
          parsedReport = JSON.parse(sanitized);
        } catch (parseError) {
          console.error("Failed to parse streamed analysis JSON", parseError);
        }
      }
    }

    const resolvedReport =
      parsedReport && isInterviewAnalysisReport(parsedReport) ? parsedReport : null;

    if (resolvedReport && latestTranscript?.conversationId) {
      try {
        await db
          .update(convaiTranscripts)
          .set({
            analysis: {
              generatedAt,
              analysisReport: resolvedReport
            }
          })
          .where(eq(convaiTranscripts.conversationId, latestTranscript.conversationId));
      } catch (persistError) {
        console.error("Failed to persist interview analysis JSON", persistError);
      }
    }

    const donePayload: Record<string, unknown> = {
      text: trimmedContent,
      report: resolvedReport,
      generatedAt
    };

    if (!resolvedReport) {
      donePayload.error = trimmedContent
        ? "Unable to parse interview analysis JSON."
        : "Interview analysis agent returned an empty response.";
    }

    sendEvent("done", donePayload);
    res.end();
  } catch (error) {
    console.error("Failed to build key takeaways", error);
    const message =
      error instanceof Error && error.message
        ? error.message
        : "failed_to_generate_takeaways";
    if (!res.headersSent) {
      return res.status(500).json({ error: message });
    }
    res.write(`event: error\n`);
    res.write(`data: ${JSON.stringify({ message })}\n\n`);
    res.end();
  }
}
