import Head from "next/head";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GetServerSideProps } from "next";
import { motion, AnimatePresence } from "framer-motion";
import { db } from "@/db/client";
import { convaiTranscripts, sessionContexts, sessions } from "@/db/schema";
import { desc, eq, or } from "drizzle-orm";
import type { InterviewAnalysisReport } from "@/types/interviewAnalysis";
import { isInterviewAnalysisReport } from "@/types/interviewAnalysis";
import { sanitizeJsonLikeString } from "@/lib/jsonUtils";
import type { InterviewScript } from "@/types/interviewScript";
import { isInterviewScript } from "@/types/interviewScript";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GradientSpinner } from "@/components/ui/spinner";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";

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
  if (!raw) return null;

  let candidate: unknown = raw;

  if (typeof raw === "string") {
    const sanitized = sanitizeJsonLikeString(raw);
    if (!sanitized) return null;
    try {
      candidate = JSON.parse(sanitized);
    } catch (error) {
      console.error("Failed to parse analysis report JSON string", error, sanitized);
      return null;
    }
  }

  if (candidate && typeof candidate === "object") {
    if (isInterviewAnalysisReport(candidate)) return candidate;

    for (const key of ANALYSIS_NESTED_KEYS) {
      const nested = (candidate as Record<string, unknown>)[key];
      if (!nested) continue;
      if (typeof nested === "string") {
        const parsed = parseAnalysisReport(nested);
        if (parsed) return parsed;
      } else if (isInterviewAnalysisReport(nested)) {
        return nested;
      }
    }
  }

  return null;
};

const extractGeneratedAt = (raw: unknown): string | null => {
  if (!raw) return null;

  if (typeof raw === "string") {
    const sanitized = sanitizeJsonLikeString(raw);
    if (!sanitized) return null;
    try {
      const parsed = JSON.parse(sanitized);
      return extractGeneratedAt(parsed);
    } catch {
      return null;
    }
  }

  if (typeof raw === "object") {
    const candidate = raw as Record<string, unknown>;
    if (typeof candidate.generatedAt === "string") return candidate.generatedAt;

    for (const key of ANALYSIS_NESTED_KEYS) {
      const nested = candidate[key];
      if (!nested) continue;
      const nestedValue = extractGeneratedAt(nested);
      if (nestedValue) return nestedValue;
    }
  }

  return null;
};

const parseTimestamp = (value: string | null) => {
  if (!value) return null;
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
    if (transcriptMs == null) return false;
    const analysisMs = parseTimestamp(analysisGeneratedAt);
    if (analysisMs == null) return true;
    return transcriptMs > analysisMs;
  }

  const transcriptMs = parseTimestamp(latestTranscriptAt);
  if (transcriptMs == null) return false;
  const analysisMs = parseTimestamp(analysisGeneratedAt);
  if (analysisMs == null) return true;
  return transcriptMs > analysisMs;
};

const parseInterviewScript = (raw: unknown): InterviewScript | null => {
  if (!raw) return null;
  if (isInterviewScript(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (isInterviewScript(parsed)) return parsed;
    } catch {
      return null;
    }
  }
  return null;
};

// Animation variants
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 }
};

const stagger = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

// Expandable Quote Component
function ExpandableQuotes({
  quotes
}: {
  quotes: Array<{ quote: string; participantId?: string | null; context?: string | null }>;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const displayQuotes = isExpanded ? quotes : quotes.slice(0, 2);

  if (!quotes.length) return null;

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm font-semibold text-foreground-muted hover:text-primary transition-colors mb-3"
      >
        <QuoteIcon className="w-4 h-4" />
        <span className="uppercase tracking-wider">
          {quotes.length} Supporting Quote{quotes.length !== 1 ? "s" : ""}
        </span>
        <ChevronIcon className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        <motion.div
          className="grid gap-3 md:grid-cols-2"
          initial={false}
          animate={{ height: "auto" }}
        >
          {displayQuotes.map((quote, index) => (
            <motion.blockquote
              key={`${quote.quote.slice(0, 20)}-${index}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="relative p-4 bg-primary-subtle rounded-xl border border-primary/10"
            >
              <span className="absolute top-2 left-3 text-4xl text-primary/20 font-serif">&ldquo;</span>
              <p className="text-foreground-secondary text-sm leading-relaxed pl-4">
                {quote.quote}
              </p>
              <footer className="mt-2 pl-4 text-xs text-foreground-muted">
                {quote.participantId || "Participant"}
                {quote.context && <span className="opacity-70"> · {quote.context}</span>}
              </footer>
            </motion.blockquote>
          ))}
        </motion.div>
      </AnimatePresence>

      {quotes.length > 2 && !isExpanded && (
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="mt-2 text-sm text-primary hover:text-primary-hover transition-colors"
        >
          Show {quotes.length - 2} more quote{quotes.length - 2 !== 1 ? "s" : ""}
        </button>
      )}
    </div>
  );
}

// Render analysis content as bullet points or paragraphs
function AnalysisContent({ content }: { content: string | string[] }) {
  if (Array.isArray(content)) {
    const items = content.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean);
    if (!items.length) return null;
    return (
      <ul className="space-y-2">
        {items.map((item, index) => (
          <li key={`${item.slice(0, 25)}-${index}`} className="flex items-start gap-3">
            <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
            <span className="text-foreground-secondary leading-relaxed">{item}</span>
          </li>
        ))}
      </ul>
    );
  }

  const hasSingleNewlines = content.includes("\n");
  const hasDoubleNewlines = content.includes("\n\n");

  if (hasSingleNewlines && !hasDoubleNewlines) {
    const bullets = content.split("\n").map((line) => line.trim()).filter(Boolean);
    if (bullets.length > 1) {
      return (
        <ul className="space-y-2">
          {bullets.map((bullet, index) => (
            <li key={`${bullet.slice(0, 25)}-${index}`} className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
              <span className="text-foreground-secondary leading-relaxed">{bullet}</span>
            </li>
          ))}
        </ul>
      );
    }
  }

  return (
    <div className="space-y-3">
      {content
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((paragraph, index) => (
          <p key={`${paragraph.slice(0, 25)}-${index}`} className="text-foreground-secondary leading-relaxed">
            {paragraph}
          </p>
        ))}
    </div>
  );
}

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
  const [analysisReport, setAnalysisReport] = useState<InterviewAnalysisReport | null>(initialAnalysisReport);
  const [analysisTimestamp, setAnalysisTimestamp] = useState<string | null>(analysisGeneratedAt);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [rawAnalysisOutput, setRawAnalysisOutput] = useState<string | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const fetchControllerRef = useRef<AbortController | null>(null);
  const analysisCleanupRef = useRef<(() => void) | null>(null);

  const showStreamingPreview = isStreaming || Boolean(streamingText.trim());
  const pageTitle = analysisReport?.title?.trim() || "Interview Analysis Report";

  const detailItems = [
    pin ? `PIN ${pin}` : null,
    createdAt ? `Created ${formatDate(createdAt)}` : null,
    status ? `${status.toLowerCase()}` : null,
    analysisTimestamp ? `Updated ${formatDate(analysisTimestamp)}` : null
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

      if (!force && !needsRefresh) return () => {};
      if (analysisLoading || isStreaming) return () => {};

      let aborted = false;
      const controller = new AbortController();
      fetchControllerRef.current = controller;

      if (force) {
        setAnalysisReport(null);
        setAnalysisTimestamp(null);
        setRawAnalysisOutput(null);
      }

      const handleSseEvent = (eventType: string, payload: string) => {
        if (!payload) return;

        let data: unknown;
        try {
          data = JSON.parse(payload);
        } catch {
          return;
        }

        if (eventType === "delta") {
          const text = typeof (data as { text?: unknown }).text === "string" ? (data as { text: string }).text : "";
          if (text) setStreamingText((prev) => prev + text);
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
          if (finalText) setRawAnalysisOutput(finalText);

          const providedReport = record.report && isInterviewAnalysisReport(record.report) ? record.report : null;
          const parsedReport = providedReport ?? parseAnalysisReport(finalText);

          if (record.error) setAnalysisError(record.error);

          const finalTimestamp = record.generatedAt?.trim() ? record.generatedAt : new Date().toISOString();

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
        if (!rawEvent.trim()) return;

        const lines = rawEvent.split("\n");
        let eventType = "message";
        let dataPayload = "";

        for (const line of lines) {
          if (!line.trim()) continue;
          if (line.startsWith("event:")) {
            eventType = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            const value = line.slice(5).trim();
            dataPayload = dataPayload ? `${dataPayload}\n${value}` : value;
          }
        }

        if (!dataPayload) return;
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

          if (!response.body) throw new Error("Interview analysis agent returned an empty response.");

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            let separatorIndex = buffer.indexOf("\n\n");
            while (separatorIndex !== -1) {
              const rawEvent = buffer.slice(0, separatorIndex);
              buffer = buffer.slice(separatorIndex + 2);
              processRawEvent(rawEvent);
              separatorIndex = buffer.indexOf("\n\n");
            }
          }

          if (buffer.trim()) processRawEvent(buffer);
        } catch (fetchError) {
          if (aborted) return;
          setAnalysisError(fetchError instanceof Error ? fetchError.message : "Unable to fetch interview analysis.");
          setStreamingText("");
          setIsStreaming(false);
          setRawAnalysisOutput(null);
        } finally {
          if (!aborted) {
            setAnalysisLoading(false);
            setIsStreaming(false);
            if (fetchControllerRef.current === controller) fetchControllerRef.current = null;
            analysisCleanupRef.current = null;
          }
        }
      };

      fetchAnalysis();

      const cleanup = () => {
        aborted = true;
        if (fetchControllerRef.current === controller) fetchControllerRef.current = null;
        controller.abort();
        analysisCleanupRef.current = null;
      };

      analysisCleanupRef.current = cleanup;
      return cleanup;
    },
    [sessionError, sessionId, pin, analysisReport, analysisTimestamp, latestTranscriptAt, analysisLoading, isStreaming]
  );

  const autoRefreshNeeded = shouldRefreshAnalysis(Boolean(analysisReport), analysisTimestamp, latestTranscriptAt);

  useEffect(() => {
    if (!autoRefreshNeeded) return;
    return runAnalysis(false);
  }, [autoRefreshNeeded, runAnalysis]);

  useEffect(() => {
    return () => {
      analysisCleanupRef.current?.();
    };
  }, []);

  const blockingError = sessionError || analysisError;

  return (
    <div className="min-h-screen w-full bg-gradient-hero">
      <Head>
        <title>Scorecard | Surveyor</title>
        <meta
          name="description"
          content="Review the qualitative analysis generated from your interview transcripts."
        />
      </Head>

      <Header />

      <main className="flex flex-col items-center w-full px-6 md:px-12 lg:px-20 py-12 md:py-16">
        <div className="flex flex-col gap-10 w-full max-w-5xl">
          {/* Hero Section */}
          <motion.section
            className="flex flex-col gap-6"
            initial="initial"
            animate="animate"
            variants={stagger}
          >
            <motion.div variants={fadeInUp} className="flex items-center gap-3 flex-wrap">
              <Badge variant="default">Analysis Report</Badge>
              {status && (
                <Badge variant={status === "active" ? "success" : "secondary"} dot>
                  {status}
                </Badge>
              )}
            </motion.div>

            <motion.div variants={fadeInUp}>
              <h1 className="text-4xl md:text-5xl font-bold text-foreground leading-tight tracking-tight">
                <span className="text-gradient">{pageTitle}</span>
              </h1>
              {context?.prompt && (
                <p className="text-lg text-foreground-secondary mt-3 max-w-3xl leading-relaxed">
                  {context.prompt}
                </p>
              )}
            </motion.div>

            {/* Meta badges */}
            <motion.div variants={fadeInUp} className="flex flex-wrap items-center gap-3">
              {detailItems.map((item, index) => (
                <Badge key={`${item}-${index}`} variant="secondary" size="lg">
                  {item}
                </Badge>
              ))}
              {canRequestAnalysis && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => runAnalysis(true)}
                  disabled={manualRefreshDisabled}
                  className="ml-2"
                >
                  <RefreshIcon className={`w-4 h-4 ${analysisLoading || isStreaming ? "animate-spin" : ""}`} />
                  {analysisLoading || isStreaming ? "Analyzing..." : "Re-run Analysis"}
                </Button>
              )}
            </motion.div>

            {/* Context info */}
            {(context?.company || context?.product || context?.researchObjective) && (
              <motion.div variants={fadeInUp}>
                <Card variant="default" padding="sm">
                  <CardContent className="grid gap-4 md:grid-cols-3">
                    {context.company && (
                      <div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">Company</span>
                        <p className="text-foreground font-medium mt-1">{context.company}</p>
                      </div>
                    )}
                    {context.product && (
                      <div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">Product</span>
                        <p className="text-foreground font-medium mt-1">{context.product}</p>
                      </div>
                    )}
                    {context.researchObjective && (
                      <div className="md:col-span-3">
                        <span className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
                          Research Objective
                        </span>
                        <p className="text-foreground font-medium mt-1">{context.researchObjective}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </motion.section>

          {/* Error State */}
          <AnimatePresence>
            {blockingError && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Card variant="outline" className="border-error bg-error-subtle">
                  <CardContent className="flex items-start gap-3 p-4">
                    <ErrorIcon className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-error">Oops! Something went wrong</p>
                      <p className="text-sm text-error/80 mt-1">{blockingError}</p>
                      {rawAnalysisOutput && (
                        <details className="mt-3">
                          <summary className="text-xs uppercase tracking-wider text-error/70 cursor-pointer">
                            View raw output
                          </summary>
                          <pre className="mt-2 p-3 bg-surface rounded-lg text-xs overflow-auto max-h-48">
                            {rawAnalysisOutput}
                          </pre>
                        </details>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Loading State */}
          <AnimatePresence>
            {analysisLoading && !analysisReport && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center justify-center py-16 gap-4"
              >
                <GradientSpinner size="xl" />
                <div className="text-center">
                  <p className="text-lg font-medium text-foreground">Claude is analyzing your interviews</p>
                  <p className="text-sm text-foreground-muted mt-1">This usually takes 30-60 seconds...</p>
                </div>
                {streamingText && (
                  <Card variant="default" className="mt-6 max-w-2xl w-full">
                    <CardContent className="p-4">
                      <Badge variant="warning" size="sm" className="mb-3">
                        <span className="animate-pulse-soft">Live Preview</span>
                      </Badge>
                      <p className="text-foreground-secondary text-sm leading-relaxed">{streamingText}</p>
                    </CardContent>
                  </Card>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Analysis Content */}
          {!blockingError && analysisReport && (
            <motion.div className="flex flex-col gap-8" initial="initial" animate="animate" variants={stagger}>
              {/* Executive Summary */}
              <motion.div variants={fadeInUp}>
                <Card variant="elevated">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                        <SummaryIcon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <CardTitle>Executive Summary</CardTitle>
                        <p className="text-sm text-foreground-muted mt-0.5">Key insights at a glance</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {analysisReport.executiveSummary?.context && (
                      <p className="text-lg text-foreground leading-relaxed font-medium">
                        {analysisReport.executiveSummary.context}
                      </p>
                    )}

                    {/* Key Findings */}
                    {analysisReport.executiveSummary?.keyFindings?.length ? (
                      <div className="grid gap-4 md:grid-cols-2">
                        {analysisReport.executiveSummary.keyFindings.map((finding, index) => (
                          <motion.div
                            key={`${finding.theme}-${index}`}
                            className="p-5 bg-background-subtle rounded-xl border border-border hover:border-primary/30 hover:shadow-md transition-all duration-200"
                            whileHover={{ scale: 1.01 }}
                          >
                            <Badge variant="gradient" size="sm" className="mb-3">
                              Key Finding {index + 1}
                            </Badge>
                            <h3 className="text-lg font-semibold text-foreground mb-2">{finding.theme}</h3>
                            <div className="text-foreground-secondary text-sm">
                              <AnalysisContent content={finding.analysis as string | string[]} />
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-6 bg-background-muted rounded-xl text-center">
                        <p className="text-foreground-muted">
                          Key findings will appear as transcripts are analyzed.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Streaming indicator */}
              {showStreamingPreview && (
                <motion.div variants={fadeInUp}>
                  <Card variant="glass" className="border-warning/30">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="w-2 h-2 rounded-full bg-warning animate-pulse-soft" />
                        <span className="text-sm font-medium text-warning">Live: New insights streaming in...</span>
                      </div>
                      <p className="text-foreground-secondary text-sm">{streamingText || "Processing transcripts..."}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Section-by-Section Analysis */}
              {analysisReport.sections?.length
                ? analysisReport.sections.map((section, sectionIndex) => (
                    <motion.div key={`${section.sectionName}-${sectionIndex}`} variants={fadeInUp}>
                      <Card variant="default">
                        <CardHeader>
                          <div className="flex items-center justify-between flex-wrap gap-3">
                            <div className="flex items-center gap-3">
                              <Badge variant="outline">Section {sectionIndex + 1}</Badge>
                              <CardTitle>{section.sectionName}</CardTitle>
                            </div>
                            <Badge variant="secondary" size="sm">
                              {section.questions.length} question{section.questions.length !== 1 ? "s" : ""}
                            </Badge>
                          </div>
                          {section.sectionIntro && (
                            <p className="text-foreground-secondary mt-2">{section.sectionIntro}</p>
                          )}
                        </CardHeader>
                        <CardContent className="space-y-6">
                          {section.questions.map((question, questionIndex) => {
                            const statsEntries =
                              question.quantitativeData && typeof question.quantitativeData === "object"
                                ? Object.entries(question.quantitativeData).filter(
                                    ([, value]) => typeof value === "string" && value.trim().length > 0
                                  )
                                : [];
                            const quotes = Array.isArray(question.quotes)
                              ? question.quotes.filter((q) => q?.quote && q.quote.trim())
                              : [];

                            return (
                              <motion.article
                                key={`${question.questionText}-${questionIndex}`}
                                className="p-5 bg-background-subtle rounded-xl border border-border"
                                whileHover={{ borderColor: "hsl(var(--color-primary) / 0.3)" }}
                              >
                                <div className="flex items-start justify-between gap-3 mb-4">
                                  <div>
                                    <Badge variant="secondary" size="sm" className="mb-2">
                                      Question {questionIndex + 1}
                                    </Badge>
                                    <h3 className="text-lg font-semibold text-foreground leading-snug">
                                      {question.questionText}
                                    </h3>
                                  </div>
                                </div>

                                <div className="mt-4">
                                  <AnalysisContent content={question.analysis} />
                                </div>

                                {/* Quantitative Data */}
                                {statsEntries.length > 0 && (
                                  <div className="mt-5 pt-5 border-t border-border">
                                    <span className="text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-3 block">
                                      Quantitative Signals
                                    </span>
                                    <div className="grid gap-3 md:grid-cols-2">
                                      {statsEntries.map(([label, value]) => (
                                        <div
                                          key={`${label}-${value}`}
                                          className="flex items-center justify-between p-3 bg-surface rounded-lg border border-border"
                                        >
                                          <span className="text-sm text-foreground-muted capitalize">
                                            {label.replace(/([A-Z])/g, " $1").trim()}
                                          </span>
                                          <span className="text-lg font-bold text-primary">{value}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Expandable Quotes */}
                                <ExpandableQuotes quotes={quotes} />
                              </motion.article>
                            );
                          })}
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))
                : null}
            </motion.div>
          )}

          {/* Empty State */}
          {!blockingError && !analysisReport && !analysisLoading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card variant="default" className="text-center py-16">
                <CardContent>
                  <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-background-muted flex items-center justify-center">
                    <ClipboardIcon className="w-8 h-8 text-foreground-muted" />
                  </div>
                  <h2 className="text-xl font-semibold text-foreground mb-2">Analysis Pending</h2>
                  <p className="text-foreground-muted max-w-md mx-auto">
                    Your insights await! Complete some interviews and the analysis will appear here automatically.
                  </p>
                  {canRequestAnalysis && (
                    <Button variant="default" className="mt-6" onClick={() => runAnalysis(true)}>
                      <RefreshIcon className="w-4 h-4" />
                      Run Analysis Now
                    </Button>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}

// Icons
function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function SummaryIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  );
}

function QuoteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
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
      typeof interviewScript?.researchObjective === "string" ? interviewScript.researchObjective : null;

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
