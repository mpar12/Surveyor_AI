import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import styles from "@/styles/Brief.module.css";
import { SURVEY_QUESTIONS_STORAGE_KEY } from "@/lib/storageKeys";
import { useSessionContext } from "@/contexts/SessionContext";

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
  const [questionParagraph, setQuestionParagraph] = useState<string | null>(null);
  const [questionParagraphError, setQuestionParagraphError] = useState<string | null>(null);
  const [questionDebugInfo, setQuestionDebugInfo] = useState<string | null>(null);
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

  const handleQuestionParagraphChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      setQuestionParagraph(event.target.value);
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

        <section className={styles.questionsSection}>
          <div className={styles.questionsHeader}>
            <h2>Survey Questions</h2>
            <p>
              Grounded in your prompt{prompt ? `: “${prompt}”` : ""}.
            </p>
          </div>

          {areQuestionsLoading && !questionParagraphError ? (
            <div className={styles.status}>Drafting market positioning questions…</div>
          ) : null}

          {questionParagraphError ? (
            <div className={styles.errorMessage}>{questionParagraphError}</div>
          ) : null}
          {questionDebugInfo ? (
            <pre className={styles.debugMessage}>
              <strong>Detailed error (testing only):</strong>
              {"\n"}
              {questionDebugInfo}
            </pre>
          ) : null}

          {questionParagraph ? (
            <textarea
              className={styles.questionTextarea}
              value={questionParagraph}
              onChange={handleQuestionParagraphChange}
              rows={8}
            />
          ) : !areQuestionsLoading && !questionParagraphError ? (
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
