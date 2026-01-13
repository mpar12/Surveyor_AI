import { ArrowUp } from "lucide-react";
import type { ChangeEvent } from "react";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  isSubmitting: boolean;
}

export function ChatInput({ value, onChange, isSubmitting }: ChatInputProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.currentTarget.value);
  };

  return (
    <div className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden">
      {/* Terminal header with tabs */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#2a2a2a]">
        <span className="text-xs text-[#555] tracking-wide px-2 py-1 rounded bg-transparent">
          VOICE INTERVIEW
        </span>
        <span className="text-xs text-white tracking-wide px-2 py-1 rounded bg-[#222] border border-[#333]">
          TEXT PROMPT
        </span>
      </div>

      {/* Input area */}
      <div className="flex items-center px-4 py-4">
        <span className="text-[#FF6B35] mr-3 font-mono text-lg">&gt;</span>
        <input
          type="text"
          value={value}
          onInput={handleChange}
          placeholder="What would you like to research today?"
          className="flex-1 bg-transparent text-white placeholder-[#555] text-base focus:outline-none font-mono"
          aria-label="What would you like to research today?"
          disabled={isSubmitting}
        />
        <button
          type="submit"
          disabled={!value.trim() || isSubmitting}
          className="ml-3 w-9 h-9 rounded-lg bg-[#1a1a1a] border border-[#333] text-[#888] hover:text-white hover:border-[#444] transition-all duration-200 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Submit research prompt"
        >
          {isSubmitting ? (
            <span className="w-4 h-4 border-2 border-[#555] border-t-transparent rounded-full animate-spin" />
          ) : (
            <ArrowUp className="w-4 h-4 stroke-[2]" />
          )}
        </button>
      </div>
    </div>
  );
}
