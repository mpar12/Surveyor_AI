import Head from "next/head";
import Script from "next/script";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { SURVEY_QUESTIONS_STORAGE_KEY } from "@/lib/storageKeys";
import { useSessionContext } from "@/contexts/SessionContext";
import type { InterviewScript } from "@/types/interviewScript";
import { isInterviewScript } from "@/types/interviewScript";
import Header from "@/components/Header";

const formatScriptForAgent = (script: InterviewScript): string => {
  const lines: string[] = [];
  script.sections.forEach((section) => {
    section.questions.forEach((question) => {
      const label =
        typeof question.questionNumber === "number" && !Number.isNaN(question.questionNumber)
          ? `QUESTION ${question.questionNumber}:`
          : "QUESTION:";
      lines.push(`${label} ${question.questionText}`.trim());
      lines.push(""); // add blank line between questions
    });
  });
  return lines.join("\n").trim();
};

const extractInterviewScript = (value: unknown): InterviewScript | null => {
  if (!value) {
    return null;
  }

  if (isInterviewScript(value)) {
    return value as InterviewScript;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (isInterviewScript(parsed)) {
        return parsed as InterviewScript;
      }
    } catch {
      return null;
    }
  }

  return null;
};

const normalizeSurveyQuestionValue = (input: unknown): string | null => {
  const potentialScript = extractInterviewScript(input);
  if (potentialScript) {
    return formatScriptForAgent(potentialScript);
  }

  if (typeof input === "string") {
    const trimmed = input.trim();
    return trimmed ? trimmed : null;
  }

  if (Array.isArray(input)) {
    const sanitized = input
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter(Boolean);
    return sanitized.length ? sanitized.join(" ") : null;
  }

  if (isInterviewScript(input)) {
    return formatScriptForAgent(input as InterviewScript);
  }

  return null;
};

const decodeParagraphParam = (
  encoded: string
): { formatted: string | null; script: InterviewScript | null } => {
  try {
    const decoded = window.atob(encoded);
    const normalized = decodeURIComponent(escape(decoded));

    try {
      const parsed = JSON.parse(normalized);
      if (isInterviewScript(parsed)) {
        return {
          formatted: formatScriptForAgent(parsed as InterviewScript),
          script: parsed as InterviewScript
        };
      }
      const fromParsed = normalizeSurveyQuestionValue(parsed);
      if (fromParsed) {
        return { formatted: fromParsed, script: null };
      }
    } catch {
      const trimmed = normalized.trim();
      if (trimmed) {
        return { formatted: trimmed, script: null };
      }
    }
  } catch (error) {
    console.error("Failed to decode survey question paragraph", error);
  }

  return { formatted: null, script: null };
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

export default function AssistantPage() {
  const router = useRouter();
  const { sessionData } = useSessionContext();
  const [surveyQuestionParagraph, setSurveyQuestionParagraph] = useState<string | null>(null);
  const [localScript, setLocalScript] = useState<InterviewScript | null>(null);

  const getQueryValue = (value: string | string[] | undefined) => {
    if (Array.isArray(value)) {
      return value[0] ?? "";
    }
    return value ?? "";
  };

  useEffect(() => {
    if (!router.isReady || typeof window === "undefined") {
      return;
    }

    const encodedParam = getQueryValue(router.query.surveyQuestions);

    if (encodedParam) {
      const decodedResult = decodeParagraphParam(encodedParam);
      if (decodedResult.formatted) {
        setSurveyQuestionParagraph(decodedResult.formatted);
        try {
          if (decodedResult.script) {
            setLocalScript(decodedResult.script);
            window.sessionStorage.setItem(SURVEY_QUESTIONS_STORAGE_KEY, JSON.stringify(decodedResult.script));
          } else {
            window.sessionStorage.setItem(SURVEY_QUESTIONS_STORAGE_KEY, decodedResult.formatted);
          }
        } catch (storageError) {
          console.error("Failed to persist decoded survey questions", storageError);
        }
        return;
      }
    }

    try {
      const stored = window.sessionStorage.getItem(SURVEY_QUESTIONS_STORAGE_KEY);
      if (!stored) {
        return;
      }

      const trimmed = stored.trim();
      if (!trimmed) {
        return;
      }

      let normalized: string | null = null;
      let parsedValue: unknown = null;
      try {
        parsedValue = JSON.parse(trimmed);
        normalized = normalizeSurveyQuestionValue(parsedValue);
      } catch {
        normalized = normalizeSurveyQuestionValue(trimmed);
      }

      if (parsedValue && isInterviewScript(parsedValue)) {
        setLocalScript(parsedValue as InterviewScript);
      }

      if (normalized) {
        setSurveyQuestionParagraph(normalized);
      }
    } catch (error) {
      console.error("Failed to read stored survey question paragraph", error);
    }
  }, [router.isReady, router.query.surveyQuestions]);

  useEffect(() => {
    const normalized = normalizeSurveyQuestionValue(sessionData?.surveyQuestions ?? null);
    if (!normalized) {
      return;
    }

    const candidate = sessionData?.surveyQuestions;
    if (candidate && isInterviewScript(candidate)) {
      const scriptCandidate = candidate as InterviewScript;
      setLocalScript(scriptCandidate);
      const formatted = formatScriptForAgent(scriptCandidate);
      setSurveyQuestionParagraph(formatted);
      if (typeof window !== "undefined") {
        try {
          window.sessionStorage.setItem(SURVEY_QUESTIONS_STORAGE_KEY, JSON.stringify(scriptCandidate));
        } catch (storageError) {
          console.error("Failed to persist interview script", storageError);
        }
      }
      return;
    }

    setSurveyQuestionParagraph(normalized);

    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem(SURVEY_QUESTIONS_STORAGE_KEY, normalized);
      } catch (storageError) {
        console.error("Failed to persist session survey question paragraph", storageError);
      }
    }
  }, [sessionData?.surveyQuestions]);

  const scriptFromSession = useMemo(
    () => extractInterviewScript(sessionData?.surveyQuestions ?? null),
    [sessionData?.surveyQuestions]
  );

  useEffect(() => {
    if (scriptFromSession) {
      setLocalScript(scriptFromSession);
    }
  }, [scriptFromSession]);

  // Extract Prolific params from URL
  const prolificPid = getQueryValue(router.query.PROLIFIC_PID);
  const prolificStudyId = getQueryValue(router.query.STUDY_ID);
  const prolificSessionId = getQueryValue(router.query.SESSION_ID);
  const completionUrl = getQueryValue(router.query.completionUrl);
  const decodedCompletionUrl = completionUrl ? decodeURIComponent(completionUrl) : "";

  // Clean URL after initial load if we have session data
  useEffect(() => {
    if (sessionData && router.isReady) {
      const sid = getQueryValue(router.query.sid);
      const pin = getQueryValue(router.query.pin);

      if (sid && pin) {
        // Preserve Prolific params in URL
        const allowed = new Set([
          "sid", "pin", "email", "email_address",
          "PROLIFIC_PID", "STUDY_ID", "SESSION_ID", "completionUrl"
        ]);
        const hasExtraParams = Object.keys(router.query).some(
          (key) => !allowed.has(key) && router.query[key]
        );

        if (hasExtraParams) {
          const cleanQuery: Record<string, string> = { sid, pin };

          const emailValue = getQueryValue(router.query.email);
          const emailAddressValue = getQueryValue(router.query.email_address);

          if (emailValue) {
            cleanQuery.email = emailValue;
          } else if (emailAddressValue) {
            cleanQuery.email_address = emailAddressValue;
          }

          // Preserve Prolific params
          if (prolificPid) cleanQuery.PROLIFIC_PID = prolificPid;
          if (prolificStudyId) cleanQuery.STUDY_ID = prolificStudyId;
          if (prolificSessionId) cleanQuery.SESSION_ID = prolificSessionId;
          if (completionUrl) cleanQuery.completionUrl = completionUrl;

          router.replace({ pathname: router.pathname, query: cleanQuery }, undefined, { shallow: true });
        }
      }
    }
  }, [sessionData, router.isReady, router.query, router, prolificPid, prolificStudyId, prolificSessionId, completionUrl]);

  const dynamicVariables = useMemo(() => {
    // Use session data if available, fallback to URL params for initial load
    const name = sessionData?.requester || getQueryValue(router.query.name);
    const sessionId = getQueryValue(router.query.sid);
    const pin = getQueryValue(router.query.pin);
    const participantEmail =
      getQueryValue(router.query.email) || getQueryValue(router.query.email_address);
    const promptValue = sessionData?.prompt || getQueryValue(router.query.prompt);

    // Use survey question paragraph from session context (from brief page) as primary source
    const questionsFromSession = normalizeSurveyQuestionValue(sessionData?.surveyQuestions ?? null);
    const questionParagraph = questionsFromSession || surveyQuestionParagraph;
    const activeScript = scriptFromSession || localScript;
    const formattedScript = activeScript ? formatScriptForAgent(activeScript) : questionParagraph;

    const variables: Record<string, string> = {
      research_objective: "",
      duration: "",
      list_of_questions: "",
      Interview_Notes: "",
      title: ""
    };

    if (name) {
      variables.user_name = name;
    }
    if (sessionId) {
      variables.session_id = sessionId;
    }
    if (pin) {
      variables.PIN = pin;
    }
    if (participantEmail) {
      variables.email_address = participantEmail;
    }
    if (promptValue) {
      variables.survey_prompt = promptValue;
    }
    if (formattedScript) {
      variables.list_of_questions = formattedScript;
    } else if (promptValue) {
      variables.list_of_questions = promptValue;
    }

    if (activeScript) {
      const objective = activeScript.researchObjective?.trim();
      if (objective) {
        variables.research_objective = objective;
      }

      const duration = activeScript.estimatedDuration?.trim();
      if (duration) {
        variables.duration = duration;
      }

      const title = activeScript.title?.trim();
      if (title) {
        variables.title = title;
      }

      const interviewerNotes = Array.isArray(activeScript.interviewerNotes)
        ? activeScript.interviewerNotes.map((note) => note.trim()).filter(Boolean)
        : [];
      if (interviewerNotes.length) {
        variables.Interview_Notes = interviewerNotes.map((note) => `• ${note}`).join("\n");
      }
    }

    // Add Prolific tracking variables (passed through ElevenLabs to webhook)
    if (prolificPid) {
      variables.prolific_pid = prolificPid;
    }
    if (prolificStudyId) {
      variables.prolific_study_id = prolificStudyId;
    }
    if (prolificSessionId) {
      variables.prolific_session_id = prolificSessionId;
    }

    return variables;
  }, [
    sessionData,
    router.query.name,
    router.query.prompt,
    router.query.sid,
    router.query.pin,
    router.query.email,
    router.query.email_address,
    surveyQuestionParagraph,
    localScript,
    scriptFromSession,
    prolificPid,
    prolificStudyId,
    prolificSessionId
  ]);

  useEffect(() => {
    const widget = document.querySelector("elevenlabs-convai");

    if (!widget) {
      return;
    }

    const handleCallStart = () => {
      console.log("Call started: session created after mic consent");
    };

    const handleCallEnd = () => {
      console.log("Call ended or mic denied, no active session");
      // Redirect to Prolific completion URL if present
      if (decodedCompletionUrl) {
        window.location.href = decodedCompletionUrl;
      }
    };

    widget.addEventListener("elevenlabs-convai:call", handleCallStart);
    widget.addEventListener("elevenlabs-convai:call-end", handleCallEnd);

    return () => {
      widget.removeEventListener("elevenlabs-convai:call", handleCallStart);
      widget.removeEventListener("elevenlabs-convai:call-end", handleCallEnd);
    };
  }, [decodedCompletionUrl]);

  const agentId = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID;

  return (
    <div className="min-h-screen w-full bg-black relative overflow-hidden">
      <Head>
        <title>AI Interview | Surveyor</title>
        <meta
          name="description"
          content="Interact with the Surveyor ElevenLabs assistant via a focused audio-first experience."
        />
      </Head>

      <Header />

      {/* Main Content */}
      <main className="relative z-10 min-h-screen pt-24 pb-20 px-6 md:px-12 lg:px-16">
        <div className="max-w-[1400px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center min-h-[calc(100vh-200px)]">
            {/* Left Column - Widget */}
            <motion.div
              initial="initial"
              animate="animate"
              variants={stagger}
              className="flex flex-col items-center lg:items-start"
            >
              <motion.div variants={fadeInUp} className="flex items-center gap-2 mb-6">
                <div className="w-2 h-2 rounded-full bg-[#FF6B35]" />
                <span className="text-sm text-[#888] tracking-wide font-medium">AI INTERVIEW</span>
              </motion.div>

              <motion.h1 variants={fadeInUp} className="text-3xl md:text-4xl font-bold text-white mb-4 text-center lg:text-left">
                Welcome to your AI interview
              </motion.h1>

              <motion.p variants={fadeInUp} className="text-lg text-[#888] mb-8 text-center lg:text-left max-w-md">
                Click the call button to get started. Our AI agent will guide you through the interview.
              </motion.p>

              <motion.div variants={fadeInUp} className="w-full max-w-lg">
                {agentId ? (
                  <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-6">
                    <elevenlabs-convai
                      agent-id={agentId}
                      variant="expanded"
                      action-text=""
                      start-call-text="Start Interview"
                      end-call-text="End Interview"
                      listening-text="Listening…"
                      speaking-text="Speaking…"
                      dynamic-variables={JSON.stringify(dynamicVariables)}
                    />
                    <Script
                      src="https://unpkg.com/@elevenlabs/convai-widget-embed"
                      strategy="afterInteractive"
                      async
                    />
                  </div>
                ) : (
                  <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-8">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-[#1a1a1a] flex items-center justify-center">
                        <SettingsIcon className="w-5 h-5 text-[#FF6B35]" />
                      </div>
                      <h2 className="text-xl font-semibold text-white">Configuration Required</h2>
                    </div>
                    <p className="text-[#888] leading-relaxed">
                      Set the <code className="text-[#FF6B35] bg-[#1a1a1a] px-2 py-0.5 rounded">NEXT_PUBLIC_ELEVENLABS_AGENT_ID</code> environment variable to enable the ElevenLabs assistant.
                    </p>
                  </div>
                )}
              </motion.div>
            </motion.div>

            {/* Right Column - Decorative Elements */}
            <div className="hidden lg:block relative h-[500px]">
              {/* Animated nodes/connections visualization */}
              <div className="absolute inset-0">
                {/* Top node */}
                <div className="absolute top-8 left-1/2 -translate-x-1/2">
                  <div className="flex items-center gap-1 px-3 py-1.5 bg-[#1a1a1a] border border-[#333] rounded-full">
                    <div className="w-2 h-2 rounded-full bg-[#27ca40] animate-pulse" />
                    <div className="w-16 h-2 rounded-full bg-[#333]" />
                  </div>
                </div>

                {/* Center microphone icon */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                  <div className="w-20 h-20 rounded-2xl bg-[#1a1a1a] border border-[#333] flex items-center justify-center">
                    <MicIcon className="w-10 h-10 text-[#FF6B35] animate-pulse" />
                  </div>
                </div>

                {/* Connection lines */}
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 500">
                  <defs>
                    <linearGradient id="lineGradientAssistant" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#333" />
                      <stop offset="50%" stopColor="#FF6B35" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#333" />
                    </linearGradient>
                  </defs>
                  {/* Horizontal dashed lines */}
                  <line x1="50" y1="100" x2="350" y2="100" stroke="#222" strokeWidth="1" strokeDasharray="4 4" />
                  <line x1="50" y1="200" x2="350" y2="200" stroke="#222" strokeWidth="1" strokeDasharray="4 4" />
                  <line x1="50" y1="300" x2="350" y2="300" stroke="#222" strokeWidth="1" strokeDasharray="4 4" />
                  <line x1="50" y1="400" x2="350" y2="400" stroke="#222" strokeWidth="1" strokeDasharray="4 4" />
                  {/* Vertical center line with glow */}
                  <line x1="200" y1="80" x2="200" y2="420" stroke="url(#lineGradientAssistant)" strokeWidth="2" strokeDasharray="8 4" />
                </svg>

                {/* Sound wave nodes */}
                <div className="absolute top-[140px] left-8">
                  <div className="flex items-center gap-1 px-3 py-2 bg-[#1a1a1a] border border-[#333] rounded-lg">
                    <div className="flex items-end gap-0.5 h-4">
                      <div className="w-1 bg-[#FF6B35] rounded-full animate-pulse" style={{ height: "40%", animationDelay: "0ms" }} />
                      <div className="w-1 bg-[#FF6B35] rounded-full animate-pulse" style={{ height: "80%", animationDelay: "100ms" }} />
                      <div className="w-1 bg-[#FF6B35] rounded-full animate-pulse" style={{ height: "60%", animationDelay: "200ms" }} />
                      <div className="w-1 bg-[#FF6B35] rounded-full animate-pulse" style={{ height: "100%", animationDelay: "300ms" }} />
                      <div className="w-1 bg-[#FF6B35] rounded-full animate-pulse" style={{ height: "50%", animationDelay: "400ms" }} />
                    </div>
                  </div>
                </div>

                <div className="absolute top-[240px] right-8">
                  <div className="flex items-center gap-1 px-3 py-1.5 bg-[#1a1a1a] border border-[#333] rounded-full">
                    <div className="w-2 h-2 rounded-full bg-[#444]" />
                    <div className="w-2 h-2 rounded-full bg-[#FF6B35]" />
                    <div className="w-12 h-2 rounded-full bg-[#333]" />
                  </div>
                </div>

                <div className="absolute top-[340px] left-16">
                  <div className="flex items-center gap-1 px-3 py-1.5 bg-[#1a1a1a] border border-[#333] rounded-full">
                    <div className="w-2 h-2 rounded-full bg-[#444]" />
                    <div className="w-2 h-2 rounded-full bg-[#444]" />
                    <div className="w-8 h-2 rounded-full bg-[#333]" />
                  </div>
                </div>

                {/* Interview tips card */}
                <div className="absolute bottom-12 right-0 w-56 bg-[#111] border border-[#222] rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-lg bg-[#FF6B35]/10 flex items-center justify-center">
                      <TipIcon className="w-4 h-4 text-[#FF6B35]" />
                    </div>
                    <span className="text-xs font-semibold text-[#888] uppercase tracking-wider">Tips</span>
                  </div>
                  <ul className="space-y-2 text-xs text-[#666]">
                    <li className="flex items-start gap-2">
                      <span className="text-[#FF6B35] mt-0.5">•</span>
                      Speak naturally and clearly
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#FF6B35] mt-0.5">•</span>
                      Share specific examples
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#FF6B35] mt-0.5">•</span>
                      Take your time to think
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// Icons
function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
    </svg>
  );
}

function TipIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  );
}
