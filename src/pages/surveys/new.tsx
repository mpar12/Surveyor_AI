import Head from "next/head";
import { useRouter } from "next/router";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import ChatWindow from "@/components/SurveyChat/ChatWindow";
import ChatInput from "@/components/SurveyChat/ChatInput";
import type { SurveyWithSections } from "@/types/surveyBuilder";
import { isMultipleChoiceSettings, isOpenEndedSettings } from "@/types/surveyBuilder";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

type TabType = "create" | "edit" | "launch";

export default function NewSurveyPage() {
  const router = useRouter();
  const [surveyId, setSurveyId] = useState<string | null>(null);
  const [survey, setSurvey] = useState<SurveyWithSections | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [surveyGenerated, setSurveyGenerated] = useState(false);
  const [hasAutoSent, setHasAutoSent] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("create");
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isSaved, setIsSaved] = useState(true);

  // Editable study metadata
  const [studyTitle, setStudyTitle] = useState("Untitled Study");
  const [externalTitle, setExternalTitle] = useState("");
  const [background, setBackground] = useState("");
  const [studyGoals, setStudyGoals] = useState<string[]>([]);
  const [bringOwnParticipants, setBringOwnParticipants] = useState(false);

  // Create survey on mount
  useEffect(() => {
    createSurvey();
  }, []);

  // Auto-send initial prompt from query params
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
        body: JSON.stringify({ title: "Untitled Study" }),
      });

      if (!res.ok) {
        throw new Error("Failed to create survey");
      }

      const data = await res.json();
      if (data.survey?.id) {
        setSurveyId(data.survey.id);
        setSurvey(data.survey);
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

  const fetchSurvey = useCallback(async () => {
    if (!surveyId) return;
    try {
      const res = await fetch(`/api/surveys/${surveyId}`);
      if (res.ok) {
        const data = await res.json();
        setSurvey(data.survey);
        // Update metadata from survey
        if (data.survey.title) setStudyTitle(data.survey.title);
        if (data.survey.description) setBackground(data.survey.description);
      }
    } catch (error) {
      console.error("Failed to fetch survey", error);
    }
  }, [surveyId]);

  const handleSendMessage = async (message: string) => {
    if (!surveyId || isLoading) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: message,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setIsSaved(false);

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
        await fetchSurvey();
        setIsSaved(true);
      }
    } catch (error) {
      console.error("Failed to send message", error);
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
    <div className="min-h-screen w-full bg-white flex flex-col">
      <Head>
        <title>{studyTitle} | Surveyor</title>
        <meta name="description" content="Create a new survey with AI assistance" />
      </Head>

      {/* Top Header */}
      <header className="flex items-center justify-between px-4 h-14 border-b border-gray-200 bg-white">
        {/* Left: Logo and Title */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/surveys")}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <LogoIcon className="w-6 h-6" />
          </button>
          <input
            type="text"
            value={studyTitle}
            onChange={(e) => {
              setStudyTitle(e.target.value);
              setIsSaved(false);
            }}
            className="text-lg font-medium text-gray-900 bg-transparent border-none outline-none focus:ring-0"
            placeholder="Study name"
          />
        </div>

        {/* Center: Tabs */}
        <div className="flex items-center">
          <nav className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {(["create", "edit", "launch"] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${
                  activeTab === tab
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          <span className={`text-sm flex items-center gap-1 ${isSaved ? "text-gray-400" : "text-yellow-600"}`}>
            {isSaved ? (
              <>
                <CheckIcon className="w-4 h-4" />
                Saved
              </>
            ) : (
              "Saving..."
            )}
          </span>
          <Button variant="outline" size="sm" className="gap-2">
            <UserPlusIcon className="w-4 h-4" />
            Invite
          </Button>
          <Button size="sm" onClick={handleGoToEditor}>
            Proceed to Editor
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Left: AI Chat */}
        <div className="w-[480px] flex flex-col border-r border-gray-200 bg-gray-50">
          {/* Study Guide Status */}
          <div className="px-4 py-3 border-b border-gray-200">
            <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
              surveyGenerated
                ? "bg-green-100 text-green-700"
                : isCreating
                  ? "bg-yellow-100 text-yellow-700"
                  : "bg-gray-100 text-gray-600"
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                surveyGenerated ? "bg-green-500" : isCreating ? "bg-yellow-500 animate-pulse" : "bg-gray-400"
              }`} />
              {surveyGenerated ? "Loaded study guide" : isCreating ? "Initializing..." : "No study guide yet"}
            </span>
          </div>

          {createError ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                  <span className="text-red-500 text-2xl">!</span>
                </div>
                <p className="text-red-600 mb-4">{createError}</p>
                <Button onClick={createSurvey} variant="outline" size="sm">
                  Try Again
                </Button>
              </div>
            </div>
          ) : (
            <>
              <ChatWindow messages={messages} isLoading={isLoading} />

              {/* Suggestions Section */}
              {surveyGenerated && (
                <div className="border-t border-gray-200 p-4 space-y-2">
                  <h4 className="text-sm font-medium text-gray-700">Suggestions</h4>
                  <SuggestionItem text="Add pricing tier question before the value perception question" />
                  <SuggestionItem text="Add question about which NYT sections they used most" />
                  <SuggestionItem text="Add a screener to verify cancelled subscribers" />
                </div>
              )}

              <ChatInput
                onSend={handleSendMessage}
                disabled={isLoading || !surveyId || isCreating}
                placeholder="Suggest changes to the study..."
              />
            </>
          )}
        </div>

        {/* Right: Content based on active tab */}
        <div className="flex-1 flex flex-col bg-white overflow-hidden">
          {activeTab === "create" && (
            <CreateTabContent
              studyTitle={studyTitle}
              externalTitle={externalTitle}
              setExternalTitle={setExternalTitle}
              background={background}
              setBackground={setBackground}
              studyGoals={studyGoals}
              bringOwnParticipants={bringOwnParticipants}
              setBringOwnParticipants={setBringOwnParticipants}
              survey={survey}
            />
          )}

          {activeTab === "edit" && (
            <EditTabContent
              survey={survey}
              audioEnabled={audioEnabled}
              setAudioEnabled={setAudioEnabled}
              onExport={handleGoToEditor}
            />
          )}

          {activeTab === "launch" && (
            <LaunchTabContent />
          )}
        </div>
      </div>
    </div>
  );
}

// Create Tab - Study Overview
function CreateTabContent({
  studyTitle,
  externalTitle,
  setExternalTitle,
  background,
  setBackground,
  studyGoals,
  bringOwnParticipants,
  setBringOwnParticipants,
  survey,
}: {
  studyTitle: string;
  externalTitle: string;
  setExternalTitle: (v: string) => void;
  background: string;
  setBackground: (v: string) => void;
  studyGoals: string[];
  bringOwnParticipants: boolean;
  setBringOwnParticipants: (v: boolean) => void;
  survey: SurveyWithSections | null;
}) {
  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-4">
          <button className="p-1 text-gray-400 hover:text-gray-600">
            <UndoIcon className="w-5 h-5" />
          </button>
          <span className="text-sm text-gray-400">2 / 2</span>
          <button className="p-1 text-gray-400 hover:text-gray-600">
            <RedoIcon className="w-5 h-5" />
          </button>
        </div>
        <Button variant="outline" size="sm" className="gap-2">
          <ExportIcon className="w-4 h-4" />
          Export
        </Button>
      </div>

      {/* Content */}
      <div className="px-8 py-6 max-w-3xl">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">{studyTitle}</h1>

        {/* External Title */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-500 mb-2">External Title</label>
          <input
            type="text"
            value={externalTitle}
            onChange={(e) => setExternalTitle(e.target.value)}
            placeholder="Title shown to participants"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Background */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-500 mb-2">Background</label>
          <textarea
            value={background || survey?.description || ""}
            onChange={(e) => setBackground(e.target.value)}
            placeholder="Describe the context and purpose of this research..."
            rows={4}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* Study Goals */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-500 mb-2">Study Goals</label>
          <div className="space-y-2 text-gray-700">
            {studyGoals.length > 0 ? (
              studyGoals.map((goal, i) => (
                <p key={i}>• {goal}</p>
              ))
            ) : (
              <p className="text-gray-400 italic">Goals will be generated based on your research brief</p>
            )}
          </div>
        </div>

        {/* Audience */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-500 mb-2">Audience</label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={bringOwnParticipants}
              onChange={(e) => setBringOwnParticipants(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-gray-700">I&apos;ll bring my own participants</span>
          </label>
        </div>
      </div>
    </div>
  );
}

// Edit Tab - Interview Questions
function EditTabContent({
  survey,
  audioEnabled,
  setAudioEnabled,
  onExport,
}: {
  survey: SurveyWithSections | null;
  audioEnabled: boolean;
  setAudioEnabled: (v: boolean) => void;
  onExport: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-4">
          <button className="p-1 text-gray-400 hover:text-gray-600">
            <UndoIcon className="w-5 h-5" />
          </button>
          <span className="text-sm text-gray-400">2 / 2</span>
          <button className="p-1 text-gray-400 hover:text-gray-600">
            <RedoIcon className="w-5 h-5" />
          </button>
        </div>
        <h1 className="text-xl font-semibold text-gray-900">Interview Questions</h1>
        <Button onClick={onExport} variant="outline" size="sm" className="gap-2">
          <ExportIcon className="w-4 h-4" />
          Export
        </Button>
      </div>

      {/* Audio Toggle */}
      <div className="px-6 py-3 border-b border-gray-100">
        <button
          onClick={() => setAudioEnabled(!audioEnabled)}
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors ${
            audioEnabled
              ? "bg-blue-100 text-blue-700"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          <AudioIcon className="w-4 h-4" />
          Audio
        </button>
      </div>

      {/* Questions Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {!survey || survey.sections.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <DocumentIcon className="w-8 h-8 text-gray-300" />
            </div>
            <p>Your interview questions will appear here</p>
            <p className="text-sm mt-2">Start by describing your research goals</p>
          </div>
        ) : (
          <div className="max-w-2xl space-y-8">
            {/* Welcome Section */}
            <div>
              <div className="text-sm font-medium text-gray-500 mb-3">Start</div>
              <div className="text-lg text-gray-500 mb-2">Welcome message</div>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <p className="text-gray-700">
                  {survey.settings?.welcome?.message ||
                    "Thank you for participating in this research. We're interested in hearing about your experiences. Please share your honest thoughts — there are no right or wrong answers."}
                </p>
              </div>
            </div>

            {/* Sections */}
            {survey.sections
              .filter(section => section.title !== "Welcome")
              .map((section, sectionIndex) => (
                <div key={section.id}>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-sm font-medium text-gray-500">
                      Section {sectionIndex + 1}
                    </span>
                    <span className="text-sm text-gray-400">{section.title}</span>
                  </div>

                  <div className="space-y-6">
                    {section.questions?.map((question, qIndex) => (
                      <div key={question.id} className="flex gap-4">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                          <span className="text-sm text-gray-500">{qIndex + 1}</span>
                        </div>
                        <div className="flex-1">
                          <p className="text-gray-900 mb-3">{question.text}</p>

                          {question.type === "multiple_choice" &&
                            isMultipleChoiceSettings(question.settings) && (
                              <div className="space-y-2 ml-1">
                                {question.settings.options.map((option) => (
                                  <label key={option.id} className="flex items-center gap-3">
                                    <span className="w-4 h-4 rounded-full border-2 border-gray-300" />
                                    <span className="text-gray-600">{option.text}</span>
                                  </label>
                                ))}
                              </div>
                            )}

                          {question.type === "open_ended" && (
                            <div className="mt-2">
                              {isOpenEndedSettings(question.settings) &&
                                question.settings.followUpMode !== "none" && (
                                  <span className="inline-flex items-center gap-1 text-sm text-blue-600">
                                    <FollowUpIcon className="w-4 h-4" />
                                    Follow-up on short answers
                                  </span>
                                )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Launch Tab
function LaunchTabContent() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <RocketIcon className="w-8 h-8 text-gray-400" />
        </div>
        <h2 className="text-xl font-medium text-gray-900 mb-2">Ready to launch?</h2>
        <p className="text-gray-500 max-w-md">
          Review your study in the Create and Edit tabs, then come back here to launch.
        </p>
      </div>
    </div>
  );
}

// Suggestion Item Component
function SuggestionItem({ text }: { text: string }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <button
      onClick={() => setIsExpanded(!isExpanded)}
      className="w-full flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors text-left"
    >
      <span className="text-sm text-gray-700">{text}</span>
      <ChevronIcon className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
    </button>
  );
}

// Icons
function LogoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
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

function UserPlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
    </svg>
  );
}

function UndoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
    </svg>
  );
}

function RedoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 10H11a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
    </svg>
  );
}

function ExportIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  );
}

function AudioIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
  );
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function FollowUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

function RocketIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}
