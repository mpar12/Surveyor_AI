import { useState } from "react";
import { Button } from "@/components/ui/button";
import VoiceRecorder from "./VoiceRecorder";

interface FollowupChatProps {
  followupId: string;
  questionText: string;
  surveyId: string;
  responseId: string;
  onComplete: () => void;
  onSkip: () => void;
  allowVoice?: boolean;
}

type AnswerMode = "voice" | "text";

export default function FollowupChat({
  followupId,
  questionText,
  surveyId,
  responseId,
  onComplete,
  onSkip,
  allowVoice = true,
}: FollowupChatProps) {
  const [mode, setMode] = useState<AnswerMode>("voice");
  const [textInput, setTextInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitFollowupAnswer = async (answerType: string, textValue: string, voiceUrl?: string) => {
    setIsSubmitting(true);

    try {
      await fetch(`/api/surveys/${surveyId}/responses/${responseId}/followups`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          followupId,
          answerType,
          textValue,
          voiceUrl,
        }),
      });

      onComplete();
    } catch (error) {
      console.error("Failed to submit follow-up answer:", error);
      onComplete(); // Continue anyway
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVoiceComplete = async (audioBlob: Blob, transcript?: string) => {
    // Upload the voice recording
    const formData = new FormData();
    formData.append("audio", audioBlob, "recording.webm");

    try {
      const uploadRes = await fetch("/api/upload-voice", {
        method: "POST",
        body: formData,
      });

      let voiceUrl = "";
      let finalTranscript = transcript || "";

      if (uploadRes.ok) {
        const uploadData = await uploadRes.json();
        voiceUrl = uploadData.url;
        finalTranscript = uploadData.transcript || finalTranscript;
      }

      await submitFollowupAnswer("voice", finalTranscript, voiceUrl);
    } catch (error) {
      console.error("Failed to upload voice:", error);
      onComplete();
    }
  };

  const handleTextSubmit = () => {
    if (textInput.trim()) {
      submitFollowupAnswer("text", textInput.trim());
    }
  };

  return (
    <div className="bg-blue-50 rounded-lg p-6 space-y-4 animate-fadeIn">
      {/* Follow-up question in chat bubble style */}
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
          <BotIcon className="w-4 h-4 text-white" />
        </div>
        <div className="bg-white rounded-lg rounded-tl-none px-4 py-3 shadow-sm max-w-md">
          <p className="text-gray-800">{questionText}</p>
        </div>
      </div>

      {/* Answer input */}
      <div className="pl-11">
        {mode === "voice" && allowVoice ? (
          <VoiceRecorder
            onRecordingComplete={handleVoiceComplete}
            onSkip={onSkip}
            onTextSubmit={(text) => submitFollowupAnswer("text", text)}
            showTextFallback={true}
            maxDurationSeconds={120}
          />
        ) : (
          <div className="space-y-3">
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Type your response..."
              disabled={isSubmitting}
            />
            <div className="flex items-center gap-3">
              <Button
                onClick={handleTextSubmit}
                disabled={!textInput.trim() || isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? "Submitting..." : "Submit"}
              </Button>
              <button
                onClick={onSkip}
                className="text-sm text-gray-500 hover:text-gray-700"
                disabled={isSubmitting}
              >
                Skip
              </button>
              {allowVoice && (
                <button
                  onClick={() => setMode("voice")}
                  className="p-2 text-gray-400 hover:text-gray-600"
                  title="Switch to voice"
                >
                  <MicIcon className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Icons
function BotIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
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
