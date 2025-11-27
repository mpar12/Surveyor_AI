import Head from "next/head";
import { useRouter } from "next/router";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import styles from "@/styles/Population.module.css";
import { EMAIL_PREVIEW_RECIPIENTS_KEY, SURVEY_QUESTIONS_STORAGE_KEY } from "@/lib/storageKeys";
import { useSessionContext } from "@/contexts/SessionContext";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type QueryValue = string | string[] | undefined;

const getQueryValue = (value: QueryValue) => {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
};

export default function PopulationPage() {
  const router = useRouter();
  const { sessionData } = useSessionContext();
  const [emailCsv, setEmailCsv] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [hasValidEmails, setHasValidEmails] = useState(false);
  const [surveyQuestions, setSurveyQuestions] = useState<string[]>([]);
  const [agentLink, setAgentLink] = useState("");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");

  const contextSummary = useMemo(() => {
    const sidValue = getQueryValue(router.query.sid);
    const pinValue = getQueryValue(router.query.pin);

    return {
      name: sessionData?.requester || getQueryValue(router.query.name),
      prompt: sessionData?.prompt || getQueryValue(router.query.prompt),
      sid: sidValue,
      pin: pinValue,
      surveyQuestions
    };
  }, [
    sessionData,
    router.query.name,
    router.query.prompt,
    router.query.sid,
    router.query.pin,
    surveyQuestions
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const stored = sessionStorage.getItem(SURVEY_QUESTIONS_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as string[];
        if (Array.isArray(parsed)) {
          setSurveyQuestions(parsed);
        }
      } catch (error) {
        console.error("Failed to parse stored survey questions", error);
      }
    }
  }, []);

  useEffect(() => {
    if (sessionData && router.isReady && contextSummary.sid && contextSummary.pin) {
      const allowedKeys = new Set(["sid", "pin"]);
      const hasExtraParams = Object.keys(router.query).some(
        (key) => !allowedKeys.has(key) && router.query[key]
      );

      if (hasExtraParams) {
        router.replace(
          { pathname: router.pathname, query: { sid: contextSummary.sid, pin: contextSummary.pin } },
          undefined,
          { shallow: true }
        );
      }
    }
  }, [sessionData, router.isReady, contextSummary.sid, contextSummary.pin, router]);

  useEffect(() => {
    if (!router.isReady || typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams();
    const setParam = (key: string, value: string | null | undefined) => {
      if (value && value.trim()) {
        params.set(key, value.trim());
      }
    };

    setParam("name", contextSummary.name);
    setParam("prompt", contextSummary.prompt);
    setParam("sid", contextSummary.sid);
    setParam("pin", contextSummary.pin);

    const encodeSurveyQuestions = () => {
      const source = surveyQuestions.length ? surveyQuestions : null;

      if (source && source.length) {
        try {
          const payload = JSON.stringify(source);
          return window.btoa(unescape(encodeURIComponent(payload)));
        } catch (error) {
          console.error("Failed to encode survey questions for assistant link", error);
        }
      }

      return "";
    };

    const encoded = encodeSurveyQuestions();
    if (encoded) {
      params.set("surveyQuestions", encoded);
    }

    const query = params.toString();
    const origin = window.location.origin;
    const link = `${origin}/assistant${query ? `?${query}` : ""}`;
    setAgentLink(link);
  }, [
    router.isReady,
    contextSummary.name,
    contextSummary.prompt,
    contextSummary.sid,
    contextSummary.pin,
    surveyQuestions
  ]);

  const handleEmailsChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setEmailCsv(value);

    if (!value.trim()) {
      setEmailError(null);
      setHasValidEmails(false);
      return;
    }

    const entries = value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);

    if (!entries.length) {
      setEmailError("Provide at least one email address.");
      setHasValidEmails(false);
      return;
    }

    const invalidSample = entries.find((entry) => !EMAIL_REGEX.test(entry));

    if (invalidSample) {
      setEmailError(`"${invalidSample}" is not a valid email address.`);
      setHasValidEmails(false);
      return;
    }

    setEmailError(null);
    setHasValidEmails(true);
  };

  const handlePrepareEmail = () => {
    const entries = emailCsv
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => EMAIL_REGEX.test(entry));

    const unique = Array.from(new Set(entries));

    if (!unique.length) {
      setEmailError("Provide at least one valid email address.");
      setHasValidEmails(false);
      return;
    }

    if (typeof window !== "undefined") {
      sessionStorage.setItem(EMAIL_PREVIEW_RECIPIENTS_KEY, JSON.stringify(unique));
      try {
        sessionStorage.setItem(SURVEY_QUESTIONS_STORAGE_KEY, JSON.stringify(surveyQuestions));
      } catch (storageError) {
        console.error("Failed to persist survey questions for email preview", storageError);
      }
    }

    const query: Record<string, string> = {
      sid: contextSummary.sid ?? "",
      pin: contextSummary.pin ?? "",
      source: "manual"
    };

    router.push({ pathname: "/email-preview", query });
  };

  const handleCopyAgentLink = () => {
    if (!agentLink) {
      return;
    }

    if (typeof navigator === "undefined" || !navigator.clipboard) {
      setCopyStatus("error");
      setTimeout(() => setCopyStatus("idle"), 2500);
      return;
    }

    navigator.clipboard
      .writeText(agentLink)
      .then(() => {
        setCopyStatus("copied");
        setTimeout(() => setCopyStatus("idle"), 2500);
      })
      .catch(() => {
        setCopyStatus("error");
        setTimeout(() => setCopyStatus("idle"), 2500);
      });
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>Choose Participants | SurvAgent</title>
        <meta
          name="description"
          content="Decide who should receive your SurvAgent invitation."
        />
      </Head>

      <div className={styles.lead}>
        <h1 className={styles.pageTitle}>Choose Interview Participants</h1>
        <p className={styles.pageSubtitle}>
          Share a list of recipients and we&apos;ll help you send the AI survey invitation.
        </p>
      </div>

      <div className={styles.card}>
        <section className={`${styles.section} ${styles.contextPanel}`}>
          <h2>Prompt recap</h2>
          <dl>
            <div>
              <dt>Requester</dt>
              <dd>{contextSummary.name || "—"}</dd>
            </div>
            <div>
              <dt>Prompt</dt>
              <dd>{contextSummary.prompt || "—"}</dd>
            </div>
          </dl>
          <div className={styles.copyRow}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={handleCopyAgentLink}
              disabled={!agentLink}
            >
              {agentLink ? "Copy assistant link" : "Preparing link…"}
            </button>
            <span
              className={`${styles.copyStatus} ${
                copyStatus === "copied"
                  ? styles.copyStatusSuccess
                  : copyStatus === "error"
                    ? styles.copyStatusError
                    : ""
              }`}
            >
              {copyStatus === "copied"
                ? "Copied!"
                : copyStatus === "error"
                  ? "Unable to copy."
                  : "Share the ElevenLabs agent directly."}
            </span>
          </div>
        </section>

        <section className={`${styles.section} ${styles.optionsSection}`}>
          <h2>Paste your participant list</h2>
          <p className={styles.helperText}>
            Separate addresses with commas. We&apos;ll BCC everyone on your invitation.
          </p>
          <div className={styles.manualInput}>
            <textarea
              value={emailCsv}
              onChange={handleEmailsChange}
              maxLength={1000}
              placeholder="alice@example.com, bob@example.org, ..."
              aria-label="Comma separated email addresses"
            />
            <div className={styles.helperRow}>
              <span>{emailCsv.length}/1000</span>
              {emailError ? <span className={styles.error}>{emailError}</span> : null}
            </div>
          </div>
        </section>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={handlePrepareEmail}
            disabled={!hasValidEmails}
          >
            Draft Email
          </button>
        </div>
      </div>
    </div>
  );
}
