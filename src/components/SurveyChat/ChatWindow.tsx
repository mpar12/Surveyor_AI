import { useRef, useEffect } from "react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface ChatWindowProps {
  messages: ChatMessage[];
  isLoading: boolean;
}

export default function ChatWindow({ messages, isLoading }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0a0a0a]">
      {messages.length === 0 && (
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
            <SparklesIcon className="w-8 h-8 text-green-400" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">
            Let&apos;s create your study guide
          </h3>
          <p className="text-[#888] max-w-md mx-auto">
            Tell me about your research goals, target audience, and what you want to learn.
            I&apos;ll help you create an effective interview guide.
          </p>
        </div>
      )}

      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}

      {isLoading && (
        <div className="flex items-center gap-3 px-4">
          <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
            <SparklesIcon className="w-4 h-4 text-white" />
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-[#666] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="w-2 h-2 bg-[#666] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="w-2 h-2 bg-[#666] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  const renderInlineText = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
        return <strong key={`bold-${index}`}>{part.slice(2, -2)}</strong>;
      }
      return <span key={`text-${index}`}>{part}</span>;
    });
  };

  const renderAssistantContent = (content: string) => {
    type Block =
      | { type: "heading"; text: string }
      | { type: "paragraph"; text: string }
      | { type: "list"; items: string[] };

    const blocks: Block[] = [];
    let paragraphLines: string[] = [];
    let listItems: string[] = [];

    const flushParagraph = () => {
      if (paragraphLines.length) {
        blocks.push({ type: "paragraph", text: paragraphLines.join("\n") });
        paragraphLines = [];
      }
    };

    const flushList = () => {
      if (listItems.length) {
        blocks.push({ type: "list", items: listItems });
        listItems = [];
      }
    };

    const lines = content.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        flushParagraph();
        flushList();
        continue;
      }

      if (trimmed.startsWith("##")) {
        flushParagraph();
        flushList();
        blocks.push({
          type: "heading",
          text: trimmed.replace(/^##\s*/, "").trim(),
        });
        continue;
      }

      const listMatch = trimmed.match(/^(?:[-*]|\u2022)\s+(.+)/);
      if (listMatch) {
        flushParagraph();
        listItems.push(listMatch[1]);
        continue;
      }

      flushList();
      paragraphLines.push(trimmed);
    }

    flushParagraph();
    flushList();

    return (
      <div className="space-y-2">
        {blocks.map((block, index) => {
          if (block.type === "heading") {
            return (
              <h4 key={`heading-${index}`} className="text-sm font-semibold text-white">
                {renderInlineText(block.text)}
              </h4>
            );
          }

          if (block.type === "list") {
            return (
              <ul key={`list-${index}`} className="list-disc pl-5 text-sm text-white space-y-1">
                {block.items.map((item, itemIndex) => (
                  <li key={`list-item-${index}-${itemIndex}`}>
                    {renderInlineText(item)}
                  </li>
                ))}
              </ul>
            );
          }

          return (
            <p key={`paragraph-${index}`} className="text-sm text-white whitespace-pre-wrap">
              {renderInlineText(block.text)}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <div className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser ? "bg-[#333]" : "bg-green-500"
        }`}
      >
        {isUser ? (
          <UserIcon className="w-4 h-4 text-white" />
        ) : (
          <SparklesIcon className="w-4 h-4 text-white" />
        )}
      </div>
      <div
        className={`max-w-[80%] px-4 py-3 rounded-2xl ${
          isUser
            ? "bg-[#333] text-white rounded-tr-md"
            : "bg-[#111] text-white border border-[#2a2a2a] rounded-tl-md"
        }`}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          renderAssistantContent(message.content)
        )}
      </div>
    </div>
  );
}

// Icons
function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
      />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
      />
    </svg>
  );
}
