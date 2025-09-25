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
}

const INITIAL_DATA: FormData = {
  name: "",
  company: "",
  product: "",
  feedbackDesired: "",
  keyQuestions: "",
  desiredIcp: "",
  desiredIcpIndustry: ""
};

export default function HomePage() {
  const router = useRouter();
  const [form, setForm] = useState<FormData>(INITIAL_DATA);

  const isFormComplete = useMemo(
    () =>
      Object.values(form)
        .map((value) => value.trim())
        .every((value) => value.length > 0),
    [form]
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isFormComplete) {
      return;
    }

    router.push({
      pathname: "/brief",
      query: form
    });
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>SurvAgent Intake</title>
        <meta name="description" content="Kick off your AI-powered survey with SurvAgent." />
      </Head>

      <h1 className={styles.title}>SurvAgent: Your Automatic AI Researcher</h1>

      <main className={styles.panel}>
        <form className={styles.formCard} onSubmit={handleSubmit} noValidate>
          <div className={styles.formHeader}>
            <h2>Kick off your outreach survey</h2>
            <p>All fields marked as required must be completed before continuing.</p>
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
              placeholder="To inform folks on whose behalf you are reaching out on"
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
              placeholder="Apple"
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
              placeholder="iPhone 17"
              value={form.product}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, product: event.target.value }))
              }
              required
            />
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
              placeholder="What insight are you hoping to capture?"
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
              <span className={styles.requiredTag}>Required *</span>
            </div>
            <input
              id="keyQuestions"
              name="keyQuestions"
              className={styles.input}
              placeholder="List the core questions you want answered"
              value={form.keyQuestions}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, keyQuestions: event.target.value }))
              }
              required
            />
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
              placeholder="Technology"
              value={form.desiredIcpIndustry}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, desiredIcpIndustry: event.target.value }))
              }
              required
            />
          </div>

          <div className={styles.actions}>
            <button className={styles.submitButton} type="submit" disabled={!isFormComplete}>
              Continue
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
