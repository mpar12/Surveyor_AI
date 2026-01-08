import { ArrowUp } from "lucide-react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  isSubmitting: boolean;
  placeholder?: string;
  className?: string;
}

export function ChatInput({
  value,
  onChange,
  isSubmitting,
  placeholder = "What would you like to research today?",
  className
}: ChatInputProps) {
  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.currentTarget.value);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
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
    <div
      className={cn(
        "w-full relative group",
        "rounded-2xl",
        "bg-surface",
        "border border-border",
        "shadow-lg hover:shadow-xl",
        "transition-all duration-300",
        "focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20",
        "hover:border-border-strong",
        className
      )}
    >
      {/* Gradient glow effect on focus */}
      <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 opacity-0 group-focus-within:opacity-100 blur-sm transition-opacity duration-300 -z-10" />

      <textarea
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={1}
        className={cn(
          "w-full min-h-[64px] max-h-[200px]",
          "px-6 py-5 pr-16",
          "bg-transparent",
          "text-foreground text-lg",
          "placeholder:text-foreground-muted",
          "resize-none",
          "focus:outline-none",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
        style={{
          height: "auto",
          overflow: "hidden"
        }}
        onInput={(e) => {
          const target = e.currentTarget;
          target.style.height = "auto";
          target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
        }}
        aria-label={placeholder}
        disabled={isSubmitting}
      />

      <button
        type="submit"
        disabled={!value.trim() || isSubmitting}
        className={cn(
          "absolute right-3 bottom-3",
          "w-12 h-12",
          "rounded-xl",
          "bg-gradient-to-r from-primary to-accent",
          "text-white",
          "flex items-center justify-center",
          "transition-all duration-200",
          "hover:shadow-lg hover:shadow-primary/30",
          "hover:scale-105 active:scale-95",
          "disabled:opacity-40 disabled:hover:scale-100 disabled:hover:shadow-none",
          "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2"
        )}
        aria-label="Submit research prompt"
      >
        {isSubmitting ? (
          <span className="w-5 h-5 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
        ) : (
          <ArrowUp className="w-5 h-5 stroke-[2.5]" />
        )}
      </button>
    </div>
  );
}
