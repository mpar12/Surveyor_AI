import Head from "next/head";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GetServerSideProps } from "next";
import { db } from "@/db/client";
import { convaiTranscripts, sessionContexts, sessions } from "@/db/schema";
import { desc, eq, or } from "drizzle-orm";
import type { InterviewAnalysisReport } from "@/types/interviewAnalysis";
import { isInterviewAnalysisReport } from "@/types/interviewAnalysis";
import { sanitizeJsonLikeString } from "@/lib/jsonUtils";
import type { InterviewScript } from "@/types/interviewScript";
import { isInterviewScript } from "@/types/interviewScript";

interface ScorecardProps {
  sessionId: string | null;
  status: string | null;
  createdAt: string | null;
  pin?: string | null;
  context?: {
    requester?: string | null;
    prompt?: string | null;
    researchObjective?: string | null;
    company?: string | null;
    product?: string | null;
  } | null;
  analysisReport: InterviewAnalysisReport | null;
  analysisGeneratedAt: string | null;
  latestTranscriptAt: string | null;
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

const ANALYSIS_NESTED_KEYS = ["analysis", "report", "analysisReport"] as const;

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

    for (const key of ANALYSIS_NESTED_KEYS) {
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

const extractGeneratedAt = (raw: unknown): string | null => {
  if (!raw) {
    return null;
  }

  if (typeof raw === "string") {
    const sanitized = sanitizeJsonLikeString(raw);
    if (!sanitized) {
      return null;
    }
    try {
      const parsed = JSON.parse(sanitized);
      return extractGeneratedAt(parsed);
    } catch {
      return null;
    }
  }

  if (typeof raw === "object") {
    const candidate = raw as Record<string, unknown>;
    if (typeof candidate.generatedAt === "string") {
      return candidate.generatedAt;
    }

    for (const key of ANALYSIS_NESTED_KEYS) {
      const nested = candidate[key];
      if (!nested) {
        continue;
      }
      const nestedValue = extractGeneratedAt(nested);
      if (nestedValue) {
        return nestedValue;
      }
    }
  }

  return null;
};

const parseTimestamp = (value: string | null) => {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const shouldRefreshAnalysis = (
  hasReport: boolean,
  analysisGeneratedAt: string | null,
  latestTranscriptAt: string | null
) => {
  if (!hasReport) {
    const transcriptMs = parseTimestamp(latestTranscriptAt);
    if (transcriptMs == null) {
      return false;
    }
    const analysisMs = parseTimestamp(analysisGeneratedAt);
    if (analysisMs == null) {
      return true;
    }
    return transcriptMs > analysisMs;
  }

  const transcriptMs = parseTimestamp(latestTranscriptAt);
  if (transcriptMs == null) {
    return false;
  }

  const analysisMs = parseTimestamp(analysisGeneratedAt);
  if (analysisMs == null) {
    return true;
  }

  return transcriptMs > analysisMs;
};

const renderParagraphs = (content: string | string[]) => {
  // Handle array format (already renders as bullets correctly)
  if (Array.isArray(content)) {
    const normalizedItems = content
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
    if (!normalizedItems.length) {
      return null;
    }
    return (
      <ul className="list-disc pl-6 space-y-2 text-lg text-charcoal leading-relaxed">
        {normalizedItems.map((item, index) => (
          <li key={`${item.slice(0, 25)}-${index}`}>{item}</li>
        ))}
      </ul>
    );
  }

  // Check if content has single newlines (bullet format from Claude)
  // If it has \n but not \n\n, treat as bullet points
  const hasSingleNewlines = content.includes("\n");
  const hasDoubleNewlines = content.includes("\n\n");

  if (hasSingleNewlines && !hasDoubleNewlines) {
    // Bullet point format: split on single newlines
    const bullets = content
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (bullets.length > 1) {
      return (
        <ul className="list-disc pl-6 space-y-2 text-lg text-charcoal leading-relaxed">
          {bullets.map((bullet, index) => (
            <li key={`${bullet.slice(0, 25)}-${index}`}>{bullet}</li>
          ))}
        </ul>
      );
    }
  }

  // Paragraph format: split on double newlines (existing logic)
  return content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph, index) => (
      <p key={`${paragraph.slice(0, 25)}-${index}`} className="text-lg text-charcoal leading-relaxed">
        {paragraph}
      </p>
    ));
};

const parseInterviewScript = (raw: unknown): InterviewScript | null => {
  if (!raw) {
    return null;
  }

  if (isInterviewScript(raw)) {
    return raw;
  }

  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (isInterviewScript(parsed)) {
        return parsed;
      }
    } catch {
      return null;
    }
  }

  return null;
};

export default function ScorecardPage({
  sessionId,
  pin,
  createdAt,
  status,
  context,
  analysisReport: initialAnalysisReport,
  analysisGeneratedAt,
  latestTranscriptAt,
  error: sessionError
}: ScorecardProps) {
  const [analysisReport, setAnalysisReport] = useState<InterviewAnalysisReport | null>(
    initialAnalysisReport
  );
  const [analysisTimestamp, setAnalysisTimestamp] = useState<string | null>(analysisGeneratedAt);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [rawAnalysisOutput, setRawAnalysisOutput] = useState<string | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const fetchControllerRef = useRef<AbortController | null>(null);
  const analysisCleanupRef = useRef<(() => void) | null>(null);

  const showStreamingPreview = isStreaming || Boolean(streamingText.trim());

  const buildStreamingParagraphs = () => {
    if (!streamingText.trim()) {
      return [
        <p key="streaming-placeholder" className="text-lg text-soft-gray leading-relaxed">
          The interview analysis agent is synthesizing your transcripts…
        </p>
      ];
    }
    return renderParagraphs(streamingText);
  };

  const renderStreamingSection = () => (
    <section className="bg-white/70 backdrop-blur-sm rounded-2xl p-10 shadow-lg border border-light-gray/40 animate-fade-in delay-150">
      <div className="space-y-3 mb-8">
        <p className="text-xs uppercase tracking-[0.4em] text-charcoal/60 font-semibold">Live analysis</p>
        <h2 className="text-3xl font-bold text-charcoal tracking-tight">Insights are being generated</h2>
        <p className="text-lg text-soft-gray leading-relaxed">
          We&apos;re streaming fresh findings from your latest transcripts. This view will update once the full report
          is ready.
        </p>
      </div>

      <div className="flex flex-col gap-8">
        <article className="rounded-2xl border border-light-gray/40 bg-white/80 p-6 shadow-sm hover:shadow-md transition-shadow duration-300">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.4em] text-charcoal/60 font-semibold">Live question</p>
            <h3 className="text-2xl font-semibold text-charcoal leading-tight">Synthesis in progress</h3>
          </div>

          <div className="mt-5 flex flex-col gap-4">{buildStreamingParagraphs()}</div>
        </article>
      </div>
    </section>
  );

  const pageTitle = analysisReport?.title?.trim() || "Interview Analysis Report";
  const detailItems = [
    pin ? `PIN ${pin}` : null,
    createdAt ? `Created ${formatDate(createdAt)}` : null,
    status ? `Status ${status.toLowerCase()}` : null,
    analysisTimestamp ? `Updated ${formatDate(analysisTimestamp)}` : null
  ].filter(Boolean);

  const researchObjective = context?.researchObjective?.trim();
  const interviewContextItems = [
    context?.company ? `Company: ${context.company}` : null,
    context?.product ? `Product: ${context.product}` : null,
    researchObjective ? `Research objective: ${researchObjective}` : null
  ].filter(Boolean);
  const canRequestAnalysis = Boolean(sessionId && pin && !sessionError);
  const manualRefreshDisabled = !canRequestAnalysis || analysisLoading || isStreaming;

  const runAnalysis = useCallback(
    (force = false) => {
      if (sessionError || !sessionId || !pin) {
        setAnalysisLoading(false);
        return () => {};
      }

      const needsRefresh = shouldRefreshAnalysis(
        Boolean(analysisReport),
        analysisTimestamp,
        latestTranscriptAt
      );

      if (!force && !needsRefresh) {
        return () => {};
      }

      if (analysisLoading || isStreaming) {
        return () => {};
      }

      let aborted = false;
      const controller = new AbortController();
      fetchControllerRef.current = controller;

      if (force) {
        setAnalysisReport(null);
        setAnalysisTimestamp(null);
        setRawAnalysisOutput(null);
      }

      const handleSseEvent = (eventType: string, payload: string) => {
        if (!payload) {
          return;
        }

        let data: unknown;
        try {
          data = JSON.parse(payload);
        } catch {
          return;
        }

        if (eventType === "delta") {
          const text =
            typeof (data as { text?: unknown }).text === "string"
              ? (data as { text: string }).text
              : "";
          if (text) {
            setStreamingText((previous) => previous + text);
          }
          return;
        }

        if (eventType === "error") {
          const message =
            data && typeof (data as { message?: unknown }).message === "string"
              ? (data as { message: string }).message
              : "Unable to fetch interview analysis.";
          setAnalysisError(message);
          setIsStreaming(false);
          setStreamingText("");
          return;
        }

        if (eventType === "done") {
          const record = data as {
            text?: string;
            report?: unknown;
            generatedAt?: string;
            error?: string;
          };
          const finalText = typeof record.text === "string" ? record.text : "";
          if (finalText) {
            setRawAnalysisOutput(finalText);
          }
          const providedReport =
            record.report && isInterviewAnalysisReport(record.report) ? record.report : null;
          const parsedReport = providedReport ?? parseAnalysisReport(finalText);

          if (record.error) {
            setAnalysisError(record.error);
          }

          const finalTimestamp =
            record.generatedAt && record.generatedAt.trim()
              ? record.generatedAt
              : new Date().toISOString();

          if (parsedReport) {
            setAnalysisReport(parsedReport);
            setAnalysisError(null);
            setRawAnalysisOutput(null);
          } else if (!record.error) {
            setAnalysisError("Unable to parse interview analysis JSON.");
          }

          setAnalysisTimestamp(finalTimestamp);
          setStreamingText("");
          setIsStreaming(false);
        }
      };

      const processRawEvent = (rawEvent: string) => {
        if (!rawEvent.trim()) {
          return;
        }

        const lines = rawEvent.split("\n");
        let eventType = "message";
        let dataPayload = "";

        for (const line of lines) {
          if (!line.trim()) {
            continue;
          }

          if (line.startsWith("event:")) {
            eventType = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            const value = line.slice(5).trim();
            dataPayload = dataPayload ? `${dataPayload}\n${value}` : value;
          }
        }

        if (!dataPayload) {
          return;
        }

        handleSseEvent(eventType, dataPayload);
      };

    const fetchAnalysis = async () => {
      setAnalysisLoading(true);
      setIsStreaming(true);
      setStreamingText("");
      setAnalysisError(null);
      setRawAnalysisOutput(null);

        try {
          const response = await fetch("/api/takeaways", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId, pin }),
            signal: controller.signal
          });

          if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            const message =
              typeof payload?.error === "string" && payload.error.trim()
                ? payload.error
                : "Unable to fetch interview analysis.";
            throw new Error(message);
          }

          if (!response.body) {
            throw new Error("Interview analysis agent returned an empty response.");
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { value, done } = await reader.read();
            if (done) {
              break;
            }

            buffer += decoder.decode(value, { stream: true });

            let separatorIndex = buffer.indexOf("\n\n");
            while (separatorIndex !== -1) {
              const rawEvent = buffer.slice(0, separatorIndex);
              buffer = buffer.slice(separatorIndex + 2);
              processRawEvent(rawEvent);
              separatorIndex = buffer.indexOf("\n\n");
            }
          }

          if (buffer.trim()) {
            processRawEvent(buffer);
          }
        } catch (fetchError) {
          if (aborted) {
            return;
          }
        setAnalysisError(
          fetchError instanceof Error ? fetchError.message : "Unable to fetch interview analysis."
        );
        setStreamingText("");
        setIsStreaming(false);
        setRawAnalysisOutput(null);
      } finally {
        if (!aborted) {
          setAnalysisLoading(false);
          setIsStreaming(false);
            if (fetchControllerRef.current === controller) {
              fetchControllerRef.current = null;
            }
            analysisCleanupRef.current = null;
          }
        }
      };

      fetchAnalysis();

      const cleanup = () => {
        aborted = true;
        if (fetchControllerRef.current === controller) {
          fetchControllerRef.current = null;
        }
        controller.abort();
        analysisCleanupRef.current = null;
      };

      analysisCleanupRef.current = cleanup;
      return cleanup;
    },
    [
      sessionError,
      sessionId,
      pin,
      analysisReport,
      analysisTimestamp,
      latestTranscriptAt,
      analysisLoading,
      isStreaming
    ]
  );

  const autoRefreshNeeded = shouldRefreshAnalysis(
    Boolean(analysisReport),
    analysisTimestamp,
    latestTranscriptAt
  );

  useEffect(() => {
    if (!autoRefreshNeeded) {
      return;
    }
    return runAnalysis(false);
  }, [autoRefreshNeeded, runAnalysis]);

  useEffect(() => {
    return () => {
      analysisCleanupRef.current?.();
    };
  }, []);

  const blockingError = sessionError || analysisError;

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
            <div className="space-y-3 text-xl text-soft-gray leading-relaxed max-w-3xl">
              <p>
                {context?.prompt
                  ? context.prompt
                  : "A structured synthesis of every conversation captured by your SurvAgent AI interviewer."}
              </p>
              {interviewContextItems.length ? (
                <div className="text-base text-charcoal/80 space-y-1">
                  {interviewContextItems.map((item, index) => (
                    <p key={`${item}-${index}`} className="font-medium">
                      {item}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
            {(detailItems.length || canRequestAnalysis) ? (
              <div className="flex flex-wrap items-center gap-4">
                {detailItems.length ? (
                  <p className="text-sm text-soft-gray font-medium uppercase tracking-widest">
                    {detailItems.join(" · ")}
                  </p>
                ) : null}
                {canRequestAnalysis ? (
                  <button
                    type="button"
                    onClick={() => runAnalysis(true)}
                    disabled={manualRefreshDisabled}
                    className="inline-flex items-center gap-2 rounded-full border border-charcoal/20 px-4 py-2 text-sm font-semibold text-charcoal hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {analysisLoading || isStreaming ? "Re-running…" : "Re-run analysis"}
                  </button>
                ) : null}
              </div>
            ) : null}
          </section>

          {blockingError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-red-700 font-medium space-y-4">
              <p>{blockingError}</p>
              {rawAnalysisOutput ? (
                <div className="space-y-2">
                  <p className="text-sm uppercase tracking-wide text-red-800">Raw analysis output</p>
                  <pre className="max-h-72 overflow-auto rounded-xl bg-white/80 p-4 text-sm text-charcoal">
                    {rawAnalysisOutput}
                  </pre>
                </div>
              ) : null}
            </div>
          ) : analysisReport || showStreamingPreview ? (
            <>
              <section className="bg-white/70 backdrop-blur-sm rounded-2xl p-10 shadow-lg border border-light-gray/40 animate-fade-in delay-100">
                <div className="space-y-4">
                  <h2 className="text-3xl font-bold text-charcoal tracking-tight">Executive summary</h2>
                  {analysisReport ? (
                    <p className="text-lg text-charcoal leading-relaxed font-medium">
                      {analysisReport.executiveSummary?.context ||
                        "The interview analysis is being prepared. Once ready, the executive summary will highlight the study context and overall learnings."}
                    </p>
                  ) : showStreamingPreview ? (
                    <div className="flex flex-col gap-4">{buildStreamingParagraphs()}</div>
                  ) : (
                    <p className="text-lg text-charcoal leading-relaxed font-medium">
                      The interview analysis is being prepared. Once ready, the executive summary will highlight the study
                      context and overall learnings.
                    </p>
                  )}
                  {showStreamingPreview && analysisReport ? (
                    <p className="text-sm text-amber-600 font-semibold uppercase tracking-widest">
                      Live: New insights are streaming in.
                    </p>
                  ) : null}
                </div>

                {analysisReport?.executiveSummary?.keyFindings?.length ? (
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
                        <div className="text-lg text-soft-gray mt-3 leading-relaxed">
                          {renderParagraphs(finding.analysis as string | string[])}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : showStreamingPreview ? (
                  <p className="text-soft-gray text-lg font-medium mt-8">
                    We&apos;re constructing your key findings now—this section will update automatically.
                  </p>
                ) : (
                  <p className="text-soft-gray text-lg font-medium mt-8">
                    Key findings will appear as soon as the transcripts have been analyzed.
                  </p>
                )}
              </section>

              {showStreamingPreview ? renderStreamingSection() : null}

              {analysisReport?.sections?.length ? (
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
                                        {quote.context ? (
                                          <span className="text-soft-gray/80"> · {quote.context}</span>
                                        ) : null}
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
              ) : !showStreamingPreview ? (
                <section className="bg-white/70 backdrop-blur-sm rounded-2xl p-10 shadow-lg border border-light-gray/40">
                  <p className="text-lg text-soft-gray font-medium">
                    Section-level insights will appear here once the Interview Analysis agent returns results.
                  </p>
                </section>
              ) : null}
            </>
          ) : analysisLoading ? (
            <section className="bg-white/70 backdrop-blur-sm rounded-2xl p-10 shadow-lg border border-light-gray/40">
              <h2 className="text-3xl font-bold text-charcoal tracking-tight mb-4">Analyzing conversations</h2>
              <p className="text-lg text-soft-gray leading-relaxed">
                The interview analysis agent is processing your transcripts. This usually takes a minute—feel free to
                refresh if the status doesn&apos;t update automatically.
              </p>
            </section>
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
        latestTranscriptAt: null,
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
        latestTranscriptAt: null,
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
          latestTranscriptAt: null,
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
          latestTranscriptAt: null,
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
        surveyQuestions: sessionContexts.surveyQuestions
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
    const latestTranscriptAt: string | null = transcriptRows.length
      ? transcriptRows[0].receivedAt
        ? transcriptRows[0].receivedAt.toISOString()
        : null
      : null;

    for (const row of transcriptRows) {
      const parsed = parseAnalysisReport(row.analysis);
      if (parsed) {
        analysisReport = parsed;
        const storedGeneratedAt = extractGeneratedAt(row.analysis);
        analysisGeneratedAt = storedGeneratedAt
          ? storedGeneratedAt
          : row.receivedAt
          ? row.receivedAt.toISOString()
          : null;
        break;
      }
    }

    const interviewScript = parseInterviewScript(contextRows[0]?.surveyQuestions ?? null);
    const researchObjective =
      typeof interviewScript?.researchObjective === "string"
        ? interviewScript.researchObjective
        : null;

    return {
      props: {
        sessionId: sessionRecord.sessionId,
        status: sessionRecord.status,
        createdAt: sessionRecord.createdAt ? sessionRecord.createdAt.toISOString() : null,
        pin: normalizedPin,
        context: {
          requester: contextRows[0]?.requester ?? null,
          prompt: contextRows[0]?.prompt ?? null,
          company: contextRows[0]?.company ?? null,
          product: contextRows[0]?.product ?? null,
          researchObjective
        },
        analysisReport,
        analysisGeneratedAt,
        latestTranscriptAt,
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
        latestTranscriptAt: null,
        error: "Unable to load scorecard right now."
      }
    };
  }
};
