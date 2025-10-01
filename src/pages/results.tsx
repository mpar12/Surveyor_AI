import Head from "next/head";
import Link from "next/link";
import styles from "@/styles/Placeholder.module.css";

export default function ResultsPage() {
  return (
    <>
      <Head>
        <title>Survey Results | SurvAgent</title>
        <meta
          name="description"
          content="Review SurvAgent findings once outreach completes and transcripts are processed."
        />
      </Head>
      <main className={styles.container}>
        <div className={styles.hero}>
          <span className={styles.badge}>Work in progress</span>
          <h1 className={styles.title}>Results dashboard</h1>
          <p className={styles.subtitle}>
            When interviews are complete you&apos;ll see aggregated insights, callouts, and follow-up
            recommendations tailored to your research brief right here.
          </p>
        </div>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Coming to this view</h2>
          <p className={styles.cardBody}>
            We&apos;re building a responsive dashboard that pairs transcript summaries with question-level
            analytics, so you can spot emerging themes and export data for stakeholders in one place.
          </p>
        </section>

        <div className={styles.actions}>
          <Link href="/" className={styles.link}>
            ← Back to intake
          </Link>
        </div>
      </main>
    </>
  );
}
