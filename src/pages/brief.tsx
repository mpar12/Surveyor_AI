import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SURVEY_QUESTIONS_STORAGE_KEY } from "@/lib/storageKeys";
import { useSessionContext } from "@/contexts/SessionContext";
import type { InterviewScript } from "@/types/interviewScript";
import { extractQuestionsFromScript, isInterviewScript } from "@/types/interviewScript";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { GradientSpinner } from "@/components/ui/spinner";

interface ScriptState {
  data: InterviewScript | null;
  error: string | null;
  debug: string | null;
  loading: boolean;
}

const getQueryValue = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
};

const cloneScript = (script: InterviewScript) =>
  typeof structuredClone === "function"
    ? structuredClone(script)
    : (JSON.parse(JSON.stringify(script)) as InterviewScript);

const DEFAULT_SCRIPT: InterviewScript = {
  title: "",
  researchObjective: "Loading…",
  targetAudience: "Loading…",
  estimatedDuration: "Loading…",
  sections: [
    {
      sectionName: "Loading section…",
      questions: [
        {
          questionNumber: 1,
          questionText: "Loading question…",
          questionType: "open-ended",
          options: null,
          scale: null,
          followUp: null
        }
      ]
    }
  ],
  interviewerNotes: ["Loading notes…"],
  analysisConsiderations: ["Loading considerations…"]
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

export default function BriefPage() {
  const router = useRouter();
  const { sessionData } = useSessionContext();
  const [scriptState, setScriptState] = useState<ScriptState>({
    data: null,
    error: null,
    debug: null,
    loading: false
  });
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");

  const prompt = useMemo(() => {
    if (sessionData?.prompt) return sessionData.prompt;
    return getQueryValue(router.query.prompt);
  }, [sessionData?.prompt, router.query.prompt]);

  const name = useMemo(() => {
    if (sessionData?.requester) return sessionData.requester;
    return getQueryValue(router.query.name);
  }, [sessionData?.requester, router.query.name]);

  const sid = useMemo(() => getQueryValue(router.query.sid), [router.query.sid]);
  const pin = useMemo(() => getQueryValue(router.query.pin), [router.query.pin]);

  const canLaunchAgent = Boolean(sid) && Boolean(pin);
  const launchHref = useMemo(() => {
    if (!sid || !pin) return "/assistant";
    const params = new URLSearchParams({ sid, pin });
    return `/assistant?${params.toString()}`;
  }, [sid, pin]);

  const handleLaunchAgent = useCallback(() => {
    if (typeof window === "undefined" || !router.isReady || !canLaunchAgent) {
      return;
    }
    window.open(launchHref, "_blank", "noopener,noreferrer");
  }, [router.isReady, canLaunchAgent, launchHref]);

  // Load script from session context or storage on mount
  useEffect(() => {
    if (scriptState.data) {
      return;
    }

    const candidate = sessionData?.surveyQuestions;
    if (candidate) {
      if (isInterviewScript(candidate)) {
        setScriptState((previous) => ({ ...previous, data: candidate as InterviewScript }));
        return;
      }
      if (typeof candidate === "string") {
        try {
          const parsed = JSON.parse(candidate);
          if (isInterviewScript(parsed)) {
            setScriptState((previous) => ({ ...previous, data: parsed as InterviewScript }));
            return;
          }
        } catch {
          // ignore
        }
      }
    }

    if (typeof window === "undefined") {
      return;
    }
    const stored = window.sessionStorage.getItem(SURVEY_QUESTIONS_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (isInterviewScript(parsed)) {
          setScriptState((previous) => ({ ...previous, data: parsed as InterviewScript }));
        }
      } catch {
        // ignore
      }
    }
  }, [scriptState.data, sessionData?.surveyQuestions]);

  // Fetch script whenever prompt changes
  useEffect(() => {
    if (!router.isReady || !prompt.trim()) {
      setScriptState((previous) => ({
        ...previous,
        error: "A prompt is required to generate the research summary.",
        loading: false
      }));
      return;
    }

    const controller = new AbortController();

    async function fetchScript() {
      try {
        setScriptState((previous) => ({ ...previous, error: null, debug: null, loading: true }));
        const response = await fetch("/api/questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, requester: name }),
          signal: controller.signal
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            typeof payload.error === "string" && payload.error.trim()
              ? payload.error
              : "Failed to generate interview script"
          );
        }

        const parsed = payload as InterviewScript;
        if (!isInterviewScript(parsed)) {
          throw new Error("Interview script response was malformed");
        }

        setScriptState({ data: parsed, error: null, debug: null, loading: false });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        const message = error instanceof Error ? error.message : "Failed to generate interview script";
        setScriptState((previous) => ({ ...previous, error: message, debug: JSON.stringify(error, null, 2), loading: false }));
      }
    }

    fetchScript();
    return () => controller.abort();
  }, [router.isReady, prompt, name]);

  // Persist script to session storage and backend
  useEffect(() => {
    if (!scriptState.data || !sid) {
      return;
    }

    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem(SURVEY_QUESTIONS_STORAGE_KEY, JSON.stringify(scriptState.data));
      } catch (error) {
        console.error("Failed to store interview script", error);
      }
    }

    fetch("/api/sessions/context", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        sessionId: sid,
        requester: name,
        prompt,
        surveyQuestions: scriptState.data
      })
    }).catch((error) => {
      console.error("Failed to update session context with interview script", error);
    });
  }, [scriptState.data, sid, name, prompt]);

  const startEditing = useCallback((path: string, currentValue: string | null | undefined) => {
    setEditingPath(path);
    setEditingValue(currentValue ?? "");
  }, []);

  const commitEditing = useCallback(() => {
    if (!scriptState.data || !editingPath) {
      setEditingPath(null);
      return;
    }
    setScriptState((previous) => {
      if (!previous.data || !editingPath) {
        return previous;
      }
      const draft = cloneScript(previous.data);
      const segments = editingPath.split(".");
      let cursor: any = draft;
      for (let index = 0; index < segments.length - 1; index += 1) {
        const key = segments[index];
        const numeric = Number(key);
        if (!Number.isNaN(numeric) && key === numeric.toString()) {
          cursor = cursor[numeric];
        } else {
          cursor = cursor[key];
        }
        if (cursor === undefined) {
          return previous;
        }
      }
      const finalKey = segments[segments.length - 1];
      const numericFinal = Number(finalKey);
      if (!Number.isNaN(numericFinal) && finalKey === numericFinal.toString()) {
        cursor[numericFinal] = editingValue;
      } else {
        cursor[finalKey] = editingValue;
      }
      return { ...previous, data: draft };
    });
    setEditingPath(null);
    setEditingValue("");
  }, [editingPath, editingValue, scriptState.data]);

  const cancelEditing = useCallback(() => {
    setEditingPath(null);
    setEditingValue("");
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        cancelEditing();
      } else if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        commitEditing();
      }
    },
    [cancelEditing, commitEditing]
  );

  const script = scriptState.data ?? DEFAULT_SCRIPT;
  const isPlaceholder = !scriptState.data;
  const flattenedQuestions = useMemo(() => extractQuestionsFromScript(script), [script]);
  const isEditable = Boolean(scriptState.data);

  return (
    <div className="min-h-screen w-full bg-gradient-hero">
      <Head>
        <title>Research Brief | Surveyor</title>
        <meta name="description" content="Review AI-generated interview script for your research." />
      </Head>

      <Header />

      <main className="flex flex-col items-center w-full px-6 md:px-12 lg:px-20 py-12 md:py-16">
        <div className="flex flex-col gap-12 w-full max-w-5xl">
          {/* Hero Section */}
          <motion.section
            className="flex flex-col gap-6"
            initial="initial"
            animate="animate"
            variants={stagger}
          >
            <motion.div variants={fadeInUp}>
              <Badge variant="default" className="mb-4">
                Research Brief
              </Badge>
            </motion.div>

            <motion.div variants={fadeInUp} className="space-y-2">
              {scriptState.loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-12 w-3/4" />
                  <Skeleton className="h-8 w-1/2" />
                </div>
              ) : (
                <>
                  <h1 className="text-4xl md:text-5xl font-bold text-foreground leading-tight tracking-tight">
                    {script.title ? (
                      <>
                        <span className="text-foreground-muted font-medium">Interview Script:</span>{" "}
                        <span className="text-gradient">{script.title}</span>
                      </>
                    ) : (
                      <span className="text-foreground-muted">Generating interview script...</span>
                    )}
                  </h1>
                </>
              )}
            </motion.div>

            {/* Meta info grid */}
            <motion.div
              variants={fadeInUp}
              className="grid gap-4 md:grid-cols-2 mt-4"
            >
              <Card variant="default" padding="sm" className="group">
                <CardContent className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
                    Research Objective
                  </span>
                  {scriptState.loading ? (
                    <SkeletonText lines={2} />
                  ) : editingPath === "researchObjective" ? (
                    <Textarea
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      onBlur={commitEditing}
                      onKeyDown={handleKeyDown}
                      autoFocus
                      className="min-h-[80px]"
                    />
                  ) : (
                    <p
                      className="text-foreground font-medium cursor-pointer hover:text-primary transition-colors"
                      onDoubleClick={() => isEditable && startEditing("researchObjective", script.researchObjective)}
                      title={isEditable ? "Double-click to edit" : undefined}
                    >
                      {script.researchObjective}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card variant="default" padding="sm" className="group">
                <CardContent className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
                    Target Audience
                  </span>
                  {scriptState.loading ? (
                    <SkeletonText lines={2} />
                  ) : editingPath === "targetAudience" ? (
                    <Textarea
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      onBlur={commitEditing}
                      onKeyDown={handleKeyDown}
                      autoFocus
                      className="min-h-[80px]"
                    />
                  ) : (
                    <p
                      className="text-foreground font-medium cursor-pointer hover:text-primary transition-colors"
                      onDoubleClick={() => isEditable && startEditing("targetAudience", script.targetAudience)}
                      title={isEditable ? "Double-click to edit" : undefined}
                    >
                      {script.targetAudience}
                    </p>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Stats badges */}
            <motion.div variants={fadeInUp} className="flex flex-wrap gap-3">
              <Badge variant="secondary" size="lg">
                <ClockIcon className="w-4 h-4 mr-1.5" />
                {scriptState.loading ? "..." : script.estimatedDuration}
              </Badge>
              <Badge variant="secondary" size="lg">
                <QuestionIcon className="w-4 h-4 mr-1.5" />
                {isPlaceholder ? "..." : `${flattenedQuestions.length} Questions`}
              </Badge>
              <Badge variant="secondary" size="lg">
                <SectionIcon className="w-4 h-4 mr-1.5" />
                {isPlaceholder ? "..." : `${script.sections.length} Sections`}
              </Badge>
            </motion.div>
          </motion.section>

          {/* Loading State */}
          <AnimatePresence>
            {scriptState.loading && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center justify-center py-16 gap-4"
              >
                <GradientSpinner size="xl" />
                <div className="text-center">
                  <p className="text-lg font-medium text-foreground">Claude is generating your interview script</p>
                  <p className="text-sm text-foreground-muted mt-1">This usually takes 10-20 seconds...</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error State */}
          <AnimatePresence>
            {scriptState.error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Card variant="outline" className="border-error bg-error-subtle">
                  <CardContent className="flex items-start gap-3 p-4">
                    <ErrorIcon className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-error">Oops! Something went wrong</p>
                      <p className="text-sm text-error/80 mt-1">{scriptState.error}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Questions Sections */}
          {!scriptState.loading && scriptState.data && (
            <motion.div
              className="flex flex-col gap-8"
              initial="initial"
              animate="animate"
              variants={stagger}
            >
              {script.sections.map((section, sectionIndex) => (
                <motion.div key={`${section.sectionName}-${sectionIndex}`} variants={fadeInUp}>
                  <Card variant="elevated" padding="none" className="overflow-hidden">
                    <div className="bg-gradient-to-r from-primary/5 to-accent/5 px-6 py-4 border-b border-border">
                      <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold text-foreground">{section.sectionName}</h2>
                        <Badge variant="outline" size="sm">
                          {section.questions.length} questions
                        </Badge>
                      </div>
                      <p className="text-sm text-foreground-muted mt-1">
                        Double-click any question to edit the wording
                      </p>
                    </div>
                    <div className="p-6 space-y-4">
                      {section.questions.map((question, questionIndex) => (
                        <motion.article
                          key={`${question.questionNumber}-${questionIndex}`}
                          className="p-5 bg-background-subtle rounded-xl border border-border hover:border-primary/30 hover:shadow-md transition-all duration-200 group"
                          whileHover={{ scale: 1.005 }}
                        >
                          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                            <Badge variant="gradient" size="sm">
                              Q{question.questionNumber}
                            </Badge>
                            {question.questionType && (
                              <Badge variant="secondary" size="sm">
                                {question.questionType}
                              </Badge>
                            )}
                          </div>

                          {editingPath === `sections.${sectionIndex}.questions.${questionIndex}.questionText` ? (
                            <Textarea
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onBlur={commitEditing}
                              onKeyDown={handleKeyDown}
                              autoFocus
                              className="min-h-[100px]"
                              helperText="Press Enter to save, Escape to cancel"
                            />
                          ) : (
                            <p
                              className="text-lg font-medium text-foreground cursor-pointer group-hover:text-primary transition-colors"
                              onDoubleClick={() =>
                                isEditable &&
                                startEditing(
                                  `sections.${sectionIndex}.questions.${questionIndex}.questionText`,
                                  question.questionText
                                )
                              }
                            >
                              {question.questionText}
                            </p>
                          )}

                          {question.options && question.options.length > 0 && (
                            <div className="mt-4 pl-4 border-l-2 border-primary/20">
                              <span className="text-xs font-semibold uppercase tracking-wider text-primary mb-2 block">
                                Options
                              </span>
                              <ul className="space-y-1">
                                {question.options.map((option, optionIndex) => (
                                  <li
                                    key={`${option}-${optionIndex}`}
                                    className="text-foreground-secondary text-sm flex items-center gap-2"
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                                    {option}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {question.scale && (
                            <p className="mt-3 text-sm text-foreground-muted">
                              <span className="font-medium">Scale:</span> {question.scale}
                            </p>
                          )}

                          {question.followUp && (
                            <div className="mt-3 p-3 bg-accent-subtle rounded-lg">
                              <span className="text-xs font-semibold uppercase tracking-wider text-accent block mb-1">
                                Follow-up
                              </span>
                              <p className="text-sm text-foreground-secondary">{question.followUp}</p>
                            </div>
                          )}
                        </motion.article>
                      ))}
                    </div>
                  </Card>
                </motion.div>
              ))}

              {/* Interviewer Notes */}
              <motion.div variants={fadeInUp}>
                <Card variant="default">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <NoteIcon className="w-5 h-5 text-primary" />
                      Interviewer Notes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {script.interviewerNotes.map((note, noteIndex) => (
                        <li key={`note-${noteIndex}`} className="flex items-start gap-3">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                          {editingPath === `interviewerNotes.${noteIndex}` ? (
                            <Textarea
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onBlur={commitEditing}
                              onKeyDown={handleKeyDown}
                              autoFocus
                              className="flex-1"
                            />
                          ) : (
                            <p
                              className="text-foreground-secondary cursor-pointer hover:text-foreground transition-colors"
                              onDoubleClick={() => isEditable && startEditing(`interviewerNotes.${noteIndex}`, note)}
                            >
                              {note}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Analysis Considerations */}
              <motion.div variants={fadeInUp}>
                <Card variant="default">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AnalysisIcon className="w-5 h-5 text-primary" />
                      Analysis Considerations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {script.analysisConsiderations.map((item, itemIndex) => (
                        <li key={`analysis-${itemIndex}`} className="flex items-start gap-3">
                          <span className="w-1.5 h-1.5 rounded-full bg-accent mt-2 flex-shrink-0" />
                          {editingPath === `analysisConsiderations.${itemIndex}` ? (
                            <Textarea
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onBlur={commitEditing}
                              onKeyDown={handleKeyDown}
                              autoFocus
                              className="flex-1"
                            />
                          ) : (
                            <p
                              className="text-foreground-secondary cursor-pointer hover:text-foreground transition-colors"
                              onDoubleClick={() =>
                                isEditable && startEditing(`analysisConsiderations.${itemIndex}`, item)
                              }
                            >
                              {item}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          )}

          {/* Action Buttons */}
          <motion.div
            className="flex flex-wrap items-center justify-center gap-4 pt-8 pb-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Button
              variant="default"
              size="lg"
              onClick={handleLaunchAgent}
              disabled={!canLaunchAgent || scriptState.loading}
              className="min-w-[180px]"
            >
              <PlayIcon className="w-5 h-5" />
              Preview AI Agent
            </Button>

            <Button
              variant="outline"
              size="lg"
              asChild
              disabled={!sid || !pin || scriptState.loading}
              className="min-w-[220px]"
            >
              <Link href={{ pathname: "/population", query: { sid, pin } }}>
                Choose Participants
                <ArrowRightIcon className="w-5 h-5" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </main>
    </div>
  );
}

// Icon components
function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
    </svg>
  );
}

function QuestionIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function SectionIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
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

function NoteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function AnalysisIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
  );
}
