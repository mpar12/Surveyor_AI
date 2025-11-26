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
        surveyQuestions: []
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
    <div className={styles.container}>
      <Head>
        <title>SurvAgent Intake</title>
        <meta name="description" content="Kick off your AI-powered survey with SurvAgent." />
      </Head>

      <h3 className={styles.title}> Surveyor: Your Personal AI Customer Researcher :)</h3>

      <main className={styles.panel}>
        <form className={styles.formCard} onSubmit={handleSubmit} noValidate>

          {submitError ? (
            <div className={styles.errorBanner}>{submitError}</div>
          ) : null}

          <div className={styles.fieldGroup}>
            <div className={styles.labelRow}>
              <label htmlFor="name">Your Name</label>
              <span className={styles.requiredTag}>Required *</span>
            </div>
            <input
              id="name"
              name="name"
              className={styles.input}
              placeholder="Elon Musk"
              value={form.name}
              onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))}
              required
            />
          </div>

          <div className={styles.fieldGroup}>
            <div className={styles.labelRow}>
              <label htmlFor="prompt">What would you like to learn today?</label>
              <span className={styles.requiredTag}>Required *</span>
            </div>
            <textarea
              id="prompt"
              name="prompt"
              className={styles.textarea}
              placeholder='Example: "I want to understand what middle-class UK Voters think about the Labour Governments Immigration policy."'
              value={form.prompt}
              onChange={(event) => setForm((previous) => ({ ...previous, prompt: event.target.value }))}
              rows={6}
              required
            />
          </div>

          <div className={styles.actions}>
            <button
              className={styles.submitButton}
              type="submit"
              disabled={!isFormComplete || isSubmitting}
            >
              {isSubmitting ? "Creating session…" : "Continue"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
