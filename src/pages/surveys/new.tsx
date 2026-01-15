import Head from "next/head";
import { useRouter } from "next/router";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import ChatWindow from "@/components/SurveyChat/ChatWindow";
import ChatInput from "@/components/SurveyChat/ChatInput";
import type { SurveyWithSections, SurveyQuestion } from "@/types/surveyBuilder";
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
  const [isSaved, setIsSaved] = useState(true);

  // Editable study metadata
  const [studyTitle, setStudyTitle] = useState("Untitled Study");

  // Edit tab state
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [previewQuestionIndex, setPreviewQuestionIndex] = useState(0);

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
        if (data.survey.title) setStudyTitle(data.survey.title);
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

  const handleOpenPreview = () => {
    if (surveyId) {
      window.open(`/surveys/${surveyId}/take?preview=true`, '_blank');
    }
  };

  const handleRunFromStart = () => {
    setPreviewQuestionIndex(0);
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
          <Button variant="outline" size="sm" className="gap-2 border-[#333] text-[#888] hover:text-white hover:border-[#444]">
            <UserPlusIcon className="w-4 h-4" />
            Invite
          </Button>
          <Button size="sm" onClick={handleGoToEditor}>
            Proceed to Editor
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* CREATE TAB */}
        {activeTab === "create" && (
          <>
            {/* Left: AI Chat */}
            <div className="w-[480px] flex flex-col border-r border-[#2a2a2a] bg-[#0a0a0a]">
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
                      <SuggestionItem text="Add pricing tier question before the value perception question" />
                      <SuggestionItem text="Add question about which sections they used most" />
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

            {/* Right: Create Content */}
            <div className="flex-1 flex flex-col bg-black overflow-hidden">
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
            <div className="w-[400px] flex flex-col border-r border-[#2a2a2a] bg-[#0a0a0a] overflow-y-auto">
              <QuestionEditorPanel
                survey={survey}
                selectedQuestionId={selectedQuestionId}
                onSelectQuestion={(id) => {
                  setSelectedQuestionId(id);
                  // Find index for preview
                  const idx = allQuestions.findIndex(q => q.id === id);
                  if (idx >= 0) setPreviewQuestionIndex(idx);
                }}
              />
            </div>

            {/* Right: Live Preview */}
            <div className="flex-1 flex flex-col bg-white overflow-hidden">
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
      <div className="flex items-center justify-end px-6 py-4 border-b border-[#2a2a2a]">
        <Button variant="outline" size="sm" className="gap-2 border-[#333] text-[#888] hover:text-white hover:border-[#444]">
          <ExportIcon className="w-4 h-4" />
          Export
        </Button>
      </div>

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
                      const isMultipleChoice =
                        question.type === "multiple_choice" && isMultipleChoiceSettings(question.settings);
                      const isOpenEnded =
                        question.type === "open_ended" && isOpenEndedSettings(question.settings);
                      const followUpMode = isOpenEnded ? question.settings.followUpMode : "none";
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

                          {isMultipleChoice && (
                            <ul className="space-y-2 text-sm text-[#bbb]">
                              {question.settings.options.map((option) => (
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
}: {
  survey: SurveyWithSections | null;
  selectedQuestionId: string | null;
  onSelectQuestion: (id: string) => void;
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
}: {
  section: SurveyWithSections["sections"][0];
  selectedQuestionId: string | null;
  onSelectQuestion: (id: string) => void;
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
}: {
  question: SurveyQuestion;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleClick = () => {
    onSelect();
    setIsExpanded(!isExpanded);
  };

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
            <select className="w-full px-3 py-2 bg-[#111] border border-[#2a2a2a] rounded-lg text-white">
              <option value="multiple_choice">Multiple choice</option>
              <option value="open_ended">Open-ended</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-[#888] mb-1">Question</label>
            <textarea
              defaultValue={question.text}
              className="w-full px-3 py-2 bg-[#111] border border-[#2a2a2a] rounded-lg text-white resize-none"
              rows={2}
            />
          </div>

          {question.type === "multiple_choice" && isMultipleChoiceSettings(question.settings) && (
            <div>
              <label className="block text-sm text-[#888] mb-1">Options</label>
              <div className="space-y-2">
                {question.settings.options.map((option) => (
                  <div key={option.id} className="flex items-center gap-2">
                    <GripIcon className="w-4 h-4 text-[#666]" />
                    <input
                      type="text"
                      defaultValue={option.text}
                      className="flex-1 px-3 py-2 bg-[#111] border border-[#2a2a2a] rounded-lg text-white"
                    />
                    <TrashIcon className="w-4 h-4 text-[#666] hover:text-red-400 cursor-pointer" />
                  </div>
                ))}
                <button className="text-[#FF6B35] text-sm hover:underline">+ Add another option</button>
              </div>

              <div className="mt-4 space-y-3">
                <label className="flex items-center justify-between">
                  <span className="text-[#888]">Multi-select</span>
                  <ToggleSwitch />
                </label>
                <label className="flex items-center justify-between">
                  <span className="text-[#888]">Show &quot;Other&quot; option</span>
                  <ToggleSwitch />
                </label>
                <label className="flex items-center justify-between">
                  <span className="text-[#888]">Randomize order</span>
                  <ToggleSwitch />
                </label>
              </div>
            </div>
          )}

          {question.type === "open_ended" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[#888] mb-1">Follow-up questions</label>
                <select className="w-full px-3 py-2 bg-[#111] border border-[#2a2a2a] rounded-lg text-white">
                  <option value="none">None</option>
                  <option value="short">If short answer</option>
                  <option value="always">Always</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-[#888] mb-1">Preferred input type</label>
                <select className="w-full px-3 py-2 bg-[#111] border border-[#2a2a2a] rounded-lg text-white">
                  <option value="voice">Default (voice)</option>
                  <option value="text">Text</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-[#888] mb-1">Guidelines for follow-up questions</label>
                <input
                  type="text"
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
    <div className="flex-1 flex flex-col">
      {/* Preview Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onRunFromStart} className="gap-2">
            <PlayIcon className="w-4 h-4" />
            Run from start
          </Button>
          <Button variant="outline" size="sm" onClick={onOpenPreview} className="gap-2">
            <ExternalLinkIcon className="w-4 h-4" />
            Open preview
          </Button>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <DesktopIcon className="w-5 h-5 text-gray-400" />
            <MobileIcon className="w-5 h-5 text-gray-600" />
          </div>
          <span className="text-gray-500 text-sm">⏱ 13-18 min</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-1 bg-gray-100">
        <div
          className="h-full bg-blue-500 transition-all"
          style={{ width: totalQuestions > 0 ? `${((questionIndex + 1) / totalQuestions) * 100}%` : "0%" }}
        />
      </div>

      {/* Preview Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        {!question ? (
          <p className="text-gray-400">Select a question to preview</p>
        ) : (
          <div className="max-w-xl w-full text-center">
            <h2 className="text-2xl font-medium text-gray-900 mb-8">{question.text}</h2>

            {question.type === "multiple_choice" && isMultipleChoiceSettings(question.settings) && (
              <div className="flex flex-wrap justify-center gap-3">
                {question.settings.options.map((option) => (
                  <button
                    key={option.id}
                    className="px-6 py-3 border-2 border-blue-500 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    {option.text}
                  </button>
                ))}
              </div>
            )}

            {question.type === "open_ended" && (
              <div className="flex flex-col items-center">
                <button className="w-24 h-24 rounded-full bg-blue-100 flex items-center justify-center mb-4 hover:bg-blue-200 transition-colors">
                  <MicIcon className="w-10 h-10 text-blue-600" />
                </button>
                <span className="text-blue-600 font-medium">Start Recording</span>
                <button className="mt-4 text-gray-500 underline">Skip question</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
        <span className="text-sm text-gray-400">runs on <span className="font-semibold text-blue-600">listen labs</span></span>
        <div className="flex items-center gap-2">
          <button
            onClick={onPrevQuestion}
            disabled={questionIndex <= 0}
            className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <ChevronLeftIcon className="w-5 h-5 text-gray-600" />
          </button>
          <button
            onClick={onNextQuestion}
            disabled={questionIndex >= totalQuestions - 1}
            className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <ChevronRightIcon className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Toggle Switch Component
function ToggleSwitch() {
  const [isOn, setIsOn] = useState(false);
  return (
    <button
      onClick={() => setIsOn(!isOn)}
      className={`w-10 h-6 rounded-full transition-colors ${isOn ? "bg-[#FF6B35]" : "bg-[#333]"}`}
    >
      <div className={`w-4 h-4 rounded-full bg-white transform transition-transform mx-1 ${isOn ? "translate-x-4" : ""}`} />
    </button>
  );
}

// Suggestion Item Component
function SuggestionItem({ text }: { text: string }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <button
      onClick={() => setIsExpanded(!isExpanded)}
      className="w-full flex items-center justify-between p-3 bg-[#111] border border-[#2a2a2a] rounded-lg hover:border-[#333] transition-colors text-left"
    >
      <span className="text-sm text-[#ccc]">{text}</span>
      <ChevronIcon className={`w-4 h-4 text-[#666] transition-transform ${isExpanded ? "rotate-180" : ""}`} />
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

function ExportIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
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
