import Head from "next/head";
import Script from "next/script";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import styles from "@/styles/Assistant.module.css";
import { SURVEY_QUESTIONS_STORAGE_KEY } from "@/lib/storageKeys";
import { useSessionContext } from "@/contexts/SessionContext";
import type { InterviewScript } from "@/types/interviewScript";
import { isInterviewScript } from "@/types/interviewScript";

const formatScriptForAgent = (script: InterviewScript): string => {
  const lines: string[] = [];
  script.sections.forEach((section) => {
    lines.push(`${section.sectionName}:`);
    section.questions.forEach((question) => {
      lines.push(`Q${question.questionNumber}. ${question.questionText}`);
      if (question.followUp && question.followUp.trim()) {
        lines.push(`Follow-up: ${question.followUp.trim()}`);
      }
    });
    lines.push("");
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

export default function AssistantPage() {
  const router = useRouter();
  const { sessionData, isLoading: sessionLoading, error: sessionError } = useSessionContext();
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

  // Clean URL after initial load if we have session data
  useEffect(() => {
    if (sessionData && router.isReady) {
      const sid = getQueryValue(router.query.sid);
      const pin = getQueryValue(router.query.pin);

      if (sid && pin) {
        const allowed = new Set(["sid", "pin", "email", "email_address"]);
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

          router.replace({ pathname: router.pathname, query: cleanQuery }, undefined, { shallow: true });
        }
      }
    }
  }, [sessionData, router.isReady, router.query, router]);

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
      List_of_questions: "",
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
      variables.List_of_questions = formattedScript;
    } else if (promptValue) {
      variables.List_of_questions = promptValue;
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
    scriptFromSession
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
    };

    widget.addEventListener("elevenlabs-convai:call", handleCallStart);
    widget.addEventListener("elevenlabs-convai:call-end", handleCallEnd);

    return () => {
      widget.removeEventListener("elevenlabs-convai:call", handleCallStart);
      widget.removeEventListener("elevenlabs-convai:call-end", handleCallEnd);
    };
  }, []);

  const agentId = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID;

  return (
    <>
      <Head>
        <title>Assistant | SurvAgent</title>
        <meta
          name="description"
          content="Interact with the SurvAgent ElevenLabs assistant via a focused audio-first experience."
        />
      </Head>

      <main className={styles.container}>
        <section className={styles.widgetColumn}>
          {agentId ? (
            <>
              <elevenlabs-convai
                agent-id={agentId}
                variant="expanded"
                action-text=""
                start-call-text="Start"
                end-call-text="End"
                listening-text="Listening…"
                speaking-text="Speaking…"
                dynamic-variables={JSON.stringify(dynamicVariables)}
              />
              <Script
                src="https://unpkg.com/@elevenlabs/convai-widget-embed"
                strategy="afterInteractive"
                async
              />
            </>
          ) : (
            <div>
              <h2 style={{ fontSize: "1.4rem", fontWeight: 600, marginBottom: "0.75rem" }}>
                Configuration required
              </h2>
              <p style={{ color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
                Set the `NEXT_PUBLIC_ELEVENLABS_AGENT_ID` environment variable to enable the ElevenLabs
                assistant.
              </p>
            </div>
          )}
        </section>

        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>Welcome to your AI interview! Click the call button to get started.</h1>
          <p className={styles.heroBody}>
            Our AI agent will be happy to answer any questions
            you have and guide you through the interview.
          </p>
        </section>
      </main>
    </>
  );
}
