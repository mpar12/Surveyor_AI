import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import Waveform, { StaticWaveform } from "@/components/ui/Waveform";
import { AudioRecorder, formatDuration } from "@/lib/audioUtils";

interface VoiceRecorderProps {
  onRecordingComplete: (audioBlob: Blob, transcript?: string) => void;
  onSkip?: () => void;
  maxDurationSeconds?: number;
  showTextFallback?: boolean;
  onTextSubmit?: (text: string) => void;
}

type RecorderState = "idle" | "recording" | "recorded" | "playing";

export default function VoiceRecorder({
  onRecordingComplete,
  onSkip,
  maxDurationSeconds,
  showTextFallback = true,
  onTextSubmit,
}: VoiceRecorderProps) {
  const [state, setState] = useState<RecorderState>("idle");
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [playbackProgress, setPlaybackProgress] = useState(0);

  const recorderRef = useRef<AudioRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recorderRef.current) recorderRef.current.cancel();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const startRecording = async () => {
    try {
      setError(null);
      recorderRef.current = new AudioRecorder();
      await recorderRef.current.start();

      setAnalyser(recorderRef.current.getAnalyser());
      setState("recording");
      setDuration(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setDuration((d) => {
          const newDuration = d + 1;
          // Auto-stop at max duration
          if (maxDurationSeconds && newDuration >= maxDurationSeconds) {
            stopRecording();
          }
          return newDuration;
        });
      }, 1000);
    } catch (err) {
      setError("Could not access microphone. Please check permissions.");
      console.error("Recording error:", err);
    }
  };

  const stopRecording = async () => {
    if (!recorderRef.current) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      const blob = await recorderRef.current.stop();
      setAudioBlob(blob);

      const url = URL.createObjectURL(blob);
      setAudioUrl(url);

      setAnalyser(null);
      setState("recorded");
    } catch (err) {
      setError("Failed to stop recording");
      console.error("Stop recording error:", err);
    }
  };

  const playRecording = () => {
    if (!audioUrl) return;

    audioRef.current = new Audio(audioUrl);
    audioRef.current.onended = () => {
      setState("recorded");
      setPlaybackProgress(0);
    };
    audioRef.current.ontimeupdate = () => {
      if (audioRef.current) {
        setPlaybackProgress(
          audioRef.current.currentTime / audioRef.current.duration
        );
      }
    };
    audioRef.current.play();
    setState("playing");
  };

  const pausePlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setState("recorded");
    }
  };

  const reRecord = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    setPlaybackProgress(0);
    setState("idle");
  };

  const submitRecording = async () => {
    if (!audioBlob) return;

    setIsTranscribing(true);

    try {
      // Upload audio and get transcript
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");

      const uploadRes = await fetch("/api/upload-voice", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        throw new Error("Failed to upload audio");
      }

      const { url: voiceUrl, transcript } = await uploadRes.json();

      onRecordingComplete(audioBlob, transcript);
    } catch (err) {
      console.error("Submit error:", err);
      // Still submit even without transcript
      onRecordingComplete(audioBlob);
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleTextSubmit = () => {
    if (textInput.trim() && onTextSubmit) {
      onTextSubmit(textInput.trim());
    }
  };

  // Render text input mode
  if (showTextInput) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Type your response</span>
          <button
            onClick={() => setShowTextInput(false)}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            Switch to voice
          </button>
        </div>
        <textarea
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          rows={4}
          className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Type your response here..."
          autoFocus
        />
        <Button
          onClick={handleTextSubmit}
          disabled={!textInput.trim()}
          className="w-full"
        >
          Submit Response
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* Idle State - Start Recording */}
      {state === "idle" && (
        <div className="flex flex-col items-center space-y-4">
          <button
            onClick={startRecording}
            className="w-24 h-24 rounded-full bg-blue-100 flex items-center justify-center hover:bg-blue-200 transition-colors focus:outline-none focus:ring-4 focus:ring-blue-200"
          >
            <MicIcon className="w-10 h-10 text-blue-600" />
          </button>
          <span className="text-blue-600 font-medium">Start Recording</span>
          {maxDurationSeconds && (
            <span className="text-sm text-gray-400">
              Max {formatDuration(maxDurationSeconds)}
            </span>
          )}
        </div>
      )}

      {/* Recording State */}
      {state === "recording" && (
        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            <button
              onClick={stopRecording}
              className="w-24 h-24 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 transition-colors animate-pulse focus:outline-none"
            >
              <StopIcon className="w-10 h-10 text-white" />
            </button>
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full animate-ping" />
          </div>

          <Waveform
            analyser={analyser}
            isRecording={true}
            height={48}
            barCount={40}
            barActiveColor="#EF4444"
          />

          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-lg font-mono text-gray-900">
              {formatDuration(duration)}
            </span>
            {maxDurationSeconds && (
              <span className="text-gray-400">
                / {formatDuration(maxDurationSeconds)}
              </span>
            )}
          </div>

          <span className="text-sm text-gray-500">Click to stop recording</span>
        </div>
      )}

      {/* Recorded State - Review */}
      {(state === "recorded" || state === "playing") && audioUrl && (
        <div className="flex flex-col items-center space-y-4">
          <div className="flex items-center gap-4">
            <button
              onClick={state === "playing" ? pausePlayback : playRecording}
              className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center hover:bg-blue-200 transition-colors"
            >
              {state === "playing" ? (
                <PauseIcon className="w-8 h-8 text-blue-600" />
              ) : (
                <PlayIcon className="w-8 h-8 text-blue-600 ml-1" />
              )}
            </button>
          </div>

          <StaticWaveform
            audioUrl={audioUrl}
            progress={playbackProgress}
            height={48}
            barCount={40}
          />

          <span className="text-sm text-gray-500">
            {formatDuration(duration)} recorded
          </span>

          <div className="flex items-center gap-3 w-full max-w-xs">
            <Button
              variant="outline"
              onClick={reRecord}
              className="flex-1"
              disabled={isTranscribing}
            >
              <RedoIcon className="w-4 h-4" />
              Re-record
            </Button>
            <Button
              onClick={submitRecording}
              className="flex-1"
              disabled={isTranscribing}
            >
              {isTranscribing ? (
                <>
                  <SpinnerIcon className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckIcon className="w-4 h-4" />
                  Submit
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Skip & Text Fallback */}
      <div className="flex items-center justify-center gap-4 pt-4 border-t border-gray-100">
        {onSkip && (
          <button
            onClick={onSkip}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Skip question
          </button>
        )}
        {showTextFallback && (
          <button
            onClick={() => setShowTextInput(true)}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            title="Type instead"
          >
            <KeyboardIcon className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}

// Icons
function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
  );
}

function StopIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

function RedoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function KeyboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
    </svg>
  );
}
