import Head from "next/head";
import { useRouter } from "next/router";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import VoiceRecorder from "@/components/SurveyTake/VoiceRecorder";
import FollowupChat from "@/components/SurveyTake/FollowupChat";
import type { QuestionType, QuestionSettings, SurveySettings } from "@/types/surveyBuilder";
import { isMultipleChoiceSettings, isOpenEndedSettings, isStatementSettings } from "@/types/surveyBuilder";

interface FollowupQuestion {
  id: string;
  questionText: string;
}

interface TakeQuestion {
  id: string;
  sectionId: string;
  sectionTitle: string;
  type: QuestionType;
  text: string;
  description?: string;
  settings?: QuestionSettings;
}

interface TakeSurvey {
  id: string;
  title: string;
  description?: string;
  status: string;
  version: number;
  settings?: SurveySettings;
}

export default function TakeSurveyPage() {
  const router = useRouter();
  const { id: surveyId, preview } = router.query;

  const [survey, setSurvey] = useState<TakeSurvey | null>(null);
  const [questions, setQuestions] = useState<TakeQuestion[]>([]);
  const [responseId, setResponseId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(-1); // -1 = welcome screen
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedChoices, setSelectedChoices] = useState<string[]>([]);
  const [textResponse, setTextResponse] = useState("");
  const [currentFollowup, setCurrentFollowup] = useState<FollowupQuestion | null>(null);
  const [lastAnswerId, setLastAnswerId] = useState<string | null>(null);

  const isPreview = preview === "true";
  const currentQuestion = currentIndex >= 0 ? questions[currentIndex] : null;
  const progress = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;

  const fetchSurvey = useCallback(async () => {
    if (!surveyId || typeof surveyId !== "string") return;

    try {
      const res = await fetch(`/api/surveys/${surveyId}/take`);
      if (!res.ok) {
        router.push("/surveys");
        return;
      }
      const data = await res.json();
      setSurvey(data.survey);
      setQuestions(data.questions);
    } catch (error) {
      console.error("Failed to fetch survey", error);
    } finally {
      setLoading(false);
    }
  }, [surveyId, router]);

  useEffect(() => {
    fetchSurvey();
  }, [fetchSurvey]);

  const startSurvey = async () => {
    if (!survey || isPreview) {
      setCurrentIndex(0);
      return;
    }

    try {
      const res = await fetch(`/api/surveys/${survey.id}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      setResponseId(data.response.id);
      setCurrentIndex(0);
    } catch (error) {
      console.error("Failed to start survey", error);
    }
  };

  const submitAnswer = async () => {
    if (!currentQuestion || isPreview) {
      goToNext();
      return;
    }

    if (!responseId) {
      goToNext();
      return;
    }

    setSubmitting(true);

    try {
      let answerType: string;
      let answerData: Record<string, unknown> = {};

      if (currentQuestion.type === "multiple_choice") {
        answerType = "choice";
        answerData = { choiceIds: selectedChoices };
      } else if (currentQuestion.type === "open_ended") {
        answerType = "text";
        answerData = { textValue: textResponse };
      } else {
        // Statement - no answer needed
        goToNext();
        return;
      }

      await fetch(`/api/surveys/${survey?.id}/responses/${responseId}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: currentQuestion.id,
          answerType,
          ...answerData,
        }),
      });

      goToNext();
    } catch (error) {
      console.error("Failed to submit answer", error);
    } finally {
      setSubmitting(false);
    }
  };

  const goToNext = () => {
    // Reset state
    setSelectedChoices([]);
    setTextResponse("");
    setCurrentFollowup(null);
    setLastAnswerId(null);

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      completeSurvey();
    }
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setSelectedChoices([]);
      setTextResponse("");
      setCurrentFollowup(null);
      setLastAnswerId(null);
    } else if (currentIndex === 0) {
      setCurrentIndex(-1);
    }
  };

  const generateFollowup = async (answerId: string, questionId: string, responseText: string): Promise<boolean> => {
    if (isPreview || !survey) return false;

    // Check if the question has follow-ups enabled
    const question = questions.find(q => q.id === questionId);
    if (!question) return false;

    const settings = question.settings;
    if (!isOpenEndedSettings(settings) || settings.followUpMode === "none") {
      return false;
    }

    // For "if_short" mode, only generate follow-up if response is short (under 50 words)
    if (settings.followUpMode === "if_short") {
      const wordCount = responseText.trim().split(/\s+/).length;
      if (wordCount >= 50) {
        return false;
      }
    }

    try {
      const res = await fetch(`/api/surveys/${survey.id}/generate-followup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answerId,
          questionId,
          responseText,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.followup) {
          setCurrentFollowup(data.followup);
          setLastAnswerId(answerId);
          return true;
        }
      }
    } catch (error) {
      console.error("Failed to generate follow-up:", error);
    }
    return false;
  };

  const handleFollowupComplete = () => {
    setCurrentFollowup(null);
    setLastAnswerId(null);
    goToNext();
  };

  const handleFollowupSkip = () => {
    setCurrentFollowup(null);
    setLastAnswerId(null);
    goToNext();
  };

  const completeSurvey = async () => {
    if (responseId && !isPreview) {
      try {
        await fetch(`/api/surveys/${survey?.id}/responses/${responseId}/complete`, {
          method: "POST",
        });
      } catch (error) {
        console.error("Failed to complete survey", error);
      }
    }
    // Show completion screen
    setCurrentIndex(questions.length);
  };

  const toggleChoice = (choiceId: string) => {
    const settings = currentQuestion?.settings;
    if (!isMultipleChoiceSettings(settings)) return;

    if (settings.selectionMode === "single") {
      setSelectedChoices([choiceId]);
    } else {
      setSelectedChoices((prev) =>
        prev.includes(choiceId)
          ? prev.filter((id) => id !== choiceId)
          : [...prev, choiceId]
      );
    }
  };

  const handleVoiceRecordingComplete = async (audioBlob: Blob, transcript?: string) => {
    if (!currentQuestion || isPreview) {
      goToNext();
      return;
    }

    if (!responseId) {
      goToNext();
      return;
    }

    setSubmitting(true);

    try {
      // Upload the audio and get the URL
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");

      const uploadRes = await fetch("/api/upload-voice", {
        method: "POST",
        body: formData,
      });

      let voiceUrl = "";
      let finalTranscript = transcript || "";

      if (uploadRes.ok) {
        const uploadData = await uploadRes.json();
        voiceUrl = uploadData.url;
        finalTranscript = uploadData.transcript || finalTranscript;
      }

      // Submit the voice answer
      const answerRes = await fetch(`/api/surveys/${survey?.id}/responses/${responseId}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: currentQuestion.id,
          answerType: "voice",
          voiceUrl,
          textValue: finalTranscript,
        }),
      });

      // Try to generate a follow-up question
      if (answerRes.ok && finalTranscript) {
        const answerData = await answerRes.json();
        if (answerData.answer?.id) {
          const hasFollowup = await generateFollowup(answerData.answer.id, currentQuestion.id, finalTranscript);
          // If a follow-up was generated, it will be shown
          // Otherwise, proceed to the next question
          if (!hasFollowup) {
            goToNext();
          }
          return;
        }
      }

      goToNext();
    } catch (error) {
      console.error("Failed to submit voice answer", error);
      goToNext();
    } finally {
      setSubmitting(false);
    }
  };

  const handleTextSubmit = async (text: string) => {
    if (!currentQuestion || isPreview) {
      goToNext();
      return;
    }

    if (!responseId) {
      goToNext();
      return;
    }

    setSubmitting(true);

    try {
      const answerRes = await fetch(`/api/surveys/${survey?.id}/responses/${responseId}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: currentQuestion.id,
          answerType: "text",
          textValue: text,
        }),
      });

      // Try to generate a follow-up question
      if (answerRes.ok && text.trim()) {
        const answerData = await answerRes.json();
        if (answerData.answer?.id) {
          const hasFollowup = await generateFollowup(answerData.answer.id, currentQuestion.id, text);
          // If a follow-up was generated, it will be shown
          // Otherwise, proceed to the next question
          if (!hasFollowup) {
            goToNext();
          }
          return;
        }
      }

      goToNext();
    } catch (error) {
      console.error("Failed to submit text answer", error);
      goToNext();
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkipQuestion = () => {
    goToNext();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-500">Loading survey...</div>
      </div>
    );
  }

  if (!survey) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Head>
        <title>{survey.title}</title>
        <meta name="description" content={survey.description || "Take this survey"} />
      </Head>

      {/* Progress Bar */}
      <div className="h-1 bg-gray-100">
        <div
          className="h-full bg-blue-500 transition-all duration-300"
          style={{ width: `${Math.max(progress, 5)}%` }}
        />
      </div>

      {/* Preview Banner */}
      {isPreview && survey.status !== "published" && (
        <div className="bg-orange-50 border-b border-orange-200 px-4 py-2 text-center">
          <span className="text-orange-600 text-sm">
            Showing Draft Preview - This is not the version currently shown to respondents
          </span>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-xl">
          {/* Welcome Screen */}
          {currentIndex === -1 && (
            <div className="text-center space-y-6">
              <h1 className="text-2xl font-semibold text-gray-900">
                {survey.settings?.welcome?.title || "Welcome to this interview"}
              </h1>
              <p className="text-gray-600">
                {survey.settings?.welcome?.message ||
                  "Thank you for participating. Please share your honest thoughts."}
              </p>
              <Button size="lg" onClick={startSurvey} className="w-full max-w-xs">
                Start Interview
              </Button>
            </div>
          )}

          {/* Questions */}
          {currentQuestion && (
            <div className="space-y-8">
              <h2 className="text-xl font-medium text-gray-900 leading-relaxed">
                {currentQuestion.text}
              </h2>

              {/* Multiple Choice */}
              {currentQuestion.type === "multiple_choice" &&
                isMultipleChoiceSettings(currentQuestion.settings) && (
                  <div className="space-y-3">
                    {currentQuestion.settings.options.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => toggleChoice(option.id)}
                        className={`w-full px-4 py-3 text-left rounded-lg border-2 transition-colors ${
                          selectedChoices.includes(option.id)
                            ? "bg-blue-50 border-blue-500 text-blue-700"
                            : "bg-white border-gray-200 text-gray-700 hover:border-gray-300"
                        }`}
                      >
                        {option.text}
                      </button>
                    ))}
                  </div>
                )}

              {/* Open Ended */}
              {currentQuestion.type === "open_ended" &&
                isOpenEndedSettings(currentQuestion.settings) && (
                  <>
                    {/* Show VoiceRecorder when no follow-up is active */}
                    {!currentFollowup && (
                      <VoiceRecorder
                        onRecordingComplete={handleVoiceRecordingComplete}
                        onSkip={handleSkipQuestion}
                        onTextSubmit={handleTextSubmit}
                        maxDurationSeconds={currentQuestion.settings.maxDurationSeconds}
                        showTextFallback={currentQuestion.settings.allowText !== false}
                      />
                    )}

                    {/* Show FollowupChat when a follow-up question has been generated */}
                    {currentFollowup && responseId && (
                      <FollowupChat
                        followupId={currentFollowup.id}
                        questionText={currentFollowup.questionText}
                        surveyId={survey.id}
                        responseId={responseId}
                        onComplete={handleFollowupComplete}
                        onSkip={handleFollowupSkip}
                        allowVoice={currentQuestion.settings.allowVoice !== false}
                      />
                    )}
                  </>
                )}

              {/* Statement */}
              {currentQuestion.type === "statement" &&
                isStatementSettings(currentQuestion.settings) && (
                  <Button size="lg" onClick={submitAnswer} className="w-full">
                    {currentQuestion.settings.continueButtonText || "Continue"}
                  </Button>
                )}

              {/* Submit Button (for multiple choice only - open-ended has its own submit) */}
              {currentQuestion.type === "multiple_choice" && (
                <div className="pt-4">
                  <Button
                    size="lg"
                    onClick={submitAnswer}
                    disabled={submitting || selectedChoices.length === 0}
                    className="w-full"
                  >
                    {submitting ? "Submitting..." : "Continue"}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Completion Screen */}
          {currentIndex === questions.length && (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <CheckIcon className="w-8 h-8 text-green-600" />
              </div>
              <h1 className="text-2xl font-semibold text-gray-900">
                Thank you!
              </h1>
              <p className="text-gray-600">
                Your responses have been recorded. We appreciate your time.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Navigation Footer */}
      <footer className="border-t border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded text-sm text-gray-500">
          runs on <span className="font-semibold text-blue-600">listen labs</span>
        </div>
        {currentIndex >= 0 && currentIndex < questions.length && (
          <div className="flex items-center gap-2">
            <button
              onClick={goToPrevious}
              className="p-2 text-gray-400 hover:text-gray-600"
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
            <span className="text-sm text-gray-500">
              {currentIndex + 1} / {questions.length}
            </span>
            <button
              onClick={goToNext}
              className="p-2 text-gray-400 hover:text-gray-600"
            >
              <ChevronRightIcon className="w-5 h-5" />
            </button>
          </div>
        )}
      </footer>
    </div>
  );
}

// Icons
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
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
