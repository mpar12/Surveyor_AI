import Head from "next/head";
import { useRouter } from "next/router";
import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import ChatWindow from "@/components/SurveyChat/ChatWindow";
import ChatInput from "@/components/SurveyChat/ChatInput";
import type { SurveyWithSections, SurveyQuestion, QuestionType, QuestionSettings } from "@/types/surveyBuilder";
import {
  isMultipleChoiceSettings,
  isOpenEndedSettings,
  getDefaultSettingsForType,
  defaultMultipleChoiceSettings,
  defaultOpenEndedSettings,
} from "@/types/surveyBuilder";

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
  const [isSaved, setIsSaved] = useState(true);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const titleSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Editable study metadata
  const [studyTitle, setStudyTitle] = useState("Untitled Study");

  // Edit tab state
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [previewQuestionIndex, setPreviewQuestionIndex] = useState(0);
  const editQuestionListRef = useRef<HTMLDivElement | null>(null);

  // Create survey on mount (or load existing survey from query)
  useEffect(() => {
    if (!router.isReady) return;

    const existingId = typeof router.query.id === "string" ? router.query.id : null;
    if (existingId) {
      setSurveyId(existingId);
      setIsCreating(false);
      return;
    }

    createSurvey();
  }, [router.isReady, router.query.id]);

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
        if (data.survey.title) setStudyTitle(data.survey.title);
        const settings = data.survey.settings || {};
        const nextSuggestions = Array.isArray(settings.suggestions)
          ? settings.suggestions.filter((item: unknown) => typeof item === "string" && item.trim())
          : [];
        setSuggestions(nextSuggestions);
        const hasQuestions = Array.isArray(data.survey.sections)
          ? data.survey.sections.some(
              (section: SurveyWithSections["sections"][0]) =>
                section.title !== "Welcome" && section.questions?.length > 0
            )
          : false;
        setSurveyGenerated(hasQuestions);
      }
    } catch (error) {
      console.error("Failed to fetch survey", error);
    }
  }, [surveyId]);

  const saveSurveyTitle = useCallback(
    async (nextTitle: string) => {
      if (!surveyId) return;
      try {
        const res = await fetch(`/api/surveys/${surveyId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: nextTitle }),
        });
        if (!res.ok) throw new Error("Failed to update survey title");
        const data = await res.json();
        setSurvey((prev) => (prev ? { ...prev, title: data.survey?.title ?? nextTitle } : prev));
        setIsSaved(true);
      } catch (error) {
        console.error("Failed to save survey title", error);
      }
    },
    [surveyId]
  );

  useEffect(() => {
    if (!surveyId) return;
    const trimmedTitle = studyTitle.trim();
    const existingTitle = survey?.title ?? "";

    if (!trimmedTitle || trimmedTitle === existingTitle) {
      setIsSaved(true);
      return;
    }

    setIsSaved(false);
    if (titleSaveTimeoutRef.current) {
      clearTimeout(titleSaveTimeoutRef.current);
    }

    titleSaveTimeoutRef.current = setTimeout(() => {
      saveSurveyTitle(trimmedTitle);
    }, 700);

    return () => {
      if (titleSaveTimeoutRef.current) {
        clearTimeout(titleSaveTimeoutRef.current);
      }
    };
  }, [studyTitle, survey?.title, surveyId, saveSurveyTitle]);

  const applyQuestionUpdate = useCallback(
    (questionId: string, updates: Partial<SurveyQuestion>) => {
      setSurvey((prev) => {
        if (!prev) return prev;
        const updatedSections = prev.sections.map((section) => ({
          ...section,
          questions: section.questions.map((question) =>
            question.id === questionId
              ? {
                  ...question,
                  ...updates,
                  settings: updates.settings ?? question.settings,
                }
              : question
          ),
        }));
        return { ...prev, sections: updatedSections };
      });
    },
    []
  );

  const updateQuestion = useCallback(
    async (questionId: string, updates: Partial<SurveyQuestion>) => {
      if (!surveyId) return;
      setIsSaved(false);
      applyQuestionUpdate(questionId, updates);

      try {
        const res = await fetch(`/api/surveys/${surveyId}/questions?questionId=${questionId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        if (!res.ok) throw new Error("Failed to update question");
        const data = await res.json();
        if (data.question) {
          applyQuestionUpdate(questionId, data.question);
        }
        setIsSaved(true);
      } catch (error) {
        console.error("Failed to update question", error);
      }
    },
    [applyQuestionUpdate, surveyId]
  );

  useEffect(() => {
    if (surveyId) {
      fetchSurvey();
    }
  }, [surveyId, fetchSurvey]);

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
    if (surveyGenerated) {
      setSuggestionsLoading(true);
    }

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

      if (Array.isArray(data.suggestions)) {
        const nextSuggestions = data.suggestions
          .map((item: unknown) => (typeof item === "string" ? item.trim() : ""))
          .filter(Boolean);
        setSuggestions(nextSuggestions);
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
      setSuggestionsLoading(false);
    }
  };

  const handleGoToEditor = () => {
    if (surveyId) {
      router.push(`/surveys/${surveyId}/edit`);
    }
  };

  const handleOpenPreview = () => {
    if (surveyId) {
      window.open(`/surveys/${surveyId}/take?preview=true`, '_blank');
    }
  };

  const handleRunFromStart = () => {
    setPreviewQuestionIndex(0);
    const firstQuestion = allQuestions[0];
    if (firstQuestion) {
      setSelectedQuestionId(firstQuestion.id);
    } else {
      setSelectedQuestionId(null);
    }
    if (editQuestionListRef.current) {
      editQuestionListRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Get all questions flattened
  const getAllQuestions = (): SurveyQuestion[] => {
    if (!survey) return [];
    return survey.sections.flatMap(s => s.questions || []);
  };

  const allQuestions = getAllQuestions();
  const currentPreviewQuestion = allQuestions[previewQuestionIndex];

  return (
    <div className="min-h-screen w-full bg-black flex flex-col">
      <Head>
        <title>{studyTitle} | Surveyor</title>
        <meta name="description" content="Create a new survey with AI assistance" />
      </Head>

      {/* Top Header */}
      <header className="flex items-center justify-between px-4 h-14 border-b border-[#2a2a2a] bg-black z-10">
        {/* Left: Logo and Title */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/surveys")}
            className="p-1 text-[#888] hover:text-white transition-colors"
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
            className="text-lg font-medium text-white bg-transparent border-none outline-none focus:ring-0"
            placeholder="Study name"
          />
        </div>

        {/* Center: Tabs */}
        <div className="flex items-center">
          <nav className="flex items-center gap-1 bg-[#1a1a1a] rounded-lg p-1">
            {(["create", "edit", "launch"] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${
                  activeTab === tab
                    ? "bg-[#2a2a2a] text-white"
                    : "text-[#888] hover:text-white"
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          <span className={`text-sm flex items-center gap-1 ${isSaved ? "text-[#888]" : "text-yellow-500"}`}>
            {isSaved ? (
              <>
                <CheckIcon className="w-4 h-4" />
                Saved
              </>
            ) : (
              "Saving..."
            )}
          </span>
          <Button size="sm" onClick={handleGoToEditor}>
            Proceed to Editor
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* CREATE TAB */}
        {activeTab === "create" && (
          <>
            {/* Left: AI Chat */}
            <div className="w-[480px] flex flex-col border-r border-[#2a2a2a] bg-[#0a0a0a] min-h-0">
              <div className="px-4 py-3 border-b border-[#2a2a2a]">
                <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                  surveyGenerated
                    ? "bg-green-500/10 text-green-400"
                    : isCreating
                      ? "bg-yellow-500/10 text-yellow-400"
                      : "bg-[#1a1a1a] text-[#888]"
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    surveyGenerated ? "bg-green-500" : isCreating ? "bg-yellow-500 animate-pulse" : "bg-[#666]"
                  }`} />
                  {surveyGenerated ? "Loaded study guide" : isCreating ? "Initializing..." : "No study guide yet"}
                </span>
              </div>

              {createError ? (
                <div className="flex-1 flex items-center justify-center p-8">
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                      <span className="text-red-400 text-2xl">!</span>
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
                  {surveyGenerated && (
                    <div className="border-t border-[#2a2a2a] p-4 space-y-2">
                      <h4 className="text-sm font-medium text-[#888]">Suggestions</h4>
                      {suggestionsLoading ? (
                        <p className="text-xs text-[#666]">Generating suggestions...</p>
                      ) : suggestions.length > 0 ? (
                        suggestions.map((suggestion) => (
                          <SuggestionItem
                            key={suggestion}
                            text={suggestion}
                            onClick={() => handleSendMessage(suggestion)}
                          />
                        ))
                      ) : (
                        <p className="text-xs text-[#666]">No suggestions yet.</p>
                      )}
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

            {/* Right: Create Content */}
            <div className="flex-1 flex flex-col bg-black overflow-hidden min-h-0">
              <CreateTabContent
                studyTitle={studyTitle}
                survey={survey}
              />
            </div>
          </>
        )}

        {/* EDIT TAB */}
        {activeTab === "edit" && (
          <>
            {/* Left: Question Editor */}
            <div
              ref={editQuestionListRef}
              className="w-[400px] flex flex-col border-r border-[#2a2a2a] bg-[#0a0a0a] overflow-y-auto min-h-0"
            >
              <QuestionEditorPanel
                survey={survey}
                selectedQuestionId={selectedQuestionId}
                onSelectQuestion={(id) => {
                  setSelectedQuestionId(id);
                  // Find index for preview
                  const idx = allQuestions.findIndex(q => q.id === id);
                  if (idx >= 0) setPreviewQuestionIndex(idx);
                }}
                onUpdateQuestion={updateQuestion}
              />
            </div>

            {/* Right: Live Preview */}
            <div className="flex-1 flex flex-col bg-black overflow-hidden min-h-0">
              <LivePreviewPanel
                question={currentPreviewQuestion}
                questionIndex={previewQuestionIndex}
                totalQuestions={allQuestions.length}
                onRunFromStart={handleRunFromStart}
                onOpenPreview={handleOpenPreview}
                onPrevQuestion={() => setPreviewQuestionIndex(Math.max(0, previewQuestionIndex - 1))}
                onNextQuestion={() => setPreviewQuestionIndex(Math.min(allQuestions.length - 1, previewQuestionIndex + 1))}
              />
            </div>
          </>
        )}

        {/* LAUNCH TAB */}
        {activeTab === "launch" && (
          <div className="flex-1 flex items-center justify-center bg-black">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-[#1a1a1a] flex items-center justify-center mx-auto mb-4">
                <RocketIcon className="w-8 h-8 text-[#666]" />
              </div>
              <h2 className="text-xl font-medium text-white mb-2">Ready to launch?</h2>
              <p className="text-[#888] max-w-md">
                Review your study in the Create and Edit tabs, then come back here to launch.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Create Tab Content
function CreateTabContent({
  studyTitle,
  survey,
}: {
  studyTitle: string;
  survey: SurveyWithSections | null;
}) {
  const settings = survey?.settings;
  const externalTitle =
    typeof settings?.externalTitle === "string" && settings.externalTitle.trim()
      ? settings.externalTitle.trim()
      : studyTitle;
  const background = typeof survey?.description === "string" ? survey.description : "";
  const studyGoals = Array.isArray(settings?.studyGoals)
    ? settings.studyGoals.filter((goal) => typeof goal === "string" && goal.trim())
    : [];
  const bringOwnParticipants = settings?.audience?.bringOwnParticipants === true;
  const durationMinutes =
    typeof settings?.estimatedDurationMinutes === "number"
      ? settings.estimatedDurationMinutes
      : null;
  const durationLabel = durationMinutes
    ? `${Math.max(1, durationMinutes - 1)}-${durationMinutes + 2} min`
    : null;
  const welcomeTitle =
    typeof settings?.welcome?.title === "string" ? settings.welcome.title : "Welcome message";
  const welcomeMessage =
    typeof settings?.welcome?.message === "string" ? settings.welcome.message : "";
  const sections =
    survey?.sections?.filter((section) => section.title !== "Welcome") ?? [];
  let questionCounter = 0;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 max-w-3xl">
        <div className="flex items-center gap-3 mb-6">
          <h1 className="text-2xl font-semibold text-white">{studyTitle}</h1>
          {durationLabel && (
            <span className="text-xs px-2 py-1 rounded-full bg-[#1a1a1a] text-[#888]">
              {durationLabel}
            </span>
          )}
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-[#888] mb-2">External Title</label>
          <p className={`text-sm ${externalTitle ? "text-[#ccc]" : "text-[#666] italic"}`}>
            {externalTitle || "Title shown to participants"}
          </p>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-[#888] mb-2">Background</label>
          <p className={`text-sm ${background ? "text-[#ccc]" : "text-[#666] italic"}`}>
            {background || "Background will appear once the study guide is generated."}
          </p>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-[#888] mb-2">Study Goals</label>
          <div className="space-y-2 text-[#ccc]">
            {studyGoals.length > 0 ? (
              studyGoals.map((goal, i) => (
                <p key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-[#FF6B35]">•</span>
                  {goal}
                </p>
              ))
            ) : (
              <p className="text-sm text-[#666] italic">
                Goals will be generated based on your research brief.
              </p>
            )}
          </div>
        </div>

        <div className="mb-10">
          <label className="block text-sm font-medium text-[#888] mb-2">Audience</label>
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1a1a1a] text-sm text-[#ccc]">
            {bringOwnParticipants ? "I'll bring my own participants" : "Surveyor participants"}
          </span>
        </div>

        <div className="mb-4">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-lg font-semibold text-white">Interview Questions</h2>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#1a1a1a] text-xs text-[#888]">
              <MicIcon className="w-3 h-3" />
              Audio
            </span>
          </div>

          <div className="mb-8">
            <p className="text-xs uppercase tracking-wider text-[#666]">Start</p>
            <div className="mt-2 p-4 rounded-lg border border-[#2a2a2a] bg-[#0f0f0f]">
              <p className="text-sm text-[#ccc] font-medium mb-2">{welcomeTitle}</p>
              <p className={`text-sm ${welcomeMessage ? "text-[#aaa]" : "text-[#555] italic"}`}>
                {welcomeMessage || "Welcome message will appear here."}
              </p>
            </div>
          </div>

          {sections.length === 0 ? (
            <p className="text-sm text-[#666] italic">
              Questions will appear here once the study guide is generated.
            </p>
          ) : (
            <div className="space-y-8">
              {sections.map((section, sectionIndex) => (
                <div key={section.id} className="space-y-4">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-[#666]">
                      Section {sectionIndex + 1}
                    </p>
                    <h3 className="text-base font-semibold text-white">{section.title}</h3>
                  </div>
                  <div className="space-y-4">
                    {section.questions.map((question) => {
                      questionCounter += 1;
                      const multipleChoiceSettings = isMultipleChoiceSettings(question.settings)
                        ? question.settings
                        : null;
                      const openEndedSettings = isOpenEndedSettings(question.settings)
                        ? question.settings
                        : null;
                      const followUpMode = openEndedSettings?.followUpMode ?? "none";
                      const followUpLabel =
                        followUpMode === "if_short"
                          ? "Follow-up on short answers"
                          : followUpMode === "always"
                            ? "Always follow up"
                            : null;
                      const questionTypeLabel =
                        question.type === "multiple_choice"
                          ? "Multiple choice"
                          : question.type === "statement"
                            ? "Statement"
                            : "Open-ended";

                      return (
                        <div key={question.id} className="p-4 rounded-lg border border-[#2a2a2a] bg-[#0f0f0f]">
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-[#1a1a1a] text-[#888]">
                              Q{questionCounter}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-[#1a1a1a] text-[#888]">
                              {questionTypeLabel}
                            </span>
                            {followUpLabel && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-[#0f2b3a] text-[#8fd7ff]">
                                {followUpLabel}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-[#ddd] mb-3">{question.text}</p>

                          {multipleChoiceSettings && (
                            <ul className="space-y-2 text-sm text-[#bbb]">
                              {multipleChoiceSettings.options.map((option) => (
                                <li key={option.id} className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full border border-[#555]" />
                                  {option.text}
                                </li>
                              ))}
                            </ul>
                          )}

                          {question.type === "statement" && (
                            <p className="text-xs text-[#666]">Statement screen</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Question Editor Panel (LHS of Edit tab)
function QuestionEditorPanel({
  survey,
  selectedQuestionId,
  onSelectQuestion,
  onUpdateQuestion,
}: {
  survey: SurveyWithSections | null;
  selectedQuestionId: string | null;
  onSelectQuestion: (id: string) => void;
  onUpdateQuestion: (id: string, updates: Partial<SurveyQuestion>) => void;
}) {
  if (!survey || survey.sections.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-[#666]">
        <p>No questions yet. Create some in the Create tab.</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      {survey.sections
        .filter(section => section.title !== "Welcome")
        .map((section) => (
          <SectionEditor
            key={section.id}
            section={section}
            selectedQuestionId={selectedQuestionId}
            onSelectQuestion={onSelectQuestion}
            onUpdateQuestion={onUpdateQuestion}
          />
        ))}
      <button className="w-full mt-4 py-3 border border-dashed border-[#333] rounded-lg text-[#888] hover:border-[#444] hover:text-white transition-colors">
        + Add Question
      </button>
    </div>
  );
}

// Section Editor Component
function SectionEditor({
  section,
  selectedQuestionId,
  onSelectQuestion,
  onUpdateQuestion,
}: {
  section: SurveyWithSections["sections"][0];
  selectedQuestionId: string | null;
  onSelectQuestion: (id: string) => void;
  onUpdateQuestion: (id: string, updates: Partial<SurveyQuestion>) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between p-3 bg-[#111] border border-[#2a2a2a] rounded-t-lg">
        <div className="flex items-center gap-2">
          <MenuIcon className="w-4 h-4 text-[#666]" />
          <span className="text-white font-medium">{section.title.toUpperCase()}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[#666] text-sm">Questions {section.questions?.length || 0}</span>
          <button onClick={() => setIsExpanded(!isExpanded)} className="text-[#666] hover:text-white">
            <ChevronIcon className={`w-4 h-4 transition-transform ${isExpanded ? "" : "-rotate-90"}`} />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="border border-t-0 border-[#2a2a2a] rounded-b-lg divide-y divide-[#2a2a2a]">
          {section.questions?.map((question, idx) => (
            <QuestionEditor
              key={question.id}
              question={question}
              index={idx + 1}
              isSelected={selectedQuestionId === question.id}
              onSelect={() => onSelectQuestion(question.id)}
              onUpdateQuestion={onUpdateQuestion}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Question Editor Component
function QuestionEditor({
  question,
  index,
  isSelected,
  onSelect,
  onUpdateQuestion,
}: {
  question: SurveyQuestion;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onUpdateQuestion: (id: string, updates: Partial<SurveyQuestion>) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [draftText, setDraftText] = useState(question.text);
  const [draftType, setDraftType] = useState<QuestionType>(question.type as QuestionType);
  const [draftSettings, setDraftSettings] = useState<QuestionSettings | undefined>(question.settings);

  useEffect(() => {
    setDraftText(question.text);
    setDraftType(question.type as QuestionType);
    setDraftSettings(question.settings);
  }, [question.id, question.text, question.type, question.settings]);

  const handleClick = () => {
    onSelect();
    setIsExpanded(!isExpanded);
  };

  const handleTextBlur = () => {
    const trimmed = draftText.trim();
    if (trimmed && trimmed !== question.text) {
      onUpdateQuestion(question.id, { text: trimmed });
    }
  };

  const handleTypeChange = (value: string) => {
    const nextType = value as QuestionType;
    const nextSettings = getDefaultSettingsForType(nextType);
    setDraftType(nextType);
    setDraftSettings(nextSettings);
    onUpdateQuestion(question.id, { type: nextType, settings: nextSettings });
  };

  const multipleChoiceSettings = isMultipleChoiceSettings(draftSettings)
    ? draftSettings
    : defaultMultipleChoiceSettings;
  const openEndedSettings = isOpenEndedSettings(draftSettings)
    ? draftSettings
    : defaultOpenEndedSettings;

  return (
    <div className={`bg-[#0a0a0a] ${isSelected ? "ring-1 ring-[#FF6B35]" : ""}`}>
      <button
        onClick={handleClick}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-[#111] transition-colors"
      >
        <ChevronIcon className={`w-4 h-4 text-[#666] transition-transform ${isExpanded ? "rotate-180" : ""}`} />
        <span className="text-[#FF6B35] font-medium">Q{index}</span>
        <span className="text-white flex-1 truncate">{question.text}</span>
        <div className="flex items-center gap-1">
          <TrashIcon className="w-4 h-4 text-[#666] hover:text-red-400" />
          <CopyIcon className="w-4 h-4 text-[#666] hover:text-white" />
          <GripIcon className="w-4 h-4 text-[#666]" />
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          <div>
            <label className="block text-sm text-[#888] mb-1">Question type</label>
            <select
              value={draftType}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="w-full px-3 py-2 bg-[#111] border border-[#2a2a2a] rounded-lg text-white"
            >
              <option value="multiple_choice">Multiple choice</option>
              <option value="open_ended">Open-ended</option>
              <option value="statement">Statement</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-[#888] mb-1">Question</label>
            <textarea
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              onBlur={handleTextBlur}
              className="w-full px-3 py-2 bg-[#111] border border-[#2a2a2a] rounded-lg text-white resize-none"
              rows={2}
            />
          </div>

          {draftType === "multiple_choice" && (
            <div>
              <label className="block text-sm text-[#888] mb-1">Options</label>
              <div className="space-y-2">
                {multipleChoiceSettings.options.map((option, optionIndex) => (
                  <div key={option.id} className="flex items-center gap-2">
                    <GripIcon className="w-4 h-4 text-[#666]" />
                    <input
                      type="text"
                      value={option.text}
                      onChange={(e) => {
                        const updatedOptions = multipleChoiceSettings.options.map((entry, idx) =>
                          idx === optionIndex ? { ...entry, text: e.target.value } : entry
                        );
                        const nextSettings = { ...multipleChoiceSettings, options: updatedOptions };
                        setDraftSettings(nextSettings);
                      }}
                      onBlur={() => {
                        if (isMultipleChoiceSettings(draftSettings)) {
                          onUpdateQuestion(question.id, { settings: draftSettings });
                        } else {
                          onUpdateQuestion(question.id, { settings: multipleChoiceSettings });
                        }
                      }}
                      className="flex-1 px-3 py-2 bg-[#111] border border-[#2a2a2a] rounded-lg text-white"
                    />
                    <button
                      onClick={() => {
                        const updatedOptions = multipleChoiceSettings.options.filter(
                          (_, idx) => idx !== optionIndex
                        );
                        const nextSettings = { ...multipleChoiceSettings, options: updatedOptions };
                        setDraftSettings(nextSettings);
                        onUpdateQuestion(question.id, { settings: nextSettings });
                      }}
                      className="p-1 text-[#666] hover:text-red-400 transition-colors"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => {
                    const updatedOptions = [
                      ...multipleChoiceSettings.options,
                      { id: crypto.randomUUID(), text: `Option ${multipleChoiceSettings.options.length + 1}`, isOther: false },
                    ];
                    const nextSettings = { ...multipleChoiceSettings, options: updatedOptions };
                    setDraftSettings(nextSettings);
                    onUpdateQuestion(question.id, { settings: nextSettings });
                  }}
                  className="text-[#FF6B35] text-sm hover:underline"
                >
                  + Add another option
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <label className="flex items-center justify-between">
                  <span className="text-[#888]">Multi-select</span>
                  <ToggleSwitch
                    isOn={multipleChoiceSettings.selectionMode === "multiple"}
                    onToggle={(next) => {
                      const nextSettings = {
                        ...multipleChoiceSettings,
                        selectionMode: (next ? "multiple" : "single") as "multiple" | "single",
                      };
                      setDraftSettings(nextSettings);
                      onUpdateQuestion(question.id, { settings: nextSettings });
                    }}
                  />
                </label>
                <label className="flex items-center justify-between">
                  <span className="text-[#888]">Show &quot;Other&quot; option</span>
                  <ToggleSwitch
                    isOn={multipleChoiceSettings.allowOther}
                    onToggle={(next) => {
                      const nextSettings = { ...multipleChoiceSettings, allowOther: next };
                      setDraftSettings(nextSettings);
                      onUpdateQuestion(question.id, { settings: nextSettings });
                    }}
                  />
                </label>
                <label className="flex items-center justify-between">
                  <span className="text-[#888]">Randomize order</span>
                  <ToggleSwitch
                    isOn={multipleChoiceSettings.randomizeOrder}
                    onToggle={(next) => {
                      const nextSettings = { ...multipleChoiceSettings, randomizeOrder: next };
                      setDraftSettings(nextSettings);
                      onUpdateQuestion(question.id, { settings: nextSettings });
                    }}
                  />
                </label>
              </div>
            </div>
          )}

          {draftType === "open_ended" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[#888] mb-1">Follow-up questions</label>
                <select
                  value={openEndedSettings.followUpMode}
                  onChange={(e) => {
                    const baseSettings = isOpenEndedSettings(draftSettings)
                      ? draftSettings
                      : openEndedSettings;
                    const nextSettings = {
                      ...baseSettings,
                      followUpMode: e.target.value as "none" | "if_short" | "always",
                    };
                    setDraftSettings(nextSettings);
                    onUpdateQuestion(question.id, { settings: nextSettings });
                  }}
                  className="w-full px-3 py-2 bg-[#111] border border-[#2a2a2a] rounded-lg text-white"
                >
                  <option value="none">None</option>
                  <option value="if_short">If short answer</option>
                  <option value="always">Always</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-[#888] mb-1">Preferred input type</label>
                <select
                  value={openEndedSettings.preferredInput}
                  onChange={(e) => {
                    const baseSettings = isOpenEndedSettings(draftSettings)
                      ? draftSettings
                      : openEndedSettings;
                    const nextSettings = {
                      ...baseSettings,
                      preferredInput: e.target.value as "voice" | "text",
                    };
                    setDraftSettings(nextSettings);
                    onUpdateQuestion(question.id, { settings: nextSettings });
                  }}
                  className="w-full px-3 py-2 bg-[#111] border border-[#2a2a2a] rounded-lg text-white"
                >
                  <option value="voice">Default (voice)</option>
                  <option value="text">Text</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-[#888] mb-1">Guidelines for follow-up questions</label>
                <input
                  type="text"
                  value={openEndedSettings.followUpGuidelines ?? ""}
                  onChange={(e) => {
                    const baseSettings = isOpenEndedSettings(draftSettings)
                      ? draftSettings
                      : openEndedSettings;
                    const nextSettings = {
                      ...baseSettings,
                      followUpGuidelines: e.target.value,
                    };
                    setDraftSettings(nextSettings);
                  }}
                  onBlur={() => {
                    const nextSettings = isOpenEndedSettings(draftSettings)
                      ? draftSettings
                      : openEndedSettings;
                    onUpdateQuestion(question.id, { settings: nextSettings });
                  }}
                  placeholder="If they mention A, understand why."
                  className="w-full px-3 py-2 bg-[#111] border border-[#2a2a2a] rounded-lg text-white placeholder-[#666]"
                />
              </div>
            </div>
          )}

          <button className="w-full py-2 text-[#888] hover:text-white transition-colors">
            Show advanced settings
          </button>
        </div>
      )}
    </div>
  );
}

// Live Preview Panel (RHS of Edit tab)
function LivePreviewPanel({
  question,
  questionIndex,
  totalQuestions,
  onRunFromStart,
  onOpenPreview,
  onPrevQuestion,
  onNextQuestion,
}: {
  question: SurveyQuestion | undefined;
  questionIndex: number;
  totalQuestions: number;
  onRunFromStart: () => void;
  onOpenPreview: () => void;
  onPrevQuestion: () => void;
  onNextQuestion: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col bg-[#0a0a0a] text-white">
      {/* Preview Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a]">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRunFromStart}
            className="gap-2 border-[#333] text-[#a1a1a1] hover:text-white hover:border-[#444]"
          >
            <PlayIcon className="w-4 h-4" />
            Run from start
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenPreview}
            className="gap-2 border-[#333] text-[#a1a1a1] hover:text-white hover:border-[#444]"
          >
            <ExternalLinkIcon className="w-4 h-4" />
            Open preview
          </Button>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <DesktopIcon className="w-5 h-5 text-[#666]" />
            <MobileIcon className="w-5 h-5 text-[#888]" />
          </div>
          <span className="text-[#888] text-sm">⏱ 13-18 min</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-1 bg-[#1a1a1a]">
        <div
          className="h-full bg-[#FF6B35] transition-all"
          style={{ width: totalQuestions > 0 ? `${((questionIndex + 1) / totalQuestions) * 100}%` : "0%" }}
        />
      </div>

      {/* Preview Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        {!question ? (
          <p className="text-[#666]">Select a question to preview</p>
        ) : (
          <div className="max-w-xl w-full text-center">
            <h2 className="text-2xl font-medium text-white mb-8">{question.text}</h2>

            {question.type === "multiple_choice" && isMultipleChoiceSettings(question.settings) && (
              <div className="flex flex-wrap justify-center gap-3">
                {question.settings.options.map((option) => (
                  <button
                    key={option.id}
                    className="px-6 py-3 border-2 border-[#FF6B35] text-[#FF6B35] rounded-lg hover:bg-[#1f120c] transition-colors"
                  >
                    {option.text}
                  </button>
                ))}
              </div>
            )}

            {question.type === "open_ended" && (
              <div className="flex flex-col items-center">
                <button className="w-24 h-24 rounded-full bg-[#1f120c] flex items-center justify-center mb-4 hover:bg-[#2a1710] transition-colors">
                  <MicIcon className="w-10 h-10 text-[#FF6B35]" />
                </button>
                <span className="text-[#FF6B35] font-medium">Start Recording</span>
                <button className="mt-4 text-[#666] underline">Skip question</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-[#2a2a2a]">
        <span className="text-sm text-[#666]">runs on <span className="font-semibold text-[#FF6B35]">listen labs</span></span>
        <div className="flex items-center gap-2">
          <button
            onClick={onPrevQuestion}
            disabled={questionIndex <= 0}
            className="p-2 border border-[#333] rounded-lg hover:bg-[#111] disabled:opacity-50"
          >
            <ChevronLeftIcon className="w-5 h-5 text-[#888]" />
          </button>
          <button
            onClick={onNextQuestion}
            disabled={questionIndex >= totalQuestions - 1}
            className="p-2 border border-[#333] rounded-lg hover:bg-[#111] disabled:opacity-50"
          >
            <ChevronRightIcon className="w-5 h-5 text-[#888]" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Toggle Switch Component
function ToggleSwitch({ isOn, onToggle }: { isOn: boolean; onToggle: (next: boolean) => void }) {
  return (
    <button
      onClick={() => onToggle(!isOn)}
      className={`w-10 h-6 rounded-full transition-colors ${isOn ? "bg-[#FF6B35]" : "bg-[#333]"}`}
    >
      <div className={`w-4 h-4 rounded-full bg-white transform transition-transform mx-1 ${isOn ? "translate-x-4" : ""}`} />
    </button>
  );
}

// Suggestion Item Component
function SuggestionItem({ text, onClick }: { text: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between p-3 bg-[#111] border border-[#2a2a2a] rounded-lg hover:border-[#333] transition-colors text-left"
    >
      <span className="text-sm text-[#ccc]">{text}</span>
      <ChevronIcon className="w-4 h-4 text-[#666]" />
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

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
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

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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

function GripIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
    </svg>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  );
}

function DesktopIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function MobileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  );
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
  );
}
