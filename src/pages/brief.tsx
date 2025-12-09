import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SURVEY_QUESTIONS_STORAGE_KEY } from "@/lib/storageKeys";
import { useSessionContext } from "@/contexts/SessionContext";
import type { InterviewScript } from "@/types/interviewScript";
import { extractQuestionsFromScript, isInterviewScript } from "@/types/interviewScript";

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
  const [editingValue, setEditingValue] = useState("" );

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
        } catch (error) {
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
      } catch (error) {
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

  const renderEditableField = useCallback(
    (
      path: string,
      value: string | null | undefined,
      placeholder?: string,
      className?: string,
      allowEdit = true,
      prefix = ""
    ) => {
      if (!allowEdit) {
        return (
          <p className={`text-charcoal leading-relaxed ${className ?? ""}`}>
            {prefix}
            {value && value.trim().length ? value : placeholder ?? ""}
          </p>
        );
      }

      if (editingPath === path) {
        return (
          <div className={`flex flex-col gap-1 ${className ?? ""}`}>
            {prefix ? <span className="text-sm font-semibold text-soft-gray">{prefix}</span> : null}
            <textarea
              className="w-full rounded-xl border border-light-gray/60 bg-white/90 px-4 py-3 text-base text-charcoal focus:outline-none focus:ring-2 focus:ring-orange-accent"
              value={editingValue}
              onChange={(event) => setEditingValue(event.target.value)}
              onBlur={commitEditing}
              autoFocus
            />
          </div>
        );
      }
      return (
        <p
          className={`text-charcoal leading-relaxed ${className ?? ""}`}
          onDoubleClick={() => startEditing(path, value)}
        >
          {prefix}
          {value && value.trim().length ? value : placeholder ?? "Double-click to edit."}
        </p>
      );
    },
    [editingPath, editingValue, commitEditing, startEditing]
  );

  const script = scriptState.data ?? DEFAULT_SCRIPT;
  const isPlaceholder = !scriptState.data;
  const flattenedQuestions = useMemo(() => extractQuestionsFromScript(script), [script]);
  const isEditable = Boolean(scriptState.data);

  return (
    <div className="min-h-screen w-full bg-warm-cream">
      <Head>
        <title>Research Brief | SurvAgent</title>
        <meta name="description" content="Review AI-generated context for your survey outreach." />
      </Head>

      <header className="sticky top-0 z-10 flex items-center justify-end bg-warm-cream/95 backdrop-blur-sm px-6 md:px-12 py-5 border-b border-light-gray/30 animate-fade-in">
        <Link
          href="/return"
          className="rounded-full px-6 py-2.5 text-sm font-medium bg-white/80 border border-light-gray/50 text-charcoal hover:bg-white hover:border-light-gray transition-all duration-300 shadow-sm"
        >
          Returning? Click here to input PIN
        </Link>
      </header>

      <main className="flex flex-col items-center w-full px-6 md:px-12 lg:px-20 py-12 md:py-20">
        <div className="flex flex-col gap-16 w-full max-w-6xl">
          <section className="flex flex-col gap-8 animate-fade-in">
            <p className="text-xs tracking-[0.45em] uppercase text-soft-gray">Research Brief</p>
            {renderEditableField(
              "title",
              script?.title ?? "",
              "",
              "text-5xl md:text-6xl font-bold text-charcoal leading-[1.1] tracking-tight",
              isEditable,
              "Interview Script: "
            )}
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="text-xs font-bold text-charcoal/60 uppercase tracking-widest mb-2">Research objective</h3>
                {renderEditableField("researchObjective", script?.researchObjective ?? "", "", "text-lg text-charcoal font-medium", isEditable)}
              </div>
              <div>
                <h3 className="text-xs font-bold text-charcoal/60 uppercase tracking-widest mb-2">Target audience</h3>
                {renderEditableField("targetAudience", script?.targetAudience ?? "", "", "text-lg text-charcoal font-medium", isEditable)}
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="rounded-full border border-light-gray/60 bg-white/70 px-4 py-2 text-sm font-semibold text-charcoal">
                Duration: {renderEditableField("estimatedDuration", script?.estimatedDuration ?? "", "", "inline-block font-semibold", isEditable)}
              </div>
              <div className="rounded-full border border-light-gray/60 bg-white/70 px-4 py-2 text-sm font-semibold text-charcoal">
                Questions: {isPlaceholder ? "—" : flattenedQuestions.length}
              </div>
            </div>
            {!isEditable ? (
              <div className="rounded-2xl border border-light-gray/60 bg-white/70 px-6 py-4 text-soft-gray text-sm">
                {scriptState.loading ? "Generating interview script…" : "Provide a prompt to generate interview questions."}
              </div>
            ) : null}
          </section>

          {scriptState.error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-red-700 font-medium">
              {scriptState.error}
            </div>
          ) : null}
          {scriptState.debug ? (
            <pre className="rounded-2xl border border-orange-accent/30 bg-white/80 px-6 py-4 text-soft-gray text-sm whitespace-pre-wrap">
              {scriptState.debug}
            </pre>
          ) : null}

          {script ? (
            <section className="flex flex-col gap-16">
              {script.sections.map((section, sectionIndex) => (
                <div
                  key={`${section.sectionName}-${sectionIndex}`}
                  className="bg-white/70 backdrop-blur-sm rounded-2xl p-10 shadow-lg border border-light-gray/40 animate-fade-in"
                >
                  <header className="mb-6">
                    <h2 className="text-3xl font-bold text-charcoal tracking-tight">{section.sectionName}</h2>
                    <p className="text-sm text-soft-gray mt-2">Double-click any question to edit the wording.</p>
                  </header>
                  <div className="flex flex-col gap-5">
                    {section.questions.map((question, questionIndex) => (
                      <article
                        key={`${question.questionNumber}-${questionIndex}`}
                        className="p-6 bg-white/80 backdrop-blur-sm rounded-xl border border-light-gray/40 hover:border-orange-accent/30 hover:shadow-lg transition-all duration-300"
                      >
                        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                          <span className="text-sm font-bold text-charcoal">
                            Q{question.questionNumber}
                          </span>
                          {question.questionType ? (
                            <span className="text-xs uppercase tracking-widest text-soft-gray font-semibold">
                              {question.questionType}
                            </span>
                          ) : null}
                        </div>
                        {renderEditableField(
                          `sections.${sectionIndex}.questions.${questionIndex}.questionText`,
                          question.questionText,
                          "Question text",
                          "text-lg font-semibold text-charcoal",
                          isEditable
                        )}
                        {question.options && question.options.length ? (
                          <div className="mt-4">
                            <h4 className="text-sm font-bold text-orange-accent mb-2">Options</h4>
                            <ul className="list-disc pl-5 space-y-1 text-charcoal">
                              {question.options.map((option, optionIndex) => (
                                <li key={`${option}-${optionIndex}`} onDoubleClick={() => startEditing(`sections.${sectionIndex}.questions.${questionIndex}.options.${optionIndex}`, option)}>
                                  {editingPath === `sections.${sectionIndex}.questions.${questionIndex}.options.${optionIndex}` ? (
                                    <input
                                      className="rounded-lg border border-light-gray/60 px-3 py-1 text-sm"
                                      value={editingPath === `sections.${sectionIndex}.questions.${questionIndex}.options.${optionIndex}` ? editingValue : option}
                                      autoFocus
                                      onBlur={commitEditing}
                                      onChange={(event) => setEditingValue(event.target.value)}
                                    />
                                  ) : (
                                    option
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {question.scale ? (
                          <p className="mt-3 text-sm text-soft-gray">
                            Scale: {renderEditableField(
                              `sections.${sectionIndex}.questions.${questionIndex}.scale`,
                              question.scale,
                              undefined,
                              "inline text-soft-gray",
                              isEditable
                            )}
                          </p>
                        ) : null}
                        {question.followUp ? (
                          <div className="mt-3">
                            <h4 className="text-sm font-bold text-charcoal">Follow-up</h4>
                            {renderEditableField(
                              `sections.${sectionIndex}.questions.${questionIndex}.followUp`,
                              question.followUp,
                              "Follow-up prompt",
                              "text-sm text-soft-gray",
                              isEditable
                            )}
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>
                </div>
              ))}

              <section className="bg-white/70 backdrop-blur-sm rounded-2xl p-10 shadow-lg border border-light-gray/40">
                <h3 className="text-3xl font-bold text-charcoal mb-6">Interviewer notes</h3>
                <ul className="list-disc pl-6 space-y-3 text-charcoal">
                  {script.interviewerNotes.map((note, noteIndex) => (
                    <li key={`note-${noteIndex}`}>
                      {renderEditableField(
                        `interviewerNotes.${noteIndex}`,
                        note,
                        "Double-click to edit note",
                        "text-base",
                        isEditable
                      )}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="bg-white/70 backdrop-blur-sm rounded-2xl p-10 shadow-lg border border-light-gray/40">
                <h3 className="text-3xl font-bold text-charcoal mb-6">Analysis considerations</h3>
                <ul className="list-disc pl-6 space-y-3 text-charcoal">
                  {script.analysisConsiderations.map((item, itemIndex) => (
                    <li key={`analysis-${itemIndex}`}>
                      {renderEditableField(
                        `analysisConsiderations.${itemIndex}`,
                        item,
                        "Double-click to edit consideration",
                        "text-base",
                        isEditable
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            </section>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-5 mt-20 w-full max-w-5xl animate-fade-in delay-200">
          <button
            type="button"
            onClick={handleLaunchAgent}
            disabled={!canLaunchAgent}
            className="rounded-full bg-orange-accent hover:bg-orange-hover px-10 py-4 text-lg font-semibold text-white transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 active:scale-100 disabled:opacity-60 disabled:hover:scale-100"
          >
            Preview AI Agent
          </button>

          <Link
            className={`rounded-full border-2 border-orange-accent/40 bg-white/80 px-10 py-4 text-lg font-semibold text-charcoal transition-all duration-300 shadow-md hover:shadow-lg hover:scale-105 active:scale-100 ${
              !sid || !pin ? "pointer-events-none opacity-60" : "hover:bg-white hover:border-orange-accent"
            }`}
            href={{ pathname: "/population", query: { sid, pin } }}
          >
            Choose Interview Participants →
          </Link>
        </div>
      </main>
    </div>
  );
}
