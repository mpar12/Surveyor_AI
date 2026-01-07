import Head from "next/head";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";
import styles from "@/styles/Population.module.css";

type QueryValue = string | string[] | undefined;

const getQueryValue = (value: QueryValue) => {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
};

export default function ProlificSetupPage() {
  const router = useRouter();
  const [completionUrl, setCompletionUrl] = useState("");
  const [generatedLink, setGeneratedLink] = useState("");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");

  const contextSummary = useMemo(() => {
    const sidValue = getQueryValue(router.query.sid);
    const pinValue = getQueryValue(router.query.pin);

    return {
      sid: sidValue,
      pin: pinValue
    };
  }, [
    router.query.sid,
    router.query.pin
  ]);

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

    if (completionUrl.trim()) {
      params.set("completionUrl", completionUrl.trim());
    }

    const origin = window.location.origin;
    const baseQuery = params.toString();
    const prolificParams = [
      "PROLIFIC_PID={{%PROLIFIC_PID%}}",
      "STUDY_ID={{%STUDY_ID%}}",
      "SESSION_ID={{%SESSION_ID%}}"
    ];
    const query = [baseQuery, ...prolificParams].filter(Boolean).join("&");
    setGeneratedLink(`${origin}/assistant?${query}`);
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
