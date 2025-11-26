import Head from "next/head";
import type { GetServerSideProps } from "next";
import { db } from "@/db/client";
import { convaiTranscripts, emailSends, sessionContexts, sessions } from "@/db/schema";
import { desc, eq, or } from "drizzle-orm";
import styles from "@/styles/Scorecard.module.css";

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
    prompt?: string | null;
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
  latestRawPayload: {
    dynamicVariables: unknown;
    transcript: unknown;
    analysis: unknown;
  } | null;
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
  latestRawPayload,
  error
}: ScorecardProps) {
  const formattedLatestPayload = latestRawPayload
    ? JSON.stringify(latestRawPayload, null, 2)
    : null;
  return (
    <div className={styles.container}>
      <Head>
        <title>Scorecard | SurvAgent</title>
        <meta name="description" content="Review responses captured for your SurvAgent session." />
      </Head>

      <header className={styles.lead}>
        <h1 className={styles.pageTitle}>Scorecard</h1>
        {pin || createdAt || status ? (
          <p className={styles.metaLine}>
            PIN <strong>{pin ?? "—"}</strong>
            {createdAt ? <> · Created {formatDate(createdAt)}</> : null}
            {status ? <> · Status: {status}</> : null}
          </p>
        ) : null}
      </header>

      {pin ? (
        <div className={styles.pinNotice}>
          <h2 className={styles.pinTitle}>Your session PIN</h2>
          <p>
            Save this 4-digit PIN now: <span className={styles.pinHighlight}>{pin}</span>. You&apos;ll need it to revisit your
            scorecard via the &ldquo;Returning?&rdquo; link on the homepage.
          </p>
        </div>
      ) : null}

      {error ? <div className={styles.errorBox}>{error}</div> : null}

      {!error && status === "closed" ? <div className={styles.noticeBox}>This session has been closed.</div> : null}

      {!error ? (
        <div className={styles.card}>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Survey context</h2>
            <dl className={styles.contextGrid}>
              <div className={styles.contextItem}>
                <dt className={styles.contextLabel}>Requester</dt>
                <dd className={styles.contextValue}>{context?.requester || "—"}</dd>
              </div>
              <div className={`${styles.contextItem} ${styles.contextItemFull}`}>
                <dt className={styles.contextLabel}>Prompt</dt>
                <dd className={styles.contextValue}>{context?.prompt || "—"}</dd>
              </div>
            </dl>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Performance metrics</h2>
            <div className={styles.metricsGrid}>
              <div className={styles.metricCard}>
                <span className={styles.metricTitle}>Surveys sent</span>
                <span className={styles.metricValue}>{emailsSent}</span>
                <span className={styles.metricHint}>Unique recipients emailed across this session.</span>
              </div>
              <div className={styles.metricCard}>
                <span className={styles.metricTitle}>Responders</span>
                <span className={`${styles.metricValue} ${styles.metricValueSuccess}`}>{responders}</span>
                <span className={styles.metricHint}>Completed conversations with the AI agent.</span>
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Summary of each call</h2>
            {callSummaries.length === 0 ? (
              <p className={styles.emptyState}>No completed calls yet.</p>
            ) : (
              <ul className={styles.callList}>
                {callSummaries.map((summary) => (
                  <li key={summary.conversationId} className={styles.callCard}>
                    <div className={styles.callHeader}>
                      <span>{summary.email ? summary.email : "Unknown participant"}</span>
                      <span className={styles.callMeta}>{formatDate(summary.receivedAt)}</span>
                    </div>
                    <p className={styles.callSummary}>{summary.summary || "Summary not available."}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {primaryQuestions.length ? (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Responses by scripted question</h2>
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.tableHeadQuestion}>Question</th>
                      <th>Answer</th>
                      <th className={styles.tableHeadParticipant}>Participant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {primaryQuestions.map((block, index) => {
                      const label = `Q${index + 1}: ${block.question}`;

                      if (!block.answers.length) {
                        return (
                          <tr key={label}>
                            <td className={styles.questionCell}>{label}</td>
                            <td className={`${styles.answerCell} ${styles.emptyState}`}>
                              No responses captured yet.
                            </td>
                            <td className={styles.participantCellEmpty}>—</td>
                          </tr>
                        );
                      }

                      return block.answers.map((answer, answerIndex) => (
                        <tr key={`${label}-${answer.conversationId}-${answerIndex}`}>
                          {answerIndex === 0 ? (
                            <td className={styles.questionCell} rowSpan={block.answers.length}>
                              {label}
                            </td>
                          ) : null}
                          <td className={styles.answerCell}>{answer.answer}</td>
                          <td className={styles.participantCell}>
                            <span className={styles.answerParticipant}>
                              {answer.email || "Unknown participant"}
                            </span>
                          </td>
                        </tr>
                      ));
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {/* <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Latest webhook payload</h2>
            {formattedLatestPayload ? (
              <pre className={styles.codeBlock}>
                <code>{formattedLatestPayload}</code>
              </pre>
            ) : (
              <p className={styles.emptyState}>No webhook payload captured yet.</p>
            )}
          </section> */}
        </div>
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
        latestRawPayload: null,
        error: "Missing session identifier."
      }
    };
  }

  if (!pin || !/^\d{4}$/.test(pin.trim())) {
    return {
      props: {
        sessionId: sid,
        status: null,
        createdAt: null,
        pin: null,
        context: null,
        emailsSent: 0,
        responders: 0,
        callSummaries: [],
        primaryQuestions: [],
        latestRawPayload: null,
        error: "Missing or invalid session PIN."
      }
    };
  }

  const normalizedPin = pin.trim();

  try {
    const sessionRows = await db
      .select({
        sessionId: sessions.sessionId,
        status: sessions.status,
        createdAt: sessions.createdAt,
        pinCode: sessions.pinCode
      })
      .from(sessions)
      .where(eq(sessions.sessionId, sid))
      .limit(1);

    if (sessionRows.length === 0) {
      return {
        props: {
          sessionId: sid,
          status: null,
          createdAt: null,
          pin: normalizedPin,
          context: null,
          emailsSent: 0,
          responders: 0,
          callSummaries: [],
          primaryQuestions: [],
          latestRawPayload: null,
          error: "Session not found."
        }
      };
    }

    const sessionRecord = sessionRows[0];
    if (sessionRecord.pinCode !== normalizedPin) {
      return {
        props: {
          sessionId: sid,
          status: null,
          createdAt: null,
          pin: null,
          context: null,
          emailsSent: 0,
          responders: 0,
          callSummaries: [],
          primaryQuestions: [],
          latestRawPayload: null,
          error: "Session PIN did not match."
        }
      };
    }

    const contextRows = await db
      .select({
        requester: sessionContexts.requester,
        prompt: sessionContexts.prompt,
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

    const transcriptCondition = normalizedPin
      ? or(eq(convaiTranscripts.sessionId, sid), eq(convaiTranscripts.pinCode, normalizedPin))
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

    const latestRawPayload = transcriptRows.length
      ? {
          dynamicVariables: transcriptRows[0].dynamicVariables ?? null,
          transcript: transcriptRows[0].transcript ?? null,
          analysis: transcriptRows[0].summary ?? null
        }
      : null;

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
        pin: normalizedPin,
        context: normalizedContext,
        emailsSent: uniqueRecipients.size,
        responders: summaries.length,
        callSummaries: summaries,
        primaryQuestions,
        latestRawPayload
      }
    };
  } catch (error) {
    console.error("Failed to load scorecard", error);
    return {
      props: {
        sessionId: sid,
        status: null,
        createdAt: null,
        pin: normalizedPin,
        context: null,
        emailsSent: 0,
        responders: 0,
        callSummaries: [],
        primaryQuestions: [],
        latestRawPayload: null,
        error: "Unable to load scorecard right now."
      }
    };
  }
};
