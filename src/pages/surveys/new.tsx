import Head from "next/head";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import ChatWindow from "@/components/SurveyChat/ChatWindow";
import ChatInput from "@/components/SurveyChat/ChatInput";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function NewSurveyPage() {
  const router = useRouter();
  const [surveyId, setSurveyId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [surveyGenerated, setSurveyGenerated] = useState(false);
  const [hasAutoSent, setHasAutoSent] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(true);

  // Create survey on mount
  useEffect(() => {
    createSurvey();
  }, []);

  // Auto-send initial prompt from query params (only once when survey is created and router is ready)
  useEffect(() => {
    if (!router.isReady) return;

    const initialPrompt = router.query.prompt;
    if (surveyId && initialPrompt && typeof initialPrompt === "string" && !hasAutoSent) {
      setHasAutoSent(true);
      handleSendMessage(initialPrompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, router.query.prompt, surveyId, hasAutoSent]);

  const createSurvey = async () => {
    setIsCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled Survey" }),
      });

      if (!res.ok) {
        throw new Error("Failed to create survey");
      }

      const data = await res.json();
      if (data.survey?.id) {
        setSurveyId(data.survey.id);
      } else {
        throw new Error("Invalid response from server");
      }
    } catch (error) {
      console.error("Failed to create survey", error);
      setCreateError("Failed to create survey. Please refresh the page to try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleSendMessage = async (message: string) => {
    if (!surveyId || isLoading) return;

    // Add user message immediately
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: message,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const res = await fetch(`/api/surveys/${surveyId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      const data = await res.json();

      if (data.message) {
        setMessages((prev) => [...prev, data.message]);
      }

      if (data.surveyGenerated) {
        setSurveyGenerated(true);
      }
    } catch (error) {
      console.error("Failed to send message", error);
      // Add error message
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoToEditor = () => {
    if (surveyId) {
      router.push(`/surveys/${surveyId}/edit`);
    }
  };

  return (
    <div className="min-h-screen w-full bg-black flex flex-col">
      <Head>
        <title>Create Survey | Surveyor</title>
        <meta name="description" content="Create a new survey with AI assistance" />
      </Head>

      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-[#2a2a2a]">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/surveys")}
            className="text-[#888] hover:text-white transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <span className="text-white font-medium">Create Survey</span>
        </div>

        <div className="flex items-center gap-3">
          {surveyGenerated && (
            <span className="text-sm text-green-400 flex items-center gap-1">
              <CheckIcon className="w-4 h-4" />
              Survey generated
            </span>
          )}
          <Button
            onClick={handleGoToEditor}
            disabled={!surveyId}
            variant={surveyGenerated ? "default" : "outline"}
            size="sm"
          >
            {surveyGenerated ? "Open in Editor" : "Skip to Editor"}
            <ArrowRightIcon className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Chat Interface */}
      <div className="flex-1 flex">
        {/* Left: Chat */}
        <div className="w-1/2 flex flex-col border-r border-[#2a2a2a]">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2a2a2a]">
            <div className={`w-2 h-2 rounded-full ${isCreating ? "bg-yellow-500 animate-pulse" : createError ? "bg-red-500" : "bg-[#FF6B35]"}`} />
            <span className="text-sm text-[#888]">
              {isCreating ? "Initializing..." : createError ? "Connection Error" : "AI Research Assistant"}
            </span>
          </div>

          {createError ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                  <span className="text-red-500 text-2xl">!</span>
                </div>
                <p className="text-red-400 mb-4">{createError}</p>
                <Button onClick={createSurvey} variant="outline" size="sm">
                  Try Again
                </Button>
              </div>
            </div>
          ) : (
            <>
              <ChatWindow messages={messages} isLoading={isLoading} />
              <ChatInput onSend={handleSendMessage} disabled={isLoading || !surveyId || isCreating} />
            </>
          )}
        </div>

        {/* Right: Suggestions */}
        <div className="w-1/2 p-6 overflow-y-auto">
          <div className="max-w-md mx-auto space-y-6">
            <div>
              <h3 className="text-lg font-medium text-white mb-4">
                Example prompts to get started
              </h3>
              <div className="space-y-3">
                {EXAMPLE_PROMPTS.map((prompt, index) => (
                  <button
                    key={index}
                    onClick={() => handleSendMessage(prompt.text)}
                    disabled={isLoading || !surveyId || isCreating}
                    className="w-full text-left p-4 bg-[#111] border border-[#2a2a2a] rounded-lg hover:border-[#3a3a3a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="text-white text-sm">{prompt.label}</span>
                    <p className="text-[#888] text-xs mt-1">{prompt.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-6 border-t border-[#2a2a2a]">
              <h4 className="text-sm font-medium text-white mb-3">Tips for better surveys</h4>
              <ul className="space-y-2 text-sm text-[#888]">
                <li className="flex items-start gap-2">
                  <span className="text-[#FF6B35]">•</span>
                  Be specific about your research goals
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#FF6B35]">•</span>
                  Describe your target audience clearly
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#FF6B35]">•</span>
                  Mention any constraints (time, topics to avoid)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#FF6B35]">•</span>
                  Voice questions work best for qualitative insights
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const EXAMPLE_PROMPTS = [
  {
    label: "Customer churn research",
    text: "I want to understand why customers are canceling their subscriptions to our SaaS product. I'd like to interview recently churned customers about their experience.",
    description: "Understand why customers leave",
  },
  {
    label: "Product feedback",
    text: "We're launching a new feature and want to gather feedback from beta users. I want to understand their first impressions and any pain points.",
    description: "Gather insights on new features",
  },
  {
    label: "User research",
    text: "I'm researching how people manage their personal finances. I want to understand their habits, tools they use, and pain points they experience.",
    description: "Explore user behaviors and needs",
  },
];

// Icons
function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}
