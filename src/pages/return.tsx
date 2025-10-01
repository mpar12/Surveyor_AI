import Head from "next/head";
import { useRouter } from "next/router";
import styles from "@/styles/Return.module.css";

export default function ReturnPage() {
  const router = useRouter();
  const showError = router.query.e === "1";

  return (
    <div className={styles.container}>
      <Head>
        <title>Return to Scorecard | SurvAgent</title>
        <meta name="description" content="Access your session scorecard using a PIN." />
      </Head>

      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>Access your scorecard</h1>
          <p className={styles.description}>
            Enter the 4-digit PIN you received when you created your SurvAgent session.
          </p>
        </div>

        {showError ? <div className={styles.errorBanner}>Invalid PIN. Try again.</div> : null}

        <form method="POST" action="/api/return" className={styles.form}>
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="pin">
              Please enter your 4-digit PIN
            </label>
            <input
              id="pin"
              name="pin"
              className={styles.pinInput}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              autoComplete="one-time-code"
              required
              placeholder="0000"
            />
          </div>

          <button type="submit" className={styles.submitButton}>
            View Results
          </button>
          <p className={styles.helperText}>Only teammates with the correct PIN can view this session.</p>
        </form>
      </div>
    </div>
  );
}
