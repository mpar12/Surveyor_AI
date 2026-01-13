import Head from "next/head";
import { useRouter } from "next/router";
import { ChangeEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  EMAIL_PREVIEW_LAST_SEND_KEY,
  EMAIL_PREVIEW_RECIPIENTS_KEY,
  SURVEY_QUESTIONS_STORAGE_KEY
} from "@/lib/storageKeys";
import { useSessionContext } from "@/contexts/SessionContext";
import type { InterviewScript } from "@/types/interviewScript";
import { extractQuestionsFromScript, isInterviewScript } from "@/types/interviewScript";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const buildEmailHtml = (body: string, agentLink: string) => {
  const safeBody = body.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = safeBody.split("\n").join("<br />");

  if (!agentLink) {
    return `<div>${lines}</div>`;
  }

  const safeLink = agentLink.replace(/"/g, "&quot;");
  const buttonHtml = `<div style=\"margin-top:16px;\"><a href=\"${safeLink}\" target=\"_blank\" rel=\"noopener noreferrer\" style=\"display:inline-block;padding:12px 20px;border-radius:10px;background:#FF6B35;color:#ffffff;font-weight:600;text-decoration:none;\">Start Interview</a></div>`;

  if (safeBody.includes(agentLink)) {
    const replaced = safeBody
      .split(agentLink)
      .join(`<a href=\"${safeLink}\" target=\"_blank\" rel=\"noopener noreferrer\" style=\"color:#FF6B35;font-weight:600;\">${agentLink}</a>`);
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

// Animation variants
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 }
};

const stagger = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

export default function EmailPreviewPage() {
  const router = useRouter();
  const { sessionData } = useSessionContext();

  const context = useMemo(() => {
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
      const hasExtraParams = Object.keys(router.query).some(key =>
        key !== 'sid' && key !== 'pin' && key !== 'emails' && router.query[key]
      );

      if (hasExtraParams) {
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
      return promptSnippet ? `Can we chat about "${promptSnippet}"?` : "Survey Invitation";
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
    <div className="min-h-screen w-full bg-black">
      <Head>
        <title>Email Preview | Surveyor</title>
        <meta name="description" content="Review and send the survey invitation email." />
      </Head>

      <Header />

      <main className="relative z-10 pt-24 pb-20 px-6 md:px-12 lg:px-16">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial="initial"
            animate="animate"
            variants={stagger}
            className="space-y-8"
          >
            {/* Page Header */}
            <motion.div variants={fadeInUp} className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#FF6B35]" />
                <span className="text-sm text-[#888] tracking-wide font-medium">EMAIL</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight">
                Send Interview Invitation
              </h1>
              <p className="text-lg text-[#888]">
                Review the message below and confirm to send your AI agent to the selected recipients.
              </p>
            </motion.div>

            {/* Email Form Card */}
            <motion.div variants={fadeInUp}>
              <Card variant="default" className="bg-[#111] border-[#2a2a2a]">
                <CardContent className="space-y-6 pt-6">
                  {/* From Field */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#666] mb-2">
                      From
                    </label>
                    <div className="px-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-[#888]">
                      {`${SENDER_NAME} <${SENDER_EMAIL}>`}
                    </div>
                  </div>

                  {/* Recipients Field */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#666] mb-2">
                      Bcc Recipients
                    </label>
                    <div className="space-y-3">
                      {recipients.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {recipients.map((recipient, index) => (
                            <div
                              key={index}
                              className="flex items-center gap-2 px-3 py-1.5 bg-[#1a1a1a] border border-[#333] rounded-full"
                            >
                              <span className="text-sm text-white">{recipient}</span>
                              <button
                                type="button"
                                onClick={() => handleRecipientRemove(index)}
                                className="text-[#666] hover:text-red-400 transition-colors"
                              >
                                <XIcon className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Input
                          value={newRecipient}
                          onChange={(event) => setNewRecipient(event.target.value)}
                          onKeyDown={handleNewRecipientKeyDown}
                          placeholder="Add email address"
                          className="bg-[#0a0a0a] border-[#2a2a2a] text-white placeholder-[#555]"
                        />
                        <Button
                          variant="outline"
                          onClick={handleAddRecipient}
                          className="border-[#333] text-[#a1a1a1] hover:text-white hover:border-[#444]"
                        >
                          Add
                        </Button>
                      </div>
                      {recipients.length === 0 && (
                        <p className="text-sm text-[#666]">No recipients selected yet.</p>
                      )}
                    </div>
                  </div>

                  {/* Subject Field */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#666] mb-2">
                      Subject
                    </label>
                    <Input
                      value={subject}
                      onChange={handleSubjectChange}
                      placeholder="Product Survey"
                      className="bg-[#0a0a0a] border-[#2a2a2a] text-white placeholder-[#555]"
                    />
                  </div>

                  {/* Message Body */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#666] mb-2">
                      Message
                    </label>
                    <Textarea
                      value={body}
                      onChange={handleBodyChange}
                      className="bg-[#0a0a0a] border-[#2a2a2a] text-white placeholder-[#555] min-h-[150px]"
                    />
                    <p className="text-xs text-[#666] mt-2">
                      The interview button is automatically included in the final email.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Email Preview Card */}
            <motion.div variants={fadeInUp}>
              <Card variant="default" className="bg-[#111] border-[#2a2a2a]">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <EyeIcon className="w-5 h-5 text-[#FF6B35]" />
                    Email Preview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div
                    className="p-6 bg-white rounded-lg text-gray-800"
                    dangerouslySetInnerHTML={{ __html: buildEmailHtml(body, agentLink) }}
                  />
                </CardContent>
              </Card>
            </motion.div>

            {/* Error/Success Messages */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg"
              >
                <p className="text-red-400">{error}</p>
              </motion.div>
            )}
            {success && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg"
              >
                <p className="text-green-400">{success}</p>
              </motion.div>
            )}

            {/* Action Buttons */}
            <motion.div variants={fadeInUp} className="flex justify-center pt-4">
              <Button
                size="lg"
                onClick={handleSend}
                disabled={isSending || !recipients.length}
                loading={isSending}
              >
                <SendIcon className="w-5 h-5" />
                {isSending ? "Sending…" : "Send Email"}
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}

// Icons
function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  );
}
