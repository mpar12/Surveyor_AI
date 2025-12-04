import Head from "next/head";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/router";
import styles from "@/styles/Home.module.css";

interface FormData {
  name: string;
  prompt: string;
  [key: string]: string;
}

const INITIAL_DATA: FormData = {
  name: "",
  prompt: ""
};

export default function HomePage() {
  const router = useRouter();
  const [form, setForm] = useState<FormData>(INITIAL_DATA);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const REQUIRED_FIELDS: Array<keyof FormData> = useMemo(
    () => [
      "name",
      "prompt"
    ],
    []
  );

  const isFormComplete = useMemo(
    () =>
      REQUIRED_FIELDS.every((field) => {
        const value = form[field];
        return typeof value === "string" && value.trim().length > 0;
      }),
    [form, REQUIRED_FIELDS]
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isFormComplete || isSubmitting) {
      return;
    }

    try {
      setSubmitError(null);
      setIsSubmitting(true);

      const response = await fetch("/api/sessions", { method: "POST" });

      if (!response.ok) {
        throw new Error("Unable to create session. Please try again.");
      }

      const payload: { sessionId?: string; pin?: string } = await response.json();

      if (!payload.sessionId || !payload.pin) {
        throw new Error("Session response was incomplete. Please try again.");
      }

      const sanitizedPrompt = form.prompt.trim();

      const contextPayload: Record<string, unknown> = {
        sessionId: payload.sessionId,
        requester: form.name.trim(),
        prompt: sanitizedPrompt,
        surveyQuestions: null
      };

      await fetch("/api/sessions/context", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(contextPayload)
      }).catch((contextError) => {
        console.error("Failed to persist session context", contextError);
      });

      const query: Record<string, string> = {
        name: form.name,
        prompt: sanitizedPrompt,
        sid: payload.sessionId,
        pin: payload.pin
      };

      router.push({
        pathname: "/brief",
        query
      });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Something went wrong. Please retry.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.shell}>
      <Head>
        <title>SurvAgent Intake</title>
        <meta name="description" content="Kick off your AI-powered survey with SurvAgent." />
      </Head>

      <main className={styles.appShell}>
        <section className={styles.hero}>
          <span className={styles.badge}>Surveyor Beta</span>
          <h1 className={styles.heroTitle}>AI Interviews to understand your customers at scale (fast)</h1>
          <p className={styles.heroSubtitle}>
            Generate research briefs, scripted surveys, and voice agents in seconds. Launch interviews instantly and
            revisit transcripts, insights, and key takeaways in one place.
          </p>
          <div className={styles.heroChips}>
            <div className={styles.chip}>Enterprise-ready</div>
            <div className={styles.chip}>10-question templates</div>
            <div className={styles.chip}>PIN-protected scorecards</div>
          </div>
        </section>

        <form className={styles.formCard} onSubmit={handleSubmit} noValidate>
          <div className={styles.formHeadings}>
            <h2>Spin up a research session</h2>
            <p>Tell us who you are and what you want to learn. We&apos;ll draft everything else.</p>
          </div>

          {submitError ? <div className={styles.errorBanner}>{submitError}</div> : null}

          <label className={styles.fieldGroup}>
            <span className={styles.inputLabel}>
              Your name <span className={styles.requiredTag}>Required</span>
            </span>
            <input
              id="name"
              name="name"
              className={styles.input}
              placeholder="Ada Lovelace"
              value={form.name}
              onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))}
              required
            />
          </label>

          <label className={styles.fieldGroup}>
            <span className={styles.inputLabel}>
              What would you like to learn today? <span className={styles.requiredTag}>Required</span>
            </span>
            <textarea
              id="prompt"
              name="prompt"
              className={styles.textarea}
              placeholder='Example: "Understand why enterprise design leaders churn from our research suite."'
              value={form.prompt}
              onChange={(event) => setForm((previous) => ({ ...previous, prompt: event.target.value }))}
              rows={6}
              required
            />
          </label>

          <button className={styles.submitButton} type="submit" disabled={!isFormComplete || isSubmitting}>
            {isSubmitting ? "Creating session…" : "Create session"}
          </button>
        </form>
      </main>
    </div>
  );
}
