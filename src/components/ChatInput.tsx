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
      {/* Glow effect on focus */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-[#FF6B35]/20 via-[#FF6B35]/10 to-[#FF6B35]/20 rounded-full opacity-0 group-focus-within:opacity-100 blur-xl transition-opacity duration-500" />

      <div className="relative">
        <input
          type="text"
          value={value}
          onInput={handleChange}
          placeholder="What would you like to research today?"
          className="w-full px-6 py-5 pr-16 bg-[#141414] border border-[#2a2a2a] rounded-full text-white placeholder-[#6b6b6b] text-lg transition-all duration-300 focus:outline-none focus:border-[#FF6B35]/50 focus:shadow-[0_0_30px_rgba(255,107,53,0.15)] hover:border-[#3a3a3a]"
          aria-label="What would you like to research today?"
          disabled={isSubmitting}
        />
        <button
          type="submit"
          disabled={!value.trim() || isSubmitting}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-[#FF6B35] text-white hover:bg-[#FF8555] transition-all duration-200 flex items-center justify-center hover:scale-105 active:scale-95 shadow-lg shadow-[#FF6B35]/20 disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed"
          aria-label="Submit research prompt"
        >
          {isSubmitting ? (
            <span className="w-5 h-5 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
          ) : (
            <ArrowUp className="w-5 h-5 stroke-[2.5]" />
          )}
        </button>
      </div>
    </div>
  );
}
