import { useState, KeyboardEvent } from "react";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function ChatInput({ onSend, disabled, placeholder }: ChatInputProps) {
  const [message, setMessage] = useState("");

  const handleSubmit = () => {
    if (!message.trim() || disabled) return;
    onSend(message.trim());
    setMessage("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-[#2a2a2a] p-4 bg-[#0a0a0a]">
      <div className="flex items-end gap-3 bg-[#111] rounded-xl p-2 border border-[#2a2a2a]">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder || "Describe your research goals..."}
          rows={1}
          className="flex-1 bg-transparent text-white text-sm resize-none outline-none px-2 py-1 max-h-32 placeholder-[#666]"
          style={{ minHeight: "36px" }}
        />
        <button
          onClick={handleSubmit}
          disabled={!message.trim() || disabled}
          className="p-2 bg-[#FF6B35] rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#FF6B35]/90 transition-colors"
        >
          <SendIcon className="w-4 h-4" />
        </button>
      </div>
      <p className="text-xs text-[#666] mt-2 px-2">
        Press Enter to send, Shift+Enter for new line
      </p>
    </div>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
      />
    </svg>
  );
}
