import { ArrowRight } from "lucide-react";
import type { ChangeEvent, KeyboardEvent } from "react";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  isSubmitting: boolean;
  placeholder?: string;
}

export function ChatInput({
  value,
  onChange,
  isSubmitting,
  placeholder = "What would you like to research today?"
}: ChatInputProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.currentTarget.value);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (value.trim() && !isSubmitting) {
        const form = event.currentTarget.closest("form");
        if (form) {
          form.requestSubmit();
        }
      }
    }
  };

  return (
    <div className="w-full relative">
      <input
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full h-[52px] px-4 pr-14 bg-[#FAFAF9] border border-[#E0E0DE] rounded-xl text-[15px] text-[#1a1a1a] placeholder-[#9a9a9a] transition-all duration-200 focus:outline-none focus:border-[#D4613A] focus:ring-2 focus:ring-[#D4613A]/10 hover:border-[#CCCCC9]"
        aria-label={placeholder}
        disabled={isSubmitting}
      />
      <button
        type="submit"
        disabled={!value.trim() || isSubmitting}
        className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg bg-[#1a1a1a] text-white flex items-center justify-center transition-all duration-200 hover:bg-[#333] disabled:opacity-40 disabled:hover:bg-[#1a1a1a]"
        aria-label="Submit research prompt"
      >
        {isSubmitting ? (
          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <ArrowRight className="w-4 h-4" />
        )}
      </button>
    </div>
  );
}
