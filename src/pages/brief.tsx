import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import styles from "@/styles/Brief.module.css";
import { SURVEY_QUESTIONS_STORAGE_KEY } from "@/lib/storageKeys";
import { useSessionContext } from "@/contexts/SessionContext";

type DescriptionResponse = {
  promptSummary: string;
  researchHighlights: string;
};

type QueryValue = string | string[] | undefined;

const getQueryValue = (value: QueryValue) => {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
};

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
  const [descriptions, setDescriptions] = useState<DescriptionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [questions, setQuestions] = useState<string[] | null>(null);
  const [questionsError, setQuestionsError] = useState<string | null>(null);
  const [areQuestionsLoading, setAreQuestionsLoading] = useState(false);

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

  const encodedSurveyQuestions = useMemo(() => {
    if (!questions || !questions.length) {
      return null;
    }

    try {
      if (typeof window === "undefined") {
        return null;
      }

      const payload = JSON.stringify(questions);
      return window.btoa(unescape(encodeURIComponent(payload)));
    } catch (encodedError) {
      console.error("Failed to encode survey questions", encodedError);
      return null;
    }
  }, [questions]);

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

  useEffect(() => {
    if (!router.isReady) {
      return;
    }

    if (!prompt.trim()) {
      setDescriptions(null);
      setIsLoading(false);
      setError("A prompt is required to generate the research summary.");
      setQuestions(null);
      setAreQuestionsLoading(false);
      setQuestionsError("A prompt is required to generate survey questions.");
      return;
    }

    const controller = new AbortController();

    async function fetchDescriptions() {
      try {
        setIsLoading(true);
        setError(null);
        setDescriptions(null);

        const response = await fetch("/api/descriptions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ prompt, requester: name }),
          signal: controller.signal
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            typeof payload.error === "string" && payload.error.trim()
              ? payload.error
              : "Failed to generate descriptions"
          );
        }

        setDescriptions(payload as DescriptionResponse);
      } catch (fetchError) {
        if (controller.signal.aborted) {
          return;
        }

        console.error("Failed to fetch descriptions", fetchError);
        setDescriptions(null);
        setError(
          fetchError instanceof Error ? fetchError.message : "Failed to generate descriptions"
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    async function fetchQuestions() {
      try {
        setAreQuestionsLoading(true);
        setQuestionsError(null);
        setQuestions(null);

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

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            typeof payload.error === "string" && payload.error.trim()
              ? payload.error
              : "Failed to generate survey questions"
          );
        }

        const parsed = payload as { questions?: unknown };

        if (!Array.isArray(parsed.questions)) {
          throw new Error("Response is missing survey questions");
        }

        setQuestions(parsed.questions as string[]);
      } catch (fetchError) {
        if (controller.signal.aborted) {
          return;
        }

        console.error("Failed to fetch survey questions", fetchError);
        setQuestions(null);
        setQuestionsError(
          fetchError instanceof Error ? fetchError.message : "Failed to generate survey questions"
        );
      } finally {
        if (!controller.signal.aborted) {
          setAreQuestionsLoading(false);
        }
      }
    }

    fetchDescriptions();
    fetchQuestions();

    return () => controller.abort();
  }, [router.isReady, prompt, name]);

  useEffect(() => {
    if (!questions || !sid) {
      return;
    }

    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem(SURVEY_QUESTIONS_STORAGE_KEY, JSON.stringify(questions));
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
        surveyQuestions: questions
      })
    }).catch((error) => {
      console.error("Failed to update session context with survey questions", error);
    });
  }, [questions, sid, name, prompt]);

  const summaryCopy = descriptions?.promptSummary;
  const highlightsCopy = descriptions?.researchHighlights;

  const handleQuestionChange = useCallback(
    (index: number, event: ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.target.value;
      setQuestions((previous) => {
        if (!previous) {
          return previous;
        }
        const updated = [...previous];
        updated[index] = nextValue;
        return updated;
      });
    },
    []
  );

  return (
    <div className={styles.container}>
      <Head>
        <title>Research Brief | SurvAgent</title>
        <meta name="description" content="Review AI-generated context for your survey outreach." />
      </Head>

      <h1 className={styles.pageTitle}>Survey Questions</h1>
      <p className={styles.pageSubtitle}>
        Our AI analyzes your prompt to draft a research brief and custom conversation starters. Feel free to tweak anything you see.
      </p>

      <div className={styles.card}>

        {error ? <div className={styles.errorMessage}>{error}</div> : null}

        <section className={styles.summaryGrid}>
          <article className={styles.summaryBlock}>
            <h2>Prompt summary</h2>
            <p>
              {summaryCopy
                ? summaryCopy
                : isLoading
                  ? "Interpreting your prompt..."
                  : error
                    ? "Prompt research is unavailable right now."
                    : "A summary will appear here once generated."}
            </p>
          </article>

          <article className={styles.summaryBlock}>
            <h2>Research highlights</h2>
            <p>
              {highlightsCopy
                ? highlightsCopy
                : isLoading
                  ? "Collecting insights..."
                  : error
                    ? "Highlights are unavailable right now."
                    : "Highlights will appear here once generated."}
            </p>
          </article>
        </section>

        <section className={styles.questionsSection}>
          <div className={styles.questionsHeader}>
            <h2>Survey Questions</h2>
            <p>
              Grounded in your prompt{prompt ? `: “${prompt}”` : ""}.
            </p>
          </div>

          {areQuestionsLoading && !questionsError ? (
            <div className={styles.status}>Drafting market positioning questions…</div>
          ) : null}

          {questionsError ? <div className={styles.errorMessage}>{questionsError}</div> : null}

          {questions && questions.length ? (
            <ol className={styles.questionsList}>
              {questions.map((question, index) => (
                <li key={index}>
                  <input
                    value={question}
                    onChange={(event) => handleQuestionChange(index, event)}
                    className={styles.questionInput}
                    aria-label={`Survey question ${index + 1}`}
                  />
                </li>
              ))}
            </ol>
          ) : !areQuestionsLoading && !questionsError ? (
            <div className={styles.status}>
              Survey questions will appear here once generated.
            </div>
          ) : null}
        </section>

        <div className={styles.actionsRow}>
          <button
            type="button"
            className={styles.launchButton}
            onClick={handleLaunchAgent}
            disabled={!canLaunchAgent}
          >
            Preview AI Agent
          </button>

          <Link
            className={styles.populationLink}
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

      </div>
    </div>
  );
}
