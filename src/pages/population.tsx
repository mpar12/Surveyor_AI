import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { EMAIL_PREVIEW_RECIPIENTS_KEY, SURVEY_QUESTIONS_STORAGE_KEY } from "@/lib/storageKeys";
import { useSessionContext } from "@/contexts/SessionContext";
import type { InterviewScript } from "@/types/interviewScript";
import { extractQuestionsFromScript, isInterviewScript } from "@/types/interviewScript";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const flattenScriptToParagraph = (script: InterviewScript | null): string | null => {
  if (!script) {
    return null;
  }
  const questions = extractQuestionsFromScript(script);
  return questions.length ? questions.join("\n") : null;
};

type QueryValue = string | string[] | undefined;

const getQueryValue = (value: QueryValue) => {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
};

// Animation variants
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 }
};

const stagger = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

export default function PopulationPage() {
  const router = useRouter();
  const { sessionData } = useSessionContext();
  const [emailCsv, setEmailCsv] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [hasValidEmails, setHasValidEmails] = useState(false);
  const [surveyQuestionParagraph, setSurveyQuestionParagraph] = useState<string | null>(null);
  const [surveyScript, setSurveyScript] = useState<InterviewScript | null>(null);
  const [agentLink, setAgentLink] = useState("");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");

  const contextSummary = useMemo(() => {
    const sidValue = getQueryValue(router.query.sid);
    const pinValue = getQueryValue(router.query.pin);

    return {
      name: sessionData?.requester || getQueryValue(router.query.name),
      prompt: sessionData?.prompt || getQueryValue(router.query.prompt),
      sid: sidValue,
      pin: pinValue
    };
  }, [
    sessionData,
    router.query.name,
    router.query.prompt,
    router.query.sid,
    router.query.pin
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const stored = sessionStorage.getItem(SURVEY_QUESTIONS_STORAGE_KEY);
    if (!stored) {
      return;
    }

    try {
      const parsed = JSON.parse(stored);
      if (isInterviewScript(parsed)) {
        setSurveyScript(parsed as InterviewScript);
        setSurveyQuestionParagraph(flattenScriptToParagraph(parsed as InterviewScript));
        return;
      }
      if (typeof parsed === "string") {
        setSurveyQuestionParagraph(parsed.trim() || null);
      }
    } catch {
      setSurveyQuestionParagraph(stored.trim() || null);
    }
  }, []);

  useEffect(() => {
    const payload = sessionData?.surveyQuestions;
    if (!payload) {
      return;
    }

    if (isInterviewScript(payload)) {
      const script = payload as InterviewScript;
      setSurveyScript(script);
      setSurveyQuestionParagraph(flattenScriptToParagraph(script));
      if (typeof window !== "undefined") {
        sessionStorage.setItem(SURVEY_QUESTIONS_STORAGE_KEY, JSON.stringify(script));
      }
      return;
    }

    if (typeof payload === "string") {
      setSurveyQuestionParagraph(payload.trim() || null);
      if (typeof window !== "undefined") {
        sessionStorage.setItem(SURVEY_QUESTIONS_STORAGE_KEY, payload);
      }
    }
  }, [sessionData?.surveyQuestions]);

  useEffect(() => {
    if (sessionData && router.isReady && contextSummary.sid && contextSummary.pin) {
      const allowedKeys = new Set(["sid", "pin"]);
      const hasExtraParams = Object.keys(router.query).some(
        (key) => !allowedKeys.has(key) && router.query[key]
      );

      if (hasExtraParams) {
        router.replace(
          { pathname: router.pathname, query: { sid: contextSummary.sid, pin: contextSummary.pin } },
          undefined,
          { shallow: true }
        );
      }
    }
  }, [sessionData, router.isReady, contextSummary.sid, contextSummary.pin, router]);

  useEffect(() => {
    if (!router.isReady || typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams();
    const setParam = (key: string, value: string | null | undefined) => {
      if (value && value.trim()) {
        params.set(key, value.trim());
      }
    };

    setParam("name", contextSummary.name);
    setParam("prompt", contextSummary.prompt);
    setParam("sid", contextSummary.sid);
    setParam("pin", contextSummary.pin);

    if (surveyScript) {
      try {
        const payload = JSON.stringify(surveyScript);
        const encoded = window.btoa(unescape(encodeURIComponent(payload)));
        params.set("surveyQuestions", encoded);
      } catch (error) {
        console.error("Failed to encode interview script for assistant link", error);
      }
    } else if (surveyQuestionParagraph) {
      try {
        const payload = JSON.stringify({ paragraph: surveyQuestionParagraph });
        const encoded = window.btoa(unescape(encodeURIComponent(payload)));
        params.set("surveyQuestions", encoded);
      } catch (error) {
        console.error("Failed to encode survey question paragraph for assistant link", error);
      }
    }

    const query = params.toString();
    const origin = window.location.origin;
    const link = `${origin}/assistant${query ? `?${query}` : ""}`;
    setAgentLink(link);
  }, [
    router.isReady,
    contextSummary.name,
    contextSummary.prompt,
    contextSummary.sid,
    contextSummary.pin,
    surveyQuestionParagraph,
    surveyScript
  ]);

  const handleEmailsChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setEmailCsv(value);

    if (!value.trim()) {
      setEmailError(null);
      setHasValidEmails(false);
      return;
    }

    const entries = value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);

    if (!entries.length) {
      setEmailError("Provide at least one email address.");
      setHasValidEmails(false);
      return;
    }

    const invalidSample = entries.find((entry) => !EMAIL_REGEX.test(entry));

    if (invalidSample) {
      setEmailError(`"${invalidSample}" is not a valid email address.`);
      setHasValidEmails(false);
      return;
    }

    setEmailError(null);
    setHasValidEmails(true);
  };

  const handlePrepareEmail = () => {
    const entries = emailCsv
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => EMAIL_REGEX.test(entry));

    const unique = Array.from(new Set(entries));

    if (!unique.length) {
      setEmailError("Provide at least one valid email address.");
      setHasValidEmails(false);
      return;
    }

    if (typeof window !== "undefined") {
      sessionStorage.setItem(EMAIL_PREVIEW_RECIPIENTS_KEY, JSON.stringify(unique));
      try {
        if (surveyQuestionParagraph) {
          sessionStorage.setItem(SURVEY_QUESTIONS_STORAGE_KEY, surveyQuestionParagraph);
        } else {
          sessionStorage.removeItem(SURVEY_QUESTIONS_STORAGE_KEY);
        }
      } catch (storageError) {
        console.error("Failed to persist survey question paragraph for email preview", storageError);
      }
    }

    const query: Record<string, string> = {
      sid: contextSummary.sid ?? "",
      pin: contextSummary.pin ?? "",
      source: "manual"
    };

    router.push({ pathname: "/email-preview", query });
  };

  const handleCopyAgentLink = () => {
    if (!agentLink) {
      return;
    }

    if (typeof navigator === "undefined" || !navigator.clipboard) {
      setCopyStatus("error");
      setTimeout(() => setCopyStatus("idle"), 2500);
      return;
    }

    navigator.clipboard
      .writeText(agentLink)
      .then(() => {
        setCopyStatus("copied");
        setTimeout(() => setCopyStatus("idle"), 2500);
      })
      .catch(() => {
        setCopyStatus("error");
        setTimeout(() => setCopyStatus("idle"), 2500);
      });
  };

  return (
    <div className="min-h-screen w-full bg-black">
      <Head>
        <title>Choose Participants | Surveyor</title>
        <meta
          name="description"
          content="Decide who should receive your Surveyor invitation."
        />
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
                <span className="text-sm text-[#888] tracking-wide font-medium">PARTICIPANTS</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight">
                Choose Interview Participants
              </h1>
              <p className="text-lg text-[#888]">
                Share a list of recipients and we&apos;ll help you send the AI survey invitation.
              </p>
            </motion.div>

            {/* Context Card */}
            <motion.div variants={fadeInUp}>
              <Card variant="default" className="bg-[#111] border-[#2a2a2a]">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <NoteIcon className="w-5 h-5 text-[#FF6B35]" />
                    Prompt Recap
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-[#666]">
                        Requester
                      </span>
                      <p className="text-white font-medium mt-1">{contextSummary.name || "—"}</p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-[#666]">
                        Session PIN
                      </span>
                      <p className="text-white font-medium mt-1 font-mono">{contextSummary.pin || "—"}</p>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#666]">
                      Research Prompt
                    </span>
                    <p className="text-[#a1a1a1] mt-1">{contextSummary.prompt || "—"}</p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-[#2a2a2a]">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyAgentLink}
                      disabled={!agentLink}
                      className="border-[#333] text-[#a1a1a1] hover:text-white hover:border-[#444]"
                    >
                      <CopyIcon className="w-4 h-4" />
                      {agentLink ? "Copy Assistant Link" : "Preparing..."}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/prolific-setup?sid=${contextSummary.sid}&pin=${contextSummary.pin}`)}
                      disabled={!contextSummary.sid || !contextSummary.pin}
                      className="border-[#333] text-[#a1a1a1] hover:text-white hover:border-[#444]"
                    >
                      <ExternalIcon className="w-4 h-4" />
                      Prolific Project
                    </Button>
                    <span className="text-xs text-[#666]">
                      {copyStatus === "copied"
                        ? "Copied!"
                        : copyStatus === "error"
                          ? "Unable to copy."
                          : "Share the ElevenLabs agent directly."}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Email Input Card */}
            <motion.div variants={fadeInUp}>
              <Card variant="default" className="bg-[#111] border-[#2a2a2a]">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <MailIcon className="w-5 h-5 text-[#FF6B35]" />
                    Paste Your Participant List
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-[#888]">
                    Separate addresses with commas. We&apos;ll BCC everyone on your invitation.
                  </p>
                  <Textarea
                    value={emailCsv}
                    onChange={handleEmailsChange}
                    maxLength={1000}
                    placeholder="alice@example.com, bob@example.org, ..."
                    className="bg-[#0a0a0a] border-[#2a2a2a] text-white placeholder-[#555] focus:border-[#FF6B35]"
                    characterCount
                  />
                  {emailError && (
                    <p className="text-sm text-red-400">{emailError}</p>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Action Buttons */}
            <motion.div variants={fadeInUp} className="flex flex-wrap gap-4 justify-center pt-4">
              <Button
                size="lg"
                onClick={handlePrepareEmail}
                disabled={!hasValidEmails}
              >
                <MailIcon className="w-5 h-5" />
                Draft Email
              </Button>
              <Button
                variant="outline"
                size="lg"
                asChild
                className="border-[#333] text-[#a1a1a1] hover:text-white hover:border-[#444]"
              >
                <Link href={{ pathname: "/scorecard", query: { sid: contextSummary.sid, pin: contextSummary.pin } }}>
                  <ChartIcon className="w-5 h-5" />
                  View Results
                </Link>
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}

// Icons
function NoteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

function ExternalIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  );
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}
