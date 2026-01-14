import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import SectionBlock from "./SectionBlock";
import QuestionEditor from "./QuestionEditor";
import PreviewPane from "./PreviewPane";
import type {
  SurveyWithSections,
  SurveySection,
  SurveyQuestion,
  QuestionType,
} from "@/types/surveyBuilder";

interface SurveyBuilderProps {
  survey: SurveyWithSections;
  onUpdate: () => void;
}

export default function SurveyBuilder({ survey, onUpdate }: SurveyBuilderProps) {
  const [selectedQuestion, setSelectedQuestion] = useState<SurveyQuestion | null>(null);
  const [previewQuestionIndex, setPreviewQuestionIndex] = useState(0);

  // Flatten all questions for preview navigation
  const allQuestions = survey.sections.flatMap((s) => s.questions);

  const handleAddSection = async () => {
    try {
      await fetch(`/api/surveys/${survey.id}/sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surveyId: survey.id,
          title: `Section ${survey.sections.length}`,
        }),
      });
      onUpdate();
    } catch (error) {
      console.error("Failed to add section", error);
    }
  };

  const handleAddQuestion = async (sectionId: string, type: QuestionType = "open_ended") => {
    try {
      const res = await fetch(`/api/surveys/${survey.id}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionId,
          type,
          text: type === "statement" ? "Enter your statement here" : "Enter your question here",
        }),
      });
      const data = await res.json();
      onUpdate();
      if (data.question) {
        setSelectedQuestion(data.question);
      }
    } catch (error) {
      console.error("Failed to add question", error);
    }
  };

  const handleUpdateQuestion = async (questionId: string, updates: Partial<SurveyQuestion>) => {
    try {
      await fetch(`/api/surveys/${survey.id}/questions?questionId=${questionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      onUpdate();
      // Update selected question if it's the one being updated
      if (selectedQuestion?.id === questionId) {
        setSelectedQuestion((prev) => prev ? { ...prev, ...updates } : null);
      }
    } catch (error) {
      console.error("Failed to update question", error);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    try {
      await fetch(`/api/surveys/${survey.id}/questions?questionId=${questionId}`, {
        method: "DELETE",
      });
      onUpdate();
      if (selectedQuestion?.id === questionId) {
        setSelectedQuestion(null);
      }
    } catch (error) {
      console.error("Failed to delete question", error);
    }
  };

  const handleUpdateSection = async (sectionId: string, updates: Partial<SurveySection>) => {
    try {
      await fetch(`/api/surveys/${survey.id}/sections?sectionId=${sectionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      onUpdate();
    } catch (error) {
      console.error("Failed to update section", error);
    }
  };

  const handleDeleteSection = async (sectionId: string) => {
    try {
      await fetch(`/api/surveys/${survey.id}/sections?sectionId=${sectionId}`, {
        method: "DELETE",
      });
      onUpdate();
    } catch (error) {
      console.error("Failed to delete section", error);
    }
  };

  return (
    <div className="flex h-[calc(100vh-56px)]">
      {/* Left Panel: Builder */}
      <div className="w-1/2 border-r border-[#2a2a2a] overflow-y-auto">
        <div className="p-6 space-y-4">
          {/* Welcome Settings (first section) */}
          {survey.sections.length > 0 && survey.sections[0].title === "Welcome" && (
            <WelcomeEditor
              settings={survey.settings?.welcome}
              onUpdate={(welcome) => {
                // Update survey settings
                fetch(`/api/surveys/${survey.id}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    settings: { ...survey.settings, welcome },
                  }),
                }).then(() => onUpdate());
              }}
            />
          )}

          {/* Sections */}
          {survey.sections
            .filter((s) => s.title !== "Welcome")
            .map((section) => (
              <SectionBlock
                key={section.id}
                section={section}
                selectedQuestionId={selectedQuestion?.id}
                onSelectQuestion={setSelectedQuestion}
                onAddQuestion={(type) => handleAddQuestion(section.id, type)}
                onUpdateQuestion={handleUpdateQuestion}
                onDeleteQuestion={handleDeleteQuestion}
                onUpdateSection={handleUpdateSection}
                onDeleteSection={handleDeleteSection}
              />
            ))}

          {/* Add Section Button */}
          <Button
            variant="outline"
            onClick={handleAddSection}
            className="w-full border-dashed border-[#333] text-[#888] hover:text-white hover:border-[#444]"
          >
            <PlusIcon className="w-4 h-4" />
            Add Section
          </Button>
        </div>
      </div>

      {/* Right Panel: Preview or Editor */}
      <div className="w-1/2 bg-[#0a0a0a] overflow-y-auto">
        {selectedQuestion ? (
          <QuestionEditor
            question={selectedQuestion}
            onUpdate={(updates) => handleUpdateQuestion(selectedQuestion.id, updates)}
            onClose={() => setSelectedQuestion(null)}
          />
        ) : (
          <PreviewPane
            survey={survey}
            currentQuestionIndex={previewQuestionIndex}
            onNavigate={setPreviewQuestionIndex}
          />
        )}
      </div>
    </div>
  );
}

// Welcome Editor Component
interface WelcomeEditorProps {
  settings?: {
    title: string;
    message: string;
    showConsentCheckbox: boolean;
    consentText?: string;
  };
  onUpdate: (settings: {
    title: string;
    message: string;
    showConsentCheckbox: boolean;
    consentText?: string;
  }) => void;
}

function WelcomeEditor({ settings, onUpdate }: WelcomeEditorProps) {
  const [title, setTitle] = useState(settings?.title || "Welcome to this interview");
  const [message, setMessage] = useState(settings?.message || "");
  const [showConsent, setShowConsent] = useState(settings?.showConsentCheckbox || false);

  const handleBlur = () => {
    onUpdate({
      title,
      message,
      showConsentCheckbox: showConsent,
    });
  };

  return (
    <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-4 space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded bg-[#FF6B35]/20 flex items-center justify-center">
          <span className="text-[#FF6B35] text-xs font-bold">W</span>
        </div>
        <span className="text-white font-medium">Welcome Screen</span>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-[#888] uppercase tracking-wider">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleBlur}
            className="w-full mt-1 px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded text-white text-sm"
            placeholder="Welcome to this interview"
          />
        </div>
        <div>
          <label className="text-xs text-[#888] uppercase tracking-wider">Welcome Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onBlur={handleBlur}
            rows={3}
            className="w-full mt-1 px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded text-white text-sm resize-none"
            placeholder="Thank you for participating..."
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showConsent}
            onChange={(e) => {
              setShowConsent(e.target.checked);
              onUpdate({
                title,
                message,
                showConsentCheckbox: e.target.checked,
              });
            }}
            className="rounded border-[#333] bg-[#0a0a0a]"
          />
          <label className="text-sm text-[#888]">Show consent checkbox</label>
        </div>
      </div>
    </div>
  );
}

// Icons
function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}
