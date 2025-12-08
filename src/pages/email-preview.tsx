import Head from "next/head";
import { useRouter } from "next/router";
import { ChangeEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";
import styles from "@/styles/EmailPreview.module.css";
import {
  EMAIL_PREVIEW_LAST_SEND_KEY,
  EMAIL_PREVIEW_RECIPIENTS_KEY,
  SURVEY_QUESTIONS_STORAGE_KEY
} from "@/lib/storageKeys";
import { useSessionContext } from "@/contexts/SessionContext";
import type { InterviewScript } from "@/types/interviewScript";
import { extractQuestionsFromScript, isInterviewScript } from "@/types/interviewScript";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const buildEmailHtml = (body: string, agentLink: string) => {
  const safeBody = body.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = safeBody.split("\n").join("<br />");

  if (!agentLink) {
    return `<div>${lines}</div>`;
  }

  const safeLink = agentLink.replace(/"/g, "&quot;");
  const buttonHtml = `<div style=\"margin-top:16px;\"><a href=\"${safeLink}\" target=\"_blank\" rel=\"noopener noreferrer\" style=\"display:inline-block;padding:12px 20px;border-radius:10px;background:#2563eb;color:#ffffff;font-weight:600;text-decoration:none;\">Get chatting!</a></div>`;

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

const SENDER_EMAIL = process.env.NEXT_PUBLIC_EMAIL_FROM ?? "mihirparikh99@gmail.com";
const SENDER_NAME = process.env.NEXT_PUBLIC_EMAIL_FROM_NAME ?? "Surveyor";

const flattenScriptToParagraph = (script: InterviewScript | null): string | null => {
  if (!script) {
    return null;
  }
  const questions = extractQuestionsFromScript(script);
  return questions.length ? questions.join("\n") : null;
};

export default function EmailPreviewPage() {
  const router = useRouter();
  const { sessionData, isLoading: sessionLoading, error: sessionError } = useSessionContext();

  const context = useMemo(() => {
    // Use session data if available, fallback to URL params for initial load
    return {
      name: sessionData?.requester || getQueryValue(router.query.name),
      prompt: sessionData?.prompt || getQueryValue(router.query.prompt),
      sid: getQueryValue(router.query.sid),
      pin: getQueryValue(router.query.pin)
    };
  }, [
    sessionData,
    router.query.name,
    router.query.prompt,
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
  const [newRecipient, setNewRecipient] = useState("");

  // Clean URL after initial load if we have session data
  useEffect(() => {
    if (sessionData && router.isReady && context.sid && context.pin) {
      // Check if URL has more than just sid and pin
      const hasExtraParams = Object.keys(router.query).some(key => 
        key !== 'sid' && key !== 'pin' && key !== 'emails' && router.query[key]
      );
      
      if (hasExtraParams) {
        // Replace URL with clean version
        router.replace({
          pathname: router.pathname,
          query: { sid: context.sid, pin: context.pin, emails: router.query.emails }
        }, undefined, { shallow: true });
      }
    }
  }, [sessionData, router.isReady, context.sid, context.pin, router]);

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
    setParam("prompt", context.prompt);
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
            const parsed = JSON.parse(stored);
            if (isInterviewScript(parsed)) {
              const payload = JSON.stringify(parsed);
              return window.btoa(unescape(encodeURIComponent(payload)));
            }
            if (typeof parsed === "string" && parsed.trim()) {
              const payload = JSON.stringify({ paragraph: parsed.trim() });
              return window.btoa(unescape(encodeURIComponent(payload)));
            }
          } catch (storageError) {
            console.error("Failed to encode stored survey script for assistant link", storageError);
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
      const promptSnippet = context.prompt ? context.prompt.slice(0, 60) : null;
      return promptSnippet ? `Can we chat about “${promptSnippet}”?` : "Survey Invitation";
    });

    setBody((prev) => {
      if (prev) return prev;
      const requester = context.name || "our team";
      const promptSummary = context.prompt || "a new research topic";
      return `Hello! ${requester} is running an AI-guided interview to learn more about:\n\n"${promptSummary}"\n\nIf you have a few minutes, click the button below to chat with our agent and share your perspective.\n\nThank you for your time!`;
    });
  }, [context]);

  const handleSubjectChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSubject(event.target.value);
  };

  const handleBodyChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setBody(event.target.value);
  };

  const handleRecipientChange = (index: number, value: string) => {
    setRecipients((previous) => {
      const next = [...previous];
      next[index] = value;
      return next;
    });
  };

  const handleRecipientBlur = (index: number) => {
    setRecipients((previous) => {
      const next = [...previous];
      next[index] = next[index].trim();
      return next;
    });
  };

  const handleRecipientRemove = (index: number) => {
    setRecipients((previous) => previous.filter((_, position) => position !== index));
  };

  const handleAddRecipient = () => {
    const candidate = newRecipient.trim();

    if (!candidate) {
      return;
    }

    if (!EMAIL_REGEX.test(candidate)) {
      setError(`"${candidate}" is not a valid email address.`);
      return;
    }

    if (recipients.some((existing) => existing.toLowerCase() === candidate.toLowerCase())) {
      setError("Recipient already added.");
      return;
    }

    setRecipients((previous) => [...previous, candidate]);
    setNewRecipient("");
    setError(null);
  };

  const handleNewRecipientKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleAddRecipient();
    }
  };

  const handleSend = async () => {
    const normalizedRecipients = Array.from(
      new Set(recipients.map((email) => email.trim()).filter(Boolean))
    );

    if (!normalizedRecipients.length) {
      setError("Add at least one recipient before sending.");
      setSuccess(null);
      return;
    }

    const invalidEmail = normalizedRecipients.find((email) => !EMAIL_REGEX.test(email));
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
          recipients: normalizedRecipients,
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
            recipients: normalizedRecipients,
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

      <div className={styles.lead}>
        <h1 className={styles.pageTitle}>Send Interview Invitation via email</h1>
        <p className={styles.pageSubtitle}>
          Review the message below and confirm to send your AI agent to the selected recipients.
        </p>
      </div>

      <div className={styles.card}>

        <section className={styles.section}>
          <div>
            <div className={styles.label}>From</div>
            <div className={styles.readonlyInput}>{`${SENDER_NAME} <${SENDER_EMAIL}>`}</div>
          </div>

          <div>
            <div className={styles.label}>Bcc</div>
            <div className={styles.recipientsEditable}>
              {recipients.length ? (
                recipients.map((recipient, index) => (
                  <div key={index} className={styles.recipientRow}>
                    <input
                      value={recipient}
                      onChange={(event) => handleRecipientChange(index, event.target.value)}
                      onBlur={() => handleRecipientBlur(index)}
                      className={styles.recipientInput}
                      aria-label={`Recipient ${index + 1}`}
                    />
                    <button
                      type="button"
                      className={styles.removeRecipientButton}
                      onClick={() => handleRecipientRemove(index)}
                    >
                      Remove
                    </button>
                  </div>
                ))
              ) : (
                <span className={styles.helperText}>No recipients selected yet.</span>
              )}
              <div className={styles.addRecipientRow}>
                <input
                  value={newRecipient}
                  onChange={(event) => setNewRecipient(event.target.value)}
                  onKeyDown={handleNewRecipientKeyDown}
                  className={styles.recipientInput}
                  placeholder="Add another email"
                />
                <button type="button" className={styles.addRecipientButton} onClick={handleAddRecipient}>
                  Add
                </button>
              </div>
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
        </div>
      </div>
    </div>
  );
}
