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
    <div className="w-full relative group">
      <input
        type="text"
        value={value}
        onInput={handleChange}
        placeholder="What would you like to research today?"
        className="w-full px-8 py-6 pr-20 bg-white border border-black/5 rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/20 focus:border-[#FF6B35]/50 text-[#1a1a1a] placeholder-[#888888] text-lg transition-all duration-300"
        aria-label="What would you like to research today?"
        disabled={isSubmitting}
      />
      <button
        type="submit"
        disabled={!value.trim() || isSubmitting}
        className="absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-[#FF6B35] text-white hover:bg-[#E55A2B] transition-all duration-200 flex items-center justify-center hover:scale-105 active:scale-95 shadow-lg shadow-[#FF6B35]/20 disabled:opacity-60 disabled:hover:scale-100"
        aria-label="Submit research prompt"
      >
        {isSubmitting ? (
          <span className="w-5 h-5 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
        ) : (
          <ArrowUp className="w-6 h-6 stroke-[2.5]" />
        )}
      </button>
    </div>
  );
}
