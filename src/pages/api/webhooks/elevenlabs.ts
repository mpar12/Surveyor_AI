import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/db/client";
import { convaiTranscripts } from "@/db/schema";

export const config = {
  api: {
    bodyParser: false
  }
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value);
}

function isValidPin(value: unknown): value is string {
  return typeof value === "string" && value.trim().length === 4;
}

function normalizeDynamicVariables(raw: Record<string, unknown>): Record<string, string> {
  const output: Record<string, string> = {};

  for (const [key, value] of Object.entries(raw)) {
    if (!key) continue;

    if (typeof value === "string") {
      output[key] = value;
    } else if (typeof value === "number" || typeof value === "boolean") {
      output[key] = String(value);
    } else if (value != null) {
      try {
        output[key] = JSON.stringify(value);
      } catch (error) {
        output[key] = String(value);
      }
    }
  }

  return output;
}

function getRawBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];

    req
      .on("data", (chunk) => {
        chunks.push(chunk);
      })
      .on("end", () => {
        resolve(Buffer.concat(chunks));
      })
      .on("error", (error) => {
        reject(error);
      });
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  let rawBody: Buffer;

  try {
    rawBody = await getRawBody(req);
  } catch (error) {
    console.error("[elevenlabs:webhook] unable to read raw body", error);
    return res.status(400).json({ error: "invalid_body" });
  }

  let payload: Record<string, unknown>;

  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch (error) {
    console.error("[elevenlabs:webhook] invalid JSON payload", error);
    return res.status(400).json({ error: "invalid_json" });
  }

  if (payload.type !== "post_call_transcription") {
    return res.status(200).json({ status: "ignored" });
  }

  const data = (payload.data ?? {}) as Record<string, unknown>;
  const conversationId = typeof data.conversation_id === "string" ? data.conversation_id : null;

  if (!conversationId) {
    return res.status(400).json({ error: "missing_conversation_id" });
  }

  const rawDynamicVariables =
    (data.conversation_initiation_client_data as { dynamic_variables?: Record<string, unknown> } | undefined)
      ?.dynamic_variables ?? {};
  const dynamicVariables = normalizeDynamicVariables(rawDynamicVariables as Record<string, unknown>);
  const transcript = Array.isArray(data.transcript) ? (data.transcript as unknown[]) : [];
  const analysis = data.analysis ?? null;

  if (!Array.isArray(transcript)) {
    return res.status(400).json({ error: "invalid_transcript" });
  }

  const sidCandidate =
    dynamicVariables.sid ??
    dynamicVariables.session_id ??
    dynamicVariables.sessionId ??
    dynamicVariables.sessionID;
  const pinCandidate = dynamicVariables.PIN ?? dynamicVariables.pin;
  const participantEmail = typeof dynamicVariables.email_address === "string"
    ? dynamicVariables.email_address.trim()
    : "";
  // Temporarily allow transcripts without an email; restore this guard when ready
  // if (!participantEmail || participantEmail.toLowerCase() === "replace_this") {
  //   return res.status(200).json({ status: "ignored_missing_email" });
  // }

  const sessionId = isValidUuid(sidCandidate) ? sidCandidate : null;
  const pinCode = isValidPin(pinCandidate) ? (pinCandidate as string).trim() : null;
  const eventTimestamp = typeof payload.event_timestamp === "number" ? payload.event_timestamp : null;
  const completedAt = eventTimestamp ? new Date(eventTimestamp * 1000) : null;

  try {
    const record = {
      conversationId,
      sessionId,
      pinCode,
      dynamicVariables,
      transcript,
      analysis,
      completedAt,
      receivedAt: new Date()
    };

    await db
      .insert(convaiTranscripts)
      .values(record)
      .onConflictDoUpdate({
        target: convaiTranscripts.conversationId,
        set: {
          sessionId: record.sessionId,
          pinCode: record.pinCode,
          dynamicVariables: record.dynamicVariables,
          transcript: record.transcript,
          analysis: record.analysis,
          completedAt: record.completedAt,
          receivedAt: record.receivedAt
        }
      });

    return res.status(200).json({ status: "stored" });
  } catch (error) {
    console.error("[elevenlabs:webhook] failed to persist transcript", error);
    return res.status(500).json({ error: "storage_failure" });
  }
}
