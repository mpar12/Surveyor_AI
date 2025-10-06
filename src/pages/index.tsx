import Head from "next/head";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/router";
import styles from "@/styles/Home.module.css";

interface FormData {
  name: string;
  company: string;
  product: string;
  feedbackDesired: string;
  keyQuestions: string;
  desiredIcp: string;
  desiredIcpIndustry: string;
  desiredIcpRegion: string;
  [key: string]: string;
}

const INITIAL_DATA: FormData = {
  name: "Elon Musk",
  company: "X.ai",
  product: "Grok",
  feedbackDesired: "Understand how early adopters perceive our value proposition",
  keyQuestions: "What triggers evaluation? What convinces a switch?",
  desiredIcp: "Product Manager",
  desiredIcpIndustry: "Information & Technology Services",
  desiredIcpRegion: "USA"
};

export default function HomePage() {
  const router = useRouter();
  const [form, setForm] = useState<FormData>(INITIAL_DATA);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const REQUIRED_FIELDS: Array<keyof FormData> = useMemo(
    () => [
      "name",
      "company",
      "product",
      "feedbackDesired",
      "desiredIcp",
      "desiredIcpIndustry",
      "desiredIcpRegion"
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

      const sanitizedKeyQuestions = form.keyQuestions.trim();

      const contextPayload: Record<string, unknown> = {
        sessionId: payload.sessionId,
        requester: form.name,
        company: form.company,
        product: form.product,
        feedbackDesired: form.feedbackDesired,
        desiredIcp: form.desiredIcp,
        desiredIcpIndustry: form.desiredIcpIndustry,
        desiredIcpRegion: form.desiredIcpRegion,
        surveyQuestions: []
      };

      if (sanitizedKeyQuestions) {
        contextPayload.keyQuestions = sanitizedKeyQuestions;
      }

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
        company: form.company,
        product: form.product,
        feedbackDesired: form.feedbackDesired,
        desiredIcp: form.desiredIcp,
        desiredIcpIndustry: form.desiredIcpIndustry,
        desiredIcpRegion: form.desiredIcpRegion,
        sid: payload.sessionId,
        pin: payload.pin
      };

      if (sanitizedKeyQuestions) {
        query.keyQuestions = sanitizedKeyQuestions;
      }

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

      <h1 className={styles.title}>Be Customer Obsessed: Listen to your customers every step along the way. 1000 at a time.</h1>
      <h3 className={styles.title}>Introducing SurvAgent: AI Interviews to understand your customers at scale.</h3>

      <main className={styles.panel}>
        <form className={styles.formCard} onSubmit={handleSubmit} noValidate>
          <div className={styles.formHeader}>
            <h2>Tell us about you:</h2>
          </div>

          {submitError ? (
            <div className={styles.errorBanner}>{submitError}</div>
          ) : null}

          <div className={styles.sectionHeader}>
            <h3>Section I: Who are you?</h3>
          </div>

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
              <label htmlFor="company">Company Name</label>
              <span className={styles.requiredTag}>Required *</span>
            </div>
            <input
              id="company"
              name="company"
              className={styles.input}
              placeholder="X.ai"
              value={form.company}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, company: event.target.value }))
              }
              required
            />
          </div>

          <div className={styles.fieldGroup}>
            <div className={styles.labelRow}>
              <label htmlFor="product">Product</label>
              <span className={styles.requiredTag}>Required *</span>
            </div>
            <input
              id="product"
              name="product"
              className={styles.input}
              placeholder="Grok"
              value={form.product}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, product: event.target.value }))
              }
              required
            />
          </div>

          <div className={styles.sectionHeader}>
            <h3>Section II: What are you trying to understand?</h3>
          </div>

          <div className={styles.fieldGroup}>
            <div className={styles.labelRow}>
              <label htmlFor="feedbackDesired">Feedback Desired</label>
              <span className={styles.requiredTag}>Required *</span>
            </div>
            <input
              id="feedbackDesired"
              name="feedbackDesired"
              className={styles.input}
              placeholder="Understand how early adopters perceive our value proposition"
              value={form.feedbackDesired}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, feedbackDesired: event.target.value }))
              }
              required
            />
          </div>

          <div className={styles.fieldGroup}>
            <div className={styles.labelRow}>
              <label htmlFor="keyQuestions">Key Questions</label>
              <span className={styles.optionalTag}>Optional</span>
            </div>
            <input
              id="keyQuestions"
              name="keyQuestions"
              className={styles.input}
              placeholder="What triggers evaluation? What convinces a switch?"
              value={form.keyQuestions}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, keyQuestions: event.target.value }))
              }
            />
          </div>

          <div className={styles.sectionHeader}>
            <h3>Section III: Who is your desired ICP?</h3>
          </div>

          <div className={styles.fieldGroup}>
            <div className={styles.labelRow}>
              <label htmlFor="desiredIcp">Desired ICP</label>
              <span className={styles.requiredTag}>Required *</span>
            </div>
            <input
              id="desiredIcp"
              name="desiredIcp"
              className={styles.input}
              placeholder="Product Manager"
              value={form.desiredIcp}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, desiredIcp: event.target.value }))
              }
              required
            />
          </div>

          <div className={styles.fieldGroup}>
            <div className={styles.labelRow}>
              <label htmlFor="desiredIcpIndustry">Desired ICP Industry</label>
              <span className={styles.requiredTag}>Required *</span>
            </div>
            <input
              id="desiredIcpIndustry"
              name="desiredIcpIndustry"
              className={styles.input}
              placeholder="Information & Technology Services"
              value={form.desiredIcpIndustry}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, desiredIcpIndustry: event.target.value }))
              }
              required
            />
          </div>

          <div className={styles.fieldGroup}>
            <div className={styles.labelRow}>
              <label htmlFor="desiredIcpRegion">Desired ICP Region</label>
              <span className={styles.requiredTag}>Required *</span>
            </div>
            <input
              id="desiredIcpRegion"
              name="desiredIcpRegion"
              className={styles.input}
              placeholder="USA"
              value={form.desiredIcpRegion}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, desiredIcpRegion: event.target.value }))
              }
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
