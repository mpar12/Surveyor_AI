import Head from "next/head";
import Script from "next/script";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import styles from "@/styles/Assistant.module.css";
import { SURVEY_QUESTIONS_STORAGE_KEY } from "@/lib/storageKeys";

export default function AssistantPage() {
  const router = useRouter();
  const [surveyQuestions, setSurveyQuestions] = useState<string[]>([]);

  const getQueryValue = (value: string | string[] | undefined) => {
    if (Array.isArray(value)) {
      return value[0] ?? "";
    }
    return value ?? "";
  };

  useEffect(() => {
    if (!router.isReady || typeof window === "undefined") {
      return;
    }

    const trimQuestions = (input: unknown): string[] | null => {
      if (!Array.isArray(input)) {
        return null;
      }

      const sanitized = input
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter((item): item is string => Boolean(item));

      return sanitized.length ? sanitized : null;
    };

    const decodeFromParam = (encoded: string): string[] | null => {
      try {
        const decoded = window.atob(encoded);
        const normalized = decodeURIComponent(escape(decoded));
        const parsed = JSON.parse(normalized);
        return trimQuestions(parsed);
      } catch (error) {
        console.error("Failed to decode survey questions from query", error);
        return null;
      }
    };

    const encodedParam = getQueryValue(router.query.surveyQuestions);

    if (encodedParam) {
      const decoded = decodeFromParam(encodedParam);
      if (decoded) {
        setSurveyQuestions(decoded);
        try {
          window.sessionStorage.setItem(SURVEY_QUESTIONS_STORAGE_KEY, JSON.stringify(decoded));
        } catch (storageError) {
          console.error("Failed to persist decoded survey questions", storageError);
        }
        return;
      }
    }

    try {
      const stored = window.sessionStorage.getItem(SURVEY_QUESTIONS_STORAGE_KEY);
      if (!stored) {
        return;
      }

      const parsed = JSON.parse(stored);
      const sanitized = trimQuestions(parsed);
      if (sanitized) {
        setSurveyQuestions(sanitized);
      }
    } catch (error) {
      console.error("Failed to read stored survey questions", error);
    }
  }, [router.isReady, router.query.surveyQuestions]);

  const dynamicVariables = useMemo(() => {
    const name = getQueryValue(router.query.name);
    const company = getQueryValue(router.query.company);
    const product = getQueryValue(router.query.product);
    const feedbackDesired = getQueryValue(router.query.feedbackDesired);
    const keyQuestions = getQueryValue(router.query.keyQuestions);
    const sessionId = getQueryValue(router.query.sid);
    const pin = getQueryValue(router.query.pin);
    const participantEmail =
      getQueryValue(router.query.email) || getQueryValue(router.query.email_address);

    const variables: Record<string, string> = {};

    if (name) {
      variables.user_name = name;
    }
    if (company) {
      variables.company_name = company;
    }
    if (product) {
      variables.product_name = product;
    }
    if (feedbackDesired) {
      variables.key_feedback_desired = feedbackDesired;
    }
    if (sessionId) {
      variables.session_id = sessionId;
    }
    if (pin) {
      variables.PIN = pin;
    }
    if (participantEmail) {
      variables.email_address = participantEmail;
    }
    if (surveyQuestions.length) {
      const enumerated = surveyQuestions
        .map((question, index) => `${index + 1}. ${question}`)
        .join("\n");
      variables.List_of_Questions = enumerated;
    } else if (keyQuestions) {
      variables.List_of_Questions = keyQuestions;
    }

    return variables;
  }, [
    router.query.name,
    router.query.company,
    router.query.product,
    router.query.feedbackDesired,
    router.query.keyQuestions,
    router.query.sid,
    router.query.pin,
    router.query.email,
    router.query.email_address,
    surveyQuestions
  ]);

  useEffect(() => {
    const widget = document.querySelector("elevenlabs-convai");

    if (!widget) {
      return;
    }

    const handleCallStart = () => {
      console.log("Call started: session created after mic consent");
    };

    const handleCallEnd = () => {
      console.log("Call ended or mic denied, no active session");
    };

    widget.addEventListener("elevenlabs-convai:call", handleCallStart);
    widget.addEventListener("elevenlabs-convai:call-end", handleCallEnd);

    return () => {
      widget.removeEventListener("elevenlabs-convai:call", handleCallStart);
      widget.removeEventListener("elevenlabs-convai:call-end", handleCallEnd);
    };
  }, []);

  const agentId = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID;

  return (
    <>
      <Head>
        <title>Assistant | SurvAgent</title>
        <meta
          name="description"
          content="Interact with the SurvAgent ElevenLabs assistant via a focused audio-first experience."
        />
      </Head>

      <main className={styles.container}>
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>Welcome to your AI Agent interview</h1>
          <p className={styles.heroBody}>
            Please click the call button to get started. Our agent will be happy to answer any questions
            you have and guide you through the interview.
          </p>
        </section>

        <section className={styles.widgetColumn}>
          {agentId ? (
            <>
              <elevenlabs-convai
                agent-id={agentId}
                variant="expanded"
                action-text=""
                start-call-text="Start"
                end-call-text="End"
                listening-text="Listening…"
                speaking-text="Speaking…"
                dynamic-variables={JSON.stringify(dynamicVariables)}
              />
              <Script
                src="https://unpkg.com/@elevenlabs/convai-widget-embed"
                strategy="afterInteractive"
                async
              />
            </>
          ) : (
            <div>
              <h2 style={{ fontSize: "1.4rem", fontWeight: 600, marginBottom: "0.75rem" }}>
                Configuration required
              </h2>
              <p style={{ color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
                Set the `NEXT_PUBLIC_ELEVENLABS_AGENT_ID` environment variable to enable the ElevenLabs
                assistant.
              </p>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
