import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import styles from "@/styles/Population.module.css";
import { SURVEY_QUESTIONS_STORAGE_KEY } from "@/lib/storageKeys";
import { useSessionContext } from "@/contexts/SessionContext";
import type { InterviewScript } from "@/types/interviewScript";
import { isInterviewScript } from "@/types/interviewScript";

type QueryValue = string | string[] | undefined;

const getQueryValue = (value: QueryValue) => {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
};

export default function ProlificSetupPage() {
  const router = useRouter();
  const { sessionData } = useSessionContext();
  const [completionUrl, setCompletionUrl] = useState("");
  const [generatedLink, setGeneratedLink] = useState("");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const [surveyScript, setSurveyScript] = useState<InterviewScript | null>(null);

  const contextSummary = useMemo(() => {
    const sidValue = getQueryValue(router.query.sid);
    const pinValue = getQueryValue(router.query.pin);

    return {
      name: sessionData?.requester || getQueryValue(router.query.name),
      prompt: sessionData?.prompt || getQueryValue(router.query.prompt),
      sid: sidValue,
      pin: pinValue
    };
  }, [
    sessionData,
    router.query.name,
    router.query.prompt,
    router.query.sid,
    router.query.pin
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const stored = sessionStorage.getItem(SURVEY_QUESTIONS_STORAGE_KEY);
    if (!stored) {
      return;
    }

    try {
      const parsed = JSON.parse(stored);
      if (isInterviewScript(parsed)) {
        setSurveyScript(parsed as InterviewScript);
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  useEffect(() => {
    const payload = sessionData?.surveyQuestions;
    if (!payload) {
      return;
    }

    if (isInterviewScript(payload)) {
      const script = payload as InterviewScript;
      setSurveyScript(script);
      if (typeof window !== "undefined") {
        sessionStorage.setItem(SURVEY_QUESTIONS_STORAGE_KEY, JSON.stringify(script));
      }
    }
  }, [sessionData?.surveyQuestions]);

  const generateProlificLink = () => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams();

    // Session identifiers
    if (contextSummary.sid) {
      params.set("sid", contextSummary.sid);
    }
    if (contextSummary.pin) {
      params.set("pin", contextSummary.pin);
    }
    if (contextSummary.name) {
      params.set("name", contextSummary.name);
    }
    if (contextSummary.prompt) {
      params.set("prompt", contextSummary.prompt);
    }

    // Prolific placeholders (Prolific replaces these at runtime)
    params.set("PROLIFIC_PID", "{{%PROLIFIC_PID%}}");
    params.set("STUDY_ID", "{{%STUDY_ID%}}");
    params.set("SESSION_ID", "{{%SESSION_ID%}}");

    // Encode completion URL
    if (completionUrl.trim()) {
      params.set("completionUrl", encodeURIComponent(completionUrl.trim()));
    }

    // Include surveyQuestions if available
    if (surveyScript) {
      try {
        const payload = JSON.stringify(surveyScript);
        const encoded = window.btoa(unescape(encodeURIComponent(payload)));
        params.set("surveyQuestions", encoded);
      } catch (error) {
        console.error("Failed to encode interview script", error);
      }
    }

    const origin = window.location.origin;
    setGeneratedLink(`${origin}/assistant?${params.toString()}`);
  };

  const handleCopyLink = () => {
    if (!generatedLink) {
      return;
    }

    if (typeof navigator === "undefined" || !navigator.clipboard) {
      setCopyStatus("error");
      setTimeout(() => setCopyStatus("idle"), 2500);
      return;
    }

    navigator.clipboard
      .writeText(generatedLink)
      .then(() => {
        setCopyStatus("copied");
        setTimeout(() => setCopyStatus("idle"), 2500);
      })
      .catch(() => {
        setCopyStatus("error");
        setTimeout(() => setCopyStatus("idle"), 2500);
      });
  };

  const isValidUrl = completionUrl.trim().startsWith("https://");

  return (
    <div className={styles.container}>
      <Head>
        <title>Prolific Setup | SurvAgent</title>
        <meta
          name="description"
          content="Configure your Prolific study integration with SurvAgent."
        />
      </Head>

      <div className={styles.lead}>
        <h1 className={styles.pageTitle}>Prolific Project Setup</h1>
        <p className={styles.pageSubtitle}>
          Generate a link for your Prolific study that tracks participants and redirects them on completion.
        </p>
      </div>

      <div className={styles.card}>
        <section className={`${styles.section} ${styles.contextPanel}`}>
          <h2>Session Info</h2>
          <dl>
            <div>
              <dt>Session ID</dt>
              <dd>{contextSummary.sid || "—"}</dd>
            </div>
            <div>
              <dt>PIN</dt>
              <dd>{contextSummary.pin || "—"}</dd>
            </div>
          </dl>
        </section>

        <section className={`${styles.section} ${styles.optionsSection}`}>
          <h2>Prolific Completion URL</h2>
          <p className={styles.helperText}>
            Find this in your Prolific study settings. It looks like: https://app.prolific.com/submissions/complete?cc=XXXXXXXX
          </p>
          <div className={styles.manualInput}>
            <input
              type="url"
              value={completionUrl}
              onChange={(e) => setCompletionUrl(e.target.value)}
              placeholder="https://app.prolific.com/submissions/complete?cc=XXXXXXXX"
              aria-label="Prolific completion URL"
              style={{ width: "100%", padding: "12px", fontSize: "16px", borderRadius: "8px", border: "1px solid #ccc" }}
            />
          </div>
        </section>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={generateProlificLink}
            disabled={!isValidUrl || !contextSummary.sid || !contextSummary.pin}
          >
            Generate Prolific Link
          </button>
        </div>

        {generatedLink && (
          <section className={`${styles.section} ${styles.optionsSection}`}>
            <h2>Your Prolific Study URL</h2>
            <p className={styles.helperText}>
              Copy this link and paste it into your Prolific study&apos;s &quot;Study URL&quot; field.
            </p>
            <div className={styles.manualInput}>
              <textarea
                value={generatedLink}
                readOnly
                rows={4}
                aria-label="Generated Prolific link"
                style={{ fontFamily: "monospace", fontSize: "14px" }}
              />
            </div>
            <div className={styles.copyRow}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={handleCopyLink}
              >
                Copy Link
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
                    : ""}
              </span>
            </div>

            <div style={{ marginTop: "24px", padding: "16px", backgroundColor: "#f5f5f5", borderRadius: "8px" }}>
              <h3 style={{ margin: "0 0 12px 0", fontSize: "16px" }}>Next Steps</h3>
              <ol style={{ margin: 0, paddingLeft: "20px", lineHeight: "1.8" }}>
                <li>Go to your Prolific study settings</li>
                <li>Paste this URL in the &quot;Study URL&quot; field</li>
                <li>Make sure &quot;I&apos;ll use URL parameters&quot; is selected</li>
                <li>Participants will be automatically redirected to Prolific when they complete the interview</li>
              </ol>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
