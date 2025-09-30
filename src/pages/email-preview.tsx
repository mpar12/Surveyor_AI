import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import styles from "@/styles/EmailPreview.module.css";
import {
  EMAIL_PREVIEW_LAST_SEND_KEY,
  EMAIL_PREVIEW_RECIPIENTS_KEY,
  SURVEY_QUESTIONS_STORAGE_KEY
} from "@/lib/storageKeys";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const buildEmailHtml = (body: string, agentLink: string) => {
  const safeBody = body.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = safeBody.split("\n").join("<br />");

  if (!agentLink) {
    return `<div>${lines}</div>`;
  }

  const safeLink = agentLink.replace(/"/g, "&quot;");
  const buttonHtml = `<div style=\"margin-top:16px;\"><a href=\"${safeLink}\" target=\"_blank\" rel=\"noopener noreferrer\" style=\"display:inline-block;padding:12px 20px;border-radius:10px;background:#2563eb;color:#ffffff;font-weight:600;text-decoration:none;\">Open Survey</a></div>`;

  if (safeBody.includes(agentLink)) {
    const replaced = safeBody
      .split(agentLink)
      .join(`<a href=\"${safeLink}\" target=\"_blank\" rel=\"noopener noreferrer\" style=\"color:#2563eb;font-weight:600;\">${agentLink}</a>`);
    return `<div>${replaced.replace(/\n/g, "<br />")}${buttonHtml}</div>`;
  }

  return `<div>${lines}${buttonHtml}</div>`;
};

const getQueryValue = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
};

const SENDER_EMAIL = process.env.NEXT_PUBLIC_EMAIL_FROM ?? "parikh.data.bros@gmail.com";
const SENDER_NAME = process.env.NEXT_PUBLIC_EMAIL_FROM_NAME ?? "SurvAgent";

export default function EmailPreviewPage() {
  const router = useRouter();

  const context = useMemo(() => {
    return {
      name: getQueryValue(router.query.name),
      company: getQueryValue(router.query.company),
      product: getQueryValue(router.query.product),
      feedbackDesired: getQueryValue(router.query.feedbackDesired),
      desiredIcp: getQueryValue(router.query.desiredIcp),
      desiredIcpIndustry: getQueryValue(router.query.desiredIcpIndustry),
      desiredIcpRegion: getQueryValue(router.query.desiredIcpRegion),
      sid: getQueryValue(router.query.sid),
      pin: getQueryValue(router.query.pin)
    };
  }, [
    router.query.name,
    router.query.company,
    router.query.product,
    router.query.feedbackDesired,
    router.query.desiredIcp,
    router.query.desiredIcpIndustry,
    router.query.desiredIcpRegion,
    router.query.sid,
    router.query.pin
  ]);

  const [recipients, setRecipients] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [agentLink, setAgentLink] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!router.isReady) {
      return;
    }

    let initialRecipients: string[] = [];
    const emailsParam = router.query.emails;

    if (typeof emailsParam === "string" && emailsParam.trim()) {
      initialRecipients = emailsParam
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => EMAIL_REGEX.test(entry));
    } else if (Array.isArray(emailsParam)) {
      initialRecipients = emailsParam.filter((entry) => EMAIL_REGEX.test(entry));
    } else if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem(EMAIL_PREVIEW_RECIPIENTS_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as string[];
          if (Array.isArray(parsed)) {
            initialRecipients = parsed.filter((entry) => EMAIL_REGEX.test(entry));
          }
        } catch (storedError) {
          console.error("Failed to parse stored recipients", storedError);
        }
      }
    }

    const unique = Array.from(new Set(initialRecipients));
    setRecipients(unique);
  }, [router.isReady, router.query.emails]);

  useEffect(() => {
    if (!router.isReady) {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams();
    const setParam = (key: string, value: string | undefined) => {
      if (value && value.trim()) {
        params.set(key, value.trim());
      }
    };

    setParam("name", context.name);
    setParam("company", context.company);
    setParam("product", context.product);
    setParam("feedbackDesired", context.feedbackDesired);
    setParam("desiredIcp", context.desiredIcp);
    setParam("desiredIcpIndustry", context.desiredIcpIndustry);
    setParam("desiredIcpRegion", context.desiredIcpRegion);
    setParam("sid", context.sid);
    setParam("pin", context.pin);

    const encodedSurveyQuestions = (() => {
      const raw = getQueryValue(router.query.surveyQuestions);
      if (raw && raw.trim()) {
        return raw.trim();
      }

      if (typeof window !== "undefined") {
        const stored = sessionStorage.getItem(SURVEY_QUESTIONS_STORAGE_KEY);
        if (stored) {
          try {
            const parsed = JSON.parse(stored) as unknown;
            if (Array.isArray(parsed) && parsed.length) {
              const payload = JSON.stringify(parsed);
              return window.btoa(unescape(encodeURIComponent(payload)));
            }
          } catch (storageError) {
            console.error("Failed to encode stored survey questions for assistant link", storageError);
          }
        }
      }

      return "";
    })();

    if (encodedSurveyQuestions) {
      params.set("surveyQuestions", encodedSurveyQuestions);
    }

    const query = params.toString();
    const origin = window.location.origin;
    const link = `${origin}/assistant${query ? `?${query}` : ""}`;
    setAgentLink(link);
  }, [router.isReady, context, router.query.surveyQuestions]);

  useEffect(() => {
    setSubject((prev) => {
      if (prev) return prev;
      return context.product ? `${context.product} Survey` : "Survey Invitation";
    });

    setBody((prev) => {
      if (prev) return prev;
      const requester = context.name || "our team";
      const company = context.company || "our organization";
      return `Hello! We are reaching out to you on behalf of ${requester} at ${company}.\n\nPlease chat with our AI agent by clicking the button below.\n\nThank you!`;
    });
  }, [context]);

  const handleSubjectChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSubject(event.target.value);
  };

  const handleBodyChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setBody(event.target.value);
  };

  const handleSend = async () => {
    if (!recipients.length) {
      setError("Add at least one recipient before sending.");
      setSuccess(null);
      return;
    }

    const invalidEmail = recipients.find((email) => !EMAIL_REGEX.test(email));
    if (invalidEmail) {
      setError(`"${invalidEmail}" is not a valid email address.`);
      setSuccess(null);
      return;
    }

    if (!subject.trim()) {
      setError("Subject is required.");
      setSuccess(null);
      return;
    }

    if (!body.trim()) {
      setError("Email body cannot be empty.");
      setSuccess(null);
      return;
    }

    setIsSending(true);
    setError(null);
    setSuccess(null);

    try {
      const htmlBody = buildEmailHtml(body, agentLink);

      const response = await fetch("/api/email/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId: context.sid || null,
          recipients,
          subject: subject.trim(),
          body,
          agentLink,
          htmlBody
        })
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = typeof payload?.error === "string" ? payload.error : "Failed to send email.";
        setError(message);
        setSuccess(null);
        return;
      }

      if (typeof window !== "undefined") {
        sessionStorage.removeItem(EMAIL_PREVIEW_RECIPIENTS_KEY);
      }

      if (typeof window !== "undefined") {
        sessionStorage.setItem(
          EMAIL_PREVIEW_LAST_SEND_KEY,
          JSON.stringify({
            recipients,
            subject: subject.trim(),
            sentAt: Date.now(),
            sessionId: context.sid ?? null,
            pin: context.pin ?? null
          })
        );
      }

      router.push({ pathname: "/email-success", query: { sid: context.sid ?? "", pin: context.pin ?? "" } });
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Failed to send email.");
      setSuccess(null);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>Email Preview | SurvAgent</title>
        <meta name="description" content="Review and send the survey invitation email." />
      </Head>

      <div className={styles.card}>
        <header className={styles.header}>
          <h1>Send survey invitation</h1>
          <p>Review the message below and confirm before sending your AI agent to the selected recipients.</p>
        </header>

        <section className={styles.section}>
          <div>
            <div className={styles.label}>From</div>
            <div className={styles.readonlyInput}>{`${SENDER_NAME} <${SENDER_EMAIL}>`}</div>
          </div>

          <div>
            <div className={styles.label}>Bcc</div>
            <div className={styles.recipientsBox}>
              {recipients.length ? (
                recipients.map((recipient) => (
                  <span key={recipient} className={styles.recipientChip}>
                    {recipient}
                  </span>
                ))
              ) : (
                <span className={styles.helperText}>No recipients selected yet.</span>
              )}
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <label className={styles.label} htmlFor="email-subject">
            Subject
          </label>
          <input
            id="email-subject"
            className={styles.input}
            value={subject}
            onChange={handleSubjectChange}
            placeholder="Product Survey"
          />
        </section>

        <section className={styles.section}>
          <label className={styles.label} htmlFor="email-body">
            Message
          </label>
          <textarea
            id="email-body"
            className={styles.textarea}
            value={body}
            onChange={handleBodyChange}
          />
          <p className={styles.helperText}>The survey button below is automatically included in the final email.</p>
        </section>

        <section className={styles.section}>
          <div className={styles.label}>Preview</div>
          <div
            className={styles.previewBox}
            dangerouslySetInnerHTML={{ __html: buildEmailHtml(body, agentLink) }}
          />
        </section>

        {error ? <div className={styles.statusError}>{error}</div> : null}
        {success ? <div className={styles.statusSuccess}>{success}</div> : null}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={handleSend}
            disabled={isSending || !recipients.length}
          >
            {isSending ? "Sending…" : "Send email"}
          </button>

          <Link className={styles.secondaryLink} href={{ pathname: "/population", query: { sid: context.sid ?? "", pin: context.pin ?? "" } }}>
            Back to population
          </Link>
        </div>
      </div>
    </div>
  );
}
