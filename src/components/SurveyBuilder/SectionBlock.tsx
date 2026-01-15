import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { SurveySectionWithQuestions, SurveyQuestion, QuestionType } from "@/types/surveyBuilder";

interface SectionBlockProps {
  section: SurveySectionWithQuestions;
  selectedQuestionId?: string;
  onSelectQuestion: (question: SurveyQuestion) => void;
  onAddQuestion: (type: QuestionType) => void;
  onUpdateQuestion: (questionId: string, updates: Partial<SurveyQuestion>) => void;
  onDeleteQuestion: (questionId: string) => void;
  onUpdateSection: (sectionId: string, updates: { title?: string; description?: string }) => void;
  onDeleteSection: (sectionId: string) => void;
}

export default function SectionBlock({
  section,
  selectedQuestionId,
  onSelectQuestion,
  onAddQuestion,
  onUpdateQuestion,
  onDeleteQuestion,
  onUpdateSection,
  onDeleteSection,
}: SectionBlockProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(section.title);
  const [showAddMenu, setShowAddMenu] = useState(false);

  const handleTitleSave = () => {
    if (editTitle.trim() !== section.title) {
      onUpdateSection(section.id, { title: editTitle.trim() });
    }
    setIsEditing(false);
  };

  return (
    <div className="bg-[#111] border border-[#2a2a2a] rounded-lg overflow-hidden">
      {/* Section Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-[#666] hover:text-white transition-colors"
          >
            <ChevronIcon className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
          </button>
          <DragHandle className="w-4 h-4 text-[#444] cursor-grab" />
          {isEditing ? (
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={(e) => e.key === "Enter" && handleTitleSave()}
              autoFocus
              className="bg-transparent text-white font-medium border-b border-[#FF6B35] outline-none"
            />
          ) : (
            <span
              className="text-white font-medium cursor-pointer hover:text-[#FF6B35]"
              onClick={() => setIsEditing(true)}
            >
              {section.title}
            </span>
          )}
          <span className="text-xs text-[#666]">
            {section.questions.length} question{section.questions.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onDeleteSection(section.id)}
            className="p-1 text-[#666] hover:text-red-400 transition-colors"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Questions */}
      {isExpanded && (
        <div className="p-2 space-y-2">
          {section.questions.map((question, index) => (
            <QuestionRow
              key={question.id}
              question={question}
              index={index}
              isSelected={question.id === selectedQuestionId}
              onSelect={() => onSelectQuestion(question)}
              onDelete={() => onDeleteQuestion(question.id)}
            />
          ))}

          {/* Add Question Button */}
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="w-full justify-center text-[#888] hover:text-white hover:bg-[#1a1a1a]"
            >
              <PlusIcon className="w-4 h-4" />
              Add Question
            </Button>

            {showAddMenu && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden z-10">
                <button
                  onClick={() => {
                    onAddQuestion("multiple_choice");
                    setShowAddMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-[#888] hover:text-white hover:bg-[#2a2a2a] flex items-center gap-2"
                >
                  <ListIcon className="w-4 h-4" />
                  Multiple Choice
                </button>
                <button
                  onClick={() => {
                    onAddQuestion("open_ended");
                    setShowAddMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-[#888] hover:text-white hover:bg-[#2a2a2a] flex items-center gap-2"
                >
                  <MicIcon className="w-4 h-4" />
                  Open-Ended
                </button>
                <button
                  onClick={() => {
                    onAddQuestion("statement");
                    setShowAddMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-[#888] hover:text-white hover:bg-[#2a2a2a] flex items-center gap-2"
                >
                  <TextIcon className="w-4 h-4" />
                  Statement
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Question Row Component
interface QuestionRowProps {
  question: SurveyQuestion;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function QuestionRow({ question, index, isSelected, onSelect, onDelete }: QuestionRowProps) {
  const typeIcons: Record<string, JSX.Element> = {
    multiple_choice: <ListIcon className="w-4 h-4" />,
    open_ended: <MicIcon className="w-4 h-4" />,
    statement: <TextIcon className="w-4 h-4" />,
  };

  const typeLabels: Record<string, string> = {
    multiple_choice: "MC",
    open_ended: "OE",
    statement: "ST",
  };

  return (
    <div
      onClick={onSelect}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
        isSelected
          ? "bg-[#FF6B35]/10 border border-[#FF6B35]/30"
          : "hover:bg-[#1a1a1a] border border-transparent"
      }`}
    >
      <DragHandle className="w-4 h-4 text-[#444] cursor-grab" />
      <div className={`flex items-center justify-center w-6 h-6 rounded text-xs font-medium ${
        isSelected ? "bg-[#FF6B35] text-white" : "bg-[#2a2a2a] text-[#888]"
      }`}>
        Q{index + 1}
      </div>
      <span className="flex-1 text-sm text-white truncate">{question.text}</span>
      <span className="text-xs text-[#666] flex items-center gap-1">
        {typeIcons[question.type]}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="p-1 text-[#666] hover:text-red-400 transition-colors"
      >
        <TrashIcon className="w-3 h-3" />
      </button>
    </div>
  );
}

// Icons
function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

function DragHandle({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
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

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

function ListIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
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

function TextIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16m-7 6h7" />
    </svg>
  );
}
