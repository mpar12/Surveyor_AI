import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { GetServerSideProps } from "next";
import { db } from "@/db/client";
import { convaiTranscripts, emailSends, sessionContexts, sessions } from "@/db/schema";
import { desc, eq, or } from "drizzle-orm";
import type { InterviewScript } from "@/types/interviewScript";
import { extractQuestionsFromScript, isInterviewScript } from "@/types/interviewScript";

interface QuestionAnswerRow {
  answer: string;
  email: string | null;
  conversationId: string;
}

interface ScriptedQuestionBlock {
  question: string;
  answers: QuestionAnswerRow[];
}

interface KeyTakeaways {
  text: string;
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
    surveyQuestionParagraph?: string | null;
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
  const [takeaways, setTakeaways] = useState<KeyTakeaways | null>(null);
  const [takeawaysStatus, setTakeawaysStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >(sessionId && pin ? "loading" : "idle");
  const [takeawaysError, setTakeawaysError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId || !pin) {
      return;
    }

    let isMounted = true;
    setTakeawaysStatus("loading");
    setTakeawaysError(null);

    fetch("/api/takeaways", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ sessionId, pin })
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          const message = typeof payload?.error === "string" ? payload.error : "Unable to load key takeaways.";
          throw new Error(message);
        }

        return payload as KeyTakeaways;
      })
      .then((data) => {
        if (!isMounted) return;
        setTakeaways(data);
        setTakeawaysStatus("ready");
      })
      .catch((fetchError) => {
        if (!isMounted) return;
        setTakeawaysStatus("error");
        setTakeawaysError(
          fetchError instanceof Error ? fetchError.message : "Unable to load key takeaways."
        );
      });

  return () => {
      isMounted = false;
    };
  }, [sessionId, pin]);

  return (
    <div className="min-h-screen w-full bg-warm-cream">
      <Head>
        <title>Scorecard | SurvAgent</title>
        <meta name="description" content="Review responses captured for your SurvAgent session." />
      </Head>

      <header className="sticky top-0 z-10 flex items-center justify-end bg-warm-cream/95 backdrop-blur-sm px-6 md:px-12 py-5 border-b border-light-gray/30">
        <Link
          href="/return"
          className="rounded-full px-6 py-2.5 text-sm font-medium bg-white/80 border border-light-gray/50 text-charcoal hover:bg-white hover:border-light-gray transition-all duration-300 shadow-sm"
        >
          Returning? Click here to input PIN and view previous results
        </Link>
      </header>

      <main className="flex flex-col items-center w-full px-6 md:px-12 lg:px-20 py-10 md:py-16">
        <div className="flex flex-col gap-16 w-full max-w-6xl">
          <section className="flex flex-col gap-4">
            <h1 className="text-5xl md:text-6xl font-bold text-charcoal leading-[1.1] tracking-tight">Scorecard</h1>
            {pin || createdAt || status ? (
              <p className="text-lg text-soft-gray font-medium">
                PIN <strong className="text-charcoal">{pin ?? "—"}</strong>
                {createdAt ? <> · Created {formatDate(createdAt)}</> : null}
                {status ? (
                  <>
                    {" "}
                    · Status:{" "}
                    <span className="text-orange-accent font-semibold capitalize">
                      {status.toLowerCase()}
                    </span>
                  </>
                ) : null}
              </p>
            ) : null}
          </section>

          {pin ? (
            <div className="bg-white/70 backdrop-blur-sm border-l-4 border-orange-accent rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <h2 className="text-2xl font-bold text-charcoal mb-3 tracking-tight">Your session PIN</h2>
              <p className="text-lg text-charcoal leading-relaxed font-medium">
                Save this 4-digit PIN now:{" "}
                <span className="font-bold text-2xl text-orange-accent">{pin}</span>. You&apos;ll need it to revisit
                your scorecard via the &ldquo;Returning?&rdquo; link on the homepage.
              </p>
            </div>
          ) : null}

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-red-700 font-medium">
              {error}
            </div>
          ) : null}

          {!error && status === "closed" ? (
            <div className="rounded-2xl border border-light-gray bg-white/80 px-6 py-4 text-soft-gray font-medium">
              This session has been closed.
            </div>
          ) : null}

          {!error ? (
            <div className="flex flex-col gap-16">
              <section className="bg-white/70 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-light-gray/40">
                <h2 className="text-3xl font-bold text-charcoal mb-8 tracking-tight">Survey context</h2>
                <dl className="grid gap-8 md:grid-cols-3">
                  <div className="flex flex-col gap-3">
                    <dt className="text-xs uppercase tracking-widest text-charcoal/60 font-bold">Requester</dt>
                    <dd className="font-semibold text-xl text-charcoal">{context?.requester || "—"}</dd>
                  </div>
                  <div className="flex flex-col gap-3 md:col-span-3">
                    <dt className="text-xs uppercase tracking-widest text-charcoal/60 font-bold">Prompt</dt>
                    <dd className="font-medium text-xl text-charcoal leading-relaxed">{context?.prompt || "—"}</dd>
                  </div>
                  {context?.surveyQuestionParagraph ? (
                    <div className="flex flex-col gap-3 md:col-span-3">
                      <dt className="text-xs uppercase tracking-widest text-charcoal/60 font-bold">
                        Question guidance
                      </dt>
                      <dd className="font-medium text-lg text-charcoal leading-relaxed">
                        {context.surveyQuestionParagraph}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </section>

              <section className="bg-white/70 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-light-gray/40">
                <h2 className="text-3xl font-bold text-charcoal mb-8 tracking-tight">Performance metrics</h2>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="flex flex-col gap-4 border-l-4 border-orange-accent bg-white/70 backdrop-blur-sm rounded-xl px-8 py-8 shadow-md">
                    <span className="text-lg font-bold text-charcoal tracking-tight">Surveys sent</span>
                    <span className="text-5xl font-bold text-orange-accent">{emailsSent}</span>
                    <span className="text-soft-gray text-base font-medium leading-relaxed">
                      Unique recipients emailed across this session.
                    </span>
                  </div>
                  <div className="flex flex-col gap-4 border-l-4 border-orange-accent bg-white/70 backdrop-blur-sm rounded-xl px-8 py-8 shadow-md">
                    <span className="text-lg font-bold text-charcoal tracking-tight">Responders</span>
                    <span className="text-5xl font-bold text-orange-accent">{responders}</span>
                    <span className="text-soft-gray text-base font-medium leading-relaxed">
                      Completed conversations with the AI agent.
                    </span>
                  </div>
                </div>
              </section>

              <section className="bg-white/70 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-light-gray/40">
                <div className="mb-8">
                  <h2 className="text-3xl font-bold text-charcoal tracking-tight">Key takeaways</h2>
                  <p className="text-soft-gray leading-relaxed mt-4 text-lg font-medium">
                    Highlights generated from every recorded conversation. This summary keeps the original research
                    prompt in mind so you can turn insights into action quickly.
                  </p>
                </div>
                {takeawaysStatus === "loading" ? (
                  <div className="rounded-2xl border border-light-gray/60 px-6 py-6 text-soft-gray text-lg font-medium">
                    Analyzing conversations…
                  </div>
                ) : takeawaysStatus === "error" ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-red-700 font-medium">
                      {takeawaysError ?? "Unable to load key takeaways."}
                    </div>
                    <div className="rounded-2xl border border-orange-accent/30 bg-white/70 px-6 py-4 text-soft-gray text-sm">
                      {takeawaysError || "The Claude request returned an unknown error."}
                    </div>
                  </div>
                ) : takeaways ? (
                  <pre className="rounded-2xl border border-light-gray/40 bg-white/80 px-6 py-6 text-charcoal text-base leading-relaxed whitespace-pre-wrap">
                    {takeaways.text}
                  </pre>
                ) : (
                  <div className="rounded-2xl border border-dashed border-light-gray/60 px-6 py-6 text-soft-gray text-lg font-medium">
                    Key takeaways will appear here soon.
                  </div>
                )}
              </section>

              <section className="bg-white/70 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-light-gray/40">
                <h2 className="text-3xl font-bold text-charcoal mb-8 tracking-tight">Summary of each call</h2>
                {callSummaries.length === 0 ? (
                  <p className="text-soft-gray text-lg font-medium">No completed calls yet.</p>
                ) : (
                  <ul className="grid gap-5">
                    {callSummaries.map((summary) => (
                      <li key={summary.conversationId} className="rounded-xl border border-light-gray/40 bg-white/80 px-6 py-4 shadow-sm">
                        <div className="flex justify-between flex-wrap gap-2 text-charcoal font-semibold">
                          <span>{summary.email ? summary.email : "Unknown participant"}</span>
                          <span className="text-soft-gray font-medium">{formatDate(summary.receivedAt)}</span>
                        </div>
                        <p className="mt-3 text-soft-gray leading-relaxed">
                          {summary.summary || "Summary not available."}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="bg-white/70 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-light-gray/40">
                <h2 className="text-3xl font-bold text-charcoal mb-8 tracking-tight">
                  Responses by scripted question
                </h2>
                {primaryQuestions.length ? (
                  <div className="overflow-hidden border border-light-gray/40 rounded-xl shadow-md">
                    <table className="w-full border-collapse bg-white/80">
                      <thead className="bg-warm-beige/50 text-left">
                        <tr>
                          <th className="text-sm font-bold text-charcoal px-6 py-4 tracking-tight">Question</th>
                          <th className="text-sm font-bold text-charcoal px-6 py-4 tracking-tight">Answer</th>
                          <th className="text-sm font-bold text-charcoal px-6 py-4 tracking-tight w-48">Participant</th>
                        </tr>
                      </thead>
                      <tbody>
                        {primaryQuestions.map((block, index) => {
                          const label = `Q${index + 1}: ${block.question}`;

                          if (!block.answers.length) {
                            return (
                              <tr key={label} className="border-t border-light-gray/30">
                                <td className="px-6 py-4 font-semibold text-charcoal align-top">{label}</td>
                                <td className="px-6 py-4 text-soft-gray align-top">No responses captured yet.</td>
                                <td className="px-6 py-4 text-soft-gray align-top">—</td>
                              </tr>
                            );
                          }

                          return block.answers.map((answer, answerIndex) => (
                            <tr key={`${label}-${answer.conversationId}-${answerIndex}`} className="border-t border-light-gray/30">
                              {answerIndex === 0 ? (
                                <td className="px-6 py-4 font-semibold text-charcoal align-top" rowSpan={block.answers.length}>
                                  {label}
                                </td>
                              ) : null}
                              <td className="px-6 py-4 text-soft-gray align-top">{answer.answer}</td>
                              <td className="px-6 py-4 text-charcoal font-semibold align-top">
                                {answer.email || "Unknown participant"}
                              </td>
                            </tr>
                          ));
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-soft-gray text-lg font-medium">No scripted questions have responses yet.</p>
                )}
              </section>
            </div>
          ) : null}
        </div>
      </main>
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

    const rawSurveyQuestions = contextRows[0]?.surveyQuestions;
    let questionParagraph: string | null = null;
    let questionList: string[] = [];

    if (isInterviewScript(rawSurveyQuestions)) {
      const script = rawSurveyQuestions as InterviewScript;
      questionParagraph = script.title || null;
      questionList = extractQuestionsFromScript(script);
    } else if (typeof rawSurveyQuestions === "string" && rawSurveyQuestions.trim()) {
      questionParagraph = rawSurveyQuestions.trim();
    } else if (Array.isArray(rawSurveyQuestions)) {
      questionList = (rawSurveyQuestions as unknown[])
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter((entry) => entry);
    }

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
          surveyQuestions: questionList.length ? questionList : null,
          surveyQuestionParagraph: questionParagraph
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
