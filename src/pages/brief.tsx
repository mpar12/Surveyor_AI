import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { SURVEY_QUESTIONS_STORAGE_KEY } from "@/lib/storageKeys";
import { useSessionContext } from "@/contexts/SessionContext";

type QueryValue = string | string[] | undefined;

const getQueryValue = (value: QueryValue) => {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
};

type SortableQuestion = {
  id: string;
  text: string;
};

type SortableQuestionRowProps = SortableQuestion & { index: number };

const DEFAULT_SAMPLE_QUESTIONS: string[] = [
  "What prompted you to start exploring this topic recently?",
  "Can you walk me through the last time you encountered this challenge?",
  "How are you currently addressing this need today?",
  "Which teams or stakeholders feel the impact of this most acutely?",
  "If you could change one part of the current experience, what would it be and why?",
  "What signals would tell you that a solution is really working?",
  "How do you evaluate trade-offs when prioritizing initiatives like this?",
  "What objections or hesitations do you hear from others about solving this now?",
  "Where do you go today for insight or inspiration when making these decisions?",
  "Looking ahead six months, what would success look like for this project?"
];

function SortableQuestionRow({ id, text, index }: SortableQuestionRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-start gap-4 p-6 bg-white/80 backdrop-blur-sm rounded-xl border border-light-gray/40 hover:bg-white hover:border-orange-accent/30 hover:shadow-lg transition-all duration-300 ${
        isDragging ? "opacity-60 shadow-xl scale-[1.01]" : "shadow-sm"
      }`}
    >
      <button
        type="button"
        className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-orange-accent text-white text-sm font-bold cursor-grab active:cursor-grabbing hover:bg-orange-hover hover:scale-110 transition-all duration-200 shadow-md"
        {...attributes}
        {...listeners}
      >
        {index + 1}
      </button>
      <p className="flex-1 text-base text-charcoal border-b border-light-gray/40 pb-2 mb-0">
        {text}
      </p>
    </div>
  );
}

export default function BriefPage() {
  const router = useRouter();
  const { sessionData, isLoading: sessionLoading, error: sessionError } = useSessionContext();

  // Extract data from session context or fallback to URL params for initial load
  const name = useMemo(() => {
    if (sessionData?.requester) return sessionData.requester;
    return getQueryValue(router.query.name);
  }, [sessionData?.requester, router.query.name]);
  
  const prompt = useMemo(() => {
    if (sessionData?.prompt) return sessionData.prompt;
    return getQueryValue(router.query.prompt);
  }, [sessionData?.prompt, router.query.prompt]);
  
  const sid = useMemo(() => getQueryValue(router.query.sid), [router.query.sid]);
  const pin = useMemo(() => getQueryValue(router.query.pin), [router.query.pin]);
  const [questionParagraph, setQuestionParagraph] = useState<string | null>(null);
  const [questionParagraphError, setQuestionParagraphError] = useState<string | null>(null);
  const [questionDebugInfo, setQuestionDebugInfo] = useState<string | null>(null);
  const [areQuestionsLoading, setAreQuestionsLoading] = useState(false);
  const derivedQuestionTexts = useMemo(() => {
    const normalizeStringList = (value: string) =>
      value
        .split(/[\n•-]|(?<=\?)/)
        .map((entry) => entry.replace(/^[\d\.\-\s]+/, "").trim())
        .filter(Boolean);

    const raw = sessionData?.surveyQuestions;
    if (Array.isArray(raw) && raw.length) {
      return raw.map((entry) => (typeof entry === "string" ? entry.trim() : "")).filter(Boolean);
    }

    if (typeof raw === "string" && raw.trim()) {
      return normalizeStringList(raw);
    }

    if (questionParagraph && questionParagraph.trim()) {
      return normalizeStringList(questionParagraph);
    }

    return [];
  }, [sessionData?.surveyQuestions, questionParagraph]);

  const [questionItems, setQuestionItems] = useState<SortableQuestion[]>([]);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    const baseList = derivedQuestionTexts.length ? derivedQuestionTexts : DEFAULT_SAMPLE_QUESTIONS;
    setQuestionItems(
      baseList.map((text, index) => ({
        id: `question-${index}`,
        text
      }))
    );
  }, [derivedQuestionTexts]);

  // Clean URL after initial load if we have session data
  useEffect(() => {
    if (sessionData && router.isReady && sid && pin) {
      // Check if URL has more than just sid and pin
      const hasExtraParams = Object.keys(router.query).some(key => 
        key !== 'sid' && key !== 'pin' && router.query[key]
      );
      
      if (hasExtraParams) {
        // Replace URL with clean version
        router.replace({
          pathname: router.pathname,
          query: { sid, pin }
        }, undefined, { shallow: true });
      }
    }
  }, [sessionData, router.isReady, sid, pin, router]);

  const launchHref = useMemo(() => {
    if (!sid || !pin) return "/assistant";
    
    const params = new URLSearchParams();
    params.set("sid", sid);
    params.set("pin", pin);

    return `/assistant?${params.toString()}`;
  }, [sid, pin]);

  const canLaunchAgent = useMemo(() => Boolean(sid) && Boolean(pin), [sid, pin]);

  const handleLaunchAgent = useCallback(() => {
    if (typeof window === "undefined" || !router.isReady || !canLaunchAgent) {
      return;
    }

    window.open(launchHref, "_blank", "noopener,noreferrer");
  }, [router.isReady, canLaunchAgent, launchHref]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) {
        return;
      }

      setQuestionItems((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        if (oldIndex === -1 || newIndex === -1) {
          return items;
        }

        return arrayMove(items, oldIndex, newIndex);
      });
    },
    [setQuestionItems]
  );

  useEffect(() => {
    if (!router.isReady) {
      return;
    }

    if (!prompt.trim()) {
      setQuestionParagraph(null);
      setAreQuestionsLoading(false);
      setQuestionParagraphError("A prompt is required to generate survey questions.");
      return;
    }

    const controller = new AbortController();

    async function fetchQuestions() {
      try {
        setAreQuestionsLoading(true);
        setQuestionParagraphError(null);
        setQuestionDebugInfo(null);
        setQuestionParagraph(null);

        const response = await fetch("/api/questions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            prompt,
            requester: name
          }),
          signal: controller.signal
        });

        const rawText = await response.text();

        if (!response.ok) {
          let errorMessage = rawText;
          if (rawText) {
            try {
              const parsed = JSON.parse(rawText);
              if (typeof parsed.error === "string" && parsed.error.trim()) {
                errorMessage = parsed.error.trim();
              }
            } catch {
              // ignore JSON parse errors for error payloads
            }
          }

          throw new Error(errorMessage || "Failed to generate survey questions");
        }

        const normalized = rawText.trim();

        if (!normalized) {
          throw new Error("Response is missing the survey question paragraph");
        }

        setQuestionParagraph(normalized);
        setQuestionDebugInfo(null);
      } catch (fetchError) {
        if (controller.signal.aborted) {
          return;
        }

        console.error("Failed to fetch survey questions", fetchError);
        setQuestionParagraph(null);
        setQuestionParagraphError(
          fetchError instanceof Error ? fetchError.message : "Failed to generate survey questions"
        );
        setQuestionDebugInfo(() => {
          if (fetchError instanceof Error) {
            const stack = fetchError.stack;
            return stack && stack !== fetchError.message ? stack : fetchError.message;
          }
          try {
            return JSON.stringify(fetchError);
          } catch {
            return String(fetchError);
          }
        });
      } finally {
        if (!controller.signal.aborted) {
          setAreQuestionsLoading(false);
        }
      }
    }

    fetchQuestions();

    return () => controller.abort();
  }, [router.isReady, prompt, name]);

  useEffect(() => {
    if (!questionParagraph || !sid) {
      return;
    }

    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem(SURVEY_QUESTIONS_STORAGE_KEY, questionParagraph);
      } catch (error) {
        console.error("Failed to store survey questions", error);
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
        surveyQuestions: questionParagraph
      })
    }).catch((error) => {
      console.error("Failed to update session context with survey questions", error);
    });
  }, [questionParagraph, sid, name, prompt]);

  const promptSummaryText = prompt?.trim() ? prompt.trim() : "Prompt not available yet.";
  const questionIntroText = prompt?.trim()
    ? `Grounded in your prompt: “${prompt.trim()}”.`
    : "Grounded in your research prompt.";
  const isPopulationDisabled = !sid || !pin;

  return (
    <div className="min-h-screen w-full bg-warm-cream">
      <Head>
        <title>Research Brief | SurvAgent</title>
        <meta name="description" content="Review AI-generated context for your survey outreach." />
      </Head>

      <header className="sticky top-0 z-10 flex items-center justify-end bg-warm-cream/95 backdrop-blur-sm px-6 md:px-12 py-5 border-b border-light-gray/30">
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
            <h1 className="text-5xl md:text-6xl font-bold text-charcoal leading-[1.1] tracking-tight">
              Survey Questions
            </h1>
            <p className="text-2xl text-soft-gray leading-relaxed max-w-4xl font-medium">
              Our AI analyzes your prompt to draft a research brief and custom conversation starters.
              <span className="text-orange-accent"> Feel free to tweak anything you see.</span>
            </p>
          </section>

          <section className="flex flex-col gap-4 p-8 bg-white/70 backdrop-blur-sm rounded-2xl border-l-4 border-orange-accent shadow-lg animate-fade-in">
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-charcoal/60 uppercase tracking-widest">Prompt summary</h3>
              <p className="text-lg text-charcoal leading-relaxed font-medium">{promptSummaryText}</p>
            </div>
            {questionParagraphError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {questionParagraphError}
              </div>
            ) : null}
            {questionDebugInfo ? (
              <pre className="rounded-xl border border-orange-accent/40 bg-white/70 px-4 py-3 text-sm text-soft-gray">
                {questionDebugInfo}
              </pre>
            ) : null}
          </section>
        </div>

        <section className="w-full max-w-6xl mt-16 animate-fade-in">
          <div className="mb-8 flex flex-col gap-3">
            <h3 className="text-3xl md:text-4xl font-bold text-charcoal tracking-tight">Survey Questions</h3>
            <p className="text-lg text-soft-gray">
              {questionIntroText}{" "}
              <span className="font-semibold text-orange-accent">Drag to reorder.</span>
            </p>
          </div>

          {areQuestionsLoading ? (
            <div className="rounded-2xl border border-light-gray/40 bg-white/70 px-6 py-10 text-center text-soft-gray text-lg">
              Drafting market positioning questions…
            </div>
          ) : questionItems.length ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={questionItems.map((item) => item.id)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-5">
                  {questionItems.map((item, index) => (
                    <SortableQuestionRow key={item.id} id={item.id} text={item.text} index={index} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <div className="rounded-2xl border border-dashed border-light-gray/60 px-6 py-10 text-center text-soft-gray text-lg">
              Survey questions will appear here once generated.
            </div>
          )}
        </section>

        <div className="flex flex-wrap items-center justify-center gap-5 mt-16 w-full max-w-5xl animate-fade-in">
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
              isPopulationDisabled ? "pointer-events-none opacity-60" : "hover:bg-white hover:border-orange-accent"
            }`}
            href={{
              pathname: "/population",
              query: {
                sid,
                pin
              }
            }}
          >
            Choose Interview Participants →
          </Link>
        </div>
      </main>
    </div>
  );
}
