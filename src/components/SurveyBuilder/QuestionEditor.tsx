import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import type {
  SurveyQuestion,
  QuestionType,
  MultipleChoiceSettings,
  OpenEndedSettings,
  StatementSettings,
  MultipleChoiceOption,
  FollowUpMode,
} from "@/types/surveyBuilder";
import {
  isMultipleChoiceSettings,
  isOpenEndedSettings,
  isStatementSettings,
  defaultMultipleChoiceSettings,
  defaultOpenEndedSettings,
  defaultStatementSettings,
} from "@/types/surveyBuilder";

interface QuestionEditorProps {
  question: SurveyQuestion;
  onUpdate: (updates: Partial<SurveyQuestion>) => void;
  onClose: () => void;
}

export default function QuestionEditor({ question, onUpdate, onClose }: QuestionEditorProps) {
  const [text, setText] = useState(question.text);
  const [type, setType] = useState<QuestionType>(question.type as QuestionType);
  const [settings, setSettings] = useState(question.settings);

  // Reset state when question changes
  useEffect(() => {
    setText(question.text);
    setType(question.type as QuestionType);
    setSettings(question.settings);
  }, [question.id, question.text, question.type, question.settings]);

  const handleTextBlur = () => {
    if (text !== question.text) {
      onUpdate({ text });
    }
  };

  const handleTypeChange = (newType: QuestionType) => {
    setType(newType);
    // Get default settings for new type
    let newSettings;
    switch (newType) {
      case "multiple_choice":
        newSettings = defaultMultipleChoiceSettings;
        break;
      case "open_ended":
        newSettings = defaultOpenEndedSettings;
        break;
      case "statement":
        newSettings = defaultStatementSettings;
        break;
    }
    setSettings(newSettings);
    onUpdate({ type: newType, settings: newSettings });
  };

  const handleSettingsUpdate = (newSettings: typeof settings) => {
    setSettings(newSettings);
    onUpdate({ settings: newSettings });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
        <h3 className="text-white font-medium">Edit Question</h3>
        <button onClick={onClose} className="text-[#888] hover:text-white transition-colors">
          <XIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Question Type */}
        <div>
          <label className="text-xs text-[#888] uppercase tracking-wider">Question Type</label>
          <select
            value={type}
            onChange={(e) => handleTypeChange(e.target.value as QuestionType)}
            className="w-full mt-2 px-3 py-2 bg-[#111] border border-[#2a2a2a] rounded text-white text-sm"
          >
            <option value="multiple_choice">Multiple Choice</option>
            <option value="open_ended">Open-Ended</option>
            <option value="statement">Statement</option>
          </select>
        </div>

        {/* Question Text */}
        <div>
          <label className="text-xs text-[#888] uppercase tracking-wider">Question</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={handleTextBlur}
            rows={3}
            className="w-full mt-2 px-3 py-2 bg-[#111] border border-[#2a2a2a] rounded text-white text-sm resize-none"
            placeholder="Enter your question..."
          />
        </div>

        {/* Type-specific settings */}
        {type === "multiple_choice" && (
          <MultipleChoiceEditor
            settings={isMultipleChoiceSettings(settings) ? settings : defaultMultipleChoiceSettings}
            onUpdate={handleSettingsUpdate}
          />
        )}

        {type === "open_ended" && (
          <OpenEndedEditor
            settings={isOpenEndedSettings(settings) ? settings : defaultOpenEndedSettings}
            onUpdate={handleSettingsUpdate}
          />
        )}

        {type === "statement" && (
          <StatementEditor
            settings={isStatementSettings(settings) ? settings : defaultStatementSettings}
            onUpdate={handleSettingsUpdate}
          />
        )}
      </div>
    </div>
  );
}

// Multiple Choice Editor
interface MultipleChoiceEditorProps {
  settings: MultipleChoiceSettings;
  onUpdate: (settings: MultipleChoiceSettings) => void;
}

function MultipleChoiceEditor({ settings, onUpdate }: MultipleChoiceEditorProps) {
  const [options, setOptions] = useState(settings.options);

  const handleOptionChange = (index: number, text: string) => {
    const newOptions = [...options];
    newOptions[index] = { ...newOptions[index], text };
    setOptions(newOptions);
  };

  const handleOptionBlur = () => {
    onUpdate({ ...settings, options });
  };

  const handleAddOption = () => {
    const newOptions = [
      ...options,
      { id: crypto.randomUUID(), text: `Option ${options.length + 1}`, isOther: false },
    ];
    setOptions(newOptions);
    onUpdate({ ...settings, options: newOptions });
  };

  const handleRemoveOption = (index: number) => {
    const newOptions = options.filter((_, i) => i !== index);
    setOptions(newOptions);
    onUpdate({ ...settings, options: newOptions });
  };

  return (
    <div className="space-y-4">
      {/* Options */}
      <div>
        <label className="text-xs text-[#888] uppercase tracking-wider">Options</label>
        <div className="mt-2 space-y-2">
          {options.map((option, index) => (
            <div key={option.id} className="flex items-center gap-2">
              <DragHandle className="w-4 h-4 text-[#444] cursor-grab" />
              <input
                type="text"
                value={option.text}
                onChange={(e) => handleOptionChange(index, e.target.value)}
                onBlur={handleOptionBlur}
                className="flex-1 px-3 py-2 bg-[#111] border border-[#2a2a2a] rounded text-white text-sm"
              />
              <button
                onClick={() => handleRemoveOption(index)}
                className="p-2 text-[#666] hover:text-red-400 transition-colors"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={handleAddOption}
          className="mt-2 text-sm text-[#FF6B35] hover:text-[#FF6B35]/80"
        >
          + Add another option
        </button>
      </div>

      {/* Settings */}
      <div className="space-y-3 pt-4 border-t border-[#2a2a2a]">
        <div className="flex items-center justify-between">
          <span className="text-sm text-white">Multi-select</span>
          <Toggle
            checked={settings.selectionMode === "multiple"}
            onChange={(checked) =>
              onUpdate({ ...settings, selectionMode: checked ? "multiple" : "single" })
            }
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-white">Show &quot;Other&quot; option</span>
          <Toggle
            checked={settings.allowOther}
            onChange={(checked) => onUpdate({ ...settings, allowOther: checked })}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-white">Randomize order</span>
          <Toggle
            checked={settings.randomizeOrder}
            onChange={(checked) => onUpdate({ ...settings, randomizeOrder: checked })}
          />
        </div>
      </div>
    </div>
  );
}

// Open Ended Editor
interface OpenEndedEditorProps {
  settings: OpenEndedSettings;
  onUpdate: (settings: OpenEndedSettings) => void;
}

function OpenEndedEditor({ settings, onUpdate }: OpenEndedEditorProps) {
  return (
    <div className="space-y-4">
      {/* Follow-up questions */}
      <div>
        <label className="text-xs text-[#888] uppercase tracking-wider">Follow-up Questions</label>
        <select
          value={settings.followUpMode}
          onChange={(e) => onUpdate({ ...settings, followUpMode: e.target.value as FollowUpMode })}
          className="w-full mt-2 px-3 py-2 bg-[#111] border border-[#2a2a2a] rounded text-white text-sm"
        >
          <option value="none">None</option>
          <option value="if_short">If short answer</option>
          <option value="always">Always</option>
        </select>
      </div>

      {/* Preferred input type */}
      <div>
        <label className="text-xs text-[#888] uppercase tracking-wider">Preferred Input Type</label>
        <select
          value={settings.preferredInput}
          onChange={(e) =>
            onUpdate({ ...settings, preferredInput: e.target.value as "voice" | "text" })
          }
          className="w-full mt-2 px-3 py-2 bg-[#111] border border-[#2a2a2a] rounded text-white text-sm"
        >
          <option value="voice">Default (voice)</option>
          <option value="text">Text</option>
        </select>
      </div>

      {/* Follow-up guidelines */}
      {settings.followUpMode !== "none" && (
        <div>
          <label className="text-xs text-[#888] uppercase tracking-wider">
            Guidelines for Follow-up Questions
          </label>
          <textarea
            value={settings.followUpGuidelines || ""}
            onChange={(e) => onUpdate({ ...settings, followUpGuidelines: e.target.value })}
            rows={2}
            className="w-full mt-2 px-3 py-2 bg-[#111] border border-[#2a2a2a] rounded text-white text-sm resize-none"
            placeholder="If they mention A, understand why."
          />
        </div>
      )}

      {/* Max duration */}
      <div>
        <label className="text-xs text-[#888] uppercase tracking-wider">Max Duration (seconds)</label>
        <input
          type="number"
          value={settings.maxDurationSeconds || ""}
          onChange={(e) =>
            onUpdate({
              ...settings,
              maxDurationSeconds: e.target.value ? parseInt(e.target.value) : undefined,
            })
          }
          className="w-full mt-2 px-3 py-2 bg-[#111] border border-[#2a2a2a] rounded text-white text-sm"
          placeholder="No limit"
        />
      </div>
    </div>
  );
}

// Statement Editor
interface StatementEditorProps {
  settings: StatementSettings;
  onUpdate: (settings: StatementSettings) => void;
}

function StatementEditor({ settings, onUpdate }: StatementEditorProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-[#888] uppercase tracking-wider">Continue Button Text</label>
        <input
          type="text"
          value={settings.continueButtonText}
          onChange={(e) => onUpdate({ ...settings, continueButtonText: e.target.value })}
          className="w-full mt-2 px-3 py-2 bg-[#111] border border-[#2a2a2a] rounded text-white text-sm"
          placeholder="Continue"
        />
      </div>
    </div>
  );
}

// Toggle Component
function Toggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-6 rounded-full transition-colors ${
        checked ? "bg-[#FF6B35]" : "bg-[#333]"
      }`}
    >
      <span
        className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
          checked ? "left-5" : "left-1"
        }`}
      />
    </button>
  );
}

// Icons
function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
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
