import Head from "next/head";
import Link from "next/link";
import styles from "@/styles/Placeholder.module.css";

export default function AgentPage() {
  return (
    <>
      <Head>
        <title>Agent Setup | SurvAgent</title>
        <meta
          name="description"
          content="Configure the ElevenLabs agent using the details collected on your intake."
        />
      </Head>
      <main className={styles.container}>
        <div className={styles.hero}>
          <span className={styles.badge}>Coming soon</span>
          <h1 className={styles.title}>ElevenLabs agent integration</h1>
          <p className={styles.subtitle}>
            We&apos;ll soon guide you through connecting your intake context, dynamic variables, and
            voice preferences to an ElevenLabs agent so SurvAgent can run live interviews.
          </p>
        </div>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>What to expect</h2>
          <p className={styles.cardBody}>
            This setup flow will provision an agent, map the variables you captured on the intake
            form, and collect any additional prompts or guardrails required by your research team.
            Once ready, you&apos;ll be able to launch the agent directly from your research brief.
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
