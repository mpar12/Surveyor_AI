import Head from "next/head";
import type { GetServerSideProps } from "next";
import { db } from "@/db/client";
import { convaiTranscripts, sessionContexts, sessions } from "@/db/schema";
import { desc, eq, or } from "drizzle-orm";
import type { InterviewAnalysisReport } from "@/types/interviewAnalysis";
import { isInterviewAnalysisReport } from "@/types/interviewAnalysis";

interface ScorecardProps {
  sessionId: string | null;
  status: string | null;
  createdAt: string | null;
  pin?: string | null;
  context?: {
    requester?: string | null;
    prompt?: string | null;
  } | null;
  analysisReport: InterviewAnalysisReport | null;
  analysisGeneratedAt: string | null;
  error?: string | null;
}

const formatDate = (value: string | null) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

const sanitizeJsonLikeString = (input: string) => {
  let text = input.trim();
  if (!text) {
    return text;
  }

  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  }

  if (text.startsWith("'''")) {
    text = text.replace(/^'''(?:json)?/i, "").replace(/'''$/, "").trim();
  }

  const lower = text.toLowerCase();
  if (lower.startsWith("json:") || lower.startsWith("json=")) {
    const firstBrace = text.indexOf("{");
    if (firstBrace !== -1) {
      text = text.slice(firstBrace);
    } else {
      text = text.slice(text.indexOf(":") + 1).trim();
    }
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1);
  }

  return text;
};

const parseAnalysisReport = (raw: unknown): InterviewAnalysisReport | null => {
  if (!raw) {
    return null;
  }

  let candidate: unknown = raw;

  if (typeof raw === "string") {
    const sanitized = sanitizeJsonLikeString(raw);
    if (!sanitized) {
      return null;
    }
    try {
      candidate = JSON.parse(sanitized);
    } catch (error) {
      console.error("Failed to parse analysis report JSON string", error, sanitized);
      return null;
    }
  }

  if (candidate && typeof candidate === "object") {
    if (isInterviewAnalysisReport(candidate)) {
      return candidate;
    }

    const nestedKeys = ["analysis", "report", "analysisReport"];
    for (const key of nestedKeys) {
      const nested = (candidate as Record<string, unknown>)[key];
      if (!nested) {
        continue;
      }
      if (typeof nested === "string") {
        const parsed = parseAnalysisReport(nested);
        if (parsed) {
          return parsed;
        }
      } else if (isInterviewAnalysisReport(nested)) {
        return nested;
      }
    }
  }

  return null;
};

const renderParagraphs = (text: string) =>
  text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph, index) => (
      <p key={`${paragraph.slice(0, 25)}-${index}`} className="text-lg text-charcoal leading-relaxed">
        {paragraph}
      </p>
    ));

export default function ScorecardPage({
  pin,
  createdAt,
  status,
  context,
  analysisReport,
  analysisGeneratedAt,
  error
}: ScorecardProps) {
  const pageTitle = analysisReport?.title?.trim() || "Interview Analysis Report";
  const detailItems = [
    pin ? `PIN ${pin}` : null,
    createdAt ? `Created ${formatDate(createdAt)}` : null,
    status ? `Status ${status.toLowerCase()}` : null,
    analysisGeneratedAt ? `Updated ${formatDate(analysisGeneratedAt)}` : null
  ].filter(Boolean);

  return (
    <div className="min-h-screen w-full bg-warm-cream">
      <Head>
        <title>Scorecard | SurvAgent</title>
        <meta
          name="description"
          content="Review the qualitative analysis generated from your SurvAgent interview transcripts."
        />
      </Head>

      <main className="flex flex-col items-center w-full px-8 py-20 md:py-28">
        <div className="flex flex-col gap-16 w-full max-w-6xl">
          <section className="flex flex-col gap-6 animate-fade-in delay-0">
            <span className="text-xs uppercase tracking-[0.5em] text-charcoal/60 font-semibold">
              Session report
            </span>
            <h1 className="text-5xl md:text-6xl font-bold text-charcoal leading-[1.1] tracking-tight">
              {pageTitle}
            </h1>
            <p className="text-xl text-soft-gray leading-relaxed max-w-3xl">
              {context?.prompt
                ? context.prompt
                : "A structured synthesis of every conversation captured by your SurvAgent AI interviewer."}
            </p>
            {detailItems.length ? (
              <p className="text-sm text-soft-gray font-medium uppercase tracking-widest">
                {detailItems.join(" · ")}
              </p>
            ) : null}
          </section>

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-red-700 font-medium">
              {error}
            </div>
          ) : analysisReport ? (
            <>
              <section className="bg-white/70 backdrop-blur-sm rounded-2xl p-10 shadow-lg border border-light-gray/40 animate-fade-in delay-100">
                <div className="space-y-4">
                  <h2 className="text-3xl font-bold text-charcoal tracking-tight">Executive summary</h2>
                  <p className="text-lg text-charcoal leading-relaxed font-medium">
                    {analysisReport.executiveSummary?.context ||
                      "The interview analysis is being prepared. Once ready, the executive summary will highlight the study context and overall learnings."}
                  </p>
                </div>

                {analysisReport.executiveSummary?.keyFindings?.length ? (
                  <div className="mt-10 grid gap-6 md:grid-cols-2">
                    {analysisReport.executiveSummary.keyFindings.map((finding, index) => (
                      <article
                        key={`${finding.theme}-${index}`}
                        className="rounded-2xl border border-light-gray/40 bg-white/80 p-6 shadow-sm hover:shadow-md transition-shadow duration-300"
                      >
                        <p className="text-xs uppercase tracking-[0.3em] text-charcoal/60 font-semibold">
                          Key finding {index + 1}
                        </p>
                        <h3 className="text-2xl font-semibold text-charcoal mt-3">{finding.theme}</h3>
                        <p className="text-lg text-soft-gray mt-3 leading-relaxed">{finding.analysis}</p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="text-soft-gray text-lg font-medium mt-8">
                    Key findings will appear as soon as the transcripts have been analyzed.
                  </p>
                )}
              </section>

              {analysisReport.sections.length ? (
                analysisReport.sections.map((section, sectionIndex) => (
                  <section
                    key={`${section.sectionName}-${sectionIndex}`}
                    className="bg-white/70 backdrop-blur-sm rounded-2xl p-10 shadow-lg border border-light-gray/40 animate-fade-in delay-200"
                  >
                    <div className="space-y-3 mb-8">
                      <p className="text-xs uppercase tracking-[0.4em] text-charcoal/60 font-semibold">
                        Section {sectionIndex + 1}
                      </p>
                      <h2 className="text-3xl font-bold text-charcoal tracking-tight">{section.sectionName}</h2>
                      {section.sectionIntro ? (
                        <p className="text-lg text-soft-gray leading-relaxed">{section.sectionIntro}</p>
                      ) : null}
                    </div>

                    <div className="flex flex-col gap-8">
                      {section.questions.map((question, questionIndex) => {
                        const statsEntries =
                          question.quantitativeData && typeof question.quantitativeData === "object"
                            ? Object.entries(question.quantitativeData).filter(
                                ([, value]) => typeof value === "string" && value.trim().length > 0
                              )
                            : [];
                        const quotes = Array.isArray(question.quotes)
                          ? question.quotes.filter((quote) => quote?.quote && quote.quote.trim())
                          : [];

                        return (
                          <article
                            key={`${question.questionText}-${questionIndex}`}
                            className="rounded-2xl border border-light-gray/40 bg-white/80 p-6 shadow-sm hover:shadow-md transition-shadow duration-300"
                          >
                            <div className="space-y-3">
                              <p className="text-xs uppercase tracking-[0.4em] text-charcoal/60 font-semibold">
                                Question {questionIndex + 1}
                              </p>
                              <h3 className="text-2xl font-semibold text-charcoal leading-tight">
                                {question.questionText}
                              </h3>
                            </div>

                            <div className="mt-5 flex flex-col gap-4">
                              {renderParagraphs(question.analysis)}
                            </div>

                            {statsEntries.length ? (
                              <div className="mt-6">
                                <p className="text-sm font-semibold text-charcoal/70 uppercase tracking-widest mb-3">
                                  Quantitative signals
                                </p>
                                <dl className="grid gap-4 md:grid-cols-2">
                                  {statsEntries.map(([label, value]) => (
                                    <div
                                      key={`${label}-${value}`}
                                      className="rounded-xl border border-light-gray/60 bg-warm-beige/40 px-4 py-3"
                                    >
                                      <dt className="text-xs uppercase text-charcoal/60 font-semibold">{label}</dt>
                                      <dd className="text-xl font-bold text-charcoal">{value}</dd>
                                    </div>
                                  ))}
                                </dl>
                              </div>
                            ) : null}

                            {quotes.length ? (
                              <div className="mt-6 flex flex-col gap-4">
                                <p className="text-sm font-semibold text-charcoal/70 uppercase tracking-widest">
                                  Representative quotes
                                </p>
                                <div className="grid gap-4 md:grid-cols-2">
                                  {quotes.map((quote, quoteIndex) => (
                                    <blockquote
                                      key={`${quote.quote}-${quoteIndex}`}
                                      className="rounded-xl border border-light-gray/40 bg-white px-4 py-4 shadow-sm"
                                    >
                                      <p className="text-lg text-charcoal leading-relaxed">“{quote.quote}”</p>
                                      <div className="text-sm text-soft-gray font-medium mt-2">
                                        {quote.participantId || "Participant"}
                                        {quote.context ? <span className="text-soft-gray/80"> · {quote.context}</span> : null}
                                      </div>
                                    </blockquote>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ))
              ) : (
                <section className="bg-white/70 backdrop-blur-sm rounded-2xl p-10 shadow-lg border border-light-gray/40">
                  <p className="text-lg text-soft-gray font-medium">
                    Section-level insights will appear here once the Interview Analysis agent returns results.
                  </p>
                </section>
              )}
            </>
          ) : (
            <section className="bg-white/70 backdrop-blur-sm rounded-2xl p-10 shadow-lg border border-light-gray/40">
              <h2 className="text-3xl font-bold text-charcoal tracking-tight mb-4">Analysis pending</h2>
              <p className="text-lg text-soft-gray leading-relaxed">
                We&apos;re still waiting on the Interview Analysis agent to finish synthesizing your conversations.
                Check back shortly, or refresh once the agent has processed the latest transcript.
              </p>
            </section>
          )}
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
        analysisReport: null,
        analysisGeneratedAt: null,
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
        analysisReport: null,
        analysisGeneratedAt: null,
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

    if (!sessionRows.length) {
      return {
        props: {
          sessionId: sid,
          status: null,
          createdAt: null,
          pin: normalizedPin,
          context: null,
          analysisReport: null,
          analysisGeneratedAt: null,
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
          analysisReport: null,
          analysisGeneratedAt: null,
          error: "Session PIN did not match."
        }
      };
    }

    const contextRows = await db
      .select({
        requester: sessionContexts.requester,
        prompt: sessionContexts.prompt
      })
      .from(sessionContexts)
      .where(eq(sessionContexts.sessionId, sid))
      .limit(1);

    const transcriptCondition = normalizedPin
      ? or(eq(convaiTranscripts.sessionId, sid), eq(convaiTranscripts.pinCode, normalizedPin))
      : eq(convaiTranscripts.sessionId, sid);

    const transcriptRows = await db
      .select({
        analysis: convaiTranscripts.analysis,
        receivedAt: convaiTranscripts.receivedAt
      })
      .from(convaiTranscripts)
      .where(transcriptCondition)
      .orderBy(desc(convaiTranscripts.receivedAt));

    let analysisReport: InterviewAnalysisReport | null = null;
    let analysisGeneratedAt: string | null = null;

    for (const row of transcriptRows) {
      const parsed = parseAnalysisReport(row.analysis);
      if (parsed) {
        analysisReport = parsed;
        analysisGeneratedAt = row.receivedAt ? row.receivedAt.toISOString() : null;
        break;
      }
    }

    return {
      props: {
        sessionId: sessionRecord.sessionId,
        status: sessionRecord.status,
        createdAt: sessionRecord.createdAt ? sessionRecord.createdAt.toISOString() : null,
        pin: normalizedPin,
        context: contextRows[0] ?? null,
        analysisReport,
        analysisGeneratedAt,
        error: null
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
        analysisReport: null,
        analysisGeneratedAt: null,
        error: "Unable to load scorecard right now."
      }
    };
  }
};
