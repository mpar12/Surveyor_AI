import Head from "next/head";
import type { GetServerSideProps } from "next";
import { db } from "@/db/client";
import { convaiTranscripts, emailSends, sessionContexts, sessions } from "@/db/schema";
import { desc, eq, or } from "drizzle-orm";

interface QuestionAnswerRow {
  answer: string;
  email: string | null;
  conversationId: string;
}

interface ScriptedQuestionBlock {
  question: string;
  answers: QuestionAnswerRow[];
}

interface ScorecardProps {
  sessionId: string | null;
  status: string | null;
  createdAt: string | null;
  pin?: string | null;
  context?: {
    requester?: string | null;
    company?: string | null;
    product?: string | null;
    feedbackDesired?: string | null;
    desiredIcp?: string | null;
    desiredIcpIndustry?: string | null;
    desiredIcpRegion?: string | null;
    keyQuestions?: string | null;
    surveyQuestions?: string[] | null;
  } | null;
  emailsSent: number;
  responders: number;
  callSummaries: Array<{
    conversationId: string;
    summary: string | null;
    receivedAt: string | null;
    email: string | null;
  }>;
  primaryQuestions: ScriptedQuestionBlock[];
  error?: string;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch (error) {
    return value;
  }
}

type TranscriptTurn = {
  speaker: "agent" | "participant";
  text: string;
};

function sanitizeForMatch(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

const SURFACE_CARD = "var(--color-surface-0)";
const SURFACE_PANEL = "var(--color-surface-0)";
const SURFACE_LIST = "var(--gradient-hero)";
const BORDER_SOFT = "var(--color-border)";
const BORDER_MUTED = "rgba(28, 39, 64, 0.16)";
const TEXT_PRIMARY = "var(--color-text-primary)";
const TEXT_SECONDARY = "var(--color-text-secondary)";
const TEXT_MUTED = "var(--color-text-muted)";
const METRIC_ACCENT = "var(--color-accent)";
const METRIC_SUCCESS = "#4ade80";
const TABLE_BG = "var(--color-surface-0)";
const TABLE_HEADER_BG = "rgba(16, 19, 34, 0.04)";
const TABLE_BORDER = "rgba(28, 39, 64, 0.12)";

function detectSpeaker(entry: unknown): "agent" | "participant" | null {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const obj = entry as Record<string, unknown>;
  const candidateKeys = ["speaker", "role", "from", "actor", "entity"];

  for (const key of candidateKeys) {
    const raw = obj[key];
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

  if (typeof obj.agent === "boolean") {
    return obj.agent ? "agent" : "participant";
  }

  if (typeof obj.is_user === "boolean") {
    return obj.is_user ? "participant" : "agent";
  }

  return null;
}

function valueToText(value: unknown): string {
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
}

function normalizeTranscript(raw: unknown): TranscriptTurn[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const turns: TranscriptTurn[] = [];

  for (const entry of raw) {
    const speaker = detectSpeaker(entry);
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
}

function buildQuestionBreakdown(
  questions: string[],
  transcripts: Array<{ conversationId: string; email: string | null; transcript: unknown }>
): ScriptedQuestionBlock[] {
  const blocks: ScriptedQuestionBlock[] = questions.map((question) => ({
    question,
    answers: []
  }));

  const normalizedQuestions = questions.map((question) => ({
    raw: question,
    full: question.toLowerCase(),
    sanitized: sanitizeForMatch(question),
    prefix: sanitizeForMatch(question)
      .split(" ")
      .slice(0, 6)
      .join(" "),
    suffix: sanitizeForMatch(question)
      .split(" ")
      .slice(-6)
      .join(" ")
  }));

  const matchQuestion = (text: string): number | null => {
    if (!text) {
      return null;
    }

    const lower = text.toLowerCase();
    const sanitized = sanitizeForMatch(text);

    for (let index = 0; index < normalizedQuestions.length; index += 1) {
      const target = normalizedQuestions[index];

      if (target.full && lower.includes(target.full)) {
        return index;
      }

      if (target.prefix && sanitized.includes(target.prefix)) {
        return index;
      }

      if (target.suffix && sanitized.includes(target.suffix)) {
        return index;
      }
    }

    return null;
  };

  transcripts.forEach(({ conversationId, email, transcript }) => {
    const turns = normalizeTranscript(transcript);

    if (!turns.length) {
      return;
    }

    let currentQuestion: number | null = null;
    let pendingAnswer = "";

    const commitAnswer = () => {
      if (currentQuestion === null) {
        return;
      }

      const text = pendingAnswer.trim();
      if (!text) {
        return;
      }

      blocks[currentQuestion].answers.push({
        answer: text,
        email,
        conversationId
      });
    };

    for (const turn of turns) {
      if (turn.speaker === "agent") {
        if (pendingAnswer.trim()) {
          commitAnswer();
          pendingAnswer = "";
        }

        const matched = matchQuestion(turn.text);
        if (matched !== null) {
          currentQuestion = matched;
          pendingAnswer = "";
        } else {
          currentQuestion = null;
        }
      } else if (turn.speaker === "participant") {
        if (currentQuestion !== null) {
          pendingAnswer = pendingAnswer ? `${pendingAnswer} ${turn.text}` : turn.text;
        }
      }
    }

    if (pendingAnswer.trim()) {
      commitAnswer();
    }
  });

  return blocks;
}

export default function ScorecardPage({
  sessionId,
  status,
  createdAt,
  pin,
  context,
  emailsSent,
  responders,
  callSummaries,
  primaryQuestions,
  error
}: ScorecardProps) {
  return (
    <div
      style={{
        padding: "clamp(2.5rem, 6vw, 4rem) clamp(1.5rem, 5vw, 3rem)",
        maxWidth: "960px",
        margin: "0 auto",
        color: TEXT_PRIMARY
      }}
    >
      <Head>
        <title>Scorecard | SurvAgent</title>
        <meta name="description" content="Review responses captured for your SurvAgent session." />
      </Head>

      <header style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 700, color: TEXT_PRIMARY }}>Scorecard</h1>
        {pin || createdAt || status ? (
          <p style={{ color: TEXT_SECONDARY, marginTop: "0.5rem" }}>
            PIN <strong>{pin ?? "—"}</strong>
            {createdAt ? <> · Created {formatDate(createdAt)}</> : null}
            {status ? <> · Status: {status}</> : null}
          </p>
        ) : null}
      </header>

      {error ? (
        <div
          style={{
            background: "var(--color-error-surface)",
            border: "1px solid var(--color-error-border)",
            borderRadius: "12px",
            padding: "1rem 1.25rem",
            color: "var(--color-error)",
            fontWeight: 600
          }}
        >
          {error}
        </div>
      ) : null}

      {!error && status === "closed" ? (
        <div
          style={{
            background: "rgba(255, 196, 111, 0.12)",
            border: "1px solid rgba(255, 196, 111, 0.38)",
            borderRadius: "12px",
            padding: "1rem 1.25rem",
            color: "#facc15",
            fontWeight: 600,
            marginBottom: "1.5rem"
          }}
        >
          This session has been closed.
        </div>
      ) : null}

      {!error ? (
        <section style={{ display: "grid", gap: "1.5rem" }}>
          <div
            style={{
              background: SURFACE_CARD,
              borderRadius: "22px",
              padding: "1.5rem",
              boxShadow: "var(--shadow-card)",
              border: `1px solid ${BORDER_SOFT}`,
              display: "grid",
              gap: "1rem"
            }}
          >
            <h2 style={{ fontSize: "1.2rem", fontWeight: 600, color: TEXT_PRIMARY }}>Survey context</h2>
            <dl style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <div>
                <dt style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em", color: TEXT_MUTED, fontWeight: 600 }}>
                  Requester
                </dt>
                <dd style={{ margin: 0, color: TEXT_PRIMARY, fontWeight: 500 }}>{context?.requester || "—"}</dd>
              </div>
              <div>
                <dt style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em", color: TEXT_MUTED, fontWeight: 600 }}>
                  Desired ICP
                </dt>
                <dd style={{ margin: 0, color: TEXT_PRIMARY, fontWeight: 500 }}>{context?.desiredIcp || "—"}</dd>
              </div>
              <div>
                <dt style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em", color: TEXT_MUTED, fontWeight: 600 }}>
                  ICP Industry
                </dt>
                <dd style={{ margin: 0, color: TEXT_PRIMARY, fontWeight: 500 }}>{context?.desiredIcpIndustry || "—"}</dd>
              </div>
              <div>
                <dt style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em", color: TEXT_MUTED, fontWeight: 600 }}>
                  ICP Region
                </dt>
                <dd style={{ margin: 0, color: TEXT_PRIMARY, fontWeight: 500 }}>{context?.desiredIcpRegion || "—"}</dd>
              </div>
              <div>
                <dt style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em", color: TEXT_MUTED, fontWeight: 600 }}>
                  Feedback desired
                </dt>
                <dd style={{ margin: 0, color: TEXT_PRIMARY, fontWeight: 500 }}>{context?.feedbackDesired || "—"}</dd>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <dt style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em", color: TEXT_MUTED, fontWeight: 600 }}>
                  Key questions
                </dt>
                <dd style={{ margin: 0, color: TEXT_PRIMARY, fontWeight: 500 }}>{context?.keyQuestions || "—"}</dd>
              </div>
            </dl>
          </div>

          <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <div
              style={{
                background: SURFACE_PANEL,
                borderRadius: "20px",
                padding: "1.5rem",
                boxShadow: "var(--shadow-soft)",
                border: `1px solid ${BORDER_MUTED}`
              }}
            >
              <h3 style={{ fontSize: "1rem", fontWeight: 600, color: TEXT_PRIMARY }}>Surveys sent</h3>
              <p style={{ fontSize: "2rem", fontWeight: 700, color: METRIC_ACCENT, margin: "0.25rem 0 0" }}>{emailsSent}</p>
              <p style={{ color: TEXT_MUTED, marginTop: "0.4rem" }}>Unique recipients emailed across this session.</p>
            </div>
            <div
              style={{
                background: SURFACE_PANEL,
                borderRadius: "20px",
                padding: "1.5rem",
                boxShadow: "var(--shadow-soft)",
                border: `1px solid ${BORDER_MUTED}`
              }}
            >
              <h3 style={{ fontSize: "1rem", fontWeight: 600, color: TEXT_PRIMARY }}>Responders</h3>
              <p style={{ fontSize: "2rem", fontWeight: 700, color: METRIC_SUCCESS, margin: "0.25rem 0 0" }}>{responders}</p>
              <p style={{ color: TEXT_MUTED, marginTop: "0.4rem" }}>Completed conversations with the AI agent.</p>
            </div>
          </div>

          <div
            style={{
              background: SURFACE_CARD,
              borderRadius: "22px",
              padding: "1.5rem",
              boxShadow: "var(--shadow-card)",
              border: `1px solid ${BORDER_SOFT}`
            }}
          >
            <h2 style={{ fontSize: "1.2rem", fontWeight: 600, color: TEXT_PRIMARY, marginBottom: "1rem" }}>
              Summary of each call
            </h2>
            {callSummaries.length === 0 ? (
              <p style={{ color: TEXT_MUTED }}>No completed calls yet.</p>
            ) : (
              <ul style={{ display: "grid", gap: "1rem", padding: 0, listStyle: "none" }}>
                {callSummaries.map((summary) => (
                  <li
                    key={summary.conversationId}
                    style={{
                      background: SURFACE_LIST,
                      border: `1px solid ${BORDER_MUTED}`,
                      borderRadius: "18px",
                      padding: "1.1rem"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ color: TEXT_PRIMARY, fontWeight: 600 }}>
                        {summary.email ? summary.email : "Unknown participant"}
                      </div>
                      <div style={{ color: TEXT_MUTED, fontSize: "0.85rem" }}>
                        {formatDate(summary.receivedAt)}
                      </div>
                    </div>
                    <div style={{ color: TEXT_SECONDARY, lineHeight: 1.55 }}>
                      {summary.summary || "Summary not available."}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {primaryQuestions.length ? (
            <div
              style={{
                background: SURFACE_CARD,
                borderRadius: "22px",
                padding: "1.5rem",
                boxShadow: "var(--shadow-card)",
                border: `1px solid ${BORDER_SOFT}`
              }}
            >
              <h2 style={{ fontSize: "1.2rem", fontWeight: 600, color: TEXT_PRIMARY, marginBottom: "1rem" }}>
                Responses by scripted question
              </h2>
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    background: TABLE_BG,
                    borderRadius: "16px",
                    overflow: "hidden",
                    border: `1px solid ${TABLE_BORDER}`
                  }}
                >
                  <thead style={{ background: TABLE_HEADER_BG, color: TEXT_PRIMARY, textAlign: "left" }}>
                    <tr>
                      <th style={{ padding: "0.85rem 1rem", fontSize: "0.9rem", width: "40%" }}>Question</th>
                      <th style={{ padding: "0.85rem 1rem", fontSize: "0.9rem" }}>Answer</th>
                      <th style={{ padding: "0.85rem 1rem", fontSize: "0.9rem", width: "22%" }}>Participant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {primaryQuestions.map((block, index) => {
                      const label = `Q${index + 1}: ${block.question}`;

                      if (!block.answers.length) {
                        return (
                          <tr key={label} style={{ borderTop: `1px solid ${TABLE_BORDER}` }}>
                            <td style={{ padding: "0.85rem 1rem", fontWeight: 600, color: TEXT_PRIMARY }}>{label}</td>
                            <td style={{ padding: "0.85rem 1rem", color: TEXT_MUTED }}>No responses captured yet.</td>
                            <td style={{ padding: "0.85rem 1rem", color: TEXT_MUTED }}>—</td>
                          </tr>
                        );
                      }

                      return block.answers.map((answer, answerIndex) => (
                        <tr key={`${label}-${answer.conversationId}-${answerIndex}`} style={{ borderTop: `1px solid ${TABLE_BORDER}` }}>
                          {answerIndex === 0 ? (
                            <td
                              style={{
                                padding: "0.85rem 1rem",
                                fontWeight: 600,
                                color: TEXT_PRIMARY
                              }}
                              rowSpan={block.answers.length}
                            >
                              {label}
                            </td>
                          ) : null}
                          <td style={{ padding: "0.85rem 1rem", color: TEXT_SECONDARY }}>{answer.answer}</td>
                          <td style={{ padding: "0.85rem 1rem", color: METRIC_ACCENT, fontWeight: 600 }}>
                            {answer.email || "Unknown participant"}
                          </td>
                        </tr>
                      ));
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

        </section>
      ) : null}
    </div>
  );
}

export const getServerSideProps: GetServerSideProps<ScorecardProps> = async (context) => {
  const sidParam = context.query.sid;
  const pinParam = context.query.pin;
  const sid = typeof sidParam === "string" ? sidParam : Array.isArray(sidParam) ? sidParam[0] : null;
  const pin = typeof pinParam === "string" ? pinParam : Array.isArray(pinParam) ? pinParam[0] : null;

  if (!sid) {
    return {
      props: {
        sessionId: null,
        status: null,
        createdAt: null,
        pin: null,
        context: null,
        emailsSent: 0,
        responders: 0,
        callSummaries: [],
        primaryQuestions: [],
        followUpQuestions: [],
        error: "Missing session identifier."
      }
    };
  }

  try {
    const sessionRows = await db
      .select({ sessionId: sessions.sessionId, status: sessions.status, createdAt: sessions.createdAt })
      .from(sessions)
      .where(eq(sessions.sessionId, sid))
      .limit(1);

    if (sessionRows.length === 0) {
      return {
        props: {
          sessionId: sid,
          status: null,
          createdAt: null,
          pin: pin ?? null,
          context: null,
          emailsSent: 0,
          responders: 0,
          callSummaries: [],
          primaryQuestions: [],
          followUpQuestions: [],
          error: "Session not found."
        }
      };
    }

    const sessionRecord = sessionRows[0];

const contextRows = await db
      .select({
        requester: sessionContexts.requester,
        company: sessionContexts.company,
        product: sessionContexts.product,
        feedbackDesired: sessionContexts.feedbackDesired,
        desiredIcp: sessionContexts.desiredIcp,
        desiredIcpIndustry: sessionContexts.desiredIcpIndustry,
        desiredIcpRegion: sessionContexts.desiredIcpRegion,
        keyQuestions: sessionContexts.keyQuestions,
        surveyQuestions: sessionContexts.surveyQuestions
      })
      .from(sessionContexts)
      .where(eq(sessionContexts.sessionId, sid))
      .limit(1);

    const emailRows = await db
      .select({ recipients: emailSends.recipients })
      .from(emailSends)
      .where(eq(emailSends.sessionId, sid));

    const uniqueRecipients = new Set<string>();
    emailRows.forEach((row) => {
      const list = Array.isArray(row.recipients) ? (row.recipients as unknown[]) : [];
      list.forEach((entry) => {
        if (typeof entry === "string") {
          uniqueRecipients.add(entry);
        }
      });
    });

    const transcriptCondition = pin
      ? or(eq(convaiTranscripts.sessionId, sid), eq(convaiTranscripts.pinCode, pin))
      : eq(convaiTranscripts.sessionId, sid);

    const transcriptRows = await db
      .select({
        conversationId: convaiTranscripts.conversationId,
        summary: convaiTranscripts.analysis,
        receivedAt: convaiTranscripts.receivedAt,
        dynamicVariables: convaiTranscripts.dynamicVariables,
        transcript: convaiTranscripts.transcript
      })
      .from(convaiTranscripts)
      .where(transcriptCondition)
      .orderBy(desc(convaiTranscripts.receivedAt));

    const summaries = transcriptRows.map((row) => {
      const summaryText =
        row.summary && typeof row.summary === "object"
          ? ((row.summary as Record<string, unknown>).transcript_summary as string | null) ?? null
          : null;

      const dynamicVars =
        row.dynamicVariables && typeof row.dynamicVariables === "object"
          ? (row.dynamicVariables as Record<string, unknown>)
          : {};
      const emailValue = dynamicVars.email_address;

      return {
        conversationId: row.conversationId,
        summary: summaryText,
        receivedAt: row.receivedAt ? row.receivedAt.toISOString() : null,
        email: typeof emailValue === "string" && emailValue.trim() ? emailValue.trim() : null
      };
    });

    const questionListRaw = Array.isArray(contextRows[0]?.surveyQuestions)
      ? (contextRows[0]?.surveyQuestions as unknown[])
      : [];
    const questionList = questionListRaw
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter((entry) => entry);

    const transcriptsForBreakdown = transcriptRows.map((row, index) => {
      const dynamicVars =
        row.dynamicVariables && typeof row.dynamicVariables === "object"
          ? (row.dynamicVariables as Record<string, unknown>)
          : {};
      const emailValue = dynamicVars.email_address;

      return {
        conversationId: row.conversationId,
        email: typeof emailValue === "string" && emailValue.trim() ? emailValue.trim() : null,
        transcript: row.transcript
      };
    });

    const primaryQuestions = buildQuestionBreakdown(questionList, transcriptsForBreakdown);

    const rawContext = contextRows[0] ?? null;
    const normalizedContext = rawContext
      ? {
          ...rawContext,
          surveyQuestions: questionList.length ? questionList : null
        }
      : null;

    return {
      props: {
        sessionId: sessionRecord.sessionId,
        status: sessionRecord.status,
        createdAt: sessionRecord.createdAt ? sessionRecord.createdAt.toISOString() : null,
        pin: pin ?? null,
        context: normalizedContext,
        emailsSent: uniqueRecipients.size,
        responders: summaries.length,
        callSummaries: summaries,
        primaryQuestions
      }
    };
  } catch (error) {
    console.error("Failed to load scorecard", error);
    return {
      props: {
        sessionId: sid,
        status: null,
        createdAt: null,
        pin: pin ?? null,
        context: null,
        emailsSent: 0,
        responders: 0,
        callSummaries: [],
        primaryQuestions: [],
        error: "Unable to load scorecard right now."
      }
    };
  }
};
