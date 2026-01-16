import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { SurveyWithSections, SurveyQuestion } from "@/types/surveyBuilder";
import { isMultipleChoiceSettings, isOpenEndedSettings, isStatementSettings } from "@/types/surveyBuilder";

interface PreviewPaneProps {
  survey: SurveyWithSections;
  currentQuestionIndex: number;
  onNavigate: (index: number) => void;
}

export default function PreviewPane({ survey, currentQuestionIndex, onNavigate }: PreviewPaneProps) {
  // Flatten all questions
  const allQuestions = survey.sections.flatMap((s) => s.questions);
  const totalQuestions = allQuestions.length;
  const currentQuestion = allQuestions[currentQuestionIndex];

  // Show welcome screen if no questions or at start
  const showWelcome = totalQuestions === 0 || currentQuestionIndex < 0;

  return (
    <div className="h-full flex flex-col">
      {/* Preview Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a]">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="text-[#888] hover:text-white"
          >
            <PlayIcon className="w-4 h-4" />
            Run from start
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-[#888] hover:text-white"
          >
            <ExternalLinkIcon className="w-4 h-4" />
            Open preview
          </Button>
        </div>
        <div className="flex items-center gap-2 text-sm text-[#888]">
          <MonitorIcon className="w-4 h-4" />
          <PhoneIcon className="w-4 h-4" />
          <span className="ml-2">
            {survey.settings?.estimatedDurationMinutes || "14-18"} min
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-1 bg-[#1a1a1a]">
        <div
          className="h-full bg-blue-500 transition-all duration-300"
          style={{
            width: totalQuestions > 0
              ? `${((currentQuestionIndex + 1) / totalQuestions) * 100}%`
              : "0%",
          }}
        />
      </div>

      {/* Preview Content */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-lg">
          {showWelcome ? (
            <WelcomePreview settings={survey.settings?.welcome} />
          ) : currentQuestion ? (
            <QuestionPreview question={currentQuestion} />
          ) : null}
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-[#2a2a2a]">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1a1a1a] rounded text-sm text-[#888]">
          Powered by <span className="font-semibold text-[#FF6B35]">Surveyor AI</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate(Math.max(-1, currentQuestionIndex - 1))}
            disabled={currentQuestionIndex <= -1}
            className="p-2 text-[#888] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeftIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => onNavigate(Math.min(totalQuestions - 1, currentQuestionIndex + 1))}
            disabled={currentQuestionIndex >= totalQuestions - 1}
            className="p-2 text-[#888] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRightIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Welcome Preview
interface WelcomePreviewProps {
  settings?: {
    title: string;
    message: string;
    showConsentCheckbox: boolean;
  };
}

function WelcomePreview({ settings }: WelcomePreviewProps) {
  return (
    <div className="text-center space-y-6">
      <h1 className="text-2xl font-semibold text-white">
        {settings?.title || "Welcome to this interview"}
      </h1>
      <p className="text-[#888]">
        {settings?.message || "Thank you for participating in this research. Please share your honest thoughts."}
      </p>
      <Button size="lg" className="w-full">
        Start Interview
      </Button>
    </div>
  );
}

// Question Preview
interface QuestionPreviewProps {
  question: SurveyQuestion;
}

function QuestionPreview({ question }: QuestionPreviewProps) {
  const settings = question.settings;

  return (
    <div className="space-y-8">
      {/* Question Text */}
      <h2 className="text-xl font-medium text-white leading-relaxed">
        {question.text}
      </h2>

      {/* Multiple Choice */}
      {question.type === "multiple_choice" && isMultipleChoiceSettings(settings) && (
        <div className="space-y-3">
          {settings.options.map((option) => (
            <button
              key={option.id}
              className="w-full px-4 py-3 text-left bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-400 hover:bg-blue-500/20 transition-colors"
            >
              {option.text}
            </button>
          ))}
          {settings.allowOther && (
            <button className="w-full px-4 py-3 text-left bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-400 hover:bg-blue-500/20 transition-colors">
              Other...
            </button>
          )}
        </div>
      )}

      {/* Open Ended */}
      {question.type === "open_ended" && isOpenEndedSettings(settings) && (
        <div className="flex flex-col items-center space-y-4">
          <button className="w-20 h-20 rounded-full bg-blue-500/20 flex items-center justify-center hover:bg-blue-500/30 transition-colors">
            <MicIcon className="w-8 h-8 text-blue-400" />
          </button>
          <span className="text-blue-400 font-medium">Start Recording</span>
          <button className="text-sm text-[#888] underline">Skip question</button>
          <div className="absolute bottom-24 right-8">
            <button className="p-2 text-[#888] hover:text-white">
              <KeyboardIcon className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}

      {/* Statement */}
      {question.type === "statement" && isStatementSettings(settings) && (
        <Button size="lg" className="w-full">
          {settings.continueButtonText || "Continue"}
        </Button>
      )}
    </div>
  );
}

// Icons
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

function MonitorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
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

function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
  );
}

function KeyboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
    </svg>
  );
}
