import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import styles from "@/styles/EmailPreview.module.css";
import { EMAIL_PREVIEW_LAST_SEND_KEY } from "@/lib/storageKeys";

interface LastSend {
  recipients: string[];
  subject: string;
  sentAt: number;
  sessionId: string | null;
  pin: string | null;
}

export default function EmailSuccessPage() {
  const router = useRouter();
  const [lastSend, setLastSend] = useState<LastSend | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const raw = sessionStorage.getItem(EMAIL_PREVIEW_LAST_SEND_KEY);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as LastSend;
      if (parsed && Array.isArray(parsed.recipients)) {
        setLastSend(parsed);
      }
      sessionStorage.removeItem(EMAIL_PREVIEW_LAST_SEND_KEY);
    } catch (error) {
      console.error("Failed to read last send payload", error);
    }
  }, []);

  const subjectLine = lastSend?.subject ?? "Survey Invitation";
  const recipients = lastSend?.recipients ?? [];
  const sentAtLabel = lastSend?.sentAt ? new Date(lastSend.sentAt).toLocaleString() : "";
  const sessionId = lastSend?.sessionId ?? (typeof router.query.sid === "string" ? router.query.sid : null);
  const pin = lastSend?.pin ?? (typeof router.query.pin === "string" ? router.query.pin : null);

  return (
    <div className={styles.container}>
      <Head>
        <title>Email Sent | SurvAgent</title>
        <meta name="description" content="Confirm the survey invitation email was delivered." />
      </Head>

      <div className={styles.card}>
        <header className={styles.header}>
          <h1>Email sent</h1>
          <p>Your survey invitation has been dispatched to the recipients listed below.</p>
        </header>

        {recipients.length ? (
          <section className={styles.section}>
            <div className={styles.label}>Subject</div>
            <div className={styles.readonlyInput}>{subjectLine}</div>

            <div className={styles.label}>Recipients ({recipients.length})</div>
            <div className={styles.recipientsBox}>
              {recipients.map((recipient) => (
                <span key={recipient} className={styles.recipientChip}>
                  {recipient}
                </span>
              ))}
            </div>

            {sentAtLabel ? (
              <div className={styles.helperText}>Sent at {sentAtLabel}</div>
            ) : null}
          </section>
        ) : (
          <div className={styles.statusError}>No send details were found for this session.</div>
        )}

        <div className={styles.actions}>
          <Link
            className={styles.secondaryLink}
            href={{ pathname: "/population", query: { sid: sessionId ?? "", pin: pin ?? "" } }}
          >
            Back to population
          </Link>

          {sessionId ? (
            <Link
              className={styles.secondaryLink}
              href={{ pathname: "/scorecard", query: { sid: sessionId, pin: pin ?? "" } }}
            >
              View results
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
